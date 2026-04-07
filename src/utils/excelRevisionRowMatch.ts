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

/** Acepta «Validado» o «Validada» en el Excel (mayúsculas, espacios, sin tildes inconsistentes). */
export function esCeldaEstadoValidado(raw: string): boolean {
  const t = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return t === 'validado' || t === 'validada'
}

function encabezadoPareceEstado(h: string): boolean {
  const n = normEncabezado(h)
  if (n === 'estado') return true
  if (/^estado([\s(]|$)/.test(n)) return true
  if (/\bestado\b/.test(n)) return true
  return false
}

/**
 * Columnas «Estado» (export del panel puede traer una; la revisión manual puede añadir otra).
 */
export function listEstadoColumnKeys(headers: string[]): string[] {
  return headers.filter(encabezadoPareceEstado)
}

/**
 * Elige la columna Estado donde aparezca al menos un «Validado»; si ninguna, usa la primera candidata.
 */
export function findEstadoColumnKeyParaValidado(headers: string[], rows: ExcelRevisionRow[]): string | null {
  const keys = listEstadoColumnKeys(headers)
  if (keys.length === 0) return null
  for (const k of keys) {
    if (rows.some((r) => esCeldaEstadoValidado(r[k] ?? ''))) return k
  }
  return keys[0] ?? null
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
