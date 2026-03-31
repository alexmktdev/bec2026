import { useEffect, useMemo, useRef, useState } from 'react'
import { useAdminFilter } from '../../contexts/AdminFilterContext'
import { actualizarDocumentosValidados } from '../../services/postulacionService'
import type { PostulanteFirestore, TramoVigenteEstado } from '../../types/postulante'
import { limpiarTodasLasAsignacionesTramos, obtenerTramos } from '../../services/tramosService'
import { AdminLayout } from './AdminLayout'
import { getFiltroRevisionDocConfig, setFiltroRevisionDocConfig } from '../../services/filtroConfigService'
import { exportarExcel } from '../../services/excelExport'
import { TableScrollSlider } from './TableScrollSlider'
import { TablePagination } from './TablePagination'
import { useAuth } from '../../hooks/useAuth'

// Subcomponentes refactorizados
import { PanelEvaluacion } from './FiltroRevisionDoc/PanelEvaluacion'
import { ModalMotivoRechazo } from './FiltroRevisionDoc/ModalMotivoRechazo'
import { RevisionTable } from './FiltroRevisionDoc/RevisionTable'
import { AsignacionRevisoresModal } from './FiltroRevisionDoc/AsignacionRevisoresModal'
import { VerAsignacionesModal } from './FiltroRevisionDoc/VerAsignacionesModal'

const ITEMS_PER_PAGE = 10

