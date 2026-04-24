import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import type { PostulanteRechazadoEntrada } from '../types/postulante'
import { formatDateTimeDmyHm } from '../utils/inputFormatters'

const HEADERS = [
  'Nombre completo',
  'RUT',
  'RUT normalizado',
  'Edad',
  'NEM',
  'Sexo',
  'Estado civil',
  'Email',
  'Teléfono',
  'Domicilio familiar',
  'Fecha postulación',
  'Hora postulación',
  'Comuna',
  'Institución',
  'Carrera',
  'Matrícula en curso (año)',
  'Duración semestres',
  'Integrantes hogar',
  'Tramo RSH',
  'Motivo rechazo',
  'Detalle',
  'Código rechazo',
  'Origen registro',
  'Fecha rechazo',
] as const

function s(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function filaExcel(r: PostulanteRechazadoEntrada): string[] {
  const nombre = [r.nombres, r.apellidoPaterno, r.apellidoMaterno].filter(Boolean).join(' ').trim()
  return [
    nombre,
    s(r.rut),
    s(r.rutNormalizado),
    s(r.edad),
    s(r.nem),
    s(r.sexo),
    s(r.estadoCivil),
    s(r.email),
    s(r.telefono),
    s(r.domicilioFamiliar),
    formatDateTimeDmyHm(r.fechaPostulacion),
    s(r.horaPostulacion),
    s(r.comuna),
    s(r.nombreInstitucion),
    s(r.carrera),
    s(r.anoIngreso),
    s(r.duracionSemestres),
    s(r.totalIntegrantes),
    s(r.tramoRegistroSocial),
    s(r.rejectionLabel),
    s(r.rejectionMessage),
    s(r.rejectionCode),
    s(r.source),
    formatDateTimeDmyHm(r.updatedAt),
  ]
}

/** Exporta todos los rechazados de entrada cargados (misma fuente que la tabla). */
export async function exportarPostulantesRechazadosEntradaExcel(
  data: PostulanteRechazadoEntrada[],
  options?: { nombreArchivoBase?: string },
): Promise<void> {
  if (!data.length) {
    throw new Error('No hay datos para exportar.')
  }
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Rechazados entrada', {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  ws.addRow([...HEADERS])
  ws.getRow(1).font = { bold: true }
  for (const r of data) {
    ws.addRow(filaExcel(r))
  }
  const buf = await wb.xlsx.writeBuffer()
  const base = options?.nombreArchivoBase ?? 'postulantes_rechazados_entrada'
  const filename = `${base}_${new Date().toISOString().slice(0, 10)}.xlsx`
  saveAs(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  )
}
