import type { ExcelRevisionParseResult, ExcelRevisionRow } from '../services/excelRevisionImport'
import type { PostulanteFirestore } from '../types/postulante'
import { rutClaveParaComparacion } from '../postulacion/shared/rut'

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
 * Celda de revisión «validada»: texto manual Validado/Validada o el rotulo del export del panel (DOC. VALIDADA).
 */
export function esCeldaEstadoValidado(raw: string): boolean {
  const t = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (t === 'validado' || t === 'validada') return true
  if (t === 'doc validada' || t === 'doc validado') return true
  if (t === 'documentacion validada') return true
  return false
}

/**
 * Celda «Rechazado» manual o etiqueta tipo export del panel (RECHAZADO).
 */
export function esCeldaEstadoRechazado(raw: string): boolean {
  const t = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (t === 'rechazado' || t === 'rechazada') return true
  if (t === 'doc rechazado' || t === 'doc rechazada') return true
  if (t === 'documentacion rechazada' || t === 'documentacion rechazado') return true
  return false
}

/** «Estado Civil» no es el estado de revisión documental (evita elegir la primera columna equivocada). */
function encabezadoEsEstadoCivil(h: string): boolean {
  const n = normEncabezado(h)
  return n === 'estado civil' || n.startsWith('estado civil ') || /^estado civil\s*\(/.test(n)
}

function encabezadoPareceEstado(h: string): boolean {
  if (encabezadoEsEstadoCivil(h)) return false
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

function celdaNormRevision(raw: string): string {
  return raw.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}

/** Solo para puntuar columnas candidatas (misma lógica que `filtroPuntajeTotalLogic` en Functions). */
function celdaEsValidadoORechazadoRevision(raw: string): boolean {
  const t = celdaNormRevision(raw)
  return t === 'validado' || t === 'rechazado'
}

function prioridadEncabezadoEstadoRevision(h: string): number {
  const n = normEncabezado(h)
  if (/^estado\s*\(\d+\)\s*$/.test(n)) return 0
  if (n === 'estado') return 2
  return 1
}

/**
 * Columna de revisión «Validado/Rechazado» (alineada con servidor: vista filtro puntaje / desempate).
 */
export function findEstadoRevisionColumnKey(headers: string[], rows: ExcelRevisionRow[]): string | null {
  const candidates = headers.filter(encabezadoPareceEstado)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  let bestScore = -1
  const scores = new Map<string, number>()
  for (const k of candidates) {
    let s = 0
    for (const r of rows) {
      if (celdaEsValidadoORechazadoRevision(r[k] ?? '')) s++
    }
    scores.set(k, s)
    if (s > bestScore) bestScore = s
  }

  const tier = candidates.filter((k) => (scores.get(k) ?? 0) === bestScore)
  const headerIndex = (k: string) => headers.indexOf(k)

  tier.sort((a, b) => {
    const pa = prioridadEncabezadoEstadoRevision(a)
    const pb = prioridadEncabezadoEstadoRevision(b)
    if (pa !== pb) return pa - pb
    return headerIndex(a) - headerIndex(b)
  })

  return tier[0] ?? candidates[0]
}

export type TotalesEstadoRevisionPlanilla = {
  totalFilas: number
  validados: number
  rechazados: number
  tieneColumnaEstado: boolean
}

/**
 * Conteos de «Validado» / «Rechazado» usando la misma columna Estado que el filtrado por puntaje en servidor.
 */
export function computeTotalesEstadoRevisionPlanilla(
  parsed: ExcelRevisionParseResult | null,
): TotalesEstadoRevisionPlanilla {
  if (!parsed || parsed.rows.length === 0) {
    return { totalFilas: 0, validados: 0, rechazados: 0, tieneColumnaEstado: false }
  }
  const estadoKey = findEstadoRevisionColumnKey(parsed.headers, parsed.rows)
  if (!estadoKey) {
    return { totalFilas: parsed.rows.length, validados: 0, rechazados: 0, tieneColumnaEstado: false }
  }
  let validados = 0
  let rechazados = 0
  for (const r of parsed.rows) {
    const cell = r[estadoKey] ?? ''
    if (esCeldaEstadoValidado(cell)) validados++
    else if (esCeldaEstadoRechazado(cell)) rechazados++
  }
  return {
    totalFilas: parsed.rows.length,
    validados,
    rechazados,
    tieneColumnaEstado: true,
  }
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
    const k = rutClaveParaComparacion(raw)
    if (!byRut.has(k)) byRut.set(k, row)
  }
  const out: ExcelRevisionRow[] = []
  for (const p of ordenPostulantes) {
    const row = byRut.get(rutClaveParaComparacion(p.rut))
    if (row) out.push(row)
  }
  return out
}
