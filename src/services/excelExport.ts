import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { PostulanteFirestore } from '../types/postulante'
import { formatDate } from '../utils/inputFormatters'
import { resumenCuentaBancariaListado } from '../utils/cuentaBancariaDisplay'
import { emitirEnlacesDescargaZipDocumentosLote } from './descargaZipPostulanteService'

const COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'Nombres', key: 'nombres', width: 20 },
  { header: 'Apellido Paterno', key: 'apellidoPaterno', width: 18 },
  { header: 'Apellido Materno', key: 'apellidoMaterno', width: 18 },
  { header: 'RUT', key: 'rut', width: 14 },
  { header: 'Fecha Nacimiento', key: 'fechaNacimiento', width: 16 },
  { header: 'Edad', key: 'edad', width: 8 },
  { header: 'Sexo', key: 'sexo', width: 10 },
  { header: 'Estado Civil', key: 'estadoCivil', width: 12 },
  { header: 'Teléfono', key: 'telefono', width: 14 },
  { header: 'Email', key: 'email', width: 25 },
  { header: 'Domicilio Familiar', key: 'domicilioFamiliar', width: 25 },
  { header: 'Fecha Postulación', key: 'fechaPostulacion', width: 16 },
  { header: 'Hora Postulación', key: 'horaPostulacion', width: 14 },
  { header: 'NEM', key: 'nem', width: 8 },
  { header: 'Institución', key: 'nombreInstitucion', width: 25 },
  { header: 'Comuna', key: 'comuna', width: 15 },
  { header: 'Carrera', key: 'carrera', width: 25 },
  { header: 'Duración Semestres', key: 'duracionSemestres', width: 16 },
  { header: 'Año en curso', key: 'anoIngreso', width: 14 },
  { header: 'Total Integrantes', key: 'totalIntegrantes', width: 16 },
  { header: 'Tramo RSH', key: 'tramoRegistroSocial', width: 12 },
  { header: 'Hermanos/Hijos Estudiando', key: 'hermanosHijos', width: 22 },
  { header: '1 Hermano/Hijo', key: 'unHermano', width: 14 },
  { header: '2+ Hermanos/Hijos', key: 'dosHermanos', width: 16 },
  { header: 'Enfermedad Catastrófica', key: 'enfCatastrofica', width: 20 },
  { header: 'Enfermedad Crónica', key: 'enfCronica', width: 18 },
  { header: 'Tipo cuenta banc.', key: 'tipoCuentaBancaria', width: 14 },
  { header: 'Cuenta bancaria (resumen)', key: 'cuentaResumen', width: 40 },
  { header: 'Puntaje NEM', key: 'pNem', width: 12 },
  { header: 'Puntaje RSH', key: 'pRsh', width: 12 },
  { header: 'Puntaje Enfermedad', key: 'pEnfermedad', width: 16 },
  { header: 'Puntaje Hermanos', key: 'pHermanos', width: 16 },
  { header: 'Puntaje Total', key: 'pTotal', width: 14 },
  { header: 'Estado', key: 'estado', width: 16 },
  { header: 'Fecha Registro', key: 'fechaRegistro', width: 20 },
]

function estadoLabel(estado: string): string {
  switch (estado) {
    case 'pendiente':
      return 'PRE-APROBADO'
    case 'en_revision':
      return 'EN REVISIÓN'
    case 'documentacion_validada':
      return 'DOC. VALIDADA'
    default:
      return estado.toUpperCase()
  }
}

