import './functionsInit'
import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import type {
  PostulanteData,
  PostulanteRechazadoEntrada,
  TramoAsignacion,
  TramoVigenteEstado,
  AuditLog,
} from '../../src/types/postulante'
import {
  obtenerSnapshotsPostulantesPorIds,
  ordenarDocsPostulantesComoEnPanel,
} from './postulantesOrdenPanel'
import { webCallableBase } from './httpsCallableDefaults'
import { calcularPuntajeTotal } from '../../src/postulacion/shared/scoring'

/** Campos que el panel puede enviar; nunca assignedTo, id, createdAt ni puntaje (se recalcula en servidor). */
const POSTULANTE_UPDATE_KEYS = new Set<string>([
  'nombres',
  'apellidoPaterno',
  'apellidoMaterno',
  'rut',
  'fechaNacimiento',
  'edad',
  'sexo',
  'estadoCivil',
  'telefono',
  'email',
  'domicilioFamiliar',
  'fechaPostulacion',
  'horaPostulacion',
  'nem',
  'nombreInstitucion',
  'comuna',
  'carrera',
  'duracionSemestres',
  'anoIngreso',
  'totalIntegrantes',
  'tramoRegistroSocial',
  'tieneHermanosOHijosEstudiando',
  'tieneUnHermanOHijoEstudiando',
  'tieneDosOMasHermanosOHijosEstudiando',
  'enfermedadCatastrofica',
  'enfermedadCronica',
  'tipoCuentaBancaria',
  'numeroCuenta',
  'rutCuenta',
  'otraNumeroCuenta',
  'otraTipoCuenta',
  'otraBanco',
  'otraBancoDetalle',
  'otraRutTitular',
  'observacion',
  'declaracionJuradaAceptada',
  'estado',
  'motivoRechazo',
  'documentosSubidos',
  'documentosValidados',
])

function storagePathFromDownloadUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)(?:\?|$)/)
    if (!match) return null
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

async function assertRevisorOrAdmin(
  callerUid: string,
  db: admin.firestore.Firestore,
  tokenEmail?: string,
): Promise<{ email: string }> {
  const userDoc = await db.collection('users').doc(callerUid).get()
  const role = (userDoc.data()?.role || '').toString().toLowerCase().trim()
  if (!['superadmin', 'revisor', 'admin'].includes(role)) {
    throw new HttpsError('permission-denied', 'No tiene privilegios para esta operación.')
  }
  const email = (tokenEmail || (userDoc.data()?.email as string | undefined) || 'unknown').toString()
  return { email: email || 'unknown' }
}

function parseScopePostulanteIdsTramos(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new HttpsError(
      'invalid-argument',
      'Debe enviar el alcance de la vista de revisión (IDs de postulantes visibles con el filtro actual, no vacío).',
    )
  }
  if (raw.length > 25_000) {
    throw new HttpsError('invalid-argument', 'El alcance supera el límite permitido.')
  }
  const ids = raw.map((x) => String(x ?? '').trim()).filter((s) => s.length > 0)
  if (ids.length !== raw.length) {
    throw new HttpsError('invalid-argument', 'Hay IDs vacíos o inválidos en el alcance.')
  }
  if (new Set(ids).size !== ids.length) {
    throw new HttpsError('invalid-argument', 'El alcance no puede contener IDs duplicados.')
  }
  return ids
}

async function writeAuditLog(
  db: admin.firestore.Firestore,
  adminUid: string,
  adminEmail: string,
  action: string,
  targetUid: string,
  details: string,
): Promise<void> {
  await db.collection('audit_logs').doc().set({
    adminUid,
    adminEmail,
    action,
    targetUid,
    details,
    timestamp: new Date().toISOString(),
  } as AuditLog)
}

// Helper function to check superadmin privileges
async function verifySuperAdmin(uid: string, db: admin.firestore.Firestore): Promise<void> {
  const userDoc = await db.collection('users').doc(uid).get()
  const role = (userDoc.data()?.role || '').toString().toLowerCase().trim()
  if (!userDoc.exists || role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acceso denegado: Se requiere rol de SuperAdministrador.')
  }
}

