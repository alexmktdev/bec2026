import type { ExcelRevisionRow } from '../services/excelRevisionImport'
import type { PostulanteFirestore } from '../types/postulante'
import { normalizeRut } from '../postulacion/shared/rut'

/** Encuentra el nombre exacto de columna en el Excel (comparación sin sensibilidad a mayúsculas). */
export function findColumnKeyIgnoreCase(headers: string[], target: string): string | null {
  const t = target.trim().toLowerCase()
  for (const h of headers) {
    if (h.trim().toLowerCase() === t) return h
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
