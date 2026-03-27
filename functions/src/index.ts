/**
 * Cloud Functions — postulación pública (sin Auth).
 * Admin SDK escribe en Firestore; las reglas bloquean create desde el cliente.
 *
 * Mejoras de seguridad aplicadas:
 * - App Check (enforceAppCheck) para evitar abuso automatizado
 * - Validación de payload con Zod (en lugar de `as` type assertions)
 * - Recibe rutas de Storage (no URLs); genera URLs de descarga con Admin SDK
 */
import './functionsInit'
import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'

import type {
  DocumentosSubidos,
  PostulanteData,
  PostulanteRechazadoEntrada,
  RechazoEntradaCode,
} from '../../src/types/postulante'
import { calcularPuntajeTotal } from '../../src/postulacion/shared/scoring'
import {
  evaluarReglasPostulacion,
  rutNormalizadoPostulacion,
  validarDocumentosPresentes,
  validarPathsStorage,
} from '../../src/postulacion/shared/businessRules'
import { normalizeRut, rutTieneFormatoMinimo, validarRutMatematico } from '../../src/postulacion/shared/rut'
import { CrearPostulacionPayloadSchema } from '../../src/postulacion/shared/payloadValidation'
import { webCallableBase } from './httpsCallableDefaults'
import { enqueueRechazoEntradaMail } from './triggerEmailRechazoEntrada'

if (!admin.apps.length) {
  admin.initializeApp()
}

function etiquetaRechazoEntrada(code: RechazoEntradaCode): string {
  switch (code) {
    case 'edad':
      return 'Fuera de rango de edad'
    case 'nem':
      return 'NEM insuficiente'
    case 'historical':
      return 'Beneficiario de procesos anteriores'
    case 'duplicate':
      return 'Postulación duplicada'
    case 'rut_invalido':
      return 'RUT inválido'
    case 'declaracion':
      return 'Declaración jurada no aceptada'
    default:
      return 'Rechazo de entrada'
  }
}

function toRechazoEntradaCode(code: string): RechazoEntradaCode {
  switch (code) {
    case 'edad':
    case 'nem':
    case 'historical':
    case 'duplicate':
    case 'rut_invalido':
    case 'declaracion':
      return code
    default:
      return 'desconocido'
  }
}

async function registrarRechazoEntradaEnFirestore(
  db: admin.firestore.Firestore,
  data: PostulanteData,
  code: RechazoEntradaCode,
  message: string,
  source: 'verificacion' | 'creacion' | 'frontend',
): Promise<void> {
  const rutNormalizado = normalizeRut(String(data.rut || '').trim())
  const now = new Date().toISOString()
  const registro: PostulanteRechazadoEntrada = {
    ...data,
    rutNormalizado,
    rejectionCode: code,
    rejectionLabel: etiquetaRechazoEntrada(code),
    rejectionMessage: message,
    rejectionFlags: {
      edad: code === 'edad',
      nem: code === 'nem',
      historical: code === 'historical',
      duplicate: code === 'duplicate',
    },
    source,
    createdAt: now,
    updatedAt: now,
  }
  await db.collection('postulantes_rechazados_entrada').doc(rutNormalizado).set(registro, { merge: true })
  await enqueueRechazoEntradaMail(db, registro)
}

/**
 * Genera la URL de descarga de Firebase Storage a partir de una ruta.
 * Usa el token de descarga que Firebase crea automáticamente al subir un archivo.
 */
