import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminFilter } from '../../contexts/AdminFilterContext'
import type { PostulanteFirestore } from '../../types/postulante'
import type { ExcelRevisionRow } from '../../services/excelRevisionImport'
import { loadExcelRevisionImportFirestore } from '../../services/excelRevisionFirestoreService'
import { PostulanteDetail } from './PostulanteDetail'
import { AdminLayout } from './AdminLayout'
import { exportarExcel } from '../../services/excelExport'
import { descargarTodosDocumentos } from '../../services/zipDownload'
import { useAuth } from '../../hooks/useAuth'
import { ZipDownloadBriefNotice } from './ZipDownloadBriefNotice'
import { ExcelRevisionUploadedTable } from './FiltroRevisionDoc/ExcelRevisionUploadedTable'
import { findRutColumnKey, ordenarFilasExcelSegunPostulantes } from '../../utils/excelRevisionRowMatch'
import { normalizeRut } from '../../postulacion/shared/rut'

function puntajeLabel(p: number) {
  return `>=${p} puntos`
}

/** Postulantes con documentación validada (entrada desde revisión de documentos), listados para el umbral de puntaje. */
function ordenarPorPuntajeTotalDesc(lista: PostulanteFirestore[]): PostulanteFirestore[] {
  return [...lista].sort((a, b) => (b.puntaje?.total ?? 0) - (a.puntaje?.total ?? 0))
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
  } = useAdminFilter()
  const [selected, setSelected] = useState<PostulanteFirestore | null>(null)
  const [exportando, setExportando] = useState<string | null>(null)
  const [avisoZipTick, setAvisoZipTick] = useState(0)

  const [puntajeSeleccionado, setPuntajeSeleccionado] = useState<number>(30)

  useEffect(() => {
    if (puntajeAplicado != null) setPuntajeSeleccionado(puntajeAplicado)
  }, [puntajeAplicado])
  const [filtrandoPuntaje, setFiltrandoPuntaje] = useState(false)
  const [mostrarModalOk, setMostrarModalOk] = useState(false)

  const [excelRevision, setExcelRevision] = useState<Awaited<ReturnType<typeof loadExcelRevisionImportFirestore>>>(null)
  const [restaurandoExcel, setRestaurandoExcel] = useState(true)
  const [recargandoExcel, setRecargandoExcel] = useState(false)
  const [errorExcel, setErrorExcel] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const snap = await loadExcelRevisionImportFirestore()
        if (!cancel) setExcelRevision(snap)
      } catch (e) {
        if (!cancel) {
          setErrorExcel(e instanceof Error ? e.message : 'No se pudo cargar el Excel guardado.')
        }
      } finally {
        if (!cancel) setRestaurandoExcel(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const recargarExcelDesdeFirestore = useCallback(async () => {
    if (recargandoExcel) return
    setRecargandoExcel(true)
    setErrorExcel(null)
    try {
      const snap = await loadExcelRevisionImportFirestore()
      setExcelRevision(snap)
    } catch (e) {
      setErrorExcel(e instanceof Error ? e.message : 'No se pudo recargar el Excel guardado.')
    } finally {
      setRecargandoExcel(false)
    }
  }, [recargandoExcel])

  const claveRutExcel = useMemo(
    () => (excelRevision ? findRutColumnKey(excelRevision.headers) : null),
    [excelRevision],
  )

  const activarFilaExcel = useCallback(
    (row: ExcelRevisionRow) => {
      if (!claveRutExcel) return
      const raw = (row[claveRutExcel] ?? '').trim()
      if (!raw) return
      const k = normalizeRut(raw)
      const p = postulantes.find((pr) => normalizeRut(pr.rut) === k)
      if (p) setSelected(p)
    },
    [claveRutExcel, postulantes],
  )

  /** Solo quienes ya pasaron revisión de documentos (estado en servidor). */
  const postulantesElegiblesPuntaje = useMemo(
    () => postulantes.filter((p) => p.estado === 'documentacion_validada'),
    [postulantes],
  )

  /** Siempre orden mayor → menor puntaje total (misma nómina que viene de revisión de documentos). */
  const tablaLista = useMemo(() => {
    const base =
      puntajeAplicado == null ? postulantesElegiblesPuntaje : postulantesFiltrados
    return ordenarPorPuntajeTotalDesc(base)
  }, [puntajeAplicado, postulantesElegiblesPuntaje, postulantesFiltrados])

  const filasExcelFiltradas = useMemo(() => {
    if (!excelRevision || !claveRutExcel) return []
    return ordenarFilasExcelSegunPostulantes(excelRevision.rows, claveRutExcel, tablaLista)
  }, [excelRevision, claveRutExcel, tablaLista])

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
    setAvisoZipTick((t) => t + 1)
    setExportando('zip')
    try {
      await descargarTodosDocumentos(tablaLista)
    } catch (err) {
      console.error('Error descargando documentación filtrada:', err)
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
              solo quienes queden con estado <strong>documentación validada</strong> entran aquí. La tabla principal es la
              misma planilla que sube en <strong>Revisión de documentación</strong> (mismo formato y columnas), mostrando
              solo las filas de esta etapa y ordenadas por <strong>puntaje total de mayor a menor</strong>. Al aplicar el
              filtro, el servidor registra el umbral y la lista resultante alimenta la etapa de{' '}
              <strong>filtrado por desempate</strong>.
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
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar postulantes
            </button>

            <button
              type="button"
              onClick={() => void recargarExcelDesdeFirestore()}
              disabled={restaurandoExcel || recargandoExcel}
              title="Vuelve a leer desde Firestore el Excel de Revisión de documentación (útil tras subir un archivo nuevo o editarlo en otro equipo con la misma sesión)."
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${recargandoExcel ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {recargandoExcel ? 'Recargando Excel…' : 'Recargar Excel'}
            </button>

            {canManageFiltroPuntaje && puntajeAplicado != null && (
              <button
                type="button"
                onClick={() => {
                  void clearFiltro().catch(() => alert('No se pudo quitar el filtro.'))
                }}
                disabled={exportando === 'excel'}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Quitar filtro
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcelFiltrado}
              disabled={exportando === 'excel'}
              className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:opacity-50"
            >
              {exportando === 'excel' ? 'Exportando...' : 'Exportar Excel Completo'}
            </button>

            <button
              type="button"
              onClick={handleDescargarDocsFiltrados}
              disabled={exportando === 'zip'}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
            >
              {exportando === 'zip' ? 'Preparando ZIP…' : 'Descargar Documentación Completa'}
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

          {/* Tabla Excel: no depende del loading de postulantes (antes el spinner tapaba todo el bloque). */}
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
            ) : (
              <>
                {loading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-2 text-xs text-blue-900">
                    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
                    <span>
                      Actualizando postulantes desde el servidor… La planilla del Excel se muestra igualmente abajo; hasta
                      que termine la carga se ve el archivo completo y después se aplica el filtro de esta etapa (documentación
                      validada y umbral de puntaje si está activo).
                    </span>
                  </div>
                ) : null}

                {errorExcel ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                    {errorExcel}
                  </div>
                ) : restaurandoExcel ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
                    Cargando tabla del Excel revisado…
                  </div>
                ) : !excelRevision ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-6 text-sm text-amber-950 space-y-3">
                    <p className="font-semibold text-amber-900">Aún no hay un Excel revisado cargado</p>
                    <p className="text-amber-900/90 leading-relaxed">
                      Esta pestaña muestra la misma planilla que sube en <strong>Revisión de documentación</strong>, pero solo las
                      filas que corresponden a postulantes con documentación validada y al filtro de puntaje vigente (orden por
                      puntaje total de mayor a menor). Suba primero el archivo .xlsx en esa pestaña con el mismo usuario con el
                      que está conectado ahora, o pulse <strong>Recargar Excel</strong> si ya lo subió.
                    </p>
                    <Link
                      to="/admin/filtro-revision-doc"
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-900"
                    >
                      Ir a Revisión de documentación — Subir Excel revisado
                    </Link>
                  </div>
                ) : !claveRutExcel ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    El archivo guardado no tiene una columna <strong>RUT</strong> reconocible; no se puede alinear con el listado
                    del sistema. Vuelva a exportar desde el panel y suba el Excel en revisión de documentación.
                  </div>
                ) : (
                  <ExcelRevisionUploadedTable
                    data={excelRevision}
                    onClear={() => {}}
                    rowsSubset={loading ? undefined : filasExcelFiltradas}
                    hideQuitarArchivo
                    hidePersistenciaBanner
                    onRowActivate={loading ? undefined : activarFilaExcel}
                    subtituloFiltro={
                      <div className="space-y-2">
                        {loading ? (
                          <p className="text-amber-800 font-medium">
                            Vista temporal: <strong>todas las filas</strong> del archivo hasta que termine de cargar el listado
                            de postulantes; luego solo las de esta etapa.
                          </p>
                        ) : null}
                        <p>
                          Mismas columnas y estilo que en <strong>Revisión de documentación</strong>.
                          {!loading ? (
                            <>
                              {' '}
                              Solo aparecen RUT que existen en el archivo y en esta etapa
                              {puntajeAplicado != null ? (
                                <>
                                  {' '}
                                  con puntaje total <strong>≥ {puntajeAplicado}</strong>
                                </>
                              ) : (
                                <> (todas las filas con documentación validada)</>
                              )}
                              .
                            </>
                          ) : null}{' '}
                          Clic en una fila abre la ficha si el postulante ya está cargado. Exportar Excel / ZIP de arriba sigue
                          usando los datos del servidor ({loading ? '…' : tablaLista.length} postulantes en esta vista
                          {loading ? ', cargando' : ''}).
                        </p>
                      </div>
                    }
                    mensajeVacioSinBusqueda={
                      loading
                        ? 'Esperando datos de postulantes para alinear filas por RUT…'
                        : tablaLista.length === 0
                          ? 'No hay postulantes con documentación validada en esta etapa, o el umbral de puntaje dejó la lista vacía.'
                          : 'Ningún RUT del Excel coincide con el listado filtrado. Compruebe que el archivo corresponde al mismo proceso y que los RUT coinciden con el panel.'
                    }
                  />
                )}
              </>
            )}
          </div>
        </div>

      {selected && <PostulanteDetail postulante={selected} onClose={() => setSelected(null)} />}

      <ZipDownloadBriefNotice tick={avisoZipTick} />

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

