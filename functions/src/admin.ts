import './functionsInit'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import * as admin from 'firebase-admin'
import { DocumentReference, GeoPoint, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import archiver from 'archiver'
import type { PostulanteData, PostulanteRechazadoEntrada, AuditLog } from '../../src/types/postulante'
import { ordenarDocsPostulantesComoEnPanel } from './postulantesOrdenPanel'
import { aplicarCorsZipDocumentacionCompleta } from './allowedWebOrigins'
import { webCallableBase } from './httpsCallableDefaults'
import { calcularPuntajeTotal } from '../../src/postulacion/shared/scoring'
import { construirVistaFiltroPuntajeTotal } from './filtroPuntajeTotalVista'
import { postulantesParaRankingDesdeVistaPuntaje } from './desempateDesdeVistaPuntaje'

/** Campos que el panel puede enviar; nunca id, createdAt ni puntaje (se recalcula en servidor). */
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

/** Un solo doc Firestore por export Excel (evita miles de escrituras de tokens). */
const EXCEL_ZIP_EXPORT_BATCHES = 'excel_zip_export_batches'
const EXCEL_ZIP_BATCH_TTL_MS = 72 * 60 * 60 * 1000

/** Consultas `file.exists()` a Storage en paralelo (ZIP masivo). */
const STORAGE_EXISTS_PARALLEL = 220

function nombreEntradaZip(docId: string): string {
  return DOC_ZIP_ENTRY_NAMES[docId] ?? `${docId}.pdf`
}

async function streamZipDocumentosPostulanteHttp(
  res: ServerResponse,
  postulanteId: string,
  pdata: {
    documentUrls?: Record<string, string>
    rut?: unknown
    nombres?: unknown
    apellidoPaterno?: unknown
    apellidoMaterno?: unknown
  },
): Promise<void> {
  const documentUrls =
    pdata.documentUrls && typeof pdata.documentUrls === 'object' ? pdata.documentUrls : {}
  const bucket = admin.storage().bucket()
  const carpeta = carpetaRaizZipPostulante(pdata, postulanteId)
  const archive = archiver('zip', { zlib: { level: 0 } })
  archive.on('error', (err: Error) => {
    console.error('archiver error', err)
  })
  const safeZipFileName = carpeta.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || postulanteId.slice(0, 40)
  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="documentos_${safeZipFileName}.zip"`)
  archive.pipe(res)

  let agregados = 0
  for (const [docId, url] of Object.entries(documentUrls)) {
    if (!url || typeof url !== 'string') continue
    const path = storagePathFromDownloadUrl(url)
    if (!path) continue
    const file = bucket.file(path)
    const [exists] = await file.exists()
    if (!exists) continue
    archive.append(file.createReadStream(), { name: `${carpeta}/${nombreEntradaZip(docId)}` })
    agregados++
  }

  if (agregados === 0) {
    archive.append(Buffer.from('No hay archivos de documentación asociados a este postulante.', 'utf8'), {
      name: `${carpeta}/LEEME.txt`,
    })
  }

  await archive.finalize()
}

async function streamZipDocumentacionCompletaMasiva(
  res: ServerResponse,
  permitidos: { id: string; pdata: Record<string, unknown> }[],
): Promise<void> {
  const bucket = admin.storage().bucket()
  const archive = archiver('zip', { zlib: { level: 0 } })
  archive.on('error', (err: Error) => console.error('archiver masivo', err))

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="documentos_postulantes_${new Date().toISOString().slice(0, 10)}.zip"`,
  )
  archive.pipe(res)

  const root = 'carpeta_postulaciones'
  const docOrderByPrefix = new Map<string, string[]>()
  const pending: { prefix: string; docId: string; file: ReturnType<typeof bucket.file> }[] = []

  for (const { id, pdata } of permitidos) {
    const documentUrls =
      pdata.documentUrls && typeof pdata.documentUrls === 'object' && pdata.documentUrls !== null
        ? (pdata.documentUrls as Record<string, string>)
        : {}
    const carpeta = carpetaRaizZipPostulante(pdata, id)
    const prefix = `${root}/${carpeta}`
    const keys = Object.entries(documentUrls)
      .filter(([, url]) => url && typeof url === 'string')
      .map(([k]) => k)
    docOrderByPrefix.set(prefix, keys)

    for (const [docId, url] of Object.entries(documentUrls)) {
      if (!url || typeof url !== 'string') continue
      const path = storagePathFromDownloadUrl(url)
      if (!path) continue
      pending.push({ prefix, docId, file: bucket.file(path) })
    }
  }

  const ok: { prefix: string; docId: string; file: ReturnType<typeof bucket.file> }[] = []
  for (let i = 0; i < pending.length; i += STORAGE_EXISTS_PARALLEL) {
    const slice = pending.slice(i, i + STORAGE_EXISTS_PARALLEL)
    const hits = await Promise.all(
      slice.map(async (j) => ((await j.file.exists())[0] ? j : null)),
    )
    for (const h of hits) {
      if (h) ok.push(h)
    }
  }

  const byPrefix = new Map<string, { prefix: string; docId: string; file: ReturnType<typeof bucket.file> }[]>()
  for (const j of ok) {
    const arr = byPrefix.get(j.prefix) ?? []
    arr.push(j)
    byPrefix.set(j.prefix, arr)
  }

  for (const { id, pdata } of permitidos) {
    const carpeta = carpetaRaizZipPostulante(pdata, id)
    const prefix = `${root}/${carpeta}`
    const orden = docOrderByPrefix.get(prefix) ?? []
    let list = byPrefix.get(prefix) ?? []
    list = [...list].sort((a, b) => orden.indexOf(a.docId) - orden.indexOf(b.docId))
    if (list.length === 0) {
      archive.append(Buffer.from('Sin archivos en Storage para este postulante.', 'utf8'), {
        name: `${prefix}/LEEME.txt`,
      })
    } else {
      for (const j of list) {
        archive.append(j.file.createReadStream(), { name: `${prefix}/${nombreEntradaZip(j.docId)}` })
      }
    }
  }

  await archive.finalize()
}

