/**
 * Normaliza RUT chileno para usarlo como ID de documento y en consultas.
 * "17.379.095-3" -> "17379095-3"
 */
export function normalizeRut(rut: string): string {
  return rut.replace(/\./g, '').replace(/\s/g, '').toLowerCase()
}

/**
 * Clave estable para cruzar RUT entre Excel y servidor.
 * Excel a veces entrega número sin guión: "173790953" → "17379095-3".
 */
export function rutClaveParaComparacion(rut: string): string {
  const n = normalizeRut(rut)
  if (!n) return n
  if (n.includes('-')) {
    const [body, dv] = n.split('-')
    if (body && dv && /^\d{7,8}$/.test(body) && /^[\dk]$/.test(dv)) {
      return `${body}-${dv}`
    }
    return n
  }
  const m = n.match(/^(\d{7,8})([\dk])$/)
  if (m) return `${m[1]}-${m[2]}`
  return n
}

/** Formato mínimo: cuerpo numérico + guión + dígito verificador (k permitido). */
export function rutTieneFormatoMinimo(rut: string): boolean {
  const n = normalizeRut(rut)
  return /^\d{7,8}-[\dk]$/.test(n)
}

/** Valida matemáticamente el dígito verificador usando el Módulo 11 */
export function validarRutMatematico(rut: string): boolean {
  if (!rutTieneFormatoMinimo(rut)) return false
  
  const cleanRut = normalizeRut(rut)
  const [cuerpoStr, dvStr] = cleanRut.split('-')
  let cuerpo = parseInt(cuerpoStr, 10)
  const dvIngresado = dvStr.toUpperCase()

  let suma = 0
  let multiplicador = 2

  while (cuerpo > 0) {
    suma += (cuerpo % 10) * multiplicador
    cuerpo = Math.floor(cuerpo / 10)
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1
  }

  const resto = suma % 11
  const dvCalculado = 11 - resto
  let dvEsperado = dvCalculado.toString()
  if (dvCalculado === 11) dvEsperado = '0'
  if (dvCalculado === 10) dvEsperado = 'K'

  return dvEsperado === dvIngresado
}