// -------------------------------------------------------------
// 1. Asignar Tramos
// -------------------------------------------------------------
export const asignarTramosRevisores = onCall(
  { ...webCallableBase(), memory: '512MiB', timeoutSeconds: 60, maxInstances: 5 },
  async (request) => {
    const callerUid = request.auth?.uid
    const { assignments, scopePostulanteIds } = request.data as {
      assignments: TramoAsignacion[]
      scopePostulanteIds?: unknown
    }

    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')
    if (!Array.isArray(assignments)) {
      throw new HttpsError('invalid-argument', 'El payload debe ser un array de asignaciones.')
    }

    const db = admin.firestore()
    await verifySuperAdmin(callerUid, db)

    try {
      const configRef = db.collection('config').doc('tramos_revisores')
      const { FieldValue } = admin.firestore

      // Limpiar todo: sin tramos en config y sin metadatos de asignación en postulantes.
      if (assignments.length === 0) {
        const configBatch = db.batch()
        configBatch.set(configRef, { tramos: {}, updatedAt: new Date().toISOString() })

        const snapshot = await db.collection('postulantes').get()
        let operations = 0
        let batch = db.batch()

        const commitBatch = async () => {
          if (operations > 0) {
            await batch.commit()
            batch = db.batch()
            operations = 0
          }
        }

        for (const doc of snapshot.docs) {
          const raw = doc.data()
          if (
            Object.prototype.hasOwnProperty.call(raw, 'assignedTo') ||
            Object.prototype.hasOwnProperty.call(raw, 'ordenRevisionDoc')
          ) {
            batch.update(doc.ref, {
              assignedTo: FieldValue.delete(),
              ordenRevisionDoc: FieldValue.delete(),
            })
            operations++
            if (operations >= 400) await commitBatch()
          }
        }

        await commitBatch()
        await configBatch.commit()

        const logRef = db.collection('audit_logs').doc()
        await logRef.set({
          adminUid: callerUid,
          adminEmail: request.auth?.token.email || 'unknown',
          action: 'ASIGNACION_TRAMOS_LIMPIADA',
          targetUid: 'SISTEMA',
          details: 'Se eliminaron todas las asignaciones por tramos y los campos assignedTo/ordenRevisionDoc en postulantes.',
          timestamp: new Date().toISOString(),
        } as AuditLog)

        return { ok: true }
      }

      // 1. Guardar la configuración general (para la UI del SuperAdmin)
      const tramosMap: Record<string, TramoAsignacion> = {}
      const revisoresProcesados = new Set<string>()

      for (const t of assignments) {
        if (!t.reviewerUid || typeof t.startRange !== 'number' || typeof t.endRange !== 'number') {
          throw new HttpsError('invalid-argument', 'Petición rechazada: estructura de datos manipulada o incompleta.')
        }
        if (t.startRange < 1 || t.startRange > t.endRange) {
          throw new HttpsError('invalid-argument', 'Petición rechazada: El rango es matemáticamente imposible.')
        }
        if (revisoresProcesados.has(t.reviewerUid)) {
          throw new HttpsError('already-exists', `El usuario ${t.reviewerEmail} tiene operaciones paralelas duplicadas enviadas.`)
        }
        revisoresProcesados.add(t.reviewerUid)

        // Strict backend validation for overlapping segments bypassing UI
        const overlapDetected = assignments.find(other =>
          other !== t && (
            (t.startRange >= other.startRange && t.startRange <= other.endRange) ||
            (t.endRange >= other.startRange && t.endRange <= other.endRange) ||
            (t.startRange <= other.startRange && t.endRange >= other.endRange)
          )
        )

        if (overlapDetected) {
          throw new HttpsError('failed-precondition', `El backend detectó solapamiento entre los rangos ${t.startRange}-${t.endRange} y el rango de otro revisor. Operación abortada atómicamente.`)
        }

        tramosMap[t.reviewerUid] = t
      }

      const configBatch = db.batch()
      configBatch.set(configRef, { tramos: tramosMap, updatedAt: new Date().toISOString() })

      const scopeIds = parseScopePostulanteIdsTramos(scopePostulanteIds)
      const scopeSnaps = await obtenerSnapshotsPostulantesPorIds(db, scopeIds)
      const missingIdx = scopeIds.map((id, i) => (!scopeSnaps[i]?.exists ? id : null)).filter(Boolean) as string[]
      if (missingIdx.length > 0) {
        const muestra = missingIdx.slice(0, 5).join(', ')
        throw new HttpsError(
          'not-found',
          `IDs no encontrados en postulantes: ${muestra}${missingIdx.length > 5 ? '…' : ''}`,
        )
      }

      const sortedScope = ordenarDocsPostulantesComoEnPanel(scopeSnaps)
      const scopeLen = sortedScope.length

      for (const t of assignments) {
        if (t.startRange > scopeLen || t.endRange > scopeLen) {
          throw new HttpsError(
            'invalid-argument',
            `Los rangos deben estar entre 1 y ${scopeLen} (postulantes en la vista de revisión actual).`,
          )
        }
      }

      const idToPosition = new Map<string, number>()
      sortedScope.forEach((doc, i) => idToPosition.set(doc.id, i + 1))
      const inScope = new Set(sortedScope.map((d) => d.id))

      // 3. Fuera del alcance: quitar metadatos de asignación.
      //    Dentro: aplicar tramo y guardar el número global visible en revisión (`ordenRevisionDoc`).
      const allSnapshot = await db.collection('postulantes').get()
      let operations = 0
      let batch = db.batch()

      const commitBatch = async () => {
        if (operations > 0) {
          await batch.commit()
          batch = db.batch()
          operations = 0
        }
      }

      for (const doc of allSnapshot.docs) {
        const raw = doc.data()
        if (!inScope.has(doc.id)) {
          if (
            Object.prototype.hasOwnProperty.call(raw, 'assignedTo') ||
            Object.prototype.hasOwnProperty.call(raw, 'ordenRevisionDoc')
          ) {
            batch.update(doc.ref, {
              assignedTo: FieldValue.delete(),
              ordenRevisionDoc: FieldValue.delete(),
            })
            operations++
            if (operations >= 400) await commitBatch()
          }
          continue
        }

        const pos = idToPosition.get(doc.id)!
        const assignedTo =
          assignments.find((t) => pos >= t.startRange && pos <= t.endRange)?.reviewerUid || null

        if (raw.assignedTo !== assignedTo || raw.ordenRevisionDoc !== pos) {
          batch.update(doc.ref, { assignedTo, ordenRevisionDoc: pos })
          operations++
          if (operations >= 400) await commitBatch()
        }
      }

      await commitBatch()
      await configBatch.commit()

      const logRef = db.collection('audit_logs').doc()
      await logRef.set({
        adminUid: callerUid,
        adminEmail: request.auth?.token.email || 'unknown',
        action: 'ASIGNACION_TRAMOS_CREADA',
        targetUid: 'SISTEMA',
        details: `Se asignaron tramos a ${assignments.length} revisores. Alcance: ${scopeLen} postulantes (vista revisión).`,
        timestamp: new Date().toISOString(),
      } as AuditLog)

      return { ok: true }
    } catch (e: unknown) {
      console.error('Error asignarTramosRevisores:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'No se pudieron asignar los tramos.')
    }
  }
)

export const obtenerTramosRevisores = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 20, maxInstances: 10 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)

    try {
      const docSnap = await db.collection('config').doc('tramos_revisores').get()
      if (!docSnap.exists) {
        return { tramos: [] }
      }
      const data = docSnap.data()
      const tramosArray = Object.values(data?.tramos || {}) as TramoAsignacion[]
      if (tramosArray.length === 0) return { tramos: [] }

      const reviewerUids = new Set(tramosArray.map((t) => t.reviewerUid))
      const counters = new Map<string, { totalAsignados: number; totalTerminados: number }>()
      for (const uid of reviewerUids) counters.set(uid, { totalAsignados: 0, totalTerminados: 0 })

      const snapshot = await db.collection('postulantes').get()
      for (const doc of snapshot.docs) {
        const raw = doc.data() as { assignedTo?: unknown; estado?: unknown }
        const assignedTo = typeof raw.assignedTo === 'string' ? raw.assignedTo : ''
        if (!assignedTo || !counters.has(assignedTo)) continue
        const counter = counters.get(assignedTo)!
        counter.totalAsignados += 1
        const estado = String(raw.estado || '')
        if (estado === 'documentacion_validada' || estado === 'rechazado') {
          counter.totalTerminados += 1
        }
      }

      const tramos = tramosArray.map((t) => {
        const c = counters.get(t.reviewerUid) || { totalAsignados: 0, totalTerminados: 0 }
        return {
          ...t,
          totalAsignados: c.totalAsignados,
          totalTerminados: c.totalTerminados,
          terminado: c.totalAsignados > 0 && c.totalTerminados >= c.totalAsignados,
        } satisfies TramoVigenteEstado
      })
      return { tramos }
    } catch (e) {
      console.error('Error obtenerTramosRevisores:', e)
      throw new HttpsError('internal', 'Error al obtener los tramos asignados.')
    }
  }
)

