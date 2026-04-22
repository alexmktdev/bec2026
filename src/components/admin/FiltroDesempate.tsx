import { useEffect, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import { descargarTodosDocumentos } from '../../services/zipDownload'
import type { PostulanteFirestore } from '../../types/postulante'
import { exportarExcelRevisionTabla, type ExcelRevisionParseResult } from '../../services/excelRevisionImport'
import { ZipDownloadBriefNotice } from './ZipDownloadBriefNotice'
import { ExcelRevisionUploadedTable } from './FiltroRevisionDoc/ExcelRevisionUploadedTable'
import {
  obtenerRankingDesempate,
  type EmpatesResumenDesempate,
  type FuenteVistaPuntajeDesempate,
} from '../../services/desempateService'
import {
  getCriterioDesempateConfig,
  setCriterioDesempateConfig,
  clearCriterioDesempateConfig,
  type CriterioDesempate,
} from '../../services/filtroConfigService'

const TOP_RANK_VERDE = 150

const CRITERIOS_ACUMULABLES: { value: CriterioDesempate | 'none'; label: string }[] = [
  { value: 'none', label: 'Sin filtro activo (solo puntaje total)' },
  { value: 'nem', label: '2° filtro: Puntaje total + Puntaje NEM' },
  { value: 'rsh', label: '3° filtro: + Puntaje RSH' },
  { value: 'enfermedad', label: '4° filtro: + Puntaje Enfermedad' },
  { value: 'hermanos', label: '5° filtro: + Puntaje Hermanos/Hijos' },
  { value: 'fecha', label: '6° filtro: + Fecha/Hora de postulación' },
]

function normalizarCriterioUI(
  value: CriterioDesempate | 'none' | null | undefined,
): CriterioDesempate | 'none' {
  return value == null ? 'none' : value
}

const EMPATES_VACIO: EmpatesResumenDesempate = {
  gruposConEmpate: 0,
  postulantesEnEmpate: 0,
  detalleGrupos: [],
}

/** Descripción de qué valores deben coincidir para contar como “empate” con el filtro activo. */
function descripcionClaveEmpate(criterio: CriterioDesempate | 'none'): string {
  switch (criterio) {
    case 'none':
      return 'mismo valor en columna «Puntaje Total» del Excel'
    case 'nem':
      return 'mismos valores en columnas «Puntaje Total» y «Puntaje NEM» del Excel'
    case 'rsh':
      return 'mismos valores en «Puntaje Total», «Puntaje NEM» y «Puntaje RSH» del Excel'
    case 'enfermedad':
      return 'mismos valores en «Puntaje Total», «Puntaje NEM», «Puntaje RSH» y «Puntaje Enfermedad» del Excel'
    case 'hermanos':
      return 'mismos valores en «Puntaje Total», «Puntaje NEM», «Puntaje RSH», «Puntaje Enfermedad» y «Puntaje Hermanos» del Excel'
    case 'fecha':
      return 'mismos puntajes en Excel (Total…Hermanos) y misma fecha y hora en columna «Fecha Registro»'
    default:
      return 'los criterios aplicados'
  }
}

// ── Componente principal ──────────────────────────────────────────────────────

export function FiltroDesempate() {
  const [listaOrdenada, setListaOrdenada] = useState<PostulanteFirestore[]>([])
  const [loading, setLoading] = useState(true)
  const [errorPostulantes, setErrorPostulantes] = useState<string | null>(null)
  const [criterioSeleccionado, setCriterioSeleccionado] = useState<CriterioDesempate | 'none'>('none')
  const [guardandoCriterio, setGuardandoCriterio] = useState(false)
  const [avisoZipTick, setAvisoZipTick] = useState(0)
  const [exportando, setExportando] = useState<string | null>(null)
  const [empatesResumen, setEmpatesResumen] = useState<EmpatesResumenDesempate>(EMPATES_VACIO)
  const [fuenteVistaPuntaje, setFuenteVistaPuntaje] = useState<FuenteVistaPuntajeDesempate | null>(null)
  const [tablaExcelDesempate, setTablaExcelDesempate] = useState<ExcelRevisionParseResult | null>(null)

  const cargarRanking = async (criterio: CriterioDesempate | null) => {
    setLoading(true)
    setErrorPostulantes(null)
    try {
      // El ranking y la nómina cruzada vienen del servidor (`obtenerRankingDesempateAdmin`).
      // No llamar `refrescarPostulantes()` aquí: evita un segundo `postulantes.get()` completo (N lecturas)
      // redundante con cada carga o cambio de criterio. El panel se actualiza al entrar / botón Actualizar.
      const data = await obtenerRankingDesempate(criterio)
      setListaOrdenada(data.postulantes)
      setEmpatesResumen(data.empatesResumen ?? EMPATES_VACIO)
      setFuenteVistaPuntaje(data.fuenteVistaPuntaje ?? null)
      setTablaExcelDesempate(data.tablaExcelDesempate ?? null)
      setCriterioSeleccionado(normalizarCriterioUI(data.criterioHasta))
    } catch (err) {
      console.error('Error cargando ranking de desempate:', err)
      setListaOrdenada([])
      setEmpatesResumen(EMPATES_VACIO)
      setFuenteVistaPuntaje(null)
      setTablaExcelDesempate(null)
      setErrorPostulantes('No se pudo cargar el ranking de desempate. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const init = async () => {
      try {
        const saved = await getCriterioDesempateConfig()
        const criterioInicial = saved ?? null
        setCriterioSeleccionado(normalizarCriterioUI(criterioInicial))
        await cargarRanking(criterioInicial)
      } catch {
        await cargarRanking(null)
      }
    }
    void init()
  }, [])

  async function handleExportExcel() {
    if (!tablaExcelDesempate?.rows.length) return
    setExportando('excel')
    try {
      await exportarExcelRevisionTabla(tablaExcelDesempate, {
        nombreArchivoBase: 'filtro_desempate_ranking',
        nombreHoja: 'Ranking desempate',
      })
    } catch (err) {
      console.error('Error exportando Excel:', err)
      alert('Error al exportar Excel.')
    } finally {
      setExportando(null)
    }
  }

  async function handleAplicarCriterio() {
    setGuardandoCriterio(true)
    try {
      const criterioBackend = criterioSeleccionado === 'none' ? null : criterioSeleccionado
      if (criterioBackend == null) {
        await clearCriterioDesempateConfig()
        await cargarRanking(null)
      } else {
        await setCriterioDesempateConfig(criterioBackend)
        await cargarRanking(criterioBackend)
      }
    } catch (err) {
      console.error('Error aplicando criterio:', err)
      alert('No se pudo aplicar el criterio de desempate.')
    } finally {
      setGuardandoCriterio(false)
    }
  }

  async function handleResetFiltros() {
    setGuardandoCriterio(true)
    try {
      await clearCriterioDesempateConfig()
      setCriterioSeleccionado('none')
      await cargarRanking(null)
    } catch (err) {
      console.error('Error reseteando filtros:', err)
      alert('No se pudo resetear el filtro de desempate.')
    } finally {
      setGuardandoCriterio(false)
    }
  }

  async function handleDescargarDocs() {
    setAvisoZipTick((t) => t + 1)
    setExportando('zip')
    try {
      await descargarTodosDocumentos(listaOrdenada)
    } catch (err) {
      console.error('Error descargando documentos:', err)
      alert('Error al descargar documentos.')
    } finally {
      setExportando(null)
    }
  }

  return (
    <AdminLayout>
        <div className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 max-w-[1600px] mx-auto">

          {/* Encabezado de sección */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 flex gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <div>
              <h3 className="text-sm font-bold text-blue-900 uppercase tracking-tight">FILTRADO POR DESEMPATE</h3>
              <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                La <strong>entrada</strong> es la misma tabla que en <strong>Filtrado por puntaje total</strong>: filas con
                Estado «Validado» y, si el superadmin definió umbral global, solo quienes cumplen el puntaje mínimo. Los
                datos se leen del Excel guardado en Firestore con <strong>su usuario</strong> y se cruzan con los
                postulantes del sistema por <strong>RUT</strong>. El orden principal usa solo las columnas del Excel con
                encabezados exactos <strong>Puntaje Total</strong>, <strong>Puntaje NEM</strong>,{' '}
                <strong>Puntaje RSH</strong>, <strong>Puntaje Enfermedad</strong> y <strong>Puntaje Hermanos</strong>{' '}
                (hasta el 5.º filtro), todos en descendente. El 6.º nivel usa la columna <strong>Fecha Registro</strong>{' '}
                del Excel (fecha y hora en la celda): <strong>quien postuló antes queda más arriba</strong>; los que
                postularon después van bajando. Orden:{' '}
                <strong>
                  Puntaje Total (Excel) ↓ → Puntaje NEM (Excel) ↓ → Puntaje RSH (Excel) ↓ → Puntaje Enfermedad (Excel) ↓ →
                  Puntaje Hermanos (Excel) ↓ → Fecha Registro (Excel, antes ↑ / después ↓)
                </strong>
                .
              </p>
            </div>
          </div>

          {fuenteVistaPuntaje && !fuenteVistaPuntaje.sinDatos && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <span className="font-semibold text-slate-800">Vista de origen:</span>{' '}
              {fuenteVistaPuntaje.totalFilasVista} fila{fuenteVistaPuntaje.totalFilasVista !== 1 ? 's' : ''} en filtrado
              por puntaje total
              {fuenteVistaPuntaje.umbralActivo != null ? (
                <>
                  {' '}
                  (umbral activo <strong>≥ {fuenteVistaPuntaje.umbralActivo}</strong> pts.)
                </>
              ) : (
                <> (sin umbral de puntaje; todas las filas validadas).</>
              )}
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
              <p className="text-xs font-bold uppercase tracking-widest text-blue-900">Total en esta etapa final</p>
              <p className="text-2xl font-black text-blue-800 tracking-tight leading-none mt-1">
                {listaOrdenada.length}{' '}
                <span className="text-base font-semibold text-blue-600 tracking-normal">
                  postulantes en el ranking (desde su vista de puntaje + Firestore)
                </span>
              </p>
            </div>
          </div>

          {/* Empates restantes (agrupación por “huella” de puntajes según criterio; backend) */}
          {listaOrdenada.length > 0 && (
            <div
              className={`rounded-xl border p-4 shadow-sm ${
                empatesResumen.gruposConEmpate > 0
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-emerald-200 bg-emerald-50/80'
              }`}
            >
              <div className="flex items-start gap-3">
                {empatesResumen.gruposConEmpate > 0 ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <div className="flex-1 min-w-0">
                  <h3
                    className={`text-sm font-bold uppercase tracking-tight ${
                      empatesResumen.gruposConEmpate > 0 ? 'text-amber-900' : 'text-emerald-900'
                    }`}
                  >
                    {empatesResumen.gruposConEmpate > 0
                      ? `Empates restantes: ${empatesResumen.gruposConEmpate} grupo(s) · ${empatesResumen.postulantesEnEmpate} postulante(s) involucrados`
                      : 'Sin empates restantes con el filtro actual'}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">
                    <strong>¿Qué es la «clave»?</strong> En el servidor no es una contraseña: es una{' '}
                    <strong>huella</strong> que resume los valores que ya se usaron para comparar (puntaje total y, según
                    el menú, NEM, RSH, enfermedad, hermanos, fecha/hora). Dos postulantes están en el mismo grupo de
                    empate si esa huella es idéntica — es decir, si coinciden en{' '}
                    <strong>{descripcionClaveEmpate(criterioSeleccionado)}</strong>. El orden de la tabla sigue el
                    criterio oficial del servidor (incluye desempates finos cuando aplica).
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {criterioSeleccionado === 'none'
                      ? 'Solo se ordena por la columna «Puntaje Total» del Excel (descendente).'
                      : 'Cada nivel añade un desempate en el Excel: 2.º «Puntaje NEM», 3.er «Puntaje RSH», 4.º «Puntaje Enfermedad», 5.º «Puntaje Hermanos», 6.º «Fecha Registro» (antes arriba, después abajo).'}
                  </p>
                  {empatesResumen.gruposConEmpate > 0 && (
                    <p className="mt-2 text-xs font-medium text-amber-900/95 rounded-md border border-amber-200 bg-amber-100/60 px-2 py-1.5">
                      Aún hay grupos indistinguibles con el criterio actual. Suba un nivel en el filtro de desempate
                      (p. ej. de NEM a RSH) y pulse <strong>Aplicar filtro</strong> para intentar separarlos. Si tras
                      llegar a <strong>fecha/hora</strong> siguen apareciendo aquí, esas personas quedan empatadas en
                      todos los criterios oficiales.
                    </p>
                  )}
                  {empatesResumen.gruposConEmpate > 0 && (
                    <div className="mt-3 space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {empatesResumen.detalleGrupos.map((grupo, idx) => (
                        <div key={`emp-${idx}-${grupo.postulantes[0]?.id ?? ''}`} className="rounded-lg border border-amber-200 bg-white/70 p-2.5">
                          <p className="text-xs font-bold text-amber-900 mb-1">
                            {grupo.puntajeTotal} pts. · {grupo.cantidad} postulantes con la misma huella de criterios
                            (indistinguibles con el filtro actual)
                          </p>
                          <ul className="list-disc list-inside text-[11px] text-amber-900/90 space-y-0.5">
                            {grupo.postulantes.map((p) => (
                              <li key={p.id}>
                                <span className="font-semibold">
                                  {p.nombres} {p.apellidoPaterno}
                                </span>{' '}
                                <span className="opacity-80">({p.rut})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Criterios aplicados en backend */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[320px] flex-1">
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Filtro de desempate acumulado hasta
                </label>
                <select
                  value={normalizarCriterioUI(criterioSeleccionado)}
                  onChange={(e) => setCriterioSeleccionado(e.target.value as CriterioDesempate | 'none')}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {CRITERIOS_ACUMULABLES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => { void handleAplicarCriterio() }}
                disabled={guardandoCriterio || loading}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {guardandoCriterio ? 'Aplicando...' : 'Aplicar filtro'}
              </button>
              <button
                onClick={() => { void handleResetFiltros() }}
                disabled={guardandoCriterio || loading}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Resetear filtros
              </button>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-xs text-emerald-800">
                <span className="font-bold">Regla:</span> siempre se ordena por puntaje total (desc). Luego se acumulan
                criterios hasta el nivel seleccionado del menú.
              </p>
            </div>
          </div>

          {/* Acciones y conteo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {listaOrdenada.length} postulante{listaOrdenada.length !== 1 ? 's' : ''} en la lista de desempate
              </span>
              {tablaExcelDesempate && tablaExcelDesempate.rows.length > 0 && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                  Excel: tabla en pantalla (orden de ranking actual)
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { void cargarRanking(criterioSeleccionado === 'none' ? null : criterioSeleccionado) }}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar
              </button>
              <button
                onClick={() => { void handleExportExcel() }}
                disabled={
                  exportando === 'excel' || !tablaExcelDesempate || tablaExcelDesempate.rows.length === 0
                }
                className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:opacity-50"
              >
                {exportando === 'excel' ? 'Exportando...' : 'Exportar Excel'}
              </button>
              <button
                onClick={handleDescargarDocs}
                disabled={exportando === 'zip' || listaOrdenada.length === 0}
                className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
              >
                {exportando === 'zip' ? 'Preparando ZIP…' : 'Descargar Documentación Completa'}
              </button>
            </div>
          </div>

          {/* Tabla */}
          <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            {errorPostulantes ? (
              <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-5 flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">Error al cargar los datos</p>
                  <p className="mt-0.5 text-sm text-red-700">{errorPostulantes}</p>
                </div>
                <button onClick={() => { void cargarRanking(criterioSeleccionado === 'none' ? null : criterioSeleccionado) }} className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                  Reintentar
                </button>
              </div>
            ) : loading ? (
              <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
              </div>
            ) : listaOrdenada.length === 0 || !tablaExcelDesempate || tablaExcelDesempate.rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M12 12h.01M15 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-slate-600 font-medium">No hay filas para rankear en esta etapa.</p>
                <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                  {fuenteVistaPuntaje?.mensaje ??
                    'Cargue el Excel en Revisión de documentos, verifique Filtrado por puntaje total y vuelva a actualizar esta pestaña.'}
                </p>
                {fuenteVistaPuntaje?.sinDatos && (
                  <p className="mt-2 text-xs text-slate-400">
                    La lista proviene solo de su vista guardada (misma cuenta que en revisión de documentos).
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <ExcelRevisionUploadedTable
                  data={tablaExcelDesempate}
                  onClear={() => {}}
                  hideQuitarArchivo
                  hidePersistenciaBanner
                  marcarVerdeRankingHasta={TOP_RANK_VERDE}
                  subtituloFiltro={
                    <p>
                      Misma vista que en <strong>Filtrado por puntaje total</strong> (columnas y valores del Excel
                      guardado). El orden de las filas es el <strong>ranking de desempate</strong> del servidor. La
                      columna <strong>#</strong> usa fondo verde suave en las primeras {TOP_RANK_VERDE} posiciones del
                      ranking. La búsqueda y la paginación (10 filas por página) son solo en el navegador.
                    </p>
                  }
                />
                <p className="text-[10px] text-slate-500 px-1 leading-relaxed">
                  <strong>Exportar Excel</strong> descarga exactamente esta tabla (mismas columnas y orden actual). El{' '}
                  <strong>ZIP</strong> de documentación sigue usando los postulantes en Firestore según la lista
                  cargada.
                </p>
              </div>
            )}
          </div>
        </div>

      <ZipDownloadBriefNotice tick={avisoZipTick} />
    </AdminLayout>
  )
}
