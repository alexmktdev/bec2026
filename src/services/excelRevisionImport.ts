import ExcelJS from 'exceljs'
import { getExcelExportHeaderLabels } from './excelExport'

const MAX_FILE_BYTES = 32 * 1024 * 1024
const MAX_DATA_ROWS = 5000
const MAX_COLUMNS = 64

export type ExcelRevisionRow = Record<string, string>

export interface ExcelRevisionParseResult {
  headers: string[]
  rows: ExcelRevisionRow[]
  sheetName: string
  /** Coincidencia aproximada con el export del panel (solo informativo). */
  coincideConPlantillaExport: boolean
  /** ISO 8601: última vez que se guardó en IndexedDB en este navegador. */
  persistedAt?: string
}

function celdaATexto(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return String(v)
  }
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? '' : v.toLocaleString('es-CL')
  }
  if (typeof v === 'object' && v !== null) {
    const o = v as unknown as Record<string, unknown>
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((r) => r.text ?? '').join('')
    }
    if (typeof o.text === 'string' && 'hyperlink' in o) {
      return o.text
    }
    if (typeof o.text === 'string') {
      return o.text
    }
    if ('formula' in o && o.result !== undefined && o.result !== null) {
      return String(o.result)
    }
    if ('sharedFormula' in o && o.result !== undefined && o.result !== null) {
      return String(o.result)
    }
  }
  return ''
}

function normalizarEncabezadosUnicos(raw: string[]): string[] {
  const seen = new Map<string, number>()
  return raw.map((h, i) => {
    const base = (h || '').trim() || `Columna ${i + 1}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
}

function filaTieneContenido(cells: string[]): boolean {
  return cells.some((c) => c.trim().length > 0)
}

/**
 * Comprueba si los encabezados parecen los del export oficial (sin bloquear otros formatos).
 */
export function encabezadosCoincidenConExportOficial(headers: string[]): boolean {
  const esperados = getExcelExportHeaderLabels()
  if (headers.length < esperados.length * 0.5) return false
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const setH = new Set(headers.map(norm))
  let hits = 0
  for (const e of esperados) {
    if (setH.has(norm(e))) hits++
  }
  return hits >= Math.min(esperados.length, Math.ceil(esperados.length * 0.75))
}

/**
 * Lee la primera hoja de un .xlsx (p. ej. el Excel exportado desde el panel y editado offline).
 * Los datos no se envían a ningún servidor: solo se muestran en el navegador.
 */
export async function importarExcelRevisionDesdeArchivo(file: File): Promise<ExcelRevisionParseResult> {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    throw new Error('Use un archivo .xlsx (Excel).')
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`El archivo supera el tamaño máximo permitido (${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB).`)
  }

  const buffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const sheet = wb.worksheets[0]
  if (!sheet) {
    throw new Error('El libro no contiene hojas.')
  }

  const headerRow = sheet.getRow(1)
  const colCount = Math.min(
    Math.max(sheet.actualColumnCount || 0, sheet.columnCount || 0, 1),
    MAX_COLUMNS,
  )

  const rawHeaders: string[] = []
  for (let c = 1; c <= colCount; c++) {
    rawHeaders.push(celdaATexto(headerRow.getCell(c)))
  }
  const headers = normalizarEncabezadosUnicos(rawHeaders)
  if (headers.length === 0 || !headers.some((h) => h.trim().length > 0)) {
    throw new Error('La primera fila debe contener los títulos de columnas.')
  }

  const rows: ExcelRevisionRow[] = []
  const lastRow = Math.min(sheet.rowCount || 1, MAX_DATA_ROWS + 1)

  for (let r = 2; r <= lastRow; r++) {
    const row = sheet.getRow(r)
    const values: string[] = []
    for (let c = 1; c <= headers.length; c++) {
      values.push(celdaATexto(row.getCell(c)))
    }
    if (!filaTieneContenido(values)) continue
    const obj: ExcelRevisionRow = {}
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = values[i] ?? ''
    }
    rows.push(obj)
    if (rows.length >= MAX_DATA_ROWS) break
  }

  if (rows.length === 0) {
    throw new Error('No se encontraron filas de datos debajo de los encabezados.')
  }

  return {
    headers,
    rows,
    sheetName: sheet.name,
    coincideConPlantillaExport: encabezadosCoincidenConExportOficial(headers),
  }
}
