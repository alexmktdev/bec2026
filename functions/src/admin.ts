import './functionsInit'
import { randomUUID } from 'node:crypto'
import * as admin from 'firebase-admin'
import { DocumentReference, GeoPoint, Timestamp } from 'firebase-admin/firestore'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import archiver from 'archiver'
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

/** Lee `tramos` como array (nuevo) o como mapa por uid (legado). */
function normalizeTramosConfigRaw(raw: unknown): TramoAsignacion[] {
  if (Array.isArray(raw)) {
    return raw as TramoAsignacion[]
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, TramoAsignacion>)
  }
  return []
}

function segmentosNumericosSeSolapan(
  a: { startRange: number; endRange: number },
  b: { startRange: number; endRange: number },
): boolean {
  return (
    (a.startRange >= b.startRange && a.startRange <= b.endRange) ||
    (a.endRange >= b.startRange && a.endRange <= b.endRange) ||
    (a.startRange <= b.startRange && a.endRange >= b.endRange)
  )
}

/** Solo campos permitidos; rangos y uid validados. */
function sanitizeTramoAssignment(raw: unknown, index: number): TramoAsignacion {
  if (!raw || typeof raw !== 'object') {
    throw new HttpsError('invalid-argument', `Segmento ${index + 1}: datos inválidos.`)
  }
  const o = raw as Record<string, unknown>
  const reviewerUid =
    typeof o.reviewerUid === 'string' && o.reviewerUid.length > 0 && o.reviewerUid.length < 200
      ? o.reviewerUid
      : ''
  if (!reviewerUid) {
    throw new HttpsError('invalid-argument', `Segmento ${index + 1}: reviewerUid inválido.`)
  }

  const reviewerEmail =
    typeof o.reviewerEmail === 'string' && o.reviewerEmail.length < 320 ? o.reviewerEmail : ''
  const reviewerName =
    typeof o.reviewerName === 'string' && o.reviewerName.length < 500 ? o.reviewerName : ''

  const startRange = typeof o.startRange === 'number' ? o.startRange : Number(o.startRange)
  const endRange = typeof o.endRange === 'number' ? o.endRange : Number(o.endRange)
  if (!Number.isInteger(startRange) || !Number.isInteger(endRange)) {
    throw new HttpsError('invalid-argument', `Segmento ${index + 1}: los rangos deben ser números enteros.`)
  }

  let segmentId =
    typeof o.segmentId === 'string' && /^[a-zA-Z0-9_.-]{8,128}$/.test(o.segmentId.trim())
      ? o.segmentId.trim()
      : ''
  if (!segmentId) {
    segmentId = randomUUID()
  }

  const assignedByUid =
    typeof o.assignedByUid === 'string' ? o.assignedByUid.slice(0, 200) : ''
  const assignedByEmail =
    typeof o.assignedByEmail === 'string' ? o.assignedByEmail.slice(0, 320) : ''
  const createdAt =
    typeof o.createdAt === 'string' && o.createdAt.length < 48 ? o.createdAt : new Date().toISOString()

  return {
    segmentId,
    reviewerUid,
    reviewerEmail,
    reviewerName,
    startRange,
    endRange,
    assignedByUid,
    assignedByEmail,
    createdAt,
  }
}

function conSegmentIdCompleto(t: TramoAsignacion): TramoAsignacion {
  if (t.segmentId && t.segmentId.length >= 8) return t
  return {
    ...t,
    segmentId: `legacy-${t.reviewerUid}-${t.startRange}-${t.endRange}`,
  }
}

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

/** Nombres dentro del ZIP (alineado con `src/services/zipDownload.ts`). */
const DOC_ZIP_ENTRY_NAMES: Record<string, string> = {
  identidad: '01_Cedula_identidad.pdf',
  matricula: '02_Certificado_matricula.pdf',
  rsh: '03_Cartola_registro_social_hogares.pdf',
  nem: '04_Concentracion_notas_NEM.pdf',
  hermanos: '05_Certificado_alumno_regular.pdf',
  medico: '06_Certificado_medico.pdf',
}