function toRow(p: PostulanteFirestore): Record<string, unknown> {
  return {
    nombres: p.nombres,
    apellidoPaterno: p.apellidoPaterno,
    apellidoMaterno: p.apellidoMaterno,
    rut: p.rut,
    fechaNacimiento: formatDate(p.fechaNacimiento),
    edad: p.edad,
    sexo: p.sexo,
    estadoCivil: p.estadoCivil,
    telefono: p.telefono,
    email: p.email,
    domicilioFamiliar: p.domicilioFamiliar,
    fechaPostulacion: formatDate(p.fechaPostulacion),
    horaPostulacion: p.horaPostulacion,
    nem: p.nem,
    nombreInstitucion: p.nombreInstitucion,
    comuna: p.comuna,
    carrera: p.carrera,
    duracionSemestres: p.duracionSemestres,
    anoIngreso: String(p.anoIngreso ?? '').trim(),
    totalIntegrantes: p.totalIntegrantes,
    tramoRegistroSocial: p.tramoRegistroSocial,
    hermanosHijos: p.tieneHermanosOHijosEstudiando,
    unHermano: p.tieneUnHermanOHijoEstudiando,
    dosHermanos: p.tieneDosOMasHermanosOHijosEstudiando,
    enfCatastrofica: p.enfermedadCatastrofica,
    enfCronica: p.enfermedadCronica,
    tipoCuentaBancaria: p.tipoCuentaBancaria === 'otra' ? 'Otra' : 'Cuenta RUT',
    cuentaResumen: resumenCuentaBancariaListado(p),
    pNem: p.puntaje.nem,
    pRsh: p.puntaje.rsh,
    pEnfermedad: p.puntaje.enfermedad,
    pHermanos: p.puntaje.hermanos,
    pTotal: p.puntaje.total,
    estado: estadoLabel(p.estado),
    fechaRegistro: p.createdAt ? new Date(p.createdAt).toLocaleString('es-CL') : '—',
  }
}

function rowValuesInOrder(p: PostulanteFirestore): unknown[] {
  const o = toRow(p)
  return COLUMNS.map((col) => {
    const v = o[col.key]
    if (v === undefined || v === null) return ''
    return v
  })
}

const COLUMNAS_MANUAL_FINAL = [
  { header: 'Revisor designado', width: 22 },
  { header: 'Estado', width: 14 },
  { header: 'Descarga documentación', width: 28 },
] as const

/** Texto visible del hipervínculo (la URL va en el destino del clic, no en la celda). */
const TEXTO_CELDA_LINK_ZIP = 'Descargar documentación (ZIP)'

/** Excel a veces ignora `text`+`hyperlink` en ExcelJS; `HYPERLINK` fuerza el texto visible. */
function valorCeldaHipervinculoZip(url: string, textoVisible: string): ExcelJS.CellValue {
  const esc = (s: string) => s.replace(/"/g, '""')
  return {
    formula: `HYPERLINK("${esc(url)}","${esc(textoVisible)}")`,
    result: textoVisible,
  }
}

export async function exportarExcel(postulantes: PostulanteFirestore[]) {
  const postulanteIds = postulantes.map((p) => (typeof p.id === 'string' ? p.id.trim() : ''))
  let enlacesZip: string[] = []
  try {
    enlacesZip = await emitirEnlacesDescargaZipDocumentosLote(postulanteIds)
  } catch {
    enlacesZip = postulanteIds.map(() => '')
  }

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Postulantes')

  const headers = [...COLUMNS.map((c) => c.header), ...COLUMNAS_MANUAL_FINAL.map((c) => c.header)]
  const headerRow = sheet.addRow(headers)
  headerRow.font = { bold: true }
  COLUMNS.forEach((col, i) => {
    sheet.getColumn(i + 1).width = col.width
  })
  COLUMNAS_MANUAL_FINAL.forEach((col, j) => {
    sheet.getColumn(COLUMNS.length + j + 1).width = col.width
  })

  const colLink = COLUMNS.length + 3
  for (let i = 0; i < postulantes.length; i++) {
    const p = postulantes[i]
    const url = (enlacesZip[i] ?? '').trim()
    const row = sheet.addRow([...rowValuesInOrder(p), '', '', ''])
    const linkCell = row.getCell(colLink)
    if (url) {
      linkCell.value = valorCeldaHipervinculoZip(url, TEXTO_CELDA_LINK_ZIP)
      linkCell.font = { color: { argb: 'FF0563C1' }, underline: true }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, `postulantes_beca_2026_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
