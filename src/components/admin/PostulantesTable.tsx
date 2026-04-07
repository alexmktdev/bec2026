import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { EstadoPostulacion, PostulanteFirestore } from '../../types/postulante'
import { formatDate, formatFechaRegistro24h } from '../../utils/inputFormatters'
import { descargarDocumentosPostulante } from '../../services/zipDownload'
import { generarReporteIndividualPDF } from '../../services/pdfGenerator'
import { PostulanteEdit } from './PostulanteEdit'
import { resumenCuentaBancariaListado } from '../../utils/cuentaBancariaDisplay'
import { TableScrollSlider } from './TableScrollSlider'
import { TablePagination } from './TablePagination'
import { ZipDownloadBriefNotice } from './ZipDownloadBriefNotice'
import { tdClassExcelRevisionColumn, thClassExcelRevisionColumn } from './FiltroRevisionDoc/excelRevisionTableStyles'

const ITEMS_PER_PAGE = 10

/** Encabezados alineados al export Excel + columnas de utilidad del panel (mismos textos que `thClass`/`tdClass`). */
const PANEL_HEADERS: { label: string; styleKey: string }[] = [
  { label: 'Nombres', styleKey: 'Nombres' },
  { label: 'Apellido Paterno', styleKey: 'Apellido Paterno' },
  { label: 'Apellido Materno', styleKey: 'Apellido Materno' },
  { label: 'RUT', styleKey: 'RUT' },
  { label: 'Fecha Nacimiento', styleKey: 'Fecha Nacimiento' },
  { label: 'Edad', styleKey: 'Edad' },
  { label: 'Sexo', styleKey: 'Sexo' },
  { label: 'Estado Civil', styleKey: 'Estado Civil' },
  { label: 'Teléfono', styleKey: 'Teléfono' },
  { label: 'Email', styleKey: 'Email' },
  { label: 'Domicilio Familiar', styleKey: 'Domicilio Familiar' },
  { label: 'NEM', styleKey: 'NEM' },
  { label: 'Institución', styleKey: 'Institución' },
  { label: 'Comuna', styleKey: 'Comuna' },
  { label: 'Carrera', styleKey: 'Carrera' },
  { label: 'Duración Semestres', styleKey: 'Duración Semestres' },
  { label: 'Año en curso', styleKey: 'Año en curso' },
  { label: 'Total Integrantes', styleKey: 'Total Integrantes' },
  { label: 'Tramo RSH', styleKey: 'Tramo RSH' },
  { label: 'Hermanos/Hijos Estudiando', styleKey: 'Hermanos/Hijos Estudiando' },
  { label: '1 Hermano/Hijo', styleKey: '1 Hermano/Hijo' },
  { label: '2+ Hermanos/Hijos', styleKey: '2+ Hermanos/Hijos' },
  { label: 'Enfermedad Catastrófica', styleKey: 'Enfermedad Catastrófica' },
  { label: 'Enfermedad Crónica', styleKey: 'Enfermedad Crónica' },
  { label: 'Cuenta bancaria', styleKey: 'Cuenta bancaria (resumen)' },
  { label: 'Puntaje NEM', styleKey: 'Puntaje NEM' },
  { label: 'Puntaje RSH', styleKey: 'Puntaje RSH' },
  { label: 'Puntaje Enfermedad', styleKey: 'Puntaje Enfermedad' },
  { label: 'Puntaje Hermanos', styleKey: 'Puntaje Hermanos' },
  { label: 'Puntaje Total', styleKey: 'Puntaje Total' },
  { label: 'Estado', styleKey: 'Estado' },
  { label: 'Fecha Registro', styleKey: 'Fecha Registro' },
  { label: 'Documentos (ZIP)', styleKey: 'Documentos (ZIP)' },
  { label: 'Reporte PDF', styleKey: 'Reporte PDF' },
  { label: 'Acciones', styleKey: 'Acciones' },
]

const COL_COUNT = 1 + PANEL_HEADERS.length

interface Props {
  postulantes: PostulanteFirestore[]
  onSelectPostulante: (p: PostulanteFirestore) => void
  onEliminar: (id: string) => void
  onActualizar: (actualizado: PostulanteFirestore) => void
}

const ESTADO_BADGE: Record<EstadoPostulacion, string> = {
  pendiente: 'bg-blue-100 text-blue-800 border-blue-200',
  en_revision: 'bg-amber-100 text-amber-800 border-amber-200',
  documentacion_validada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  aprobado: 'bg-green-100 text-green-800 border-green-200',
  rechazado: 'bg-red-100 text-red-800 border-red-200',
}

function getEstadoLabel(estado: EstadoPostulacion): string {
  if (estado === 'pendiente') return 'Pre-aprobado'
  if (estado === 'en_revision') return 'En revisión'
  if (estado === 'documentacion_validada') return 'Doc. validada'
  return estado.charAt(0).toUpperCase() + estado.slice(1)
}