const DESCARGA_DOCS_ZIP_TOKENS = 'descarga_docs_zip_tokens'
const DESCARGA_DOCS_ZIP_TTL_MS = 7 * 24 * 60 * 60 * 1000

function nombreEntradaZip(docId: string): string {
  return DOC_ZIP_ENTRY_NAMES[docId] ?? `${docId}.pdf`
}

function assertPuedeDescargarDocumentosPostulante(
  callerUid: string,
  role: string,
  postulante: { assignedTo?: unknown },
): void {
  const r = role.toLowerCase().trim()
  if (r === 'superadmin' || r === 'admin') return
  if (r === 'revisor') {
    const assigned = typeof postulante.assignedTo === 'string' ? postulante.assignedTo : ''
    if (assigned !== callerUid) {
      throw new HttpsError('permission-denied', 'No tiene asignado este postulante para descargar sus documentos.')
    }
    return
  }
  throw new HttpsError('permission-denied', 'No tiene permisos.')
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
        configBatch.set(configRef, { tramos: [], updatedAt: new Date().toISOString() })

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

      const cleanAssignments = assignments.map((raw, i) => sanitizeTramoAssignment(raw, i))

      for (const t of cleanAssignments) {
        if (t.startRange < 1 || t.startRange > t.endRange) {
          throw new HttpsError('invalid-argument', 'Petición rechazada: El rango es matemáticamente imposible.')
        }
      }

      for (let i = 0; i < cleanAssignments.length; i++) {
        for (let j = i + 1; j < cleanAssignments.length; j++) {
          const a = cleanAssignments[i]
          const b = cleanAssignments[j]
          if (segmentosNumericosSeSolapan(a, b)) {
            throw new HttpsError(
              'failed-precondition',
              `Solapamiento entre segmentos (#${a.startRange}–${a.endRange} y #${b.startRange}–${b.endRange}). No puede haber dos tramos que compartan posiciones.`,
            )
          }
        }
      }

      const configBatch = db.batch()
      configBatch.set(configRef, { tramos: cleanAssignments, updatedAt: new Date().toISOString() })

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

      for (const t of cleanAssignments) {
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
          cleanAssignments.find((t) => pos >= t.startRange && pos <= t.endRange)?.reviewerUid || null

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
        details: `Se guardaron ${cleanAssignments.length} segmento(s) de tramo. Alcance: ${scopeLen} postulantes (vista revisión).`,
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
      const tramosRaw = normalizeTramosConfigRaw(data?.tramos).map(conSegmentIdCompleto)
      if (tramosRaw.length === 0) return { tramos: [] }

      const snapshot = await db.collection('postulantes').get()

      const tramos: TramoVigenteEstado[] = tramosRaw.map((t) => {
        let totalAsignados = 0
        let totalValidados = 0
        let totalRechazados = 0
        let totalTerminados = 0
        for (const doc of snapshot.docs) {
          const raw = doc.data() as {
            assignedTo?: unknown
            estado?: unknown
            ordenRevisionDoc?: unknown
          }
          const assignedTo = typeof raw.assignedTo === 'string' ? raw.assignedTo : ''
          if (assignedTo !== t.reviewerUid) continue
          const orden = Number(raw.ordenRevisionDoc)
          if (!Number.isFinite(orden) || orden < t.startRange || orden > t.endRange) continue
          totalAsignados += 1
          const estado = String(raw.estado || '')
          if (estado === 'documentacion_validada') {
            totalValidados += 1
            totalTerminados += 1
          } else if (estado === 'rechazado') {
            totalRechazados += 1
            totalTerminados += 1
          }
        }
        return {
          ...t,
          totalAsignados,
          totalValidados,
          totalRechazados,
          totalTerminados,
          terminado: totalAsignados > 0 && totalTerminados >= totalAsignados,
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

/** Umbrales permitidos para el filtro de puntaje (misma grilla que el panel). */
const UMBRALES_PUNTAJE_ADMIN = new Set([30, 40, 50, 60, 70, 80])

type NivelDesempate = 'nem' | 'rsh' | 'enfermedad' | 'hermanos' | 'fecha'
const NIVELES_DESEMPATE: NivelDesempate[] = ['nem', 'rsh', 'enfermedad', 'hermanos', 'fecha']

function nivelIncluye(nivelHasta: NivelDesempate | null, criterio: NivelDesempate): boolean {
  if (nivelHasta == null) return false
  return NIVELES_DESEMPATE.indexOf(criterio) <= NIVELES_DESEMPATE.indexOf(nivelHasta)
}

/** Clave de igualdad para detectar empates *con los criterios ya aplicados* (misma lógica que el orden). */
function claveEmpateAcumulado(
  p: Record<string, unknown>,
  criterioHasta: NivelDesempate | null,
): string {
  const puntaje = calcularPuntajeTotal(p as unknown as PostulanteData)
  const parts: string[] = [`t:${puntaje.total ?? 0}`]
  if (criterioHasta == null) return parts.join('|')
  if (nivelIncluye(criterioHasta, 'nem')) parts.push(`n:${puntaje.nem ?? 0}`)
  if (nivelIncluye(criterioHasta, 'rsh')) parts.push(`r:${puntaje.rsh ?? 0}`)
  if (nivelIncluye(criterioHasta, 'enfermedad')) parts.push(`e:${puntaje.enfermedad ?? 0}`)
  if (nivelIncluye(criterioHasta, 'hermanos')) parts.push(`h:${puntaje.hermanos ?? 0}`)
  if (nivelIncluye(criterioHasta, 'fecha')) parts.push(`d:${registrationTimestamp(p)}`)
  return parts.join('|')
}

type EmpateGrupoResumen = {
  puntajeTotal: number
  cantidad: number
  postulantes: { id: string; nombres: string; apellidoPaterno: string; rut: string }[]
}

function calcularEmpatesResumen(
  postulantes: Record<string, unknown>[],
  criterioHasta: NivelDesempate | null,
): {
  gruposConEmpate: number
  postulantesEnEmpate: number
  /** Grupos con 2+ personas indistinguibles con el criterio actual (máx. 40 para la UI). */
  detalleGrupos: EmpateGrupoResumen[]
} {
  const map = new Map<string, Record<string, unknown>[]>()
  for (const p of postulantes) {
    const k = claveEmpateAcumulado(p, criterioHasta)
    if (!map.has(k)) map.set(k, [])
    map.get(k)!.push(p)
  }
  let gruposConEmpate = 0
  let postulantesEnEmpate = 0
  const detalleGrupos: EmpateGrupoResumen[] = []
  for (const arr of map.values()) {
    if (arr.length <= 1) continue
    gruposConEmpate++
    postulantesEnEmpate += arr.length
    if (detalleGrupos.length < 40) {
      const first = arr[0]
      const pt = calcularPuntajeTotal(first as unknown as PostulanteData).total ?? 0
      detalleGrupos.push({
        puntajeTotal: pt,
        cantidad: arr.length,
        postulantes: arr.map((x) => ({
          id: String(x.id ?? ''),
          nombres: String(x.nombres ?? ''),
          apellidoPaterno: String(x.apellidoPaterno ?? ''),
          rut: String(x.rut ?? ''),
        })),
      })
    }
  }
  detalleGrupos.sort((a, b) => b.puntajeTotal - a.puntajeTotal)
  return { gruposConEmpate, postulantesEnEmpate, detalleGrupos }
}

function registrationTimestamp(raw: Record<string, unknown>): number {
  const fecha = String(raw.fechaPostulacion ?? '').trim()
  const hora = String(raw.horaPostulacion ?? '').trim() || '00:00:00'
  const isoLike = fecha ? `${fecha}T${hora}` : ''
  const fromForm = isoLike ? Date.parse(isoLike) : NaN
  if (Number.isFinite(fromForm)) return fromForm
  const fromCreatedAt = Date.parse(String(raw.createdAt ?? ''))
  if (Number.isFinite(fromCreatedAt)) return fromCreatedAt
  return Number.MAX_SAFE_INTEGER
}

/**
 * Las respuestas de onCall deben ser JSON puro. Los docs de Firestore traen Timestamp,
 * GeoPoint, etc.; si no se convierten, el runtime puede fallar con error `internal`.
 */
function serializarParaCallable(data: unknown): unknown {
  if (data === null || data === undefined) return null
  const t = typeof data
  if (t === 'string' || t === 'number' || t === 'boolean') return data
  if (data instanceof Date) return data.toISOString()
  if (data instanceof Timestamp) return data.toDate().toISOString()
  if (data instanceof GeoPoint) return { latitude: data.latitude, longitude: data.longitude }
  if (data instanceof DocumentReference) return data.path
  if (Array.isArray(data)) return data.map(serializarParaCallable)
  if (t !== 'object') return String(data)

  const o = data as Record<string, unknown>
  if (typeof o.toDate === 'function') {
    try {
      const d = (o as { toDate: () => Date }).toDate()
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString()
    } catch {
      /* continuar como objeto */
    }
  }

  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined) continue
    out[k] = serializarParaCallable(v)
  }
  return out
}

/**
 * Aplica el filtro por puntaje total solo sobre postulantes con documentación validada.
 * Persiste `config/filtro_puntaje`. Solo superadmin (el cliente ya no escribe ese doc).
 */
export const aplicarFiltroPuntajeAdmin = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 60, maxInstances: 5 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await verifySuperAdmin(callerUid, db)

    const raw = (request.data as { puntajeMinimo?: unknown })?.puntajeMinimo
    const puntajeMinimo =
      typeof raw === 'number' && Number.isFinite(raw)
        ? raw
        : typeof raw === 'string'
          ? parseInt(raw, 10)
          : NaN

    if (!Number.isFinite(puntajeMinimo) || !UMBRALES_PUNTAJE_ADMIN.has(puntajeMinimo)) {
      throw new HttpsError('invalid-argument', 'Umbral de puntaje no permitido.')
    }

    try {
      const snapshot = await db.collection('postulantes').get()
      const sortedDocs = ordenarDocsPostulantesComoEnPanel(snapshot.docs)

      let cantidad = 0
      for (const docSnap of sortedDocs) {
        const data = docSnap.data()
        if (data.estado !== 'documentacion_validada') continue
        const puntaje = calcularPuntajeTotal(data as PostulanteData)
        if (puntaje.total >= puntajeMinimo) cantidad++
      }

      await db.collection('config').doc('filtro_puntaje').set({
        puntajeAplicado: puntajeMinimo,
        updatedAt: new Date().toISOString(),
      })

      return { ok: true as const, puntajeAplicado: puntajeMinimo, cantidadSeleccionados: cantidad }
    } catch (e: unknown) {
      console.error('Error aplicarFiltroPuntajeAdmin:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'No se pudo aplicar el filtro de puntaje.')
    }
  },
)

export const limpiarFiltroPuntajeAdmin = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 15, maxInstances: 5 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await verifySuperAdmin(callerUid, db)

    try {
      const ref = db.collection('config').doc('filtro_puntaje')
      const snap = await ref.get()
      if (snap.exists) await ref.delete()
      return { ok: true as const }
    } catch (e: unknown) {
      console.error('Error limpiarFiltroPuntajeAdmin:', e)
      throw new HttpsError('internal', 'No se pudo limpiar el filtro de puntaje.')
    }
  },
)