async function generarUrlDescarga(storagePath: string): Promise<string> {
  const bucket = admin.storage().bucket()
  const file = bucket.file(storagePath)

  const [exists] = await file.exists()
  if (!exists) {
    throw new HttpsError('not-found', `El documento no fue encontrado: ${storagePath}`)
  }

  const [metadata] = await file.getMetadata()
  const downloadToken = (metadata.metadata as Record<string, string> | undefined)
    ?.firebaseStorageDownloadTokens

  if (!downloadToken) {
    // Si no hay token (poco probable si se subió con el SDK), creamos uno
    const newToken = crypto.randomUUID()
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: newToken } })
    const encodedPath = encodeURIComponent(storagePath)
    return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${newToken}`
  }

  const encodedPath = encodeURIComponent(storagePath)
  return `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`
}

/**
 * Genera URLs de descarga para múltiples rutas de Storage.
 */
async function generarUrlsDescarga(
  documentPaths: Record<string, string>,
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}

  await Promise.all(
    Object.entries(documentPaths).map(async ([key, storagePath]) => {
      urls[key] = await generarUrlDescarga(storagePath)
    }),
  )

  return urls
}

// ─── Cloud Functions ───

export const verificarElegibilidadPostulacion = onCall(
  {
    ...webCallableBase(),
    memory: '256MiB',
    timeoutSeconds: 15,
    maxInstances: 30,
  },
  async (request) => {
    try {
      const rut = request.data?.rut
      if (typeof rut !== 'string' || !rut.trim()) {
        throw new HttpsError('invalid-argument', 'El RUT enviado no es válido.')
      }
      
      // Validar matemáticamente
      if (!validarRutMatematico(rut.trim())) {
        throw new HttpsError('invalid-argument', 'El RUT enviado no es válido (dígito verificador incorrecto).')
      }
      
      const norm = normalizeRut(rut.trim())

      console.log(`Verificando elegibilidad para: ${norm}`)
      const db = admin.firestore()
      
      const [hist, post] = await Promise.all([
        db.collection('historical_ruts').doc(norm).get(),
        db.collection('postulantes').doc(norm).get(),
      ])

      if (hist.exists) return { ok: false as const, code: 'historical' as const }
      if (post.exists) return { ok: false as const, code: 'duplicate' as const }

      return { ok: true as const }
    } catch (error) {
      console.error('Error en verificarElegibilidadPostulacion:', error)
      if (error instanceof HttpsError) throw error
      throw new HttpsError('internal', 'Error interno al verificar elegibilidad.')
    }
  },
)

export const registrarPostulanteRechazadoEntrada = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 20, maxInstances: 20 },
  async (request) => {
    const payload = request.data as { data?: PostulanteData; reason?: string; message?: string }
    const data = payload?.data
    if (!data || typeof data !== 'object' || !rutTieneFormatoMinimo(String((data as PostulanteData).rut || ''))) {
      throw new HttpsError('invalid-argument', 'Datos del postulante inválidos para registrar rechazo.')
    }

    const db = admin.firestore()
    const reglas = evaluarReglasPostulacion(data)
    let reason: RechazoEntradaCode = 'desconocido'
    let message = String(payload?.message || 'Postulación rechazada en validación de entrada.')

    if (!reglas.ok) {
      reason = toRechazoEntradaCode(reglas.code)
      message = reglas.message
    } else {
      const norm = normalizeRut(String(data.rut || '').trim())
      const [hist, post] = await Promise.all([
        db.collection('historical_ruts').doc(norm).get(),
        db.collection('postulantes').doc(norm).get(),
      ])
      if (hist.exists) {
        reason = 'historical'
        message = 'El RUT corresponde a un beneficiario de procesos anteriores.'
      } else if (post.exists) {
        reason = 'duplicate'
        message = 'Ya existe una postulación con este RUT.'
      }
    }

    await registrarRechazoEntradaEnFirestore(db, data, reason, message, 'frontend')
    return { ok: true }
  },
)

export const crearPostulacion = onCall(
  {
    ...webCallableBase(),
    memory: '512MiB',
    timeoutSeconds: 60,
    maxInstances: 20,
  },
  async (request) => {
    // ── 1. Validar payload completo con Zod ──
    const parsed = CrearPostulacionPayloadSchema.safeParse(request.data)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]
      throw new HttpsError(
        'invalid-argument',
        `Datos inválidos: ${firstError?.path?.join('.') || 'campo desconocido'} — ${firstError?.message || 'error de validación'}`,
      )
    }

    const { data, documentosSubidos, documentPaths } = parsed.data
    // Asegurar tipos compatibles con las funciones existentes
    const postData = data as PostulanteData
    const docsSub = documentosSubidos as DocumentosSubidos

    // ── 2. Reglas de negocio ──
    const reglas = evaluarReglasPostulacion(postData)
    if (!reglas.ok) {
      throw new HttpsError('invalid-argument', reglas.message, { reason: reglas.code })
    }

    // ── 3. Validar documentos presentes ──
    const docsOk = validarDocumentosPresentes(postData, docsSub, documentPaths)
    if (!docsOk.ok) {
      throw new HttpsError('invalid-argument', docsOk.message, { reason: docsOk.code })
    }

    // ── 4. Validar rutas de Storage ──
    const pathsOk = validarPathsStorage(documentPaths)
    if (!pathsOk.ok) {
      throw new HttpsError('invalid-argument', pathsOk.message, { reason: pathsOk.code })
    }

    // ── 5. Verificar duplicados y base histórica ──
    const norm = rutNormalizadoPostulacion(postData)
    const db = admin.firestore()
    const [hist, existing] = await Promise.all([
      db.collection('historical_ruts').doc(norm).get(),
      db.collection('postulantes').doc(norm).get(),
    ])
    if (hist.exists) {
      throw new HttpsError(
        'failed-precondition',
        'El RUT corresponde a un beneficiario de procesos anteriores. En consecuencia, su postulación para el presente año fué rechazada.',
      )
    }
    if (existing.exists) {
      throw new HttpsError('already-exists', 'Ya existe una postulación con este RUT.')
    }

    // ── 6. Generar URLs de descarga desde las rutas de Storage (Admin SDK) ──
    const documentUrls = await generarUrlsDescarga(documentPaths)

    // ── 7. Calcular puntaje y registrar ──
    const puntaje = calcularPuntajeTotal(postData)
    const now = new Date().toISOString()
    const registro = {
      ...postData,
      rutNormalizado: norm,
      puntaje,
      estado: 'pendiente',
      motivoRechazo: null,
      documentosSubidos: docsSub,
      documentUrls,
      createdAt: now,
      updatedAt: now,
    }

    try {
      await db.collection('postulantes').doc(norm).create(registro)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('ALREADY_EXISTS') || msg.includes('already exists')) {
        throw new HttpsError('already-exists', 'Ya existe una postulación con este RUT.')
      }
      console.error('crearPostulacion create error', e)
      throw new HttpsError('internal', 'No se pudo registrar la postulación. Intente nuevamente.')
    }

    return { postulanteId: norm }
  },
)

/**
 * Registra un intento fallido de login. Bloquea si llega a 3.
 */
export const registrarIntentoFallido = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 15, maxInstances: 20 },
  async (request) => {
    const { email } = request.data
    if (!email || typeof email !== 'string') throw new HttpsError('invalid-argument', 'Email requerido.')

    try {
      const db = admin.firestore()
      const auth = admin.auth()

      // Buscar UID por email
      const userRecord = await auth.getUserByEmail(email)
      const userRef = db.collection('users').doc(userRecord.uid)

      await db.runTransaction(async (t) => {
        const snap = await t.get(userRef)
        if (!snap.exists) return

        const data = snap.data() || {}
        const intentos = (data.intentosFallidos || 0) + 1
        const bloqueado = intentos >= 3

        t.update(userRef, {
          intentosFallidos: intentos,
          bloqueado: bloqueado,
          lastAttempt: new Date().toISOString(),
        })
      })

      return { ok: true }
    } catch (e) {
      console.error('Error registrarIntentoFallido:', e)
      // No revelamos si el usuario existe o no por seguridad
      return { ok: true }
    }
  },
)

/**
 * Verifica si un correo está bloqueado antes de intentar login.
 */
export const verificarEstadoBloqueo = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 10, maxInstances: 20 },
  async (request) => {
    const { email } = request.data
    if (!email || typeof email !== 'string') throw new HttpsError('invalid-argument', 'Email requerido.')

    try {
      const auth = admin.auth()
      const userRecord = await auth.getUserByEmail(email)
      const snap = await admin.firestore().collection('users').doc(userRecord.uid).get()
      
      const data = snap.data()
      return { bloqueado: !!data?.bloqueado }
    } catch {
      return { bloqueado: false }
    }
  },
)

/**
 * Desbloquea al usuario y resetea intentos para que pueda recuperar su cuenta.
 * No envía el correo; el correo lo enviamos desde el cliente para asegurar
 * que use la infraestructura de envío directo de Firebase.
 */
export const solicitarRecuperacionPassword = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 15, maxInstances: 10 },
  async (request) => {
    const { email } = request.data
    if (!email || typeof email !== 'string') throw new HttpsError('invalid-argument', 'Email requerido.')

    try {
      const auth = admin.auth()
      const userRecord = await auth.getUserByEmail(email)
      
      // Reseteamos el bloqueo inmediatamente al solicitar recuperación
      await admin.firestore().collection('users').doc(userRecord.uid).update({
        intentosFallidos: 0,
        bloqueado: false,
      })

      return { ok: true }
    } catch (e) {
      console.error('Error solicitarRecuperacionPassword:', e)
      // Siempre devolvemos ok por seguridad (no revelar emails)
      return { ok: true }
    }
  },
)

/**
 * Lista todos los usuarios/admins del sistema.
 * Solo accesible por superadmin.
 */
export const obtenerUsuariosAdmin = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 20, maxInstances: 5 },
  async (request) => {
    // 1. Verificar sesión y rol
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    const callerDoc = await db.collection('users').doc(uid).get()
    if (callerDoc.data()?.role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'No tiene permisos para ver esta información.')
    }

    try {
      // 2. Obtener lista de usuarios
      const snap = await db.collection('users').get()
      const users = snap.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      }))

      return { users }
    } catch (e) {
      console.error('Error obtenerUsuariosAdmin:', e)
      throw new HttpsError('internal', 'Error al obtener usuarios.')
    }
  },
)

/**
 * Cambia el estado de bloqueo de un usuario (Activar/Inactivar).
 * Solo accesible por superadmin.
 */
export const cambiarEstadoUsuario = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    // 1. Verificar sesión y rol
    const callerUid = request.auth?.uid
    const { targetUid, nuevoEstado } = request.data

    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')
    if (!targetUid || typeof nuevoEstado !== 'boolean') {
      throw new HttpsError('invalid-argument', 'Parámetros inválidos.')
    }

    const db = admin.firestore()
    
    // 2. Verificar que el que llama es superadmin
    const callerDoc = await db.collection('users').doc(callerUid).get()
    if (callerDoc.data()?.role !== 'superadmin') {
      throw new HttpsError('permission-denied', 'No tiene permisos para modificar usuarios.')
    }

    try {
      // 3. Aplicar cambio en Firestore
      await db.collection('users').doc(targetUid).update({
        bloqueado: nuevoEstado,
        updatedAt: new Date().toISOString(),
      })

      // 4. Deshabilitar/Habilitar la cuenta en Firebase Auth
      await admin.auth().updateUser(targetUid, {
        disabled: nuevoEstado,
      })

      return { ok: true }
    } catch (e) {
      console.error('Error cambiarEstadoUsuario:', e)
      throw new HttpsError('internal', 'No se pudo cambiar el estado del usuario.')
    }
  },
)

export * from './admin'
export * from './mailProcessor'
