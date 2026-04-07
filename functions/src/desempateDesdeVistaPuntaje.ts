import type { PostulanteData } from '../../src/types/postulante'
import { rutClaveParaComparacion } from '../../src/postulacion/shared/rut'
import { calcularPuntajeTotal } from '../../src/postulacion/shared/scoring'
import type { VistaFiltroPuntajeTotal } from './filtroPuntajeTotalVista'

function normEncabezado(h: string): string {
  return h
    .replace(/^\ufeff/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Resuelve el nombre real de columna en el Excel (encabezados tal cual en el archivo). */
function findHeaderKey(headers: string[], ...candidatos: string[]): string | null {
  const map = new Map<string, string>()
  for (const h of headers) {
    map.set(normEncabezado(h), h)
  }
  for (const c of candidatos) {
    const k = map.get(normEncabezado(c))
    if (k) return k
  }
  return null
}

function cell(row: Record<string, string>, key: string | null): string {
  if (!key) return ''
  return String(row[key] ?? '').trim()
}

/**
 * Interpreta "Fecha Registro" del export (p. ej. 06-04-2026 14.30 hrs) para fechaPostulacion (YYYY-MM-DD) y hora.
 */
function parseFechaRegistroExport(s: string): { fecha: string; hora: string } | null {
  const t = s.trim()
  const m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2})\.(\d{2})\s*hrs?/i)
  if (m) {
    const dd = m[1].padStart(2, '0')
    const mm = m[2].padStart(2, '0')
    const yyyy = m[3]
    const HH = m[4].padStart(2, '0')
    const min = m[5]
    return { fecha: `${yyyy}-${mm}-${dd}`, hora: `${HH}:${min}:00` }
  }
  const d = Date.parse(t)
  if (Number.isFinite(d)) {
    const x = new Date(d)
    const dd = String(x.getDate()).padStart(2, '0')
    const mm = String(x.getMonth() + 1).padStart(2, '0')
    const yyyy = x.getFullYear()
    const HH = String(x.getHours()).padStart(2, '0')
    const min = String(x.getMinutes()).padStart(2, '0')
    return { fecha: `${yyyy}-${mm}-${dd}`, hora: `${HH}:${min}:00` }
  }
  return null
}

function excelRowToPostulanteData(row: Record<string, string>, headers: string[]): PostulanteData {
  const k = (...labels: string[]) => findHeaderKey(headers, ...labels)

  const nombres = cell(row, k('nombres'))
  const apellidoPaterno = cell(row, k('apellido paterno'))
  const apellidoMaterno = cell(row, k('apellido materno'))
  const rut = cell(row, k('rut'))
  const fechaNacimiento = cell(row, k('fecha nacimiento'))
  const edad = cell(row, k('edad'))
  const sexo = cell(row, k('sexo'))
  const estadoCivil = cell(row, k('estado civil'))
  const telefono = cell(row, k('teléfono', 'telefono'))
  const email = cell(row, k('email'))
  const domicilioFamiliar = cell(row, k('domicilio familiar'))
  const nem = cell(row, k('nem'))
  const nombreInstitucion = cell(row, k('institución', 'institucion'))
  const comuna = cell(row, k('comuna'))
  const carrera = cell(row, k('carrera'))
  const duracionSemestres = cell(row, k('duración semestres', 'duracion semestres'))
  const anoIngreso = cell(row, k('año en curso', 'ano en curso'))
  const totalIntegrantes = cell(row, k('total integrantes'))
  const tramoRegistroSocial = cell(row, k('tramo rsh'))
  const tieneHermanosOHijosEstudiando = cell(row, k('hermanos/hijos estudiando'))
  const tieneUnHermanOHijoEstudiando = cell(row, k('1 hermano/hijo'))
  const tieneDosOMasHermanosOHijosEstudiando = cell(row, k('2+ hermanos/hijos'))
  const enfermedadCatastrofica = cell(row, k('enfermedad catastrófica', 'enfermedad catastrofica'))
  const enfermedadCronica = cell(row, k('enfermedad crónica', 'enfermedad cronica'))

  let fechaPostulacion = cell(row, k('fecha postulación', 'fecha postulacion'))
  let horaPostulacion = cell(row, k('hora'))
  const fechaReg = cell(row, k('fecha registro'))
  if ((!fechaPostulacion || !horaPostulacion) && fechaReg) {
    const parsed = parseFechaRegistroExport(fechaReg)
    if (parsed) {
      if (!fechaPostulacion) fechaPostulacion = parsed.fecha
      if (!horaPostulacion) horaPostulacion = parsed.hora
    }
  }

  const tipoTxt = cell(row, k('tipo cuenta banc.', 'tipo cuenta bancaria')).toLowerCase()
  const tipoCuentaBancaria: 'cuenta_rut' | 'otra' = tipoTxt.includes('otra') ? 'otra' : 'cuenta_rut'

  return {
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    rut,
    fechaNacimiento,
    edad,
    sexo,
    estadoCivil,
    telefono,
    email,
    domicilioFamiliar,
    fechaPostulacion,
    horaPostulacion,
    nem,
    nombreInstitucion,
    comuna,
    carrera,
    duracionSemestres,
    anoIngreso,
    totalIntegrantes,
    tramoRegistroSocial,
    tieneHermanosOHijosEstudiando,
    tieneUnHermanOHijoEstudiando,
    tieneDosOMasHermanosOHijosEstudiando,
    enfermedadCatastrofica,
    enfermedadCronica,
    tipoCuentaBancaria,
    numeroCuenta: '',
    rutCuenta: '',
    otraNumeroCuenta: '',
    otraTipoCuenta: '',
    otraBanco: '',
    otraBancoDetalle: '',
    otraRutTitular: '',
    observacion: '',
    declaracionJuradaAceptada: true,
  }
}