// -------------------------------------------------------------
// 2. Historial de Auditoría
// -------------------------------------------------------------
export const registrarAccionAdmin = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 20, maxInstances: 10 },
  async (request) => {
    const callerUid = request.auth?.uid
    const { action, targetUid, details } = request.data

    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()

    // Verify user is at least a revisor
    const userDoc = await db.collection('users').doc(callerUid).get()
    const role = (userDoc.data()?.role || '').toString().toLowerCase().trim()
    if (!['superadmin', 'revisor', 'admin'].includes(role)) {
      throw new HttpsError('permission-denied', 'No tiene permisos de administrador.')
    }

    try {
      const email = request.auth?.token.email || userDoc.data()?.email || 'unknown'
      const logRef = db.collection('audit_logs').doc()

      const log: AuditLog = {
        adminUid: callerUid,
        adminEmail: email,
        action,
        targetUid: targetUid || 'SISTEMA',
        details,
        timestamp: new Date().toISOString()
      }

      await logRef.set(log)

      return { ok: true }
    } catch (e) {
      console.error('Error registrarAccionAdmin:', e)
      throw new HttpsError('internal', 'No se pudo registrar la acción.')
    }
  }
)

export const obtenerLogsAuditoria = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await verifySuperAdmin(callerUid, db)

    try {
      // Return the latest 200 logs to prevent massive payloads
      const snap = await db.collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get()

      const logs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLog[]

      return { logs }
    } catch (e) {
      console.error('Error obtenerLogsAuditoria:', e)
      throw new HttpsError('internal', 'Error al obtener los logs de auditoría.')
    }
  }
)

