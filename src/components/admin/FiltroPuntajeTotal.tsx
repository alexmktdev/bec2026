import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { saveAs } from 'file-saver'
import { AdminLayout } from './AdminLayout'
import { ExcelRevisionUploadedTable } from './FiltroRevisionDoc/ExcelRevisionUploadedTable'
import { useAuth } from '../../hooks/useAuth'
import {
  aplicarUmbralFiltroPuntajeTotal,
  exportarExcelFiltroPuntajeTotalDesdeServidor,
  limpiarUmbralFiltroPuntajeTotal,
  obtenerVistaFiltroPuntajeTotal,
  type VistaFiltroPuntajeTotal,
} from '../../services/filtroPuntajeTotalService'
import { exportarExcelRevisionTabla, type ExcelRevisionParseResult } from '../../services/excelRevisionImport'
import {
  filasConPuntajeTotalColumnaMinimo,
  findColumnaPuntajeTotalEstricta,
} from '../../utils/puntajeTotalColumnaEstricta'

const UMBRALES = [40, 50, 60, 70, 80] as const
const UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL = 60

function rolEsSuperadmin(role: string | undefined): boolean {
  return (role ?? '').toLowerCase().trim() === 'superadmin'
}

export function FiltroPuntajeTotal() {
  const { user, userRole, loading: authLoading } = useAuth()
  const canManageUmbral = rolEsSuperadmin(userRole?.role)

  const [vista, setVista] = useState<VistaFiltroPuntajeTotal | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [umbralSeleccionado, setUmbralSeleccionado] = useState<number>(40)
  const [filtrando, setFiltrando] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const [exportando, setExportando] = useState(false)
  const [modalFiltroOk, setModalFiltroOk] = useState(false)
  /** Filtro de esta pestaña: solo columna exacta «Puntaje Total» ≥ 60 (solo filas ya en Estado Validado). */
  const [filtroPuntaje60Activo, setFiltroPuntaje60Activo] = useState(false)

  const cargarVista = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const v = await obtenerVistaFiltroPuntajeTotal()
      setVista(v)
      setFiltroPuntaje60Activo(false)
      if (v.umbralActivo != null) setUmbralSeleccionado(v.umbralActivo)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'No se pudo cargar la vista.')
      setVista(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!user?.uid) {
      setLoading(false)
      setVista(null)
      return
    }
    void cargarVista()
  }, [user?.uid, authLoading, cargarVista])

  async function handleFiltrar() {
    if (!canManageUmbral) return
    if (filtrando) return
    setFiltrando(true)
    setError(null)
    try {
      const v = await aplicarUmbralFiltroPuntajeTotal(umbralSeleccionado)
      setVista(v)
      setFiltroPuntaje60Activo(false)
      setModalFiltroOk(true)
      window.setTimeout(() => setModalFiltroOk(false), 2200)
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'No se pudo aplicar el filtro.'
      setError(msg)
    } finally {
      setFiltrando(false)
    }
  }

  async function handleQuitarFiltro() {
    if (!canManageUmbral) return
    if (quitando) return
    setQuitando(true)
    setError(null)
    try {
      const v = await limpiarUmbralFiltroPuntajeTotal()
      setVista(v)
      setFiltroPuntaje60Activo(false)
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'No se pudo quitar el filtro.'
      setError(msg)
    } finally {
      setQuitando(false)
    }
  }

  const columnaPuntajeTotalEstricta = useMemo(() => {
    if (!vista?.headers.length) return null
    return findColumnaPuntajeTotalEstricta(vista.headers)
  }, [vista?.headers])

  const filasSubsetTabla = useMemo(() => {
    if (!vista) return undefined
    if (filtroPuntaje60Activo) {
      if (!columnaPuntajeTotalEstricta) return []
      return filasConPuntajeTotalColumnaMinimo(
        vista.filasBaseValidado,
        columnaPuntajeTotalEstricta,
        UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL,
      )
    }
    if (vista.umbralActivo != null) return vista.filasVista
    return undefined
  }, [vista, filtroPuntaje60Activo, columnaPuntajeTotalEstricta])

  const cantidadFilasTabla =
    filasSubsetTabla === undefined ? (vista?.filasBaseValidado.length ?? 0) : filasSubsetTabla.length

  async function handleExportarExcel() {
    if (exportando || !vista) return
    setExportando(true)
    setError(null)
    try {
      if (filtroPuntaje60Activo && columnaPuntajeTotalEstricta && filasSubsetTabla && filasSubsetTabla.length > 0) {
        const data: ExcelRevisionParseResult = {
          headers: vista.headers,
          rows: filasSubsetTabla,
          sheetName: vista.sheetName || 'Hoja1',
          coincideConPlantillaExport: vista.coincideConPlantillaExport,
          persistedAt: vista.persistedAt ?? undefined,
        }
        await exportarExcelRevisionTabla(data, {
          nombreArchivoBase: `filtro_puntaje_total_${UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL}`,
          nombreHoja: `Puntaje Total ≥${UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL}`,
        })
        return
      }
      const { blob, filename } = await exportarExcelFiltroPuntajeTotalDesdeServidor()
      saveAs(blob, filename)
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
          ? (e as { message: string }).message
          : 'No se pudo descargar el Excel.'
      setError(msg)
    } finally {
      setExportando(false)
    }
  }

  const tableData: ExcelRevisionParseResult | null =
    vista && !vista.sinExcel && vista.headers.length > 0
      ? {
          headers: vista.headers,
          rows: vista.filasBaseValidado,
          sheetName: vista.sheetName || 'Hoja1',
          coincideConPlantillaExport: vista.coincideConPlantillaExport,
          persistedAt: vista.persistedAt ?? undefined,
        }
      : null

  return (
    <AdminLayout>
      <div className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 leading-relaxed">
            <strong>Orden del proceso:</strong> en <strong>Revisión de documentos</strong> se marca cada fila del Excel con
            <strong> Estado</strong> «Validado» o «Rechazado». En esta pestaña solo se consideran quienes figuran como{' '}
            <strong>Validado</strong>.             Use el botón <strong>Filtrar por Puntaje Total ≥ 60</strong> para dejar solo filas validadas cuyo valor
            numérico en la columna exacta <strong>Puntaje Total</strong> sea mayor o igual a 60 (no se usan otras
            columnas). Opcionalmente el superadmin puede guardar otro umbral en el servidor para el resto del flujo.
          </div>
          <h2 className="text-sm font-bold uppercase text-slate-700 mb-2">Cómo se calcula el puntaje total</h2>
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
              <p className="text-xs text-slate-700 mt-1">1: 5 pts · 2 o más: 10 pts · No: 0 pts</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <p className="text-xs font-bold text-blue-900 uppercase">Fórmula</p>
            <p className="text-xs text-blue-800 mt-1">
              Puntaje total = NEM + RSH + Enfermedad + Hermanos/Hijos (máximo 100 pts).
            </p>
            <p className="text-xs text-blue-700 mt-2 font-medium">
              El filtro ≥ 60 se aplica en el navegador leyendo únicamente la celda bajo el encabezado «Puntaje Total». El
              umbral global del servidor (si existe) es independiente y solo superadmin lo modifica.
            </p>
          </div>
        </div>

        {!canManageUmbral && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-900">
            Aplicar o quitar el umbral de puntaje es una acción de <strong>superadmin</strong>. Como revisor o admin puede
            ver la tabla y descargar el Excel según el estado actual del servidor.
          </div>
        )}

        <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="flex flex-col gap-2 w-full sm:w-auto border-b border-slate-100 sm:border-0 pb-3 sm:pb-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filtro de esta pestaña</p>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => {
                  if (!columnaPuntajeTotalEstricta) {
                    setError('No hay columna con encabezado exacto «Puntaje Total» en el Excel.')
                    return
                  }
                  setError(null)
                  setFiltroPuntaje60Activo(true)
                }}
                disabled={loading || !vista || vista.sinExcel || vista.totalValidado === 0}
                className="rounded-xl bg-blue-800 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 disabled:opacity-50"
              >
                Filtrar por Puntaje Total ≥ {UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFiltroPuntaje60Activo(false)
                  setError(null)
                }}
                disabled={loading || !filtroPuntaje60Activo}
                className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                Quitar filtro ≥ {UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL}
              </button>
            </div>
            {!columnaPuntajeTotalEstricta && vista && !vista.sinExcel && !vista.sinColumnaEstado ? (
              <p className="text-[11px] text-amber-800 max-w-xl">
                Falta una columna titulada exactamente <strong>Puntaje Total</strong> (como en el export del panel). No se
                usan encabezados parecidos.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1 min-w-[14rem]">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Umbral en servidor</label>
            <select
              value={umbralSeleccionado}
              onChange={(e) => setUmbralSeleccionado(Number(e.target.value))}
              disabled={filtrando || !canManageUmbral}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            >
              {UMBRALES.map((u) => (
                <option key={u} value={u}>
                  Puntaje total ≥ {u}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => void handleFiltrar()}
            disabled={filtrando || loading || !canManageUmbral}
            className="rounded-xl bg-red-700 px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-800 disabled:opacity-50"
          >
            {filtrando ? 'Aplicando…' : 'Filtrar'}
          </button>
          <button
            type="button"
            onClick={() => void handleQuitarFiltro()}
            disabled={quitando || loading || !canManageUmbral || !vista?.umbralActivo}
            className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {quitando ? 'Quitando…' : 'Quitar filtro'}
          </button>
          <button
            type="button"
            onClick={() => void cargarVista()}
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Actualizar vista
          </button>
          <button
            type="button"
            onClick={() => void handleExportarExcel()}
            disabled={exportando || loading || !vista || cantidadFilasTabla === 0}
            className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-800 disabled:opacity-50"
          >
            {exportando ? 'Generando…' : 'Descargar Excel (vista actual)'}
          </button>
        </div>

        {vista?.umbralActivo != null && (
          <p className="text-xs text-slate-600">
            Umbral activo en servidor: <strong>≥ {vista.umbralActivo}</strong> puntos (sobre filas con Estado Validado).
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-white p-4 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-900">Totales (servidor)</p>
            <p className="text-lg font-bold text-blue-800 mt-1">
              <span className="text-2xl font-black tabular-nums">{vista?.totalValidado ?? '—'}</span>
              <span className="text-sm font-semibold text-blue-600 ml-1">con Estado «Validado»</span>
            </p>
            {vista && filtroPuntaje60Activo && (
              <p className="text-sm font-semibold text-blue-700 mt-1">
                <span className="text-xl font-black tabular-nums">{cantidadFilasTabla}</span>
                <span className="text-slate-600 font-medium text-sm ml-2">
                  en tabla: columna «Puntaje Total» ≥ {UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL} (solo esa columna)
                </span>
              </p>
            )}
            {vista && !filtroPuntaje60Activo && vista.umbralActivo != null && (
              <p className="text-sm font-semibold text-blue-700 mt-1">
                <span className="text-xl font-black tabular-nums">{vista.filasVista.length}</span>
                <span className="text-slate-600 font-medium text-sm ml-2">
                  según umbral en servidor (≥ {vista.umbralActivo}) en columna «Puntaje Total»
                </span>
              </p>
            )}
            {vista && !filtroPuntaje60Activo && vista.umbralActivo == null && vista.totalValidado > 0 && (
              <p className="text-xs text-blue-700/90 mt-1">Sin filtro ≥ 60 ni umbral en servidor: todas las filas validadas.</p>
            )}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        ) : null}

        {authLoading || (loading && !vista) ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
            Cargando vista desde el servidor…
          </div>
        ) : !user ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm">Inicie sesión para continuar.</div>
        ) : vista?.sinExcel ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-6 text-sm text-amber-950 space-y-3">
            <p className="font-semibold">No hay planilla guardada para su usuario</p>
            <p className="leading-relaxed">
              Suba o restaure el Excel en <strong>Revisión de documentos</strong> con esta misma cuenta; los datos persisten
              en Firestore y esta pestaña los leerá desde el servidor.
            </p>
            <Link
              to="/admin/filtro-revision-doc"
              className="inline-flex rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-900"
            >
              Ir a Revisión de documentación
            </Link>
          </div>
        ) : vista?.sinColumnaEstado ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            No se encontró una columna <strong>Estado</strong> reconocible en el Excel. Revise el archivo en revisión de
            documentos.
          </div>
        ) : tableData && vista ? (
          <div className="space-y-3">
            {vista.sinColumnaPuntajeTotal && vista.umbralActivo != null ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                Hay umbral guardado pero el Excel no tiene columna <strong>Puntaje Total</strong> (encabezado exacto); no se
                puede aplicar el corte en servidor hasta corregir el archivo.
              </div>
            ) : null}
            <ExcelRevisionUploadedTable
              data={tableData}
              onClear={() => {}}
              rowsSubset={filasSubsetTabla}
              hideQuitarArchivo
              hidePersistenciaBanner
              subtituloFiltro={
                <p>
                  Filas con <strong>Estado = Validado</strong>
                  {filtroPuntaje60Activo ? (
                    <>
                      {' '}
                      y valor en la columna <strong>Puntaje Total</strong> ≥ {UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL} (filtro de
                      esta pestaña; solo ese encabezado y ese número).
                    </>
                  ) : vista.umbralActivo != null ? (
                    <>
                      {' '}
                      y <strong>Puntaje Total</strong> ≥ {vista.umbralActivo} según umbral en servidor.
                    </>
                  ) : (
                    <> (sin filtro por puntaje en la tabla).</>
                  )}{' '}
                  La búsqueda dentro de la tabla es solo visual en el navegador.
                </p>
              }
              mensajeVacioSinBusqueda={
                vista.totalValidado === 0
                  ? 'Ninguna fila tiene Estado «Validado».'
                  : filtroPuntaje60Activo
                    ? cantidadFilasTabla === 0
                      ? `Ninguna fila tiene en «Puntaje Total» un valor ≥ ${UMBRAL_FILTRO_LOCAL_PUNTAJE_TOTAL}.`
                      : 'Sin resultados para la búsqueda.'
                    : vista.umbralActivo != null && vista.filasVista.length === 0
                      ? 'Ninguna fila cumple el umbral de puntaje en servidor.'
                      : 'Sin resultados para la búsqueda.'
              }
            />
          </div>
        ) : null}
      </div>

      {modalFiltroOk && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-[1px]">
          <div className="rounded-2xl bg-white px-10 py-8 shadow-2xl text-center">
            <p className="text-lg font-bold text-slate-900">Filtro aplicado</p>
            <p className="mt-2 text-sm text-slate-500">El servidor actualizó el umbral y la tabla.</p>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
