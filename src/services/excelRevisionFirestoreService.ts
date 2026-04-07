import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { auth, db, prepareCallableSecurity } from '../firebase/config'
import type { ExcelRevisionParseResult, ExcelRevisionRow } from './excelRevisionImport'

/** Filas por documento de trozo (límite ~1 MiB por documento en Firestore). */
const ROWS_PER_CHUNK = 22
const MAX_ROWS = 5000

function chunksCollection(uid: string) {
  return collection(db, 'excel_revision_imports', uid, 'chunks')
}

function metaDocRef(uid: string) {
  return doc(db, 'excel_revision_imports', uid)
}

function tsToIso(t: unknown): string | undefined {
  if (t instanceof Timestamp) return t.toDate().toISOString()
  return undefined
}

function normalizeRow(r: unknown): ExcelRevisionRow {
  if (!r || typeof r !== 'object') return {}
  const o: ExcelRevisionRow = {}
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
    o[k] = v === null || v === undefined ? '' : String(v)
  }
  return o
}

async function eliminarTodosLosChunks(uid: string): Promise<void> {
  const snap = await getDocs(chunksCollection(uid))
  if (snap.empty) return
  let batch = writeBatch(db)
  let n = 0
  for (const d of snap.docs) {
    batch.delete(d.ref)
    n++
    if (n >= 450) {
      await batch.commit()
      batch = writeBatch(db)
      n = 0
    }
  }
  if (n > 0) await batch.commit()
}

/**
 * Guarda la tabla en Firestore (mismo backend que usa el panel; datos propios del usuario autenticado).
 */
export async function saveExcelRevisionImportFirestore(data: ExcelRevisionParseResult): Promise<string> {
  await prepareCallableSecurity()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Debe iniciar sesión para guardar la tabla.')

  const { headers, rows, sheetName, coincideConPlantillaExport } = data
  if (rows.length > MAX_ROWS) {
    throw new Error(`Como máximo ${MAX_ROWS} filas pueden guardarse en la base de datos.`)
  }

  await eliminarTodosLosChunks(uid)
  await deleteDoc(metaDocRef(uid)).catch(() => {})

  const chunks: ExcelRevisionRow[][] = []
  for (let i = 0; i < rows.length; i += ROWS_PER_CHUNK) {
    chunks.push(rows.slice(i, i + ROWS_PER_CHUNK))
  }

  let batch = writeBatch(db)
  let ops = 0
  for (let i = 0; i < chunks.length; i++) {
    batch.set(doc(chunksCollection(uid), String(i)), { rows: chunks[i] })
    ops++
    if (ops >= 450) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }
  if (ops > 0) await batch.commit()

  await setDoc(metaDocRef(uid), {
    headers,
    sheetName,
    coincideConPlantillaExport,
    rowCount: rows.length,
    chunkCount: chunks.length,
    updatedAt: serverTimestamp(),
  })

  const meta = await getDoc(metaDocRef(uid))
  const u = meta.get('updatedAt')
  return tsToIso(u) ?? new Date().toISOString()
}

export async function loadExcelRevisionImportFirestore(): Promise<ExcelRevisionParseResult | null> {
  await prepareCallableSecurity()
  const uid = auth.currentUser?.uid
  if (!uid) return null

  const metaSnap = await getDoc(metaDocRef(uid))
  if (!metaSnap.exists()) return null

  const d = metaSnap.data()
  const headers = Array.isArray(d.headers) ? d.headers.map((x: unknown) => String(x ?? '')) : []
  const sheetName = typeof d.sheetName === 'string' ? d.sheetName : ''
  const coincideConPlantillaExport = d.coincideConPlantillaExport === true
  const chunkCount = typeof d.chunkCount === 'number' ? d.chunkCount : 0
  const rowCount = typeof d.rowCount === 'number' ? d.rowCount : 0

  if (headers.length === 0 || chunkCount < 0) return null

  const rows: ExcelRevisionRow[] = []
  for (let i = 0; i < chunkCount; i++) {
    const cs = await getDoc(doc(chunksCollection(uid), String(i)))
    if (!cs.exists()) continue
    const raw = cs.data()?.rows
    if (!Array.isArray(raw)) continue
    for (const item of raw) {
      rows.push(normalizeRow(item))
    }
  }

  if (rows.length === 0 && rowCount > 0) {
    return null
  }

  return {
    headers,
    rows,
    sheetName,
    coincideConPlantillaExport,
    persistedAt: tsToIso(d.updatedAt),
  }
}

export async function clearExcelRevisionImportFirestore(): Promise<void> {
  await prepareCallableSecurity()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('Debe iniciar sesión.')

  await eliminarTodosLosChunks(uid)
  await deleteDoc(metaDocRef(uid)).catch(() => {})
}