// 3. Extracción de Postulantes Segura (Backend Filtering)
// -------------------------------------------------------------
export const obtenerPostulantesRevisor = onCall(
  { ...webCallableBase(), memory: '512MiB', timeoutSeconds: 60, maxInstances: 10 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()

    const userDoc = await db.collection('users').doc(callerUid).get()
    const role = (userDoc.data()?.role || '').toString().toLowerCase().trim()

    if (!['superadmin', 'revisor', 'admin'].includes(role)) {
      throw new HttpsError('permission-denied', 'No tiene privilegios para acceder a la nómina de postulantes.')
    }

    try {
      // Sin orderBy en servidor: evita índices compuestos y fallos si falta createdAt en algún doc.
      const snapshot = await db.collection('postulantes').get()
      const sortedDocs = ordenarDocsPostulantesComoEnPanel(snapshot.docs)
      const allPostulantes = sortedDocs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))

      return { postulantes: allPostulantes }
    } catch (e: unknown) {
      console.error('Error obtenerPostulantesRevisor:', e)
      if (e instanceof HttpsError) throw e
      const msg = e instanceof Error ? e.message : 'Sin detalle'
      throw new HttpsError('internal', `Error al obtener la información asignada: ${msg}`)
    }
  }
)

function sanitizePostulanteUpdatePayload(raw: unknown): Record<string, unknown> {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new HttpsError('invalid-argument', 'El campo fields debe ser un objeto.')
  }
  const out: Record<string, unknown> = {}
  const estadosPermitidos = new Set([
    'pendiente',
    'en_revision',
    'documentacion_validada',
    'aprobado',
    'rechazado',
  ])
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!POSTULANTE_UPDATE_KEYS.has(k)) continue
    if (k === 'documentosValidados') {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) continue
      const dv: Record<string, boolean> = {}
      for (const [dk, dval] of Object.entries(v as Record<string, unknown>)) {
        if (typeof dval === 'boolean') dv[dk] = dval
      }
      out[k] = dv
      continue
    }
    if (k === 'documentosSubidos') {
      if (v === null || typeof v !== 'object' || Array.isArray(v)) continue
      out[k] = v
      continue
    }
    if (k === 'declaracionJuradaAceptada') {
      if (typeof v === 'boolean') out[k] = v
      continue
    }
    if (k === 'motivoRechazo') {
      if (v === null) out[k] = null
      else if (typeof v === 'string') out[k] = v
      continue
    }
    if (k === 'estado') {
      if (typeof v === 'string' && estadosPermitidos.has(v)) out[k] = v
      continue
    }
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    }
  }
  return out
}