/** Carpeta raíz dentro del ZIP: RUT + nombres + apellidos (alineado con `src/services/zipDownload.ts`). */
function carpetaRaizZipPostulante(
  pdata: {
    rut?: unknown
    nombres?: unknown
    apellidoPaterno?: unknown
    apellidoMaterno?: unknown
  },
  postulanteId: string,
): string {
  const rut = String(pdata.rut ?? '')
    .replace(/\./g, '')
    .trim()
  const nombres = String(pdata.nombres ?? '').trim()
  const ap1 = String(pdata.apellidoPaterno ?? '').trim()
  const ap2 = String(pdata.apellidoMaterno ?? '').trim()
  const partes = [rut, nombres, ap1, ap2].filter((p) => p.length > 0)
  const raw = partes.length > 0 ? partes.join('_') : postulanteId
  let s = raw.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')
  s = s.replace(/_+/g, '_').replace(/^_|_$/g, '')
  if (!s) {
    s = postulanteId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
  }
  return s.slice(0, 120)
}

function assertPuedeDescargarDocumentosPostulante(role: string): void {
  const r = role.toLowerCase().trim()
  if (r === 'superadmin' || r === 'admin' || r === 'revisor') return
  throw new HttpsError('permission-denied', 'No tiene permisos.')
}

