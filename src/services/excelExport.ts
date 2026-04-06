import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { PostulanteFirestore } from '../types/postulante'
import { formatDate } from '../utils/inputFormatters'
import { resumenCuentaBancariaListado } from '../utils/cuentaBancariaDisplay'
import { prepareCallableSecurity } from '../firebase/config'
import { emitirEnlaceDescargaZipDocumentos } from './descargaZipPostulanteService'

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
  { header: 'Link descarga documentación (ZIP)', width: 72 },
] as const

async function enlacesZipEnParalelo(postulantes: PostulanteFirestore[], limite: number): Promise<string[]> {
  const n = postulantes.length
  const resultados = new Array<string>(n)
  let idx = 0

  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++
      if (i >= n) return
      const p = postulantes[i]
      const id = typeof p.id === 'string' ? p.id.trim() : ''
      if (!id) {
        resultados[i] = ''
        continue
      }
      try {
        resultados[i] = await emitirEnlaceDescargaZipDocumentos(id)
      } catch {
        resultados[i] = ''
      }
    }
  }

  const workers = Math.max(1, Math.min(limite, n))
  await Promise.all(Array.from({ length: workers }, () => worker()))
  return resultados
}

export async function exportarExcel(postulantes: PostulanteFirestore[]) {
  await prepareCallableSecurity()
  const enlacesZip = await enlacesZipEnParalelo(postulantes, 4)

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

  for (let i = 0; i < postulantes.length; i++) {
    const p = postulantes[i]
    const fila = [...rowValuesInOrder(p), '', '', enlacesZip[i] ?? '']
    sheet.addRow(fila)
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  saveAs(blob, `postulantes_beca_2026_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
