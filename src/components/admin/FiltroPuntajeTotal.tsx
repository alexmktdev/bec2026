import { useEffect, useMemo, useState } from 'react'
import { useAdminFilter } from '../../contexts/AdminFilterContext'
import { eliminarPostulante } from '../../services/postulacionService'
import type { PostulanteFirestore } from '../../types/postulante'
import { PostulantesTable } from './PostulantesTable'
import { PostulanteDetail } from './PostulanteDetail'
import { AdminLayout } from './AdminLayout'
import { exportarExcel } from '../../services/excelExport'
import { descargarTodosDocumentos } from '../../services/zipDownload'
import { useAuth } from '../../hooks/useAuth'

function puntajeLabel(p: number) {
  return `>=${p} puntos`
}

export function FiltroPuntajeTotal() {
  const { userRole } = useAuth()
  const canManageFiltroPuntaje = userRole?.role === 'superadmin'
  const {
    postulantes,
    postulantesFiltrados,
    loading,
    errorPostulantes,
    puntajeAplicado,
    setFiltroPuntaje,
    clearFiltro,
    refrescarPostulantes,
    actualizarPostulanteLocal,
    eliminarPostulanteLocal,
  } = useAdminFilter()
  const [selected, setSelected] = useState<PostulanteFirestore | null>(null)
  const [exportando, setExportando] = useState<string | null>(null)
  const [modalDescarga, setModalDescarga] = useState<'loading' | 'success' | null>(null)

  const [puntajeSeleccionado, setPuntajeSeleccionado] = useState<number>(30)

  useEffect(() => {
    if (puntajeAplicado != null) setPuntajeSeleccionado(puntajeAplicado)
  }, [puntajeAplicado])
  const [filtrandoPuntaje, setFiltrandoPuntaje] = useState(false)
  const [mostrarModalOk, setMostrarModalOk] = useState(false)

  async function handleEliminar(id: string) {
    try {
      await eliminarPostulante(id)
      eliminarPostulanteLocal(id)
      if (selected?.id === id) setSelected(null)
    } catch (err) {
      console.error('Error eliminando:', err)
      alert('Error al eliminar el postulante.')
    }
  }

  /** Solo quienes ya pasaron revisión de documentos (estado en servidor). */
  const postulantesElegiblesPuntaje = useMemo(
    () => postulantes.filter((p) => p.estado === 'documentacion_validada'),
    [postulantes],
  )

  const tablaLista = useMemo(
    () => (puntajeAplicado == null ? postulantesElegiblesPuntaje : postulantesFiltrados),
    [puntajeAplicado, postulantesElegiblesPuntaje, postulantesFiltrados],
  )

  async function handleFiltrarPuntaje() {
    if (!canManageFiltroPuntaje) return
    if (filtrandoPuntaje) return
    if (postulantesElegiblesPuntaje.length === 0) {
      alert('No hay postulantes con documentación validada. Complete primero la revisión de documentos.')
      return
    }
    setFiltrandoPuntaje(true)
    try {
      await setFiltroPuntaje(puntajeSeleccionado)
      setMostrarModalOk(true)
      window.setTimeout(() => setMostrarModalOk(false), 2500)
    } catch {
      alert('No se pudo aplicar el filtro. Verifique permisos (superadmin) y conexión.')
    } finally {
      setFiltrandoPuntaje(false)
    }
  }

  async function handleExportExcelFiltrado() {
    setExportando('excel')
    try {
      await exportarExcel(tablaLista)
    } catch (err) {
      console.error('Error exportando Excel filtrado:', err)
      alert('Error al exportar Excel.')
    } finally {
      setExportando(null)
    }
  }

  async function handleDescargarDocsFiltrados() {
    setExportando('zip')
    setModalDescarga('loading')
    try {
      await descargarTodosDocumentos(tablaLista)
      setModalDescarga('success')
      setTimeout(() => setModalDescarga(null), 1500)
    } catch (err) {
      console.error('Error descargando documentación filtrada:', err)
      setModalDescarga(null)
      alert('Error al descargar documentos.')
    } finally {
      setExportando(null)
    }
  }

  return (
    <AdminLayout>
        <div className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 max-w-[1600px] mx-auto">
          {/* Explicación */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 leading-relaxed">
              <strong>Orden del proceso:</strong> primero se revisa la documentación de todos los postulantes ingresados;
              solo quienes queden con estado <strong>documentación validada</strong> entran aquí. Al aplicar el filtro, el
              servidor registra el umbral y la lista resultante alimenta la etapa de <strong>filtrado por desempate</strong>.
            </div>
            <h2 className="text-sm font-bold uppercase text-slate-700 mb-2">
              Cómo se calcula el puntaje total
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-blue-800 uppercase">NEM (Promedio)</p>
                <p className="text-xs text-slate-700 mt-1">
                  5.5: 10 pts · 5.6-6.0: 20 pts · 6.1-6.5: 30 pts · 6.6-7.0: 40 pts
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-blue-800 uppercase">RSH (Tramo)</p>
                <p className="text-xs text-slate-700 mt-1">
                  40%: 35 pts · 50%: 20 pts · 60%: 15 pts · 70%: 10 pts · Otros: 0 pts
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-blue-800 uppercase">Enfermedades</p>
                <p className="text-xs text-slate-700 mt-1">
                  Catastrófica: 15 pts · Crónica: 10 pts · Ninguna: 0 pts
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-bold text-blue-800 uppercase">Hermanos/Hijos</p>
                <p className="text-xs text-slate-700 mt-1">
                  1: 5 pts · 2 o más: 10 pts · No: 0 pts
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
              <p className="text-xs font-bold text-blue-900 uppercase">Fórmula</p>
              <p className="text-xs text-blue-800 mt-1">
                Puntaje total = NEM + RSH + Enfermedad + Hermanos/Hijos (máximo 100 pts).
              </p>
              <p className="text-xs text-blue-700 mt-2 font-medium">
                El umbral se guarda en el servidor (solo superadmin puede aplicarlo o quitarlo) y persiste al recargar.
              </p>
            </div>
          </div>

          {/* Filtro UI */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm font-semibold text-slate-700">Seleccionar nivel:</div>
              <select
                value={puntajeSeleccionado}
                onChange={(e) => setPuntajeSeleccionado(parseInt(e.target.value, 10))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={filtrandoPuntaje || !canManageFiltroPuntaje}
              >
                <option value={30}>{puntajeLabel(30)}</option>
                <option value={40}>{puntajeLabel(40)}</option>
                <option value={50}>{puntajeLabel(50)}</option>
                <option value={60}>{puntajeLabel(60)}</option>
                <option value={70}>{puntajeLabel(70)}</option>
                <option value={80}>{puntajeLabel(80)}</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleFiltrarPuntaje}
              disabled={
                filtrandoPuntaje ||
                loading ||
                !canManageFiltroPuntaje ||
                postulantesElegiblesPuntaje.length === 0
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-red-700 px-8 py-4 text-sm font-semibold text-white shadow-sm hover:bg-red-800 disabled:opacity-50"
            >
              {filtrandoPuntaje ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v1m0 10v1m6-6h1M5 12h1m14.07-4.07l.7-.7M7.23 16.77l-.7.7m0-11.4l.7.7m10.64 10.64l.7.7" />
                  </svg>
                  Filtrando...
                </>
              ) : (
                <>Filtrar</>
              )}
            </button>
          </div>
          {!canManageFiltroPuntaje && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-800">
              El filtro de puntaje solo puede ser gestionado por Superadmin. Como revisor, esta vista es de solo lectura y
              refleja el filtro vigente.
            </div>
          )}

          {/* Action buttons (filtrados) */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refrescarPostulantes}
              disabled={loading || !!exportando}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>

            {canManageFiltroPuntaje && puntajeAplicado != null && (
              <button
                type="button"
                onClick={() => {
                  void clearFiltro().catch(() => alert('No se pudo quitar el filtro.'))
                }}
                disabled={!!exportando}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Quitar filtro
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcelFiltrado}
              disabled={!!exportando}
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:opacity-50"
            >
              {exportando === 'excel' ? 'Exportando...' : 'Exportar Excel Completo'}
            </button>

            <button
              type="button"
              onClick={handleDescargarDocsFiltrados}
              disabled={!!exportando}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              {exportando === 'zip' ? 'Descargando...' : 'Descargar Documentación Completa'}
            </button>
          </div>

          {/* Resumen Total */}
          <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900">Total en esta etapa</p>
              <p className="text-2xl font-black text-blue-800 tracking-tight leading-none mt-1">
                {tablaLista.length} <span className="text-base font-semibold text-blue-600 tracking-normal">postulantes</span>
              </p>
            </div>
          </div>

          {/* Tabla */}
          <div className="space-y-4">
            {errorPostulantes ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">Error al cargar los datos</p>
                  <p className="mt-0.5 text-sm text-red-700">{errorPostulantes}</p>
                </div>
                <button
                  onClick={refrescarPostulantes}
                  className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Reintentar
                </button>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
              </div>
            ) : (
              <PostulantesTable
                postulantes={tablaLista}
                onSelectPostulante={setSelected}
                onEliminar={handleEliminar}
                onActualizar={actualizarPostulanteLocal}
              />
            )}
          </div>
        </div>

      {selected && <PostulanteDetail postulante={selected} onClose={() => setSelected(null)} />}

      {/* Modal de descarga */}
      {modalDescarga && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-10 py-8 shadow-2xl min-w-[200px]">
            {modalDescarga === 'loading' ? (
              <>
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700 mb-4" />
                <p className="text-base font-semibold text-slate-700">Cargando...</p>
              </>
            ) : (
              <>
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-slate-800">¡Descarga iniciada!</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal de éxito centrado */}
      {mostrarModalOk && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <div className="flex flex-col items-center justify-center rounded-3xl bg-white p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900">¡Filtrado exitoso!</h3>
            <p className="mt-2 text-sm text-slate-500 text-center max-w-[200px]">
              Los datos se han actualizado correctamente.
            </p>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

