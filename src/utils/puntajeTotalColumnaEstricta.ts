import type { ExcelRevisionRow } from '../services/excelRevisionImport'

function normEncabezado(h: string): string {
  return h
    .replace(/^\ufeff/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/**
 * Solo la columna cuyo encabezado es exactamente «Puntaje Total» (sin «(2)», sin «pt. total», etc.).
 */
export function findColumnaPuntajeTotalEstricta(headers: string[]): string | null {
  for (const h of headers) {
    if (normEncabezado(h) === 'puntaje total') return h
  }
  return null
}

export function parseValorPuntajeTotalCelda(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n)) return null
  return n
}

export function filasConPuntajeTotalColumnaMinimo(
  rows: ExcelRevisionRow[],
  columnKey: string,
  minimo: number,
): ExcelRevisionRow[] {
  return rows.filter((r) => {
    const p = parseValorPuntajeTotalCelda(String(r[columnKey] ?? ''))
    return p !== null && p >= minimo
  })
}