export const obtenerPostulanteRevisor = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 20, maxInstances: 10 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const postId = (request.data as { postId?: string })?.postId
    if (!postId || typeof postId !== 'string' || !postId.trim()) {
      throw new HttpsError('invalid-argument', 'postId requerido.')
    }

    const db = admin.firestore()
    try {
      await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)

      const snap = await db.collection('postulantes').doc(postId.trim()).get()
      if (!snap.exists) return { postulante: null as null }

      return {
        postulante: { id: snap.id, ...snap.data() },
      }
    } catch (e: unknown) {
      console.error('Error obtenerPostulanteRevisor:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'Error al obtener el postulante.')
    }
  },
)

export const actualizarPostulanteRevisor = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const { postId, fields } = request.data as { postId?: string; fields?: unknown }
    if (!postId || typeof postId !== 'string' || !postId.trim()) {
      throw new HttpsError('invalid-argument', 'postId requerido.')
    }

    const db = admin.firestore()

    try {
      const { email } = await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)
      const sanitized = sanitizePostulanteUpdatePayload(fields)
      if (Object.keys(sanitized).length === 0) {
        throw new HttpsError('invalid-argument', 'No hay campos válidos para actualizar.')
      }

      const ref = db.collection('postulantes').doc(postId.trim())
      const snap = await ref.get()
      if (!snap.exists) throw new HttpsError('not-found', 'Postulante no encontrado.')

      const current = snap.data() as Record<string, unknown>
      const merged = { ...current, ...sanitized }
      const puntaje = calcularPuntajeTotal(merged as PostulanteData)
      const updatedAt = new Date().toISOString()

      await ref.update({
        ...sanitized,
        puntaje,
        updatedAt,
      })

      const keys = Object.keys(sanitized).join(', ')
      await writeAuditLog(db, callerUid, email, 'EDICION_DATOS', postId.trim(), `Campos: ${keys}`)
      if (sanitized.estado !== undefined) {
        await writeAuditLog(
          db,
          callerUid,
          email,
          'CAMBIO_ESTADO',
          postId.trim(),
          `Estado: ${String(sanitized.estado)}. Motivo: ${String(sanitized.motivoRechazo ?? 'N/A')}`,
        )
      }

      return { ok: true }
    } catch (e: unknown) {
      console.error('Error actualizarPostulanteRevisor:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'Error al actualizar el postulante.')
    }
  },
)

export const eliminarPostulanteRevisor = onCall(
  { ...webCallableBase(), memory: '512MiB', timeoutSeconds: 90, maxInstances: 5 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const postId = (request.data as { postId?: string })?.postId
    if (!postId || typeof postId !== 'string' || !postId.trim()) {
      throw new HttpsError('invalid-argument', 'postId requerido.')
    }

    const db = admin.firestore()

    try {
      const { email } = await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)
      const id = postId.trim()
      const ref = db.collection('postulantes').doc(id)
      const snap = await ref.get()
      if (!snap.exists) return { ok: true }

      const data = snap.data() as { documentUrls?: Record<string, string> }
      const urls = Object.values(data.documentUrls ?? {}).filter(
        (u): u is string => typeof u === 'string' && u.length > 0,
      )
      const bucket = admin.storage().bucket()
      await Promise.allSettled(
        urls.map(async (url) => {
          const path = storagePathFromDownloadUrl(url)
          if (!path) return
          try {
            await bucket.file(path).delete()
          } catch {
            // ignorar
          }
        }),
      )

      await ref.delete()
      await writeAuditLog(
        db,
        callerUid,
        email,
        'ELIMINACION_POSTULANTE',
        id,
        'Postulante y archivos asociados eliminados.',
      )
      return { ok: true }
    } catch (e: unknown) {
      console.error('Error eliminarPostulanteRevisor:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'Error al eliminar el postulante.')
    }
  },
)

export const obtenerPostulantesRechazadosEntrada = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 30, maxInstances: 10 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')
    const db = admin.firestore()
    await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)

    try {
      const snap = await db.collection('postulantes_rechazados_entrada').get()
      const rows = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PostulanteRechazadoEntrada[]
      rows.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      return { postulantes: rows }
    } catch (e: unknown) {
      console.error('Error obtenerPostulantesRechazadosEntrada:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'No se pudieron obtener los rechazados de entrada.')
    }
  },
)
