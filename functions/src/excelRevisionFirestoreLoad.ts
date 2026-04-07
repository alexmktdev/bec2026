import type { Firestore } from 'firebase-admin/firestore'

export type ExcelRevisionRow = Record<string, string>

function normalizeRow(r: unknown): ExcelRevisionRow {
  if (!r || typeof r !== 'object') return {}
  const o: ExcelRevisionRow = {}
  for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
    o[k] = v === null || v === undefined ? '' : String(v)
  }
  return o
}

function tsToIso(t: unknown): string | null {
  if (t && typeof t === 'object' && 'toDate' in t && typeof (t as { toDate: () => Date }).toDate === 'function') {
    try {
      const d = (t as { toDate: () => Date }).toDate()
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d.toISOString()
    } catch {
      /* ignore */
    }
  }
  return null
}

/** Carga la planilla guardada en `excel_revision_imports/{uid}` (misma estructura que el cliente). */
export async function loadExcelRevisionImportFromFirestore(
  db: Firestore,
  uid: string,
): Promise<{
  headers: string[]
  rows: ExcelRevisionRow[]
  sheetName: string
  coincideConPlantillaExport: boolean
  persistedAt: string | null
} | null> {
  const metaSnap = await db.collection('excel_revision_imports').doc(uid).get()
  if (!metaSnap.exists) return null

  const d = metaSnap.data()!
  const headers = Array.isArray(d.headers) ? d.headers.map((x: unknown) => String(x ?? '')) : []
  const sheetName = typeof d.sheetName === 'string' ? d.sheetName : ''
  const coincideConPlantillaExport = d.coincideConPlantillaExport === true
  const chunkCount = typeof d.chunkCount === 'number' ? d.chunkCount : 0

  if (headers.length === 0) return null

  const rows: ExcelRevisionRow[] = []
  const chunksCol = db.collection('excel_revision_imports').doc(uid).collection('chunks')

  for (let i = 0; i < chunkCount; i++) {
    const cs = await chunksCol.doc(String(i)).get()
    if (!cs.exists) continue
    const raw = cs.data()?.rows
    if (!Array.isArray(raw)) continue
    for (const item of raw) {
      rows.push(normalizeRow(item))
    }
  }

  const persistedAt = tsToIso(d.updatedAt) ?? null

  return {
    headers,
    rows,
    sheetName,
    coincideConPlantillaExport,
    persistedAt,
  }
}