function shallowMergePostulante(
  base: Record<string, unknown>,
  excel: PostulanteData,
): Record<string, unknown> {
  const keys: (keyof PostulanteData)[] = [
    'nombres',
    'apellidoPaterno',
    'apellidoMaterno',
    'rut',
    'fechaNacimiento',
    'edad',
    'sexo',
    'estadoCivil',
    'telefono',
    'email',
    'domicilioFamiliar',
    'fechaPostulacion',
    'horaPostulacion',
    'nem',
    'nombreInstitucion',
    'comuna',
    'carrera',
    'duracionSemestres',
    'anoIngreso',
    'totalIntegrantes',
    'tramoRegistroSocial',
    'tieneHermanosOHijosEstudiando',
    'tieneUnHermanOHijoEstudiando',
    'tieneDosOMasHermanosOHijosEstudiando',
    'enfermedadCatastrofica',
    'enfermedadCronica',
    'tipoCuentaBancaria',
    'numeroCuenta',
    'rutCuenta',
    'otraNumeroCuenta',
    'otraTipoCuenta',
    'otraBanco',
    'otraBancoDetalle',
    'otraRutTitular',
    'observacion',
    'declaracionJuradaAceptada',
  ]
  const out = { ...base }
  for (const key of keys) {
    const v = excel[key]
    if (v === '' || v === undefined) continue
    if (typeof v === 'string' && !v.trim()) continue
    out[key] = v
  }
  return out
}

/**
 * Construye la lista de registros (mezcla Excel + Firestore por RUT) a ordenar por desempate.
 * Orden de filas de entrada = orden de `vista.filasVista` (solo se usa para índice estable en duplicados).
 */
export function postulantesParaRankingDesdeVistaPuntaje(
  vista: VistaFiltroPuntajeTotal,
  firestorePostulantes: Record<string, unknown>[],
): Record<string, unknown>[] {
  const byRut = new Map<string, Record<string, unknown>>()
  for (const p of firestorePostulantes) {
    const raw = String((p as { rut?: unknown }).rut ?? '').trim()
    const key = rutClaveParaComparacion(raw)
    if (key && !byRut.has(key)) byRut.set(key, p)
  }

  const out: Record<string, unknown>[] = []
  let idx = 0
  for (const row of vista.filasVista) {
    idx++
    const excelPd = excelRowToPostulanteData(row, vista.headers)
    const rutRaw = excelPd.rut || cell(row, findHeaderKey(vista.headers, 'rut'))
    const rutKey = rutClaveParaComparacion(rutRaw)
    if (!rutKey) continue

    const fs = byRut.get(rutKey)
    let merged: Record<string, unknown>
    if (fs) {
      merged = shallowMergePostulante(fs, excelPd)
      merged.id = fs.id
    } else {
      merged = {
        ...excelPd,
        id: `excel:${rutKey}:${idx}`,
        estado: 'documentacion_validada',
        motivoRechazo: null,
        documentosSubidos: {},
        documentosValidados: {},
        documentUrls: {},
        createdAt: '',
        updatedAt: '',
      }
    }

    const puntaje = calcularPuntajeTotal(merged as unknown as PostulanteData)
    merged.puntaje = puntaje
    out.push(merged)
  }
  return out
}
