import type { ExcelRevisionRow } from './excelRevisionFirestoreLoad'

function normEncabezado(h: string): string {
  return h
    .replace(/^\ufeff/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function encabezadoEsEstadoCivil(h: string): boolean {
  const n = normEncabezado(h)
  return n === 'estado civil' || n.startsWith('estado civil ') || /^estado civil\s*\(/.test(n)
}

/** Incluye «Estado», «Estado (2)» por duplicados de Excel, etc.; excluye Estado civil. */
function encabezadoPareceColumnaEstadoRevision(h: string): boolean {
  if (encabezadoEsEstadoCivil(h)) return false
  const n = normEncabezado(h)
  if (n === 'estado') return true
  if (/^estado([\s(]|$)/.test(n)) return true
  if (/\bestado\b/.test(n)) return true
  return false
}

function celdaNormSinTildes(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Celda con etiqueta de revisión documental (Validado / Rechazado). */
function celdaEsValidadoORechazadoRevision(raw: string): boolean {
  const t = celdaNormSinTildes(raw)
  return t === 'validado' || t === 'rechazado'
}

/**
 * 0 = mejor (p. ej. Estado(2)); 1 = otros «Estado …»; 2 = «Estado» solo (suele ser columna equivocada si hay duplicado).
 */
function prioridadEncabezadoEstado(h: string): number {
  const n = normEncabezado(h)
  if (/^estado\s*\(\d+\)\s*$/.test(n)) return 0
  if (n === 'estado') return 2
  return 1
}

/**
 * Columna de revisión «Validado/Rechazado» (no Estado civil).
 * Si hay varias columnas «Estado», elige la que más celdas tengan Validado o Rechazado;
 * si empatan o no hay coincidencias, prioriza «Estado (n)» de Excel sobre «Estado» solo.
 */
export function findEstadoRevisionColumnKey(headers: string[], rows: ExcelRevisionRow[]): string | null {
  const candidates: string[] = []
  for (const h of headers) {
    if (encabezadoPareceColumnaEstadoRevision(h)) candidates.push(h)
  }
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
    const pa = prioridadEncabezadoEstado(a)
    const pb = prioridadEncabezadoEstado(b)
    if (pa !== pb) return pa - pb
    return headerIndex(a) - headerIndex(b)
  })

  return tier[0] ?? candidates[0]
}

/**
 * Únicamente la columna con encabezado exactamente «Puntaje Total» (mismo texto que el export del panel).
 * No se usan variantes tipo «Puntaje Total (2)» ni otras columnas parecidas.
 */
export function findPuntajeTotalColumnKey(headers: string[]): string | null {
  for (const h of headers) {
    if (normEncabezado(h) === 'puntaje total') return h
  }
  return null
}

/** Encabezado exactamente «Puntaje NEM» (mismo texto que el export del panel). */
export function findPuntajeNemColumnKey(headers: string[]): string | null {
  for (const h of headers) {
    if (normEncabezado(h) === 'puntaje nem') return h
  }
  return null
}

/** Valor numérico para ordenar; celdas vacías o no numéricas van al final en orden descendente. */
export function leerNumeroColumnaExcelEnFila(row: ExcelRevisionRow, columnKey: string | null): number {
  if (columnKey == null) return Number.NEGATIVE_INFINITY
  const v = parsePuntajeTotalCelda(String(row[columnKey] ?? ''))
  return v ?? Number.NEGATIVE_INFINITY
}

export function leerNumeroColumnaExcelPostulante(
  filasVista: ExcelRevisionRow[],
  p: Record<string, unknown>,
  columnKey: string | null,
): number {
  const idx = (p as { __origIdx?: number }).__origIdx
  if (typeof idx !== 'number' || idx < 0 || idx >= filasVista.length) return Number.NEGATIVE_INFINITY
  return leerNumeroColumnaExcelEnFila(filasVista[idx], columnKey)
}

/**
 * Filas con Estado «Validado» en la planilla (misma interpretación amplia que el cliente:
 * Validado/Validada, DOC. VALIDADA, etc.).
 */
export function celdaEsEstadoValidado(raw: string): boolean {
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

export function parsePuntajeTotalCelda(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n)) return null
  return n
}

export function filasSoloEstadoValidado(rows: ExcelRevisionRow[], estadoKey: string): ExcelRevisionRow[] {
  return rows.filter((r) => celdaEsEstadoValidado(r[estadoKey] ?? ''))
}

export function filasConPuntajeMinimo(
  rows: ExcelRevisionRow[],
  puntajeKey: string,
  minimo: number,
): ExcelRevisionRow[] {
  return rows.filter((r) => {
    const p = parsePuntajeTotalCelda(r[puntajeKey] ?? '')
    return p !== null && p >= minimo
  })
}
