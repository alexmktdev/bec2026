import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { PostulanteFirestore } from '../types/postulante'
import { formatDate } from '../utils/inputFormatters'
import { resumenCuentaBancariaListado } from '../utils/cuentaBancariaDisplay'
import { etiquetaBancoOtra } from '../postulacion/shared/cuentaBancariaSchema'

export function generarReportePDF(postulantes: PostulanteFirestore[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  doc.setFontSize(16)
  doc.text('Reporte de Postulantes - Beca Municipal de Molina 2026', 14, 15)
  doc.setFontSize(9)
  doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')} a las ${new Date().toLocaleTimeString('es-CL')}`, 14, 22)
  doc.text(`Total de postulantes: ${postulantes.length}`, 14, 27)

  const head = [
    [
      'Nombres',
      'Apellido Paterno',
      'Apellido Materno',
      'RUT',
      'Fecha Nacimiento',
      'Edad',
      'Sexo',
      'Estado Civil',
      'Teléfono',
      'Email',
      'Domicilio Familiar',
      'Fecha Postulación',
      'Hora Postulación',
      'NEM',
      'Institución',
      'Comuna',
      'Carrera',
      'Duración Semestres',
      'Matrícula en curso (año)',
      'Total Integrantes',
      'Tramo RSH',
      'Hermanos/Hijos Estudiando',
      '1 Hermano/Hijo',
      '2+ Hermanos/Hijos',
      'Enfermedad Catastrófica',
      'Enfermedad Crónica',
      'Tipo cuenta',
      'Cuenta bancaria',
      'Observaciones',
      'Puntaje NEM',
      'Puntaje RSH',
      'Puntaje Enfermedad',
      'Puntaje Hermanos',
      'Puntaje Total',
      'Estado',
      'Fecha Registro',
    ],
  ]

  const body = postulantes.map((p) => [
    p.nombres,
    p.apellidoPaterno,
    p.apellidoMaterno,
    p.rut,
    formatDate(p.fechaNacimiento),
    p.edad,
    p.sexo,
    p.estadoCivil,
    p.telefono,
    p.email,
    p.domicilioFamiliar,
    formatDate(p.fechaPostulacion),
    p.horaPostulacion,
    p.nem,
    p.nombreInstitucion,
    p.comuna,
    p.carrera,
    p.duracionSemestres,
    p.anoIngreso,
    p.totalIntegrantes,
    p.tramoRegistroSocial,
    p.tieneHermanosOHijosEstudiando,
    p.tieneUnHermanOHijoEstudiando,
    p.tieneDosOMasHermanosOHijosEstudiando,
    p.enfermedadCatastrofica,
    p.enfermedadCronica,
    p.tipoCuentaBancaria === 'otra' ? 'Otra' : 'Cuenta RUT',
    resumenCuentaBancariaListado(p),
    p.observacion,
    String(p.puntaje.nem),
    String(p.puntaje.rsh),
    String(p.puntaje.enfermedad),
    String(p.puntaje.hermanos),
    String(p.puntaje.total),
    p.estado === 'pendiente' ? 'PRE-APROBADO' :
    p.estado === 'en_revision' ? 'EN REVISIÓN' :
    p.estado === 'documentacion_validada' ? 'DOCUMENTACIÓN VALIDADA' :
    p.estado.toUpperCase(),
    p.createdAt ? new Date(p.createdAt).toLocaleString('es-CL') : '—',
  ])

  autoTable(doc, {
    startY: 32,
    head,
    body,
    styles: { fontSize: 6, cellPadding: 1 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', fontSize: 6 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  doc.save(`reporte_postulantes_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// Paleta: blue-800, blue-600, slate (usado en el dashboard)
const COLORS = {
  header: [30, 58, 138] as [number, number, number],      // blue-800
  headerLight: [37, 99, 235] as [number, number, number], // blue-600
  text: [15, 23, 42] as [number, number, number],          // slate-900
  textMuted: [71, 85, 105] as [number, number, number],    // slate-600
  rowAlt: [239, 246, 255] as [number, number, number],     // blue-50
  border: [226, 232, 240] as [number, number, number],     // slate-200
}

export function generarReporteIndividualPDF(p: PostulanteFirestore): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  let y = 15

  // Título y Estado
  doc.setFontSize(14)
  doc.setTextColor(...COLORS.header)
  doc.setFont('helvetica', 'bold')
  doc.text('REPORTE DE POSTULANTE - BECA MUNICIPAL 2026', 14, y)
  y += 6

  const estadoLabel =
    p.estado === 'pendiente' ? 'PRE-APROBADO' :
    p.estado === 'en_revision' ? 'EN REVISIÓN' :
    p.estado === 'documentacion_validada' ? 'DOCUMENTACIÓN VALIDADA' :
    p.estado.toUpperCase()
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.textMuted)
  doc.setFont('helvetica', 'normal')
  doc.text(`Postulante: ${p.nombres} ${p.apellidoPaterno} ${p.apellidoMaterno}  |  RUT: ${p.rut}  |  Estado: ${estadoLabel}`, 14, y)
  y += 5
  doc.text(`Generado el ${new Date().toLocaleDateString('es-CL')} a las ${new Date().toLocaleTimeString('es-CL')}`, 14, y)
  y += 8

  // Función auxiliar para tablas compactas
  const compactTable = (title: string, data: string[][], startY: number, colWidths: number[]) => {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.header)
    doc.text(title.toUpperCase(), 14, startY)
    
    autoTable(doc, {
      startY: startY + 2,
      body: data,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1.5, lineColor: COLORS.border },
      columnStyles: Object.fromEntries(colWidths.map((w, i) => [i, { cellWidth: w }])),
      margin: { left: 14 },
    })
    return (doc as any).lastAutoTable.finalY + 6
  }

  // Combinar Datos Personales y Académicos en dos columnas o tablas seguidas
  y = compactTable('1. Antecedentes del Postulante', [
    ['Nombres', p.nombres, 'RUT', p.rut],
    ['Apellidos', `${p.apellidoPaterno} ${p.apellidoMaterno}`, 'F. Nacimiento', formatDate(p.fechaNacimiento)],
    ['Edad', p.edad, 'Sexo', p.sexo],
    ['Estado Civil', p.estadoCivil, 'Teléfono', p.telefono],
    ['Email', p.email, 'Domicilio', p.domicilioFamiliar],
    ['F. Postulación', formatDate(p.fechaPostulacion), 'Hora', p.horaPostulacion],
  ], y, [30, 60, 30, 60])

  y = compactTable('2. Antecedentes Académicos y Familiares', [
    ['Institución', p.nombreInstitucion, 'NEM', p.nem],
    ['Carrera', p.carrera, 'Matrícula en curso (año)', p.anoIngreso],
    ['Comuna', p.comuna, 'Duración', `${p.duracionSemestres} sem.`],
    ['Total Integrantes', p.totalIntegrantes, 'Tramo RSH', p.tramoRegistroSocial],
    ['Hnos. Estudiando', p.tieneHermanosOHijosEstudiando, 'Enf. Catastrófica', p.enfermedadCatastrofica],
  ], y, [30, 60, 30, 60])

  y = compactTable(
    '3. Información Bancaria y Puntaje',
    p.tipoCuentaBancaria === 'otra'
      ? [
          ['Modalidad', 'Otra cuenta bancaria', 'NEM Puntos', String(p.puntaje.nem)],
          ['Banco', etiquetaBancoOtra(p), 'RSH Puntos', String(p.puntaje.rsh)],
          ['Tipo de cuenta', p.otraTipoCuenta || '—', 'Enf. Puntos', String(p.puntaje.enfermedad)],
          ['N° cuenta', p.otraNumeroCuenta || '—', 'Hnos. Puntos', String(p.puntaje.hermanos)],
          ['RUT titular', p.otraRutTitular || '—', 'TOTAL PUNTAJE', String(p.puntaje.total)],
        ]
      : [
          ['Modalidad', 'Cuenta RUT', 'NEM Puntos', String(p.puntaje.nem)],
          ['N° cuenta RUT', p.numeroCuenta || '—', 'RSH Puntos', String(p.puntaje.rsh)],
          ['RUT titular', p.rutCuenta || '—', 'Enf. Puntos', String(p.puntaje.enfermedad)],
          ['Observación', p.observacion || 'Sin observaciones', 'Hnos. Puntos', String(p.puntaje.hermanos)],
          ['', '', 'TOTAL PUNTAJE', String(p.puntaje.total)],
        ],
    y,
    [30, 60, 30, 60],
  )

  // Documentos en una tabla simple
  const docRows = Object.entries(p.documentUrls || {}).map(([key, url]) => [
    key.replace(/_/g, ' ').toUpperCase(),
    'SUBIDO',
    url ? 'Disponible en sistema' : '—'
  ])
  
  y = compactTable('4. Documentación Adjunta', 
    docRows.length > 0 ? docRows : [['SIN DOCUMENTOS', '—', '—']], 
    y, [60, 30, 90]
  )

  // Pie de página
  doc.setFontSize(7)
  doc.setTextColor(...COLORS.textMuted)
  doc.text('Este documento es un reporte informativo generado por el Sistema de Gestión de Becas Municipales 2026.', 14, 285)

  return doc.output('blob')
}