export async function assertRevisorOrAdmin(
  callerUid: string,
  db: admin.firestore.Firestore,
  tokenEmail?: string,
): Promise<{ email: string; role: string }> {
  const userDoc = await db.collection('users').doc(callerUid).get()
  const role = (userDoc.data()?.role || '').toString().toLowerCase().trim()
  if (!['superadmin', 'revisor', 'admin'].includes(role)) {
    throw new HttpsError('permission-denied', 'No tiene privilegios para esta operación.')
  }
  const email = (tokenEmail || (userDoc.data()?.email as string | undefined) || 'unknown').toString()
  return { email: email || 'unknown', role }
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
export async function verifySuperAdmin(uid: string, db: admin.firestore.Firestore): Promise<void> {
  const userDoc = await db.collection('users').doc(uid).get()
  const role = (userDoc.data()?.role || '').toString().toLowerCase().trim()
  if (!userDoc.exists || role !== 'superadmin') {
    throw new HttpsError('permission-denied', 'Acceso denegado: Se requiere rol de SuperAdministrador.')
  }
}

// -------------------------------------------------------------
// 1. Historial de Auditoría
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

// 2. Extracción de Postulantes Segura (Backend Filtering)
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
 * Ranking de desempate calculado en backend.
 * Base: filas de la vista «Filtrado por puntaje total» del usuario (Validado + umbral global si aplica),
 * cruzadas con postulantes en Firestore por RUT (si no hay match, fila solo con datos del Excel).
 * Orden Puntaje total (desc).
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

      const snapshot = await db.collection('postulantes').get()
      const sortedDocs = ordenarDocsPostulantesComoEnPanel(snapshot.docs)
      const postulantesBase = sortedDocs.map((d) => ({ id: d.id, ...d.data() as Record<string, unknown> }))

      const vista = await construirVistaFiltroPuntajeTotal(db, callerUid)

      let elegibles: Record<string, unknown>[]
      let fuenteVistaPuntaje: {
        sinDatos: boolean
        totalFilasVista: number
        umbralActivo: number | null
        mensaje?: string
      }

      if (vista.sinExcel || vista.totalVista === 0) {
        elegibles = []
        fuenteVistaPuntaje = {
          sinDatos: true,
          totalFilasVista: vista.totalVista,
          umbralActivo: vista.umbralActivo,
          mensaje: vista.sinExcel
            ? 'No hay planilla guardada para su usuario. Suba el Excel en Revisión de documentos y use Filtrado por puntaje total.'
            : 'La vista filtrada no tiene filas (revise columnas Estado / Puntaje total y el umbral global).',
        }
      } else {
        elegibles = postulantesParaRankingDesdeVistaPuntaje(vista, postulantesBase)
        const sinMatch = elegibles.length === 0 && vista.totalVista > 0
        fuenteVistaPuntaje = {
          sinDatos: elegibles.length === 0,
          totalFilasVista: vista.totalVista,
          umbralActivo: vista.umbralActivo,
          mensaje: sinMatch
            ? 'Ninguna fila de la vista tiene un RUT reconocible o no se pudo armar el listado. Revise el Excel.'
            : undefined,
        }
      }

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

      const postulantesJson = ranking.map((p) => {
        const { __origIdx: _omit, ...rest } = p as Record<string, unknown>
        return serializarParaCallable(rest) as Record<string, unknown>
      })

      const tablaVistaDesempate =
        !vista.sinExcel && vista.totalVista > 0 && ranking.length > 0
          ? {
              headers: vista.headers,
              sheetName: vista.sheetName,
              coincideConPlantillaExport: vista.coincideConPlantillaExport,
              persistedAt: vista.persistedAt,
              rows: ranking.map((p) => {
                const i = (p as { __origIdx?: number }).__origIdx
                if (typeof i !== 'number' || i < 0 || i >= vista.filasVista.length) {
                  return {} as Record<string, string>
                }
                return vista.filasVista[i]
              }),
            }
          : null

      return {
        postulantes: postulantesJson,
        criterioHasta,
        empatesResumen,
        fuenteVistaPuntaje,
        tablaVistaDesempate,
      }
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
 * Solo admin/revisor (panel).
 */
export const emitirEnlaceDescargaZipDocumentos = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 30, maxInstances: 20 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const postulanteId = String((request.data as { postulanteId?: unknown })?.postulanteId ?? '').trim()
    if (!postulanteId) throw new HttpsError('invalid-argument', 'postulanteId requerido.')

    const db = admin.firestore()
    const { email, role } = await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)

    const snap = await db.collection('postulantes').doc(postulanteId).get()
    if (!snap.exists) throw new HttpsError('not-found', 'Postulante no encontrado.')

    assertPuedeDescargarDocumentosPostulante(role)

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

const LOTE_ZIP_MAX_FILAS = 3000
/** Admin SDK permite muchos refs por `getAll`; trozos en paralelo acelera el export Excel. */
const LOTE_ZIP_GETALL_CHUNK = 120

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/**
 * Emite muchos tokens de descarga ZIP en una sola invocación (p. ej. export Excel).
 * `postulanteIds[i]` corresponde a la fila `i`; cadenas vacías se ignoran.
 * Admin/revisor autorizado: token por fila con id de postulante (filas sin id o inexistentes quedan vacías).
 */