/**
 * Ranking de desempate calculado en backend (sin depender de filtros locales en frontend).
 * Base siempre activa: Puntaje total (desc).
 * Nivel seleccionable acumulable:
 * - nem: + Puntaje NEM (desc)
 * - rsh: + Puntaje NEM (desc) + Puntaje RSH (desc)
 * - enfermedad: + anteriores + Puntaje enfermedad (desc)
 * - hermanos: + anteriores + Puntaje hermanos/hijos (desc)
 * - fecha: + anteriores + Fecha/hora de postulación (desc)
 */
export const obtenerRankingDesempateAdmin = onCall(
  { ...webCallableBase(), memory: '512MiB', timeoutSeconds: 60, maxInstances: 10 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)

    try {
      const criterioHastaRaw = (request.data as { criterioHasta?: unknown } | undefined)?.criterioHasta
      const criterioHasta = NIVELES_DESEMPATE.includes(String(criterioHastaRaw) as NivelDesempate)
        ? (String(criterioHastaRaw) as NivelDesempate)
        : null

      const filtroSnap = await db.collection('config').doc('filtro_puntaje').get()
      const puntajeAplicadoRaw = filtroSnap.data()?.puntajeAplicado
      const puntajeAplicado =
        typeof puntajeAplicadoRaw === 'number' && Number.isFinite(puntajeAplicadoRaw)
          ? puntajeAplicadoRaw
          : null

      if (puntajeAplicado == null) {
        return {
          postulantes: [],
          puntajeAplicado: null,
          criterioHasta,
          empatesResumen: {
            gruposConEmpate: 0,
            postulantesEnEmpate: 0,
            detalleGrupos: [],
          },
        }
      }

      const snapshot = await db.collection('postulantes').get()
      const sortedDocs = ordenarDocsPostulantesComoEnPanel(snapshot.docs)
      const postulantesBase = sortedDocs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }))

      const elegibles = postulantesBase.filter((p) => {
        const estado = String(p.estado ?? '')
        if (estado !== 'documentacion_validada' && estado !== 'aprobado') return false
        const puntaje = calcularPuntajeTotal(p as unknown as PostulanteData)
        return (puntaje.total ?? 0) >= puntajeAplicado
      })

      const ranking = [...elegibles].sort((a, b) => {
        const puntajeA = calcularPuntajeTotal(a as unknown as PostulanteData)
        const puntajeB = calcularPuntajeTotal(b as unknown as PostulanteData)
        const totalA = puntajeA.total ?? 0
        const totalB = puntajeB.total ?? 0
        if (totalA !== totalB) return totalB - totalA

        if (nivelIncluye(criterioHasta, 'nem')) {
          const nemA = puntajeA.nem ?? 0
          const nemB = puntajeB.nem ?? 0
          if (nemA !== nemB) return nemB - nemA
        }

        if (nivelIncluye(criterioHasta, 'rsh')) {
          const rshA = puntajeA.rsh ?? 0
          const rshB = puntajeB.rsh ?? 0
          if (rshA !== rshB) return rshB - rshA
        }

        if (nivelIncluye(criterioHasta, 'enfermedad')) {
          const diseaseA = puntajeA.enfermedad ?? 0
          const diseaseB = puntajeB.enfermedad ?? 0
          if (diseaseA !== diseaseB) return diseaseB - diseaseA
        }

        if (nivelIncluye(criterioHasta, 'hermanos')) {
          const siblingsA = puntajeA.hermanos ?? 0
          const siblingsB = puntajeB.hermanos ?? 0
          if (siblingsA !== siblingsB) return siblingsB - siblingsA
        }

        if (nivelIncluye(criterioHasta, 'fecha')) {
          const dateA = registrationTimestamp(a)
          const dateB = registrationTimestamp(b)
          if (dateA !== dateB) return dateB - dateA
        }

        return String(a.id).localeCompare(String(b.id))
      })

      const empatesResumen = calcularEmpatesResumen(elegibles, criterioHasta)

      const postulantesJson = ranking.map((p) => serializarParaCallable(p) as Record<string, unknown>)

      return { postulantes: postulantesJson, puntajeAplicado, criterioHasta, empatesResumen }
    } catch (e: unknown) {
      console.error('Error obtenerRankingDesempateAdmin:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'No se pudo calcular el ranking de desempate.')
    }
  },
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