export function PostulantesTable({ postulantes, onSelectPostulante, onEliminar, onActualizar }: Props) {
  const { userRole } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [descargandoZip, setDescargandoZip] = useState<string | null>(null)
  const [avisoZipTick, setAvisoZipTick] = useState(0)
  const [exportandoPdf, setExportandoPdf] = useState<string | null>(null)
  const [editando, setEditando] = useState<PostulanteFirestore | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const filtrados = useMemo(() => {
    if (!busqueda) return postulantes
    const q = busqueda.toLowerCase()
    return postulantes.filter(
      (p) =>
        p.nombres.toLowerCase().includes(q) ||
        p.apellidoPaterno.toLowerCase().includes(q) ||
        p.apellidoMaterno.toLowerCase().includes(q) ||
        p.rut.includes(q),
    )
  }, [busqueda, postulantes])

  const paginaActual = useMemo(() => {
    const start = (pagina - 1) * ITEMS_PER_PAGE
    return filtrados.slice(start, start + ITEMS_PER_PAGE)
  }, [filtrados, pagina])

  const handleDescargarDocs = async (p: PostulanteFirestore) => {
    if (!p.id) return
    setAvisoZipTick((t) => t + 1)
    setDescargandoZip(p.id)
    try {
      await descargarDocumentosPostulante(p)
    } catch (err) {
      console.error('Error descargando documentos:', err)
      alert('Error al descargar documentos.')
    } finally {
      setDescargandoZip(null)
    }
  }

  const handleVerPDF = (p: PostulanteFirestore) => {
    if (!p.id) return
    setExportandoPdf(p.id)
    try {
      const blob = generarReporteIndividualPDF(p)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } finally {
      setExportandoPdf(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="text"
          id="postulantes-table-busqueda"
          name="postulantes_table_busqueda"
          autoComplete="off"
          aria-label="Buscar postulante por nombre o RUT"
          placeholder="Buscar por nombre o RUT..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value)
            setPagina(1)
          }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-72"
        />
      </div>

      <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div ref={scrollRef} className="overflow-x-auto no-scrollbar">
          <table className="min-w-max w-full divide-y divide-slate-200 text-[10px]">
            <thead>
              <tr className="divide-x divide-slate-100">
                <th className="sticky left-0 z-20 min-w-[3.5rem] bg-slate-100 px-2 py-2 text-center font-black uppercase text-slate-800 shadow-[1px_0_0_0_rgba(203,213,225,1)] border-b border-slate-200">
                  #
                </th>
                {PANEL_HEADERS.map(({ label, styleKey }) => (
                  <th key={styleKey + label} className={thClassExcelRevisionColumn(styleKey)}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={COL_COUNT} className="px-4 py-10 text-center text-slate-400">
                    No se encontraron postulantes.
                  </td>
                </tr>
              ) : (
                paginaActual.map((p, index) => {
                  const puedeOperarFila =
                    userRole?.role === 'superadmin' ||
                    userRole?.role === 'admin' ||
                    userRole?.role === 'revisor'
                  const cuentaResumen = resumenCuentaBancariaListado(p)

                  return (
                    <tr
                      key={p.id}
                      className={`divide-x divide-slate-50 hover:bg-slate-50/90 transition-colors ${!puedeOperarFila ? 'opacity-70' : ''}`}
                    >
                      <td className="sticky left-0 z-10 bg-slate-50/95 px-2 py-1.5 text-center text-xs font-bold text-slate-600 tabular-nums shadow-[1px_0_0_0_rgba(241,245,249,1)] border-b border-slate-100">
                        {(pagina - 1) * ITEMS_PER_PAGE + index + 1}
                      </td>
                      <td className={tdClassExcelRevisionColumn('Nombres')}>{p.nombres || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Apellido Paterno')}>{p.apellidoPaterno || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Apellido Materno')}>{p.apellidoMaterno || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('RUT')}>{p.rut || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Fecha Nacimiento')}>{formatDate(p.fechaNacimiento)}</td>
                      <td className={tdClassExcelRevisionColumn('Edad')}>{p.edad || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Sexo')}>{p.sexo || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Estado Civil')}>{p.estadoCivil || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Teléfono')}>{p.telefono || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Email')} title={p.email || undefined}>
                        {p.email || '—'}
                      </td>
                      <td className={tdClassExcelRevisionColumn('Domicilio Familiar')} title={p.domicilioFamiliar || undefined}>
                        {p.domicilioFamiliar || '—'}
                      </td>
                      <td className={tdClassExcelRevisionColumn('NEM')}>{p.nem || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Institución')} title={p.nombreInstitucion || undefined}>
                        {p.nombreInstitucion || '—'}
                      </td>
                      <td className={tdClassExcelRevisionColumn('Comuna')}>{p.comuna || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Carrera')} title={p.carrera || undefined}>
                        {p.carrera || '—'}
                      </td>
                      <td className={tdClassExcelRevisionColumn('Duración Semestres')}>{p.duracionSemestres || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Año en curso')}>{p.anoIngreso || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Total Integrantes')}>{p.totalIntegrantes || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Tramo RSH')}>{p.tramoRegistroSocial || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Hermanos/Hijos Estudiando')}>
                        {p.tieneHermanosOHijosEstudiando || '—'}
                      </td>
                      <td className={tdClassExcelRevisionColumn('1 Hermano/Hijo')}>
                        {p.tieneUnHermanOHijoEstudiando || '—'}
                      </td>
                      <td className={tdClassExcelRevisionColumn('2+ Hermanos/Hijos')}>
                        {p.tieneDosOMasHermanosOHijosEstudiando || '—'}
                      </td>
                      <td className={tdClassExcelRevisionColumn('Enfermedad Catastrófica')}>
                        {p.enfermedadCatastrofica || '—'}
                      </td>
                      <td className={tdClassExcelRevisionColumn('Enfermedad Crónica')}>{p.enfermedadCronica || '—'}</td>
                      <td className={tdClassExcelRevisionColumn('Cuenta bancaria (resumen)')} title={cuentaResumen}>
                        {cuentaResumen}
                      </td>
                      <td className={tdClassExcelRevisionColumn('Puntaje NEM')}>{String(p.puntaje.nem)}</td>
                      <td className={tdClassExcelRevisionColumn('Puntaje RSH')}>{String(p.puntaje.rsh)}</td>
                      <td className={tdClassExcelRevisionColumn('Puntaje Enfermedad')}>{String(p.puntaje.enfermedad)}</td>
                      <td className={tdClassExcelRevisionColumn('Puntaje Hermanos')}>{String(p.puntaje.hermanos)}</td>
                      <td className={tdClassExcelRevisionColumn('Puntaje Total')}>{String(p.puntaje.total)}</td>
                      <td className={tdClassExcelRevisionColumn('Estado')}>
                        <span
                          className={`inline-flex items-center rounded border px-2 py-0.5 font-semibold ${ESTADO_BADGE[p.estado]}`}
                        >
                          {getEstadoLabel(p.estado)}
                        </span>
                      </td>
                      <td className={tdClassExcelRevisionColumn('Fecha Registro')}>{formatFechaRegistro24h(p.createdAt)}</td>
                      <td className={tdClassExcelRevisionColumn('Documentos (ZIP)')}>
                        <button
                          type="button"
                          onClick={() => (puedeOperarFila ? handleDescargarDocs(p) : alert('No tienes permisos'))}
                          disabled={descargandoZip === p.id || !puedeOperarFila}
                          title={!puedeOperarFila ? 'Sin permisos' : 'Descargar documentos (ZIP)'}
                          className={`inline-flex items-center justify-center rounded p-1 transition-colors ${
                            !puedeOperarFila
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50'
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-4 w-4 ${descargandoZip === p.id ? 'animate-pulse' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className={tdClassExcelRevisionColumn('Reporte PDF')}>
                        <button
                          type="button"
                          onClick={() => (puedeOperarFila ? handleVerPDF(p) : alert('No tienes permisos'))}
                          disabled={!!exportandoPdf || !puedeOperarFila}
                          title={!puedeOperarFila ? 'Sin permisos' : 'Ver reporte PDF'}
                          className={`inline-flex items-center justify-center rounded p-1 transition-colors ${
                            !puedeOperarFila
                              ? 'text-slate-300 cursor-not-allowed'
                              : 'text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50'
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-4 w-4 ${exportandoPdf === p.id ? 'animate-pulse' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className={tdClassExcelRevisionColumn('Acciones')}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => (puedeOperarFila ? onSelectPostulante(p) : alert('No tienes permisos'))}
                            title={!puedeOperarFila ? 'Sin permisos' : 'Ver detalle'}
                            className={`rounded p-1 transition-colors ${
                              !puedeOperarFila ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => (puedeOperarFila ? setEditando(p) : alert('No tienes permisos'))}
                            title={!puedeOperarFila ? 'Sin permisos' : 'Editar datos'}
                            className={`rounded p-1 transition-colors ${
                              !puedeOperarFila ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                            }`}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          {userRole?.role === 'superadmin' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('¿Eliminar este postulante? Esta acción no se puede deshacer.')) onEliminar(p.id!)
                              }}
                              title="Eliminar"
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <TableScrollSlider scrollRef={scrollRef} />
      </div>

      <TablePagination
        totalItems={filtrados.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={pagina}
        onPageChange={setPagina}
      />

      {editando && (
        <PostulanteEdit
          postulante={editando}
          onClose={() => setEditando(null)}
          onGuardado={(actualizado) => {
            onActualizar(actualizado)
            setEditando(null)
          }}
        />
      )}

      <ZipDownloadBriefNotice tick={avisoZipTick} />
    </div>
  )
}