export function FiltroRevisionDoc() {
  const { user, userRole } = useAuth()
  const roleAdmin = userRole?.role

  const {
    postulantes: todosLosPostulantes,
    loading: loadingFiltro,
    errorPostulantes,
    refrescarPostulantes,
  } = useAdminFilter()

  const [evaluando, setEvaluando] = useState<PostulanteFirestore | null>(null)
  const [verMotivo, setVerMotivo] = useState<PostulanteFirestore | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [paginaRevision, setPaginaRevision] = useState(1)
  const [paginaFinal, setPaginaFinal] = useState(1)
  const [confirmandoFormateo, setConfirmandoFormateo] = useState(false)
  const [formateando, setFormateando] = useState(false)
  const [filtroDocActivo, setFiltroDocActivo] = useState(false)
  const [verRechazadosDoc, setVerRechazadosDoc] = useState(false)
  const [modoAsignacion, setModoAsignacion] = useState(false)
  const [verSoloMisAsignados, setVerSoloMisAsignados] = useState(false)
  const [confirmandoAsignacionModal, setConfirmandoAsignacionModal] = useState(false)
  const [toastEvaluacion, setToastEvaluacion] = useState(false)
  const [verTramosLectura, setVerTramosLectura] = useState(false)
  const [misTramosAsignados, setMisTramosAsignados] = useState<TramoVigenteEstado[]>([])
  const [confirmandoLimpiarTramos, setConfirmandoLimpiarTramos] = useState(false)
  const [limpiandoTramos, setLimpiandoTramos] = useState(false)
  const [errorLimpiarTramos, setErrorLimpiarTramos] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const scrollRefFinal = useRef<HTMLDivElement | null>(null)


  useEffect(() => {
    getFiltroRevisionDocConfig().then(activo => {
      if (activo) setFiltroDocActivo(true)
    }).catch(() => {})
  }, [])

  const huellaAssignedTo = useMemo(
    () => todosLosPostulantes.map((p) => `${p.id}:${p.assignedTo ?? ''}`).join('|'),
    [todosLosPostulantes],
  )

  useEffect(() => {
    if (!user?.uid || (roleAdmin !== 'revisor' && roleAdmin !== 'superadmin')) {
      setMisTramosAsignados([])
      return
    }
    obtenerTramos()
      .then((tramos) => {
        setMisTramosAsignados(tramos.filter((t) => t.reviewerUid === user.uid))
      })
      .catch(() => setMisTramosAsignados([]))
  }, [roleAdmin, user?.uid, huellaAssignedTo])

  const activarFiltroDoc = async (activo: boolean) => {
    setFiltroDocActivo(activo)
    setVerRechazadosDoc(false)
    try { await setFiltroRevisionDocConfig(activo) } catch (err) { console.error(err) }
  }

  const confirmarAsignacionTramos = () => {
    setConfirmandoAsignacionModal(true)
  }

  const rechazarAsignacion = () => {
    setConfirmandoAsignacionModal(false)
    setToastEvaluacion(true)
    setTimeout(() => setToastEvaluacion(false), 5000)
  }

  const ejecutarLimpiarTramosDesdePantalla = async () => {
    setLimpiandoTramos(true)
    setErrorLimpiarTramos(null)
    try {
      await limpiarTodasLasAsignacionesTramos()
      await refrescarPostulantes()
      setConfirmandoLimpiarTramos(false)
    } catch {
      setErrorLimpiarTramos('No se pudieron eliminar las asignaciones. Intente de nuevo o use el panel «Asignar tramos».')
    } finally {
      setLimpiandoTramos(false)
    }
  }

  const postulantesFiltrados = useMemo(() => {
    let list = todosLosPostulantes

    // Revisor: solo postulantes de su tramo (assignedTo en Firestore, coherente con orden por createdAt en backend)
    if (roleAdmin === 'revisor' && misTramosAsignados.length > 0 && user?.uid) {
      list = list.filter((p) => p.assignedTo === user.uid)
    }

    // Superadmin local filter for assigned tramos
    if (roleAdmin === 'superadmin' && verSoloMisAsignados && user?.uid) {
      list = list.filter(p => p.assignedTo === user.uid)
    }

    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      list = list.filter(p => 
        p.nombres?.toLowerCase().includes(q) || 
        p.apellidoPaterno?.toLowerCase().includes(q) || 
        p.rut?.includes(q)
      )
    }
    return list
  }, [todosLosPostulantes, busqueda, roleAdmin, verSoloMisAsignados, user?.uid, misTramosAsignados])

  const todosProcessados = useMemo(
    () =>
      todosLosPostulantes.length > 0 &&
      todosLosPostulantes.every((p) => p.estado === 'documentacion_validada' || p.estado === 'rechazado'),
    [todosLosPostulantes],
  )

  const validadosFinal = useMemo(
    () => todosLosPostulantes.filter((p) => p.estado === 'documentacion_validada'),
    [todosLosPostulantes],
  )

  const rechazadosFinal = useMemo(
    () => todosLosPostulantes.filter((p) => p.estado === 'rechazado'),
    [todosLosPostulantes],
  )

  const paginaRevisionItems = useMemo(() => {
    const start = (paginaRevision - 1) * ITEMS_PER_PAGE
    return postulantesFiltrados.slice(start, start + ITEMS_PER_PAGE)
  }, [postulantesFiltrados, paginaRevision])

  const listaFinalActual = verRechazadosDoc ? rechazadosFinal : validadosFinal
  const paginaFinalItems = useMemo(() => {
    const start = (paginaFinal - 1) * ITEMS_PER_PAGE
    return listaFinalActual.slice(start, start + ITEMS_PER_PAGE)
  }, [listaFinalActual, paginaFinal])

  const handleFormatearRevision = async () => {
    setFormateando(true)
    try {
      await Promise.all(todosLosPostulantes
        .filter(p => p.id && p.estado !== 'pendiente')
        .map(p => actualizarDocumentosValidados(p.id!, {}, p.documentUrls ?? {}))
      )
      await refrescarPostulantes()
    } finally {
      setFormateando(false)
      setConfirmandoFormateo(false)
    }
  }

  return (
    <AdminLayout>
      <header className="bg-white border-b border-slate-200 px-6 py-6 text-center">
        <h1 className="text-2xl font-bold text-blue-800 uppercase tracking-tight">Revisión de documentación</h1>
      </header>

      <div className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 max-w-[1600px] mx-auto">
        {toastEvaluacion && (
          <div className="bg-emerald-100 border border-emerald-300 text-emerald-800 p-4 rounded-xl font-bold flex items-center justify-between shadow-sm animate-pulse">
            <span className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Tienes vía libre para evaluar directamente. Usa los botones de validación de cada fila para empezar.
            </span>
            <button onClick={() => setToastEvaluacion(false)} className="text-emerald-600 hover:text-emerald-900 font-black px-2">✕</button>
          </div>
        )}

        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <p className="text-sm text-blue-800 leading-relaxed">
            Esta es la <strong>primera etapa</strong> del panel: la nómina corresponde a <strong>todos los postulantes ingresados</strong>{' '}
            (pre-aprobados en plataforma), sin filtro previo por puntaje. En la primera columna verá el estado:{' '}
            <strong className="text-amber-900">validación incompleta / en proceso</strong> si faltan documentos,{' '}
            <strong className="text-emerald-900">validado</strong> cuando la documentación esté completa. Quienes queden validados
            pasarán a la etapa <strong>Filtrar por puntaje total</strong> y, después, a <strong>Filtrado por desempate</strong>.
            {' '}
            Aplica tanto con tramos asignados como si el superadmin revisa directamente.
          </p>
        </div>

        {roleAdmin === 'superadmin' && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Superadmin: reparto de seguimiento</p>
            <p className="mt-2 text-sm text-emerald-900 leading-relaxed">
              Si un revisor ya terminó su tramo y aún hay postulantes por revisar (o sin tramo), puede{' '}
              <strong>volver a usar «Asignar tramos»</strong> cuando quiera: el flujo es el mismo de siempre; no reemplaza ni
              desactiva nada. Puede agregar tramos, editarlos o reasignar revisor desde el mismo modal. La guía breve está en{' '}
              <strong>«Guía: reasignar o corregir errores»</strong> dentro del panel de asignación.
            </p>
          </div>
        )}

        {misTramosAsignados.length > 0 &&
          (roleAdmin === 'revisor' || (roleAdmin === 'superadmin' && verSoloMisAsignados)) && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 shadow-sm">
            <p className="text-sm font-bold text-emerald-900">
              {roleAdmin === 'superadmin' ? 'Sus tramos (vista filtrada)' : 'Sus tramos de revisión'}:{' '}
              {misTramosAsignados
                .slice()
                .sort((a, b) => a.startRange - b.startRange)
                .map((t) => `#${t.startRange}–#${t.endRange}`)
                .join(' · ')}
              <span className="font-semibold text-emerald-800">
                {' '}
                (
                {misTramosAsignados.reduce((acc, t) => acc + (t.endRange - t.startRange + 1), 0)} cupos en la nómina)
              </span>
            </p>
            <p className="mt-1 text-xs text-emerald-800">
              El número de posición coincide con el orden de la tabla de esta pantalla: fila 1 = posición 1 (por fecha de
              postulación, más recientes primero; sin fecha al final). Misma secuencia que usa el servidor al guardar
              tramos.
            </p>
          </div>
        )}

        {/* Resumen Total */}
        <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-900">Total en esta vista</p>
            <p className="text-2xl font-black text-blue-800 tracking-tight leading-none mt-1">
              {filtroDocActivo ? listaFinalActual.length : postulantesFiltrados.length} <span className="text-base font-semibold text-blue-600 tracking-normal">postulantes</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between font-medium">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              id="filtro-revision-doc-busqueda"
              name="filtro_revision_doc_busqueda"
              autoComplete="off"
              aria-label="Buscar postulante por nombre o RUT"
              placeholder="Buscar por nombre o RUT..."
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPaginaRevision(1); setPaginaFinal(1) }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-500"
            />
            {!filtroDocActivo && roleAdmin === 'superadmin' && (
              <button
                onClick={() => setVerSoloMisAsignados(!verSoloMisAsignados)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                  verSoloMisAsignados 
                    ? 'bg-blue-100 text-blue-800 border-blue-300 shadow-inner' 
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
                title="Filtrar tabla para ver solo los postulantes que te has asignado como revisor"
              >
                {verSoloMisAsignados ? '✓ Filtrando mis asignados' : 'Filtrar mis asignados'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {!filtroDocActivo && (
              <button
                onClick={() => setVerTramosLectura(true)}
                title="Ver las personas que tienen tramos actualmente asignados"
                className="bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-sm px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Ver Asignaciones
              </button>
            )}
            {roleAdmin === 'superadmin' && (
              <>
                <button
                  type="button"
                  onClick={() => { setErrorLimpiarTramos(null); setConfirmandoLimpiarTramos(true) }}
                  title="Elimina toda la configuración de tramos y el reparto entre revisores"
                  className="border-2 border-red-300 bg-red-50 text-red-800 px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors shadow-sm"
                >
                  Quitar todos los tramos
                </button>
                <button
                  type="button"
                  disabled={todosLosPostulantes.length === 0}
                  title={
                    todosLosPostulantes.length === 0 ? 'No hay postulantes en la nómina' : undefined
                  }
                  onClick={confirmarAsignacionTramos}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354A4 4 0 1115 21H3v-1a6 6 0 0112 0v1zm0 0V11m0 0v-4m0 0a4 4 0 114-4 4 4 0 01-4 4z" /></svg>
                  Asignar tramos
                </button>
              </>
            )}
            {todosProcessados && !filtroDocActivo && (
              <button onClick={() => activarFiltroDoc(true)} className="bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold">Activar Filtro Final</button>
            )}
            {filtroDocActivo && (
              <button onClick={() => activarFiltroDoc(false)} className="border border-slate-300 px-3 py-1.5 rounded-lg text-sm text-slate-600">Volver a revisión</button>
            )}
            {!filtroDocActivo && roleAdmin === 'superadmin' && (
              <button onClick={() => setConfirmandoFormateo(true)} className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg text-sm text-red-600 font-bold hover:bg-red-100">Formatear revisión</button>
            )}
          </div>
        </div>

        {filtroDocActivo ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button onClick={() => setVerRechazadosDoc(false)} className={`px-4 py-2 rounded-lg text-sm font-bold ${!verRechazadosDoc ? 'bg-emerald-700 text-white' : 'bg-white text-emerald-700 border border-emerald-300'}`}>Validados ({validadosFinal.length})</button>
              <button onClick={() => setVerRechazadosDoc(true)} className={`px-4 py-2 rounded-lg text-sm font-bold ${verRechazadosDoc ? 'bg-red-600 text-white' : 'bg-white text-red-700 border border-red-300'}`}>Rechazados ({rechazadosFinal.length})</button>
              <button onClick={() => exportarExcel(validadosFinal)} className="ml-auto bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold">Exportar Excel</button>
            </div>
            <RevisionTable 
              postulantes={paginaFinalItems} 
              isFinalView 
              isRechazadosView={verRechazadosDoc} 
              onVerMotivo={setVerMotivo} 
              scrollRef={scrollRefFinal} 
              startIndex={(paginaFinal - 1) * ITEMS_PER_PAGE + 1}
            />
            <TableScrollSlider scrollRef={scrollRefFinal} />
            <TablePagination totalItems={listaFinalActual.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={paginaFinal} onPageChange={setPaginaFinal} />
          </div>
        ) : (
          <div className="space-y-4">
            {errorPostulantes ? <div className="p-4 bg-red-50 text-red-800 rounded-xl">{errorPostulantes}</div> : 
             loadingFiltro ? <div className="text-center py-20">Cargando...</div> :
             todosLosPostulantes.length === 0 ? (
               <div className="text-center py-10 opacity-50">No hay postulantes en la nómina.</div>
             ) :
             <>
               <RevisionTable 
                 postulantes={paginaRevisionItems} 
                 onEvaluar={setEvaluando} 
                 onVerMotivo={setVerMotivo} 
                 scrollRef={scrollRef} 
                 startIndex={(paginaRevision - 1) * ITEMS_PER_PAGE + 1}
               />
               <TableScrollSlider scrollRef={scrollRef} />
               {!todosProcessados && (
                  <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    Faltan por procesar:{' '}
                    <span className="text-amber-700 font-bold">
                      {todosLosPostulantes.filter((p) => p.estado === 'pendiente' || p.estado === 'en_revision').length}
                    </span>{' '}
                    postulantes.
                  </div>
               )}
               <TablePagination totalItems={postulantesFiltrados.length} itemsPerPage={ITEMS_PER_PAGE} currentPage={paginaRevision} onPageChange={setPaginaRevision} />
             </>
            }
          </div>
        )}
      </div>

      {evaluando && (
        <PanelEvaluacion
          key={evaluando.id}
          postulante={evaluando}
          onClose={() => setEvaluando(null)}
          onValidado={refrescarPostulantes}
          onActualizarPostulante={refrescarPostulantes}
        />
      )}
      {verMotivo && <ModalMotivoRechazo postulante={verMotivo} onClose={() => setVerMotivo(null)} />}
      
      {modoAsignacion && (
        <AsignacionRevisoresModal
          onClose={() => { setModoAsignacion(false); void refrescarPostulantes() }}
          onTramosActualizados={() => { void refrescarPostulantes() }}
          postulantesEnVistaRevision={todosLosPostulantes}
        />
      )}

      {confirmandoLimpiarTramos && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">¿Quitar todos los tramos?</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Se borrará la configuración guardada y el campo de reparto en cada postulante. Los revisores volverán a poder ver y evaluar a todos (según sus permisos habituales). Esta acción queda registrada en auditoría.
            </p>
            {errorLimpiarTramos && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{errorLimpiarTramos}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={limpiandoTramos}
                onClick={() => { setConfirmandoLimpiarTramos(false); setErrorLimpiarTramos(null) }}
                className="px-4 py-2 rounded-lg text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={limpiandoTramos}
                onClick={() => { void ejecutarLimpiarTramosDesdePantalla() }}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {limpiandoTramos ? 'Procesando…' : 'Sí, quitar tramos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmandoAsignacionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white mx-auto rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col transform transition-all animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-200 bg-blue-50/80 flex items-center gap-3">
              <svg className="w-7 h-7 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h2 className="text-xl font-black text-blue-900 tracking-tight">Asignación de Tramos</h2>
            </div>
            <div className="p-6 text-slate-700 font-medium">
              <p className="mb-3 text-lg leading-tight">¿Está seguro que desea diseñar y asignar tramos especiales de revisión?</p>
              <p className="text-sm text-slate-500 leading-relaxed">De manera predeterminada usted ya tiene autorización para evaluar directamente a todos los estudiantes de la tabla. Al activar los &quot;tramos&quot; usted limitará formalmente la carga de trabajo de los distintos revisores.</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                onClick={rechazarAsignacion} 
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-100 transition-colors"
              >
                No, evaluar directamente
              </button>
              <button 
                onClick={() => {
                  setConfirmandoAsignacionModal(false)
                  setModoAsignacion(true)
                }} 
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-800 hover:bg-blue-900 transition-colors shadow-sm"
              >
                Sí, asignar tramos
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmandoFormateo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">¿Formatear toda la revisión?</h3>
            <p className="text-sm text-slate-600">Se perderán todas las validaciones y rechazos de todos los postulantes del sistema. Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button disabled={formateando} onClick={() => setConfirmandoFormateo(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-300">Cancelar</button>
              <button disabled={formateando} onClick={handleFormatearRevision} className="px-4 py-2 rounded-lg text-sm bg-red-600 text-white font-bold">{formateando ? 'Procesando...' : 'Sí, borrar todo'}</button>
            </div>
          </div>
        </div>
      )}

      {verTramosLectura && (
        <VerAsignacionesModal onClose={() => setVerTramosLectura(false)} />
      )}
    </AdminLayout>
  )
}