export const emitirEnlacesDescargaZipDocumentosLote = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 60, maxInstances: 20 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const raw = (request.data as { postulanteIds?: unknown })?.postulanteIds
    if (!Array.isArray(raw)) {
      throw new HttpsError('invalid-argument', 'postulanteIds debe ser un arreglo.')
    }
    if (raw.length === 0) {
      return { tokens: [] as string[] }
    }
    if (raw.length > LOTE_ZIP_MAX_FILAS) {
      throw new HttpsError(
        'invalid-argument',
        `Máximo ${LOTE_ZIP_MAX_FILAS} filas por lote. Reduzca el export o exporte por partes.`,
      )
    }

    const postulanteIds = raw.map((x) => String(x ?? '').trim())
    const db = admin.firestore()
    const { email, role } = await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)
    assertPuedeDescargarDocumentosPostulante(role)

    const idsParaLeer = [...new Set(postulanteIds.filter((id) => id.length > 0))]
    const snapsMap = new Map<string, DocumentSnapshot>()
    const refChunks = chunkArray(
      idsParaLeer.map((id) => db.collection('postulantes').doc(id)),
      LOTE_ZIP_GETALL_CHUNK,
    )
    const snapBatches = await Promise.all(
      refChunks.map((part) => (part.length ? db.getAll(...part) : Promise.resolve([]))),
    )
    for (const snaps of snapBatches) {
      for (const s of snaps) {
        if (s.exists) snapsMap.set(s.id, s)
      }
    }

    /** Por fila: id del postulante si puede descargar; el cliente arma `?b=&p=` con `batchId`. */
    const tokens: string[] = new Array(postulanteIds.length).fill('')
    const allowedSet = new Set<string>()

    for (let i = 0; i < postulanteIds.length; i++) {
      const id = postulanteIds[i]
      if (!id) continue
      const snap = snapsMap.get(id)
      if (!snap?.exists) continue
      tokens[i] = id
      allowedSet.add(id)
    }

    let batchId = ''
    if (allowedSet.size > 0) {
      batchId = randomUUID()
      await db
        .collection(EXCEL_ZIP_EXPORT_BATCHES)
        .doc(batchId)
        .set({
          postulanteIds: [...allowedSet],
          expiresAtMs: Date.now() + EXCEL_ZIP_BATCH_TTL_MS,
          createdAt: new Date().toISOString(),
          createdByUid: callerUid,
        })
    }

    await writeAuditLog(
      db,
      callerUid,
      email,
      'EMITIR_ENLACES_ZIP_DOCS_LOTE',
      'LOTE_EXCEL',
      `Export Excel ZIP: batch ${batchId || '(vacío)'} con ${allowedSet.size} postulantes únicos sobre ${postulanteIds.length} filas.`,
    )

    return { batchId, tokens }
  },
)

/**
 * GET público:
 * - `?t=` token Firestore de un solo uso (panel / enlace individual).
 * - `?b=&p=` lote de export Excel (varios usos hasta expirar el lote; `p` = id postulante).
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
    const batchId = String((req.query as { b?: string }).b ?? '').trim()
    const pidFromBatch = String((req.query as { p?: string }).p ?? '').trim()

    const db = admin.firestore()

    let postulanteId: string | null = null
    let tokenExpirado = false

    if (tokenId) {
      const tokenRef = db.collection(DESCARGA_DOCS_ZIP_TOKENS).doc(tokenId)
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
    } else if (batchId && pidFromBatch) {
      const batchSnap = await db.collection(EXCEL_ZIP_EXPORT_BATCHES).doc(batchId).get()
      if (!batchSnap.exists) {
        res.status(404).send('Enlace de exportación inválido.')
        return
      }
      const bdata = batchSnap.data() as { expiresAtMs?: number; postulanteIds?: unknown }
      const exp = Number(bdata.expiresAtMs)
      if (!Number.isFinite(exp) || exp <= 0) {
        res.status(404).send('Enlace de exportación inválido.')
        return
      }
      if (Date.now() > exp) {
        res.status(410).send('El enlace de exportación expiró.')
        return
      }
      const raw = bdata.postulanteIds
      const allowed =
        Array.isArray(raw) ? raw.map((x) => String(x ?? '').trim()).filter((s) => s.length > 0) : []
      if (!allowed.includes(pidFromBatch)) {
        res.status(403).send('Este postulante no está en esta exportación.')
        return
      }
      postulanteId = pidFromBatch
    } else {
      res.status(400).send('Use ?t= (token) o ?b= y &p= (export Excel).')
      return
    }

    try {
      const pSnap = await db.collection('postulantes').doc(postulanteId).get()
      if (!pSnap.exists) {
        res.status(404).send('Postulante no encontrado.')
        return
      }
      const pdata = pSnap.data() as {
        documentUrls?: Record<string, string>
        rut?: unknown
        nombres?: unknown
        apellidoPaterno?: unknown
        apellidoMaterno?: unknown
      }
      await streamZipDocumentosPostulanteHttp(res as unknown as ServerResponse, postulanteId, pdata)
    } catch (e) {
      console.error('descargarZipDocumentosPostulanteHttp zip', e)
      if (!res.headersSent) res.status(500).send('Error al generar ZIP.')
    }
  },
)

const ZIP_MASIVO_MAX_IDS = 3000

type ReqHttpConBody = { body?: unknown } & Pick<IncomingMessage, 'on'>

async function leerCuerpoJsonHttp(req: ReqHttpConBody): Promise<{ postulanteIds?: unknown }> {
  const b = req.body
  if (b && typeof b === 'object' && b !== null && !Buffer.isBuffer(b)) {
    return b as { postulanteIds?: unknown }
  }
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve())
    req.on('error', reject)
  })
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return {}
  return JSON.parse(raw) as { postulanteIds?: unknown }
}

/**
 * POST JSON `{ postulanteIds: string[] }` con `Authorization: Bearer <Firebase ID token>`.
 * Genera un ZIP con estructura `carpeta_postulaciones/…` (misma idea que el panel) leyendo desde Storage en el servidor.
 */
