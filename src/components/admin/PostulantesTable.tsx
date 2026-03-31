import { useMemo, useRef, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import type { EstadoPostulacion, PostulanteFirestore } from '../../types/postulante'
import { formatDate } from '../../utils/inputFormatters'
import { descargarDocumentosPostulante } from '../../services/zipDownload'
import { generarReporteIndividualPDF } from '../../services/pdfGenerator'
import { PostulanteEdit } from './PostulanteEdit'
import { resumenCuentaBancariaListado } from '../../utils/cuentaBancariaDisplay'
import { TableScrollSlider } from './TableScrollSlider'
import { TablePagination } from './TablePagination'
import { ZipDownloadBriefNotice } from './ZipDownloadBriefNotice'

const ITEMS_PER_PAGE = 10

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

function formatCreatedAt(createdAt: string | undefined): string {
  if (!createdAt) return '—'
  try {
    const d = new Date(createdAt)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CL')
  } catch {
    return '—'
  }
}

export function PostulantesTable({ postulantes, onSelectPostulante, onEliminar, onActualizar }: Props) {
  const { user, userRole } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [descargandoZip, setDescargandoZip] = useState<string | null>(null)
  const [avisoZipTick, setAvisoZipTick] = useState(0)
  const [exportandoPdf, setExportandoPdf] = useState<string | null>(null)
  const [editando, setEditando] = useState<PostulanteFirestore | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)

  const colCount = 39

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

  const scrollBy = (dx: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dx, behavior: 'smooth' })
  }

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
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1) }}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-72"
        />
      </div>

      <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        {/* Flechas para desplazar horizontalmente */}
        <div className="flex items-center justify-end gap-2 border-b border-slate-200 px-3 py-2">
          <button
            type="button"
            onClick={() => scrollBy(-700)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Deslizar a la izquierda"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scrollBy(700)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Deslizar a la derecha"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="overflow-x-scroll no-scrollbar">
          <table className="min-w-max w-full divide-y divide-slate-200 text-[10px] table-auto">
            <thead className="bg-blue-50">
              <tr>
                <th className="px-2 py-2 text-center font-black uppercase text-slate-800 whitespace-nowrap sticky left-0 z-10 bg-blue-50 shadow-[1px_0_0_0_rgba(203,213,225,1)]">#</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Nombres</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Apellido Paterno</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Apellido Materno</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">RUT</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Fecha Nacimiento</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Edad</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Sexo</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Estado Civil</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Teléfono</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Email</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Domicilio Familiar</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap bg-blue-50/30">Fecha Postulación</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap bg-blue-50/30">Hora Postulación</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-indigo-600 whitespace-nowrap bg-indigo-50/30">NEM</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Institución</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Comuna</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Carrera</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Duración Semestres</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Matrícula en curso (año)</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Total Integrantes</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-teal-600 whitespace-nowrap bg-teal-50/30">Tramo RSH</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-purple-600 whitespace-nowrap bg-purple-50/30">Hermanos/Hijos Estudiando</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-purple-600 whitespace-nowrap bg-purple-50/30">1 Hermano/Hijo</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-purple-600 whitespace-nowrap bg-purple-50/30">2+ Hermanos/Hijos</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-rose-600 whitespace-nowrap bg-rose-50/30">Enfermedad Catastrófica</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-rose-600 whitespace-nowrap bg-rose-50/30">Enfermedad Crónica</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap min-w-[200px]">Cuenta bancaria</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Observaciones</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-indigo-700 whitespace-nowrap bg-indigo-50/50">Pt. NEM</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-teal-700 whitespace-nowrap bg-teal-50/50">Pt. RSH</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-rose-700 whitespace-nowrap bg-rose-50/50">Pt. Enf.</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-purple-700 whitespace-nowrap bg-purple-50/50">Pt. Hnos.</th>
                <th className="px-2 py-2 text-left font-bold uppercase text-blue-900 whitespace-nowrap bg-blue-100">Pt. TOTAL</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Estado</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Fecha Registro</th>
                <th className="px-2 py-2 text-center font-semibold uppercase text-slate-500 whitespace-nowrap">Documentos (ZIP)</th>
                <th className="px-2 py-2 text-center font-semibold uppercase text-slate-500 whitespace-nowrap">Reporte PDF</th>
                <th className="px-2 py-2 text-center font-semibold uppercase text-slate-500 whitespace-nowrap">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={colCount} className="px-4 py-10 text-center text-slate-400">
                    No se encontraron postulantes.
                  </td>
                </tr>
              ) : (
                paginaActual.map((p, index) => {
                  const isAssigned = userRole?.role === 'superadmin' || p.assignedTo === user?.uid

                  return (
                  <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${!isAssigned ? 'opacity-70' : ''}`}>
                    <td className="px-3 py-2 text-center font-bold text-slate-500 whitespace-nowrap sticky left-0 z-10 bg-white shadow-[1px_0_0_0_rgba(241,245,249,1)]">
                      {(pagina - 1) * ITEMS_PER_PAGE + index + 1}
                    </td>
                    <td className="px-2 py-2 text-slate-700 whitespace-nowrap">{p.nombres || '—'}</td>
                    <td className="px-2 py-2 text-slate-700 whitespace-nowrap">{p.apellidoPaterno || '—'}</td>
                    <td className="px-2 py-2 text-slate-700 whitespace-nowrap">{p.apellidoMaterno || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.rut || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{formatDate(p.fechaNacimiento)}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.edad || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.sexo || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.estadoCivil || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.telefono || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 max-w-[180px] truncate" title={p.email || ''}>
                      {p.email || '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-600 max-w-[220px] truncate" title={p.domicilioFamiliar || ''}>
                      {p.domicilioFamiliar || '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap bg-blue-50/20 font-medium italic">{formatDate(p.fechaPostulacion)}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap bg-blue-50/20 font-medium italic">{p.horaPostulacion || '—'}</td>
                    <td className="px-2 py-2 text-indigo-700 whitespace-nowrap bg-indigo-50/20 font-bold">{p.nem || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 max-w-[220px] truncate" title={p.nombreInstitucion || ''}>
                      {p.nombreInstitucion || '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.comuna || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 max-w-[220px] truncate" title={p.carrera || ''}>
                      {p.carrera || '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.duracionSemestres || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.anoIngreso || '—'}</td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{p.totalIntegrantes || '—'}</td>
                    <td className="px-2 py-2 text-teal-700 whitespace-nowrap bg-teal-50/20 font-bold">{p.tramoRegistroSocial || '—'}</td>
                    <td className="px-2 py-2 text-purple-700 whitespace-nowrap bg-purple-50/20 font-medium text-center">{p.tieneHermanosOHijosEstudiando || '—'}</td>
                    <td className="px-2 py-2 text-purple-700 whitespace-nowrap bg-purple-50/20 font-medium text-center">{p.tieneUnHermanOHijoEstudiando || '—'}</td>
                    <td className="px-2 py-2 text-purple-700 whitespace-nowrap bg-purple-50/20 font-medium text-center">{p.tieneDosOMasHermanosOHijosEstudiando || '—'}</td>
                    <td className="px-2 py-2 text-rose-700 whitespace-nowrap bg-rose-50/20 font-medium text-center">{p.enfermedadCatastrofica || '—'}</td>
                    <td className="px-2 py-2 text-rose-700 whitespace-nowrap bg-rose-50/20 font-medium text-center">{p.enfermedadCronica || '—'}</td>
                    <td
                      className="px-2 py-2 text-slate-600 max-w-[280px] text-xs leading-snug"
                      title={resumenCuentaBancariaListado(p)}
                    >
                      {resumenCuentaBancariaListado(p)}
                    </td>
                    <td className="px-2 py-2 text-slate-600 max-w-[260px] truncate" title={p.observacion || ''}>
                      {p.observacion || '—'}
                    </td>
                    <td className="px-2 py-2 text-indigo-800 whitespace-nowrap bg-indigo-50/40 font-bold">{String(p.puntaje.nem)}</td>
                    <td className="px-2 py-2 text-teal-800 whitespace-nowrap bg-teal-50/40 font-bold">{String(p.puntaje.rsh)}</td>
                    <td className="px-2 py-2 text-rose-800 whitespace-nowrap bg-rose-50/40 font-bold">{String(p.puntaje.enfermedad)}</td>
                    <td className="px-2 py-2 text-purple-800 whitespace-nowrap bg-purple-50/40 font-bold">{String(p.puntaje.hermanos)}</td>
                    <td className="px-2 py-2 text-blue-900 whitespace-nowrap font-black bg-blue-100 shadow-[inset_0_0_0_1px_rgba(30,64,175,0.1)]">{String(p.puntaje.total)}</td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 font-semibold ${ESTADO_BADGE[p.estado]}`}>
                        {getEstadoLabel(p.estado)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{formatCreatedAt(p.createdAt)}</td>

                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => isAssigned ? handleDescargarDocs(p) : alert('No tienes permisos')}
                        disabled={descargandoZip === p.id || !isAssigned}
                        title={!isAssigned ? "No asignado a ti" : "Descargar documentos (ZIP)"}
                        className={`inline-flex items-center justify-center rounded p-1 transition-colors ${
                          !isAssigned ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-50'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${descargandoZip === p.id ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                    </td>

                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => isAssigned ? handleVerPDF(p) : alert('No tienes permisos')}
                        disabled={!!exportandoPdf || !isAssigned}
                        title={!isAssigned ? "No asignado a ti" : "Ver reporte PDF"}
                        className={`inline-flex items-center justify-center rounded p-1 transition-colors ${
                          !isAssigned ? 'text-slate-300 cursor-not-allowed' : 'text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50'
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${exportandoPdf === p.id ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </td>

                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => isAssigned ? onSelectPostulante(p) : alert('No tienes permisos')}
                          title={!isAssigned ? "No asignado a ti" : "Ver detalle"}
                          className={`rounded p-1 transition-colors ${!isAssigned ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:bg-blue-50 hover:text-blue-600'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => isAssigned ? setEditando(p) : alert('No tienes permisos')}
                          title={!isAssigned ? "No asignado a ti" : "Editar datos"}
                          className={`rounded p-1 transition-colors ${!isAssigned ? 'text-slate-300 cursor-not-allowed' : 'text-slate-400 hover:bg-amber-50 hover:text-amber-600'}`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

      {/* Modal de edición */}
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
