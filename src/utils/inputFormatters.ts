/**
 * Filtros para inputs: solo texto (nombres, apellidos, etc.) o solo números.
 */

// Usamos Unicode property escapes para permitir letras con tildes (y otros diacríticos) de forma robusta.
// \p{L} = letras Unicode. \p{M} = marcas combinantes (tildes/diacríticos en algunos teclados).
const LETRAS_ESPACIOS = /[^\p{L}\p{M}\s\-'´`¨]/gu
const DOMICILIO = /[^\p{L}\p{M}0-9\s.,\-#´`¨]/gu

/** Solo letras (incl. acentos y ñ), espacios, guión y apóstrofe. Para nombres, apellidos, comuna, carrera, institución. */
export function soloTexto(value: string): string {
  return value.replace(LETRAS_ESPACIOS, '')
}

/** Letras, números y puntuación típica de direcciones (espacio, punto, coma, guión, #). */
export function soloTextoDomicilio(value: string): string {
  return value.replace(DOMICILIO, '')
}

/** Solo dígitos 0-9. Opcional: máximo de caracteres y/o permitir un decimal (ej. NEM). */
export function soloNumeros(
  value: string,
  opts: { maxLength?: number; allowDecimal?: boolean } = {},
): string {
  const { maxLength, allowDecimal } = opts
  let out = value.replace(allowDecimal ? /[^\d.]/g : /\D/g, '')
  if (allowDecimal) {
    const parts = out.split('.')
    if (parts.length > 2) out = parts[0] + '.' + parts.slice(1).join('')
    else if (parts.length === 2) out = parts[0] + '.' + parts[1].replace(/\./g, '')
  }
  if (maxLength != null && maxLength > 0) out = out.slice(0, maxLength)
  return out
}

/**
 * Normaliza emails: reemplaza ñ/Ñ por n/N, elimina espacios y pasa a minúsculas
 * (RFC 5322 técnicamente permite ñ pero casi ningún servidor lo soporta bien).
 */
export function formatEmail(value: string): string {
  return value
    .replace(/ñ/g, 'n')
    .replace(/Ñ/g, 'n')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** Convierte una fecha YYYY-MM-DD a DD-MM-YYYY */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '—'
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const [y, m, d] = parts
  // Si ya parece estar en formato DD-MM-YYYY (ej. d tiene 2 dígitos y y tiene 4)
  if (y.length === 2 && d.length === 4) return dateStr
  return `${d}-${m}-${y}`
}

/** Formatea timestamps ISO de Firestore a fecha y hora en formato local (es-CL) */
export function formatDateTime(isoString: string | undefined | null): string {
  if (!isoString) return '—'
  try {
    const d = new Date(isoString)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CL')
  } catch {
    return '—'
  }
}

/** Fecha/hora local en 24 h: `DD-MM-YYYY HH.mm hrs` (punto entre hora y minutos). */
export function formatFechaRegistro24hFromDate(d: Date): string {
  if (Number.isNaN(d.getTime())) return '—'
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const HH = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}-${mm}-${yyyy} ${HH}.${min} hrs`
}

export function formatFechaRegistro24h(isoString: string | undefined | null): string {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return Number.isNaN(d.getTime()) ? '—' : formatFechaRegistro24hFromDate(d)
}

/**
 * Normaliza textos de celda (p. ej. export es-CL con am/pm) al formato 24 h del panel.
 * Si no se puede interpretar como fecha, devuelve el texto original.
 */
export function intentarFormatearFechaRegistroDesdeTexto(text: string): string {
  const t = text.trim()
  if (!t) return t
  if (/\d{1,2}-\d{1,2}-\d{4}.*\d{2}\.\d{2}\s*hrs/i.test(t)) return t
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return t
  return formatFechaRegistro24hFromDate(d)
}

/**
 * Formatea fecha/hora en formato "DD-MM-YYYY HH:mm".
 * Si el valor no trae hora (ej. YYYY-MM-DD), devuelve solo "DD-MM-YYYY".
 */
export function formatDateTimeDmyHm(value: string | undefined | null): string {
  if (!value) return '—'

  const raw = String(value).trim()
  if (!raw) return '—'

  // Caso fecha simple (YYYY-MM-DD): mantenemos sin hora para evitar "00:00" artificial.
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return formatDate(raw)
  }

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return '—'

  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`
}

const LOCALE_TITULO = 'es-CL'

/**
 * Primera letra de cada palabra en mayúscula y el resto en minúsculas (p. ej. "banco DE chile" → "Banco De Chile").
 * Útil para nombres propios tecleados en el formulario.
 */
export function capitalizarTituloPorPalabras(value: string): string {
  return value
    .split(/\s+/)
    .map((word) => {
      if (!word) return ''
      const first = word.charAt(0).toLocaleUpperCase(LOCALE_TITULO)
      const rest = word.slice(1).toLocaleLowerCase(LOCALE_TITULO)
      return first + rest
    })
    .join(' ')
}
