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
import {
  esCeldaEstadoValidado,
  findEstadoColumnKeyParaValidado,
  findRutColumnKey,
  ordenarFilasExcelSegunPostulantes,
} from '../../utils/excelRevisionRowMatch'
import { rutClaveParaComparacion } from '../../postulacion/shared/rut'

function puntajeLabel(p: number) {
  return `>=${p} puntos`
}

/** Postulantes con documentación validada (entrada desde revisión de documentos), listados para el umbral de puntaje. */
function ordenarPorPuntajeTotalDesc(lista: PostulanteFirestore[]): PostulanteFirestore[] {
  return [...lista].sort((a, b) => (b.puntaje?.total ?? 0) - (a.puntaje?.total ?? 0))
}

function rolEsSuperadmin(role: string | undefined): boolean {
  return (role ?? '').toLowerCase().trim() === 'superadmin'
}

export function FiltroPuntajeTotal() {
  const { user, userRole, loading: authLoading } = useAuth()
  const canManageFiltroPuntaje = rolEsSuperadmin(userRole?.role)
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
  const [restaurandoExcel, setRestaurandoExcel] = useState(false)
  const [recargandoExcel, setRecargandoExcel] = useState(false)
  const [errorExcel, setErrorExcel] = useState<string | null>(null)

  /**
   * Sin esperar a que exista `user`, `loadExcelRevisionImportFirestore` corre con uid null y devuelve siempre null
   * (parece “no hay Excel”). Hay que volver a cargar cuando la sesión de Firebase ya está lista.
   */
  useEffect(() => {
    if (authLoading) return

    if (!user?.uid) {
      setRestaurandoExcel(false)
      setExcelRevision(null)
      setErrorExcel(null)
      return
    }

    let cancel = false
    setRestaurandoExcel(true)
    setErrorExcel(null)
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
  }, [user?.uid, authLoading])

  const recargarExcelDesdeFirestore = useCallback(async () => {
    if (recargandoExcel || !user?.uid) return
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
  }, [recargandoExcel, user?.uid])

  const claveRutExcel = useMemo(
    () => (excelRevision ? findRutColumnKey(excelRevision.headers) : null),
    [excelRevision],
  )

  const claveEstadoExcel = useMemo(
    () =>
      excelRevision?.rows.length
        ? findEstadoColumnKeyParaValidado(excelRevision.headers, excelRevision.rows)
        : null,
    [excelRevision],
  )

  /** Solo filas marcadas «Validado»/«Validada» en la columna Estado del Excel. */
  const filasExcelSoloEstadoValidado = useMemo(() => {
    if (!excelRevision?.rows.length) return []
    if (!claveEstadoExcel) return excelRevision.rows
    return excelRevision.rows.filter((row) => esCeldaEstadoValidado(row[claveEstadoExcel] ?? ''))
  }, [excelRevision, claveEstadoExcel])

  const activarFilaExcel = useCallback(
    (row: ExcelRevisionRow) => {
      if (!claveRutExcel) return
      const raw = (row[claveRutExcel] ?? '').trim()
      if (!raw) return
      const k = rutClaveParaComparacion(raw)
      const p = postulantes.find((pr) => rutClaveParaComparacion(pr.rut) === k)
      if (p) setSelected(p)
    },
    [claveRutExcel, postulantes],
  )

  /** Solo quienes ya pasaron revisión de documentos (estado en servidor). */
  const postulantesElegiblesPuntaje = useMemo(
    () => postulantes.filter((p) => p.estado === 'documentacion_validada'),
    [postulantes],
  )

  /**
   * Orden para alinear el Excel con el servidor por RUT: todos los postulantes cargados, por puntaje.
   * - No depende del umbral (`postulantesFiltrados`).
   * - No se limita a `documentacion_validada`: el Excel puede traer «DOC. VALIDADA» de un export aunque en Firestore el
   *   estado aún sea otro; igual se cruza RUT y se ordena por puntaje.
   */
  const postulantesOrdenVistaExcel = useMemo(
    () => ordenarPorPuntajeTotalDesc(postulantes),
    [postulantes],
  )

  /** Listado de la pestaña para export/ZIP y totales sin Excel: respeta umbral si está activo. */
  const tablaLista = useMemo(() => {
    const base =
      puntajeAplicado == null ? postulantesElegiblesPuntaje : postulantesFiltrados
    return ordenarPorPuntajeTotalDesc(base)
  }, [puntajeAplicado, postulantesElegiblesPuntaje, postulantesFiltrados])

  /** Filas Validado del Excel; orden por RUT según puntaje de la lista completa de postulantes (no según el umbral). */
  const filasExcelParaMostrar = useMemo(() => {
    if (!excelRevision) return []
    if (!claveRutExcel) return filasExcelSoloEstadoValidado
    const ordenadas = ordenarFilasExcelSegunPostulantes(
      filasExcelSoloEstadoValidado,
      claveRutExcel,
      postulantesOrdenVistaExcel,
    )
    if (ordenadas.length > 0) return ordenadas
    if (filasExcelSoloEstadoValidado.length > 0) return filasExcelSoloEstadoValidado
    return []
  }, [excelRevision, claveRutExcel, filasExcelSoloEstadoValidado, postulantesOrdenVistaExcel])

  const ordenServidorAplicado = useMemo(() => {
    if (!claveRutExcel || filasExcelSoloEstadoValidado.length === 0) return true
    const ordenadas = ordenarFilasExcelSegunPostulantes(
      filasExcelSoloEstadoValidado,
      claveRutExcel,
      postulantesOrdenVistaExcel,
    )
    return ordenadas.length > 0
  }, [claveRutExcel, filasExcelSoloEstadoValidado, postulantesOrdenVistaExcel])

  /** Total del recuadro azul: filas visibles en la tabla del Excel (Estado Validado + cruce RUT), o listado del servidor si aún no hay planilla. */
  const totalPostulantesVista = useMemo(() => {
    if (excelRevision && user) return filasExcelParaMostrar.length
    return tablaLista.length
  }, [excelRevision, user, filasExcelParaMostrar.length, tablaLista.length])

  async function handleFiltrarPuntaje() {
    if (!canManageFiltroPuntaje) return
    if (filtrandoPuntaje) return
    setFiltrandoPuntaje(true)
    try {
      await setFiltroPuntaje(puntajeSeleccionado)
      setMostrarModalOk(true)
      window.setTimeout(() => setMostrarModalOk(false), 2500)
    } catch (err) {
      const msg =
        err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
          ? (err as { message: string }).message
          : 'No se pudo aplicar el filtro.'
      alert(
        `${msg} Si su usuario es superadmin en Firestore, compruebe que el campo role sea exactamente «superadmin» (minúsculas) o vuelva a iniciar sesión.`,
      )
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
              solo quienes queden con estado <strong>documentación validada</strong> entran aquí.               La tabla principal es la
              misma planilla que sube en <strong>Revisión de documentación</strong>, mostrando solo quienes tengan en la
              columna <strong>Estado</strong> el texto <strong>Validado</strong>, «Validada», o el rotulo del export{' '}
              <strong>DOC. VALIDADA</strong>; el resto no aparece. Esas
              filas se ordenan por <strong>puntaje total de mayor a menor</strong> según el listado del servidor. Al aplicar el
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
              disabled={filtrandoPuntaje || loading || !canManageFiltroPuntaje}
              title={
                !canManageFiltroPuntaje
                  ? 'Solo usuarios con rol superadmin pueden aplicar el umbral en el servidor.'
                  : loading
                    ? 'Espere a que termine de cargar la lista de postulantes.'
                    : undefined
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

            {puntajeAplicado != null && (
              <button
                type="button"
                onClick={() => {
                  if (!canManageFiltroPuntaje) {
                    alert('Solo un usuario con rol superadmin puede quitar el filtro en el servidor.')
                    return
                  }
                  void clearFiltro().catch((e) =>
                    alert(e instanceof Error ? e.message : 'No se pudo quitar el filtro.'),
                  )
                }}
                disabled={exportando === 'excel'}
                title={
                  !canManageFiltroPuntaje
                    ? `Umbral activo: ≥${puntajeAplicado}. Pulse para ver el aviso de permisos o inicie sesión como superadmin.`
                    : 'Elimina el umbral en el servidor y vuelve a mostrar todos los de documentación validada.'
                }
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Quitar filtro (umbral {puntajeAplicado})
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
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900">Total en esta vista</p>
              <p className="text-2xl font-black text-blue-800 tracking-tight leading-none mt-1">
                {totalPostulantesVista}{' '}
                <span className="text-base font-semibold text-blue-600 tracking-normal">postulantes</span>
              </p>
              {excelRevision ? (
                <p className="text-[11px] text-blue-700/90 mt-1 max-w-md">
                  Cuenta las filas de la tabla de abajo (Estado validado: «Validado», «Validada» o <strong>DOC. VALIDADA</strong>{' '}
                  del export; orden por puntaje del servidor si el RUT de la fila cruza con un postulante cargado).
                </p>
              ) : (
                <p className="text-[11px] text-blue-700/90 mt-1">Según postulantes en el servidor para esta etapa.</p>
              )}
            </div>
          </div>

          {/* Tabla Excel: no se oculta por errores al refrescar postulantes ni por loading (evita parpadeos). */}
          <div className="space-y-4">
            {errorPostulantes ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex flex-wrap items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div className="flex-1 min-w-[12rem]">
                  <p className="text-sm font-semibold text-red-800">No se pudo actualizar la lista de postulantes</p>
                  <p className="mt-0.5 text-xs text-red-700">{errorPostulantes}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void refrescarPostulantes()}
                  className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Reintentar
                </button>
              </div>
            ) : null}

            {loading ? (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/90 px-3 py-2 text-xs text-blue-900">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-blue-300 border-t-blue-700" />
                <span>
                  Actualizando postulantes… La tabla del Excel abajo no se reinicia: las filas siguen alineadas al último
                  listado cargado hasta que termine esta solicitud.
                </span>
              </div>
            ) : null}

            {errorExcel ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
                {errorExcel}
              </div>
            ) : authLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
                Verificando sesión…
              </div>
            ) : restaurandoExcel ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
                Cargando planilla desde la base de datos…
              </div>
            ) : !user ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-6 text-sm text-amber-950">
                Inicie sesión para cargar el Excel guardado en su cuenta.
              </div>
            ) : !excelRevision ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-6 text-sm text-amber-950 space-y-3">
                <p className="font-semibold text-amber-900">Aún no hay un Excel revisado cargado</p>
                <p className="text-amber-900/90 leading-relaxed">
                  Esta pestaña muestra la misma planilla que sube en <strong>Revisión de documentación</strong>. Suba el .xlsx
                  allí con este mismo usuario o pulse <strong>Recargar Excel</strong> arriba.
                </p>
                <Link
                  to="/admin/filtro-revision-doc"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-900"
                >
                  Ir a Revisión de documentación — Subir Excel revisado
                </Link>
              </div>
            ) : (
              <>
                {!claveEstadoExcel ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    <strong>No se encontró columna «Estado».</strong> Se muestran todas las filas del archivo; defina «Validado»
                    en esa columna y vuelva a subir el Excel para filtrar solo validados.
                  </div>
                ) : null}
                {!claveRutExcel ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    <strong>Sin columna RUT.</strong> Filas con Estado Validado se muestran sin ordenar según el servidor.
                  </div>
                ) : null}
                {claveEstadoExcel &&
                filasExcelSoloEstadoValidado.length === 0 &&
                excelRevision.rows.length > 0 ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    Ninguna fila tiene en <strong>Estado</strong> un valor reconocido como validada (p. ej. «Validado»,
                    «Validada» o «DOC. VALIDADA» del export). Revise el Excel en revisión de documentación.
                  </div>
                ) : null}
                {claveRutExcel &&
                claveEstadoExcel &&
                filasExcelSoloEstadoValidado.length > 0 &&
                !ordenServidorAplicado &&
                !loading &&
                !errorPostulantes ? (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    {postulantes.length === 0 ? (
                      <>
                        Aún <strong>no hay postulantes</strong> cargados desde el servidor (o la lista viene vacía). No se puede
                        ordenar por puntaje; las filas del Excel siguen en <strong>orden de archivo</strong>. Pulse{' '}
                        <strong>Actualizar postulantes</strong>.
                      </>
                    ) : (
                      <>
                        Los RUT del Excel <strong>no coinciden</strong> con ningún postulante de la lista del servidor (formato,
                        columna equivocada o personas que ya no están en el sistema). Las filas validadas se muestran en{' '}
                        <strong>orden de archivo</strong>. Compruebe la columna RUT (p. ej.{' '}
                        <span className="font-mono">12.345.678-9</span>) y pulse <strong>Actualizar postulantes</strong>.
                      </>
                    )}
                  </div>
                ) : null}
                <ExcelRevisionUploadedTable
                  data={excelRevision}
                  onClear={() => {}}
                  rowsSubset={filasExcelParaMostrar}
                  hideQuitarArchivo
                  hidePersistenciaBanner
                  onRowActivate={activarFilaExcel}
                  subtituloFiltro={
                    <p>
                      Solo filas con <strong>Estado</strong> validado: «Validado», «Validada» o «DOC. VALIDADA» (export del
                      panel).
                      {claveRutExcel ? (
                        <>
                          {' '}
                          Orden por <strong>puntaje total</strong> según la lista completa de postulantes en el servidor (cruce
                          por RUT; no solo los que cumplen el umbral activo).
                          {puntajeAplicado != null ? (
                            <>
                              {' '}
                              Umbral registrado: <strong>≥ {puntajeAplicado}</strong> (afecta export/ZIP de arriba, no el orden
                              de esta tabla).
                            </>
                          ) : null}
                        </>
                      ) : (
                        <> Sin columna RUT, sin orden del servidor.</>
                      )}{' '}
                      Clic en fila abre ficha. Los botones <strong>Exportar Excel</strong> / <strong>Descargar ZIP</strong> de
                      arriba siguen usando {tablaLista.length} postulantes del servidor en esta etapa.
                    </p>
                  }
                  mensajeVacioSinBusqueda={
                    excelRevision.rows.length === 0
                      ? 'El archivo guardado no tiene filas de datos.'
                      : claveEstadoExcel && filasExcelSoloEstadoValidado.length === 0
                        ? 'Ninguna fila cumple criterio de estado validado en el Excel.'
                        : filasExcelParaMostrar.length === 0
                          ? 'Sin filas que mostrar con los filtros actuales.'
                          : 'Sin resultados para la búsqueda.'
                  }
                />
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