/**
 * Emite un enlace HTTP de un solo uso (token en Firestore) para descargar un ZIP con los documentos del postulante.
 * Solo admin/revisor con asignación correspondiente.
 */
export const emitirEnlaceDescargaZipDocumentos = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 30, maxInstances: 20 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const postulanteId = String((request.data as { postulanteId?: unknown })?.postulanteId ?? '').trim()
    if (!postulanteId) throw new HttpsError('invalid-argument', 'postulanteId requerido.')

    const db = admin.firestore()
    const { email } = await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)
    const userDoc = await db.collection('users').doc(callerUid).get()
    const role = String(userDoc.data()?.role || '').toLowerCase().trim()

    const snap = await db.collection('postulantes').doc(postulanteId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Postulante no encontrado.')

    const pdata = snap.data() as { assignedTo?: unknown }
    assertPuedeDescargarDocumentosPostulante(callerUid, role, pdata)

    const tokenId = randomUUID()
    await db.collection(DESCARGA_DOCS_ZIP_TOKENS).doc(tokenId).set({
      postulanteId,
      createdAt: new Date().toISOString(),
      expiresAtMs: Date.now() + DESCARGA_DOCS_ZIP_TTL_MS,
      createdByUid: callerUid,
    })

    await writeAuditLog(
      db,
      callerUid,
      email,
      'EMITIR_ENLACE_ZIP_DOCS',
      postulanteId,
      'Token de descarga ZIP documentación (export Excel / panel).',
    )

    return { token: tokenId }
  },
)

