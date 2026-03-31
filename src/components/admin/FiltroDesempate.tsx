import { useEffect, useRef, useState, useMemo } from 'react'
import { useAdminFilter } from '../../contexts/AdminFilterContext'
import { AdminLayout } from './AdminLayout'
import { exportarExcel } from '../../services/excelExport'
import { descargarTodosDocumentos } from '../../services/zipDownload'
import {
  getCriterioDesempateConfig,
  setCriterioDesempateConfig,
  clearCriterioDesempateConfig,
  type CriterioDesempate,
} from '../../services/filtroConfigService'
import type { PostulanteFirestore } from '../../types/postulante'
import { formatDate } from '../../utils/inputFormatters'
import { resumenCuentaBancariaListado } from '../../utils/cuentaBancariaDisplay'
import { ZipDownloadBriefNotice } from './ZipDownloadBriefNotice'

// ── Lógica de ordenamiento por desempate ─────────────────────────────────────

const ORDEN_ESTANDAR: CriterioDesempate[] = ['nem', 'rsh', 'enfermedad', 'hermanos', 'fecha']

function compararCriterio(a: PostulanteFirestore, b: PostulanteFirestore, c: CriterioDesempate): number {
  if (c === 'fecha') {
    // Postulación más antigua primero (menor createdAt gana)
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  }

  const puntosA = a.puntaje?.[c] || 0
  const puntosB = b.puntaje?.[c] || 0

  if (puntosA !== puntosB) {
    // A mayor puntaje en la categoría, mejor ranking
    return puntosB - puntosA
  }

  // SI LOS PUNTOS SON IGUALES, DESEMPATAMOS POR VALOR REAL (si aplica)
  if (c === 'nem') {
    // NEM real (6.8 vs 6.6)
    return (parseFloat(b.nem) || 0) - (parseFloat(a.nem) || 0)
  }

  if (c === 'rsh') {
    // RSH real (40% vs 50%). El % menor es más vulnerable, por ende mejor ranking.
    const valA = parseInt(a.tramoRegistroSocial) || 100
    const valB = parseInt(b.tramoRegistroSocial) || 100
    return valA - valB
  }

  return 0
}

function sortByDesempate(
  list: PostulanteFirestore[],
  criterio: CriterioDesempate | null,
): PostulanteFirestore[] {
  const orden = criterio ? [criterio, ...ORDEN_ESTANDAR.filter((c) => c !== criterio)] : ORDEN_ESTANDAR
  return [...list].sort((a, b) => {
    // 1. Siempre manda el Puntaje Total
    const diffTotal = (b.puntaje?.total || 0) - (a.puntaje?.total || 0)
    if (diffTotal !== 0) return diffTotal

    // 2. Si empatan en Puntaje Total, aplicamos el orden de desempate
    for (const c of orden) {
      const diff = compararCriterio(a, b, c)
      if (diff !== 0) return diff
    }
    return 0
  })
}

// ── Helpers de UI ─────────────────────────────────────────────────────────────

const CRITERIOS: { value: CriterioDesempate; label: string }[] = [
  { value: 'nem', label: '1. Rendimiento escolar (NEM)' },
  { value: 'rsh', label: '2. Tramo Registro Social de Hogares' },
  { value: 'enfermedad', label: '3. Enfermedad catastrófica y/o crónica' },
  { value: 'hermanos', label: '4. Hermanos y/o hijos estudiando' },
  { value: 'fecha', label: '5. Fecha y hora de postulación (más antigua primero)' },
]

function criterioLabel(c: CriterioDesempate): string {
  return CRITERIOS.find((x) => x.value === c)?.label ?? c
}

const TD = 'px-3 py-2 text-xs text-slate-700 whitespace-nowrap border-b border-slate-100'
const TH = 'px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-slate-500 whitespace-nowrap bg-slate-50 border-b border-slate-200'

// ── Componente principal ──────────────────────────────────────────────────────