export const descargarZipDocumentacionCompletaHttp = onRequest(
  {
    region: 'southamerica-west1',
    /** CORS lo aplica el handler (preflight + `Authorization`); ver `aplicarCorsZipDocumentacionCompleta`. */
    cors: false,
    invoker: 'public',
    memory: '2GiB',
    timeoutSeconds: 900,
    maxInstances: 12,
  },
  async (req, res) => {
    if (aplicarCorsZipDocumentacionCompleta(req, res)) return

    if (req.method !== 'POST') {
      res.status(405).set('Allow', 'POST').send('Use POST')
      return
    }

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).send('Se requiere Authorization: Bearer <token>')
      return
    }
    const idToken = authHeader.slice(7).trim()
    if (!idToken) {
      res.status(401).send('Token vacío.')
      return
    }

    let decoded: admin.auth.DecodedIdToken
    try {
      decoded = await admin.auth().verifyIdToken(idToken)
    } catch {
      res.status(401).send('Token inválido.')
      return
    }

    let body: { postulanteIds?: unknown }
    try {
      body = await leerCuerpoJsonHttp(req as ReqHttpConBody)
    } catch {
      res.status(400).send('JSON inválido.')
      return
    }

    const rawIds = body.postulanteIds
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      res.status(400).send('postulanteIds requerido (arreglo no vacío).')
      return
    }
    const postulanteIds = [...new Set(rawIds.map((x) => String(x ?? '').trim()).filter((s) => s.length > 0))]
    if (postulanteIds.length > ZIP_MASIVO_MAX_IDS) {
      res.status(400).send(`Máximo ${ZIP_MASIVO_MAX_IDS} postulantes por descarga.`)
      return
    }

    const db = admin.firestore()
    let email: string
    try {
      const x = await assertRevisorOrAdmin(decoded.uid, db, decoded.email)
      email = x.email
      assertPuedeDescargarDocumentosPostulante(x.role)
    } catch {
      res.status(403).send('Sin permisos.')
      return
    }

    const refChunks = chunkArray(
      postulanteIds.map((id) => db.collection('postulantes').doc(id)),
      LOTE_ZIP_GETALL_CHUNK,
    )
    const snapBatches = await Promise.all(
      refChunks.map((part) => (part.length ? db.getAll(...part) : Promise.resolve([]))),
    )
    const snapsMap = new Map<string, DocumentSnapshot>()
    for (const snaps of snapBatches) {
      for (const s of snaps) {
        if (s.exists) snapsMap.set(s.id, s)
      }
    }

    const permitidos: { id: string; pdata: Record<string, unknown> }[] = []
    for (const id of postulanteIds) {
      const snap = snapsMap.get(id)
      if (!snap?.exists) continue
      permitidos.push({ id, pdata: snap.data() as Record<string, unknown> })
    }

    if (permitidos.length === 0) {
      res.status(404).send('No hay documentación accesible para descargar.')
      return
    }

    await writeAuditLog(
      db,
      decoded.uid,
      email,
      'DESCARGA_ZIP_COMPLETA_HTTP',
      'MASIVO',
      `ZIP masivo servidor: ${permitidos.length} postulantes.`,
    )

    try {
      await streamZipDocumentacionCompletaMasiva(res as unknown as ServerResponse, permitidos)
    } catch (e) {
      console.error('descargarZipDocumentacionCompletaHttp', e)
      if (!res.headersSent) res.status(500).send('Error al generar ZIP.')
    }
  },
)
