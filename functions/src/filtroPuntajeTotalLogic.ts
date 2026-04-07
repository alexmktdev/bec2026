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

/** Columna «Estado» de revisión (no Estado civil). */
export function findEstadoRevisionColumnKey(headers: string[]): string | null {
  for (const h of headers) {
    if (encabezadoEsEstadoCivil(h)) continue
    const n = normEncabezado(h)
    if (n === 'estado') return h
  }
  for (const h of headers) {
    if (encabezadoEsEstadoCivil(h)) continue
    const n = normEncabezado(h)
    if (/^estado([\s(]|$)/.test(n)) return h
  }
  for (const h of headers) {
    if (encabezadoEsEstadoCivil(h)) continue
    const n = normEncabezado(h)
    if (/\bestado\b/.test(n)) return h
  }
  return null
}

export function findPuntajeTotalColumnKey(headers: string[]): string | null {
  for (const h of headers) {
    const n = normEncabezado(h)
    if (n === 'puntaje total' || n === 'pt. total') return h
  }
  for (const h of headers) {
    const n = normEncabezado(h)
    if (n.includes('puntaje') && n.includes('total')) return h
  }
  return null
}

/** Solo filas con Estado «Validado» (mayúsculas/espacios); no «Rechazado» ni otros. */
export function celdaEsEstadoValidado(raw: string): boolean {
  const t = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  return t === 'validado'
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