export function FiltroDesempate() {
  const { postulantesFiltrados, puntajeAplicado, loading, errorPostulantes, refrescarPostulantes } =
    useAdminFilter()

  const [criterioSeleccionado, setCriterioSeleccionado] = useState<CriterioDesempate>('nem')
  const [criterioActivo, setCriterioActivo] = useState<CriterioDesempate | null>(null)
  const [guardandoCriterio, setGuardandoCriterio] = useState(false)
  const [quitandoCriterio, setQuitandoCriterio] = useState(false)
  const [avisoZipTick, setAvisoZipTick] = useState(0)
  const [exportando, setExportando] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Cargar criterio persistido al montar
  useEffect(() => {
    getCriterioDesempateConfig().then((criterio) => {
      if (criterio) {
        setCriterioActivo(criterio)
        setCriterioSeleccionado(criterio)
      }
    }).catch(console.error)
  }, [])

  // Entrada: salida del filtro por puntaje (solo tras aplicar umbral en servidor sobre documentación validada)
  const validados = useMemo(() => {
    if (puntajeAplicado == null) return []
    return postulantesFiltrados.filter(
      (p) => p.estado === 'documentacion_validada' || p.estado === 'aprobado',
    )
  }, [postulantesFiltrados, puntajeAplicado])

  // Lista ordenada según criterio activo (siempre se ordena por total de mayor a menor, y usa desempate)
  const listaOrdenada = sortByDesempate(validados, criterioActivo)

  // Detectar y agrupar empates
  const empatesDetectados = useMemo(() => {
    const grupos = new Map<number, PostulanteFirestore[]>()
    
    listaOrdenada.forEach((p) => {
      const total = p.puntaje?.total || 0
      if (!grupos.has(total)) grupos.set(total, [])
      grupos.get(total)!.push(p)
    })

    const result: { puntaje: number; postulantes: PostulanteFirestore[] }[] = []
    grupos.forEach((postulantes, puntaje) => {
      // Consideramos "empate" si hay más de 1 persona con el MISMO puntaje total
      if (postulantes.length > 1) {
        result.push({ puntaje, postulantes })
      }
    })

    // Ordenar de mayor a menor puntaje para mostrarlos de forma más lógica
    return result.sort((a, b) => b.puntaje - a.puntaje)
  }, [listaOrdenada])

  async function handleEstablecerCriterio() {
    setGuardandoCriterio(true)
    try {
      await setCriterioDesempateConfig(criterioSeleccionado)
      setCriterioActivo(criterioSeleccionado)
    } catch (err) {
      console.error('Error guardando criterio:', err)
      alert('Error al guardar el criterio. Intente nuevamente.')
    } finally {
      setGuardandoCriterio(false)
    }
  }

  async function handleQuitarCriterio() {
    setQuitandoCriterio(true)
    try {
      await clearCriterioDesempateConfig()
      setCriterioActivo(null)
      setCriterioSeleccionado('nem')
    } catch (err) {
      console.error('Error quitando criterio:', err)
      alert('Error al quitar el criterio. Intente nuevamente.')
    } finally {
      setQuitandoCriterio(false)
    }
  }

  async function handleExportExcel() {
    setExportando('excel')
    try {
      await exportarExcel(listaOrdenada)
    } catch (err) {
      console.error('Error exportando Excel:', err)
      alert('Error al exportar Excel.')
    } finally {
      setExportando(null)
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
                Entran aquí <strong>todos</strong> los postulantes que cumplieron <strong>documentación validada</strong> y el{' '}
                <strong>filtro por puntaje total</strong> vigente en el servidor — <strong>sin tope de cantidad</strong>{' '}
                (pueden ser 200, 300, 400 o los que correspondan). La tabla muestra el <strong>ranking</strong>: primero por{' '}
                <strong>puntaje total de mayor a menor</strong>; si hay empate en el total, se aplica la cadena de desempate
                (por defecto <strong>NEM → RSH → Condición médica → Hermanos/hijos → Fecha de postulación</strong>). Al pulsar{' '}
                <strong>Establecer criterio</strong>, el criterio elegido pasa a ser el primero en esa cadena y el orden se{' '}
                <strong>vuelve a calcular</strong> sobre toda la nómina de esta etapa.
              </p>
            </div>
          </div>

          {puntajeAplicado == null && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Sin filtro de puntaje aplicado.</strong> Primero debe completarse la revisión de documentos y luego
              aplicar el umbral en <strong>Filtrar por puntaje total</strong>. Hasta entonces esta vista no muestra candidatos
              para desempate.
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
                  postulantes (tras revisión doc. y puntaje)
                </span>
              </p>
            </div>
          </div>

          {/* Alerta de Empates */}
          {empatesDetectados.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-amber-900 uppercase tracking-tight">
                    ATENCIÓN: {empatesDetectados.length} grupo(s) de puntajes con postulantes empatados
                  </h3>
                  <p className="mt-1 text-xs text-amber-800 leading-relaxed mb-3">
                    El sistema ha ordenado automáticamente la tabla final evaluando los criterios de desempate en cascada para evitar duplicidades en el ranking.
                  </p>
                  
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2">
                    {empatesDetectados.map((grupo) => (
                      <div key={grupo.puntaje} className="rounded-lg border border-amber-200 bg-white/60 p-2.5">
                        <p className="text-xs font-bold text-amber-900 mb-1">
                          Empate en {grupo.puntaje} puntos ({grupo.postulantes.length} postulantes)
                        </p>
                        <ul className="list-disc list-inside text-[11px] text-amber-800 space-y-0.5">
                          {grupo.postulantes.map(p => (
                            <li key={p.id}>
                              <span className="font-semibold">{p.nombres} {p.apellidoPaterno}</span> <span className="opacity-80">({p.rut})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panel de criterio de desempate */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1 min-w-[280px]">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Criterio principal de desempate
                </label>
                <select
                  value={criterioSeleccionado}
                  onChange={(e) => setCriterioSeleccionado(e.target.value as CriterioDesempate)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {CRITERIOS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleEstablecerCriterio}
                disabled={guardandoCriterio || criterioActivo === criterioSeleccionado}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {guardandoCriterio ? 'Guardando...' : 'Establecer criterio'}
              </button>

              {criterioActivo && (
                <button
                  onClick={handleQuitarCriterio}
                  disabled={quitandoCriterio}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {quitandoCriterio ? 'Quitando...' : 'Quitar criterio'}
                </button>
              )}
            </div>

            {criterioActivo ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xs text-emerald-800">
                  <span className="font-bold">Criterio activo:</span> {criterioLabel(criterioActivo)} — orden completo: {[criterioActivo, ...ORDEN_ESTANDAR.filter(c => c !== criterioActivo)].map(c => criterioLabel(c).split('. ')[1]).join(' → ')}{' → Fecha de postulación'}
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-amber-800">Sin criterio establecido. Seleccione un criterio y presione <strong>"Establecer criterio"</strong> para fijar el orden de desempate.</p>
              </div>
            )}
          </div>

          {/* Acciones y conteo */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                {listaOrdenada.length} postulante{listaOrdenada.length !== 1 ? 's' : ''} en la lista de desempate
              </span>
              {listaOrdenada.length > 0 && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Orden: puntaje total ↓, luego desempate
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={refrescarPostulantes}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar
              </button>
              <button
                onClick={handleExportExcel}
                disabled={exportando === 'excel' || listaOrdenada.length === 0}
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
                <button onClick={refrescarPostulantes} className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50">
                  Reintentar
                </button>
              </div>
            ) : loading ? (
              <div className="flex justify-center py-20">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
              </div>
            ) : listaOrdenada.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h.01M12 12h.01M15 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="text-slate-600 font-medium">No hay postulantes en esta etapa.</p>
                <p className="mt-1 text-sm text-slate-400">
                  Debe existir filtro de puntaje aplicado y postulantes con documentación validada que superen ese umbral.
                </p>
              </div>
            ) : (
              <>
                {/* Flechas de desplazamiento */}
                <div className="flex items-center justify-end gap-2 border-b border-slate-200 px-3 py-2">
                  <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: -700, behavior: 'smooth' })} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button type="button" onClick={() => scrollRef.current?.scrollBy({ left: 700, behavior: 'smooth' })} className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                <div ref={scrollRef} className="overflow-x-auto no-scrollbar">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr>
                        {/* Columna # sticky izquierda */}
                        <th className={`${TH} sticky left-0 z-10 bg-slate-50 border-r border-slate-200 w-12 text-center`}>#</th>
                        <th className={TH}>Nombres</th>
                        <th className={TH}>Ap. Paterno</th>
                        <th className={TH}>Ap. Materno</th>
                        <th className={TH}>RUT</th>
                        <th className={TH}>F. Nacimiento</th>
                        <th className={TH}>Edad</th>
                        <th className={TH}>Sexo</th>
                        <th className={TH}>Est. Civil</th>
                        <th className={TH}>Teléfono</th>
                        <th className={TH}>Email</th>
                        <th className={TH}>Domicilio</th>
                        <th className={`${TH} bg-blue-50/50 text-blue-700`}>F. Postulación</th>
                        <th className={`${TH} bg-blue-50/50 text-blue-700`}>Hora</th>
                        <th className={`${TH} bg-indigo-50 text-indigo-700`}>NEM</th>
                        <th className={TH}>Institución</th>
                        <th className={TH}>Comuna</th>
                        <th className={TH}>Carrera</th>
                        <th className={TH}>Semestres</th>
                        <th className={TH}>Matrícula en curso (año)</th>
                        <th className={TH}>Total Integr.</th>
                        <th className={`${TH} bg-teal-50 text-teal-700`}>Tramo RSH</th>
                        <th className={`${TH} bg-purple-50 text-purple-700`}>Hnos./Hijos Est.</th>
                        <th className={`${TH} bg-purple-50 text-purple-700`}>1 Hno./Hijo</th>
                        <th className={`${TH} bg-purple-50 text-purple-700`}>2+ Hnos./Hijos</th>
                        <th className={`${TH} bg-rose-50 text-rose-700`}>Enf. Catastrófica</th>
                        <th className={`${TH} bg-rose-50 text-rose-700`}>Enf. Crónica</th>
                        <th className={TH}>Cuenta bancaria</th>
                        <th className={TH}>Observaciones</th>
                        <th className={`${TH} text-indigo-700 bg-indigo-50/80`}>Pt. NEM</th>
                        <th className={`${TH} text-teal-700 bg-teal-50/80`}>Pt. RSH</th>
                        <th className={`${TH} text-rose-700 bg-rose-50/80`}>Pt. Enf.</th>
                        <th className={`${TH} text-purple-700 bg-purple-50/80`}>Pt. Hnos.</th>
                        <th className={`${TH} text-blue-900 font-black bg-blue-100`}>Pt. TOTAL</th>
                        <th className={TH}>F. Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listaOrdenada.map((p, idx) => {
                        const pos = idx + 1
                        return (
                          <tr key={p.id} className="group transition-colors hover:bg-slate-50">
                            <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-2 text-center text-sm font-bold text-slate-700 border-b border-slate-100 group-hover:bg-slate-50">
                              {pos}
                            </td>
                            <td className={TD}>{p.nombres}</td>
                            <td className={TD}>{p.apellidoPaterno}</td>
                            <td className={TD}>{p.apellidoMaterno}</td>
                            <td className={TD}>{p.rut}</td>
                            <td className={TD}>{formatDate(p.fechaNacimiento)}</td>
                            <td className={TD}>{p.edad}</td>
                            <td className={TD}>{p.sexo}</td>
                            <td className={TD}>{p.estadoCivil}</td>
                            <td className={TD}>{p.telefono}</td>
                            <td className={TD}>{p.email}</td>
                            <td className={TD}>{p.domicilioFamiliar}</td>
                            <td className={`${TD} bg-blue-50/20 font-medium italic`}>{formatDate(p.fechaPostulacion)}</td>
                            <td className={`${TD} bg-blue-50/20 font-medium italic`}>{p.horaPostulacion || '—'}</td>
                            <td className={`${TD} bg-indigo-50/30 text-indigo-700 font-bold`}>{p.nem}</td>
                            <td className={TD}>{p.nombreInstitucion}</td>
                            <td className={TD}>{p.comuna}</td>
                            <td className={TD}>{p.carrera}</td>
                            <td className={TD}>{p.duracionSemestres}</td>
                            <td className={TD}>{p.anoIngreso}</td>
                            <td className={TD}>{p.totalIntegrantes}</td>
                            <td className={`${TD} bg-teal-50/30 text-teal-700 font-bold`}>{p.tramoRegistroSocial}</td>
                            <td className={`${TD} bg-purple-50/20 text-purple-700 font-medium text-center`}>{p.tieneHermanosOHijosEstudiando}</td>
                            <td className={`${TD} bg-purple-50/20 text-purple-700 font-medium text-center`}>{p.tieneUnHermanOHijoEstudiando}</td>
                            <td className={`${TD} bg-purple-50/20 text-purple-700 font-medium text-center`}>{p.tieneDosOMasHermanosOHijosEstudiando}</td>
                            <td className={`${TD} bg-rose-50/20 text-rose-700 font-medium text-center`}>{p.enfermedadCatastrofica}</td>
                            <td className={`${TD} bg-rose-50/20 text-rose-700 font-medium text-center`}>{p.enfermedadCronica}</td>
                            <td className={`${TD} max-w-[220px] text-[10px] leading-tight`} title={resumenCuentaBancariaListado(p)}>
                              {resumenCuentaBancariaListado(p)}
                            </td>
                            <td className={`${TD} max-w-[200px] truncate`}>{p.observacion}</td>
                            <td className={`${TD} text-indigo-800 bg-indigo-50/40 font-bold`}>{p.puntaje.nem}</td>
                            <td className={`${TD} text-teal-800 bg-teal-50/40 font-bold`}>{p.puntaje.rsh}</td>
                            <td className={`${TD} text-rose-800 bg-rose-50/40 font-bold`}>{p.puntaje.enfermedad}</td>
                            <td className={`${TD} text-purple-800 bg-purple-50/40 font-bold`}>{p.puntaje.hermanos}</td>
                            <td className={`${TD} text-blue-900 font-black bg-blue-100 shadow-[inset_0_0_0_1px_rgba(30,64,175,0.1)]`}>{p.puntaje.total}</td>
                            <td className={TD}>{p.createdAt ? new Date(p.createdAt).toLocaleString('es-CL') : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-200 px-4 py-3 text-[10px] text-slate-500">
                  La columna # es el ranking definitivo de esta etapa: orden decreciente por puntaje total; empates resueltos
                  con los criterios de desempate (pulse <strong className="text-slate-600">Establecer criterio</strong> para
                  fijar cuál se evalúa primero entre quienes empatan en puntaje total).
                </div>
              </>
            )}
          </div>
        </div>

      <ZipDownloadBriefNotice tick={avisoZipTick} />
    </AdminLayout>
  )
}