/**
 * GET público con token opaco: genera el ZIP y elimina el token al terminar.
 * No usa Firebase Auth en el navegador; la seguridad es el token de un solo uso + expiración.
 */
export const descargarZipDocumentosPostulanteHttp = onRequest(
  {
    region: 'southamerica-west1',
    cors: true,
    invoker: 'public',
    memory: '512MiB',
    timeoutSeconds: 120,
    maxInstances: 10,
  },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('')
      return
    }
    if (req.method !== 'GET') {
      res.status(405).set('Allow', 'GET').send('Method Not Allowed')
      return
    }

    const tokenId = String((req.query as { t?: string }).t ?? '').trim()
    if (!tokenId) {
      res.status(400).send('Parámetro t requerido.')
      return
    }

    const db = admin.firestore()
    const tokenRef = db.collection(DESCARGA_DOCS_ZIP_TOKENS).doc(tokenId)

    let postulanteId: string | null = null
    let tokenExpirado = false
    try {
      await db.runTransaction(async (tx) => {
        const tokenSnap = await tx.get(tokenRef)
        if (!tokenSnap.exists) return
        const tdata = tokenSnap.data() as { postulanteId?: string; expiresAtMs?: number }
        const pid = String(tdata.postulanteId || '').trim()
        const exp = Number(tdata.expiresAtMs)
        if (!pid || !Number.isFinite(exp)) {
          tx.delete(tokenRef)
          return
        }
        if (Date.now() > exp) {
          tokenExpirado = true
          tx.delete(tokenRef)
          return
        }
        postulanteId = pid
        tx.delete(tokenRef)
      })
    } catch (e) {
      console.error('descargarZipDocumentosPostulanteHttp token tx', e)
      res.status(500).send('Error interno.')
      return
    }

    if (tokenExpirado) {
      res.status(410).send('El enlace expiró.')
      return
    }
    if (!postulanteId) {
      res.status(404).send('Enlace inválido o ya utilizado.')
      return
    }

    try {
      const pSnap = await db.collection('postulantes').doc(postulanteId).get()
      if (!pSnap.exists) {
        res.status(404).send('Postulante no encontrado.')
        return
      }
      const pdata = pSnap.data() as { documentUrls?: Record<string, string> }
      const documentUrls =
        pdata.documentUrls && typeof pdata.documentUrls === 'object' ? pdata.documentUrls : {}
      const bucket = admin.storage().bucket()

      const archive = archiver('zip', { zlib: { level: 0 } })
      archive.on('error', (err: Error) => {
        console.error('archiver error', err)
      })

      const safeName = postulanteId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
      res.setHeader('Content-Type', 'application/zip')
      res.setHeader('Content-Disposition', `attachment; filename="documentos_${safeName}.zip"`)
      archive.pipe(res)

      let agregados = 0
      for (const [docId, url] of Object.entries(documentUrls)) {
        if (!url || typeof url !== 'string') continue
        const path = storagePathFromDownloadUrl(url)
        if (!path) continue
        const file = bucket.file(path)
        const [exists] = await file.exists()
        if (!exists) continue
        archive.append(file.createReadStream(), { name: nombreEntradaZip(docId) })
        agregados++
      }

      if (agregados === 0) {
        archive.append(Buffer.from('No hay archivos de documentación asociados a este postulante.', 'utf8'), {
          name: 'LEEME.txt',
        })
      }

      await archive.finalize()
    } catch (e) {
      console.error('descargarZipDocumentosPostulanteHttp zip', e)
      if (!res.headersSent) res.status(500).send('Error al generar ZIP.')
    }
  },
)
