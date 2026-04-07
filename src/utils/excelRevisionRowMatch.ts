import type { ExcelRevisionRow } from '../services/excelRevisionImport'
import type { PostulanteFirestore } from '../types/postulante'
import { normalizeRut } from '../postulacion/shared/rut'

/** Quita BOM, espacios raros y normaliza mayúsculas para comparar encabezados de Excel. */
function normEncabezado(h: string): string {
  return h
    .replace(/^\ufeff/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Encuentra el nombre exacto de columna en el Excel (comparación sin sensibilidad a mayúsculas). */
export function findColumnKeyIgnoreCase(headers: string[], target: string): string | null {
  const t = normEncabezado(target)
  for (const h of headers) {
    if (normEncabezado(h) === t) return h
  }
  return null
}

/**
 * Localiza la columna RUT aunque venga como "RUT", " Rut ", con BOM, o "RUT (1)" por duplicados en Excel.
 */
export function findRutColumnKey(headers: string[]): string | null {
  for (const h of headers) {
    const n = normEncabezado(h)
    if (n === 'rut') return h
  }
  for (const h of headers) {
    const n = normEncabezado(h)
    if (/^rut([\s(]|$)/.test(n)) return h
  }
  for (const h of headers) {
    const n = normEncabezado(h)
    if (/\brut\b/.test(n)) return h
  }
  return null
}

/**
 * Ordena las filas del Excel siguiendo el orden de `postulantes` y dejando solo coincidencias por RUT.
 * Si varias filas del Excel comparten RUT, gana la primera encontrada en el archivo.
 */
export function ordenarFilasExcelSegunPostulantes(
  rows: ExcelRevisionRow[],
  rutKey: string,
  ordenPostulantes: PostulanteFirestore[],
): ExcelRevisionRow[] {
  const byRut = new Map<string, ExcelRevisionRow>()
  for (const row of rows) {
    const raw = (row[rutKey] ?? '').trim()
    if (!raw) continue
    const k = normalizeRut(raw)
    if (!byRut.has(k)) byRut.set(k, row)
  }
  const out: ExcelRevisionRow[] = []
  for (const p of ordenPostulantes) {
    const row = byRut.get(normalizeRut(p.rut))
    if (row) out.push(row)
  }
  return out
}
