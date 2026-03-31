import { useEffect, useState, useMemo } from 'react'
import { eliminarPostulante } from '../../services/postulacionService'
import type { PostulanteFirestore } from '../../types/postulante'
import { PostulantesTable } from './PostulantesTable'
import { PostulanteDetail } from './PostulanteDetail'
import { AdminLayout } from './AdminLayout'
import { exportarExcel } from '../../services/excelExport'
import { descargarTodosDocumentos } from '../../services/zipDownload'
import { useAdminFilter } from '../../contexts/AdminFilterContext'
import { getCriterioDesempateConfig, type CriterioDesempate } from '../../services/filtroConfigService'
import { sortByDesempate } from '../../utils/sortingUtils'
import { ZipDownloadBriefNotice } from './ZipDownloadBriefNotice'

export function Dashboard() {
  const { postulantes, loading, errorPostulantes, refrescarPostulantes, actualizarPostulanteLocal, eliminarPostulanteLocal } = useAdminFilter()
  const [selected, setSelected] = useState<PostulanteFirestore | null>(null)
  const [exportando, setExportando] = useState<string | null>(null)
  const [avisoZipTick, setAvisoZipTick] = useState(0)
  const [criterioActivo, setCriterioActivo] = useState<CriterioDesempate | null>(null)

  useEffect(() => {
    getCriterioDesempateConfig().then(setCriterioActivo).catch(console.error)
  }, [])

  // 1. Filtrar validados y ordenarlos por desempate para saber exactamente quienes son los top 150
  const validadosOrdenados = useMemo(() => {
    const validados = postulantes.filter(p => p.estado === 'documentacion_validada')
    return sortByDesempate(validados, criterioActivo)
  }, [postulantes, criterioActivo])

  const beneficiarios = validadosOrdenados.slice(0, 150)

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

  async function handleExportExcel() {
    setExportando('excel')
    try {
      await exportarExcel(postulantes)
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
      await descargarTodosDocumentos(postulantes)
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
          <div className="space-y-6">

            {/* ── STATS CARDS ── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              
              {/* Total (Pre-aprobados) */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm border-l-4 border-l-blue-600">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-blue-600">Total (Pre-aprobados)</p>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="mt-3 text-4xl font-black text-slate-800 leading-none">{postulantes.length}</p>
                <p className="mt-2 text-xs text-slate-400">pool inicial de postulantes</p>
              </div>

              {/* Doc. validada */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm border-l-4 border-l-emerald-500">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-500">Documentación Validada</p>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="mt-3 text-4xl font-black text-slate-800 leading-none">{postulantes.filter(p => p.estado === 'documentacion_validada').length}</p>
                <p className="mt-2 text-xs text-slate-400">superaron la revisión técnica</p>
              </div>

              {/* Rechazados */}
              <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm border-l-4 border-l-red-500">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-red-500">Rechazados</p>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <p className="mt-3 text-4xl font-black text-slate-800 leading-none">{postulantes.filter(p => p.estado === 'rechazado').length}</p>
                <p className="mt-2 text-xs text-slate-400">no cumplen con las bases</p>
              </div>

              {/* Total Filtrados Final (Ranking) */}
              <div className="flex flex-col justify-between rounded-xl border-indigo-200 bg-indigo-50/30 px-5 py-4 shadow-sm border-l-4 border-l-indigo-600">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-700">Ranking Final (Beneficiarios)</p>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <p className="mt-3 text-4xl font-black text-indigo-900 leading-none">
                  {beneficiarios.length}
                </p>
                <p className="mt-2 text-xs text-indigo-500">dentro del ranking oficial (Top 150)</p>
              </div>

            </div>

            {/* Definición de Pre-aprobado */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex gap-3">
                <div className="mt-0.5 text-blue-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-blue-900 uppercase tracking-tight">POSTULANTE PRE-APROBADO:</h3>
                  <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                    Son aquellos estudiantes que han superado los filtros automáticos iniciales:
                    tienen entre <strong>17 y 23 años</strong>, <strong>NEM mayor o igual a 5.5</strong> y <strong>no figuran en la base de datos histórica</strong> de beneficiarios.
                    Su información y documentos ya están registrados en el sistema para el siguiente nivel de revisión.
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
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
                disabled={exportando === 'excel'}
                className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-green-800 disabled:opacity-50"
              >
                {exportando === 'excel' ? 'Exportando...' : 'Exportar Excel Completo'}
              </button>
              <button
                onClick={handleDescargarDocs}
                disabled={exportando === 'zip'}
                className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
              >
                {exportando === 'zip' ? 'Preparando ZIP…' : 'Descargar Documentación Completa'}
              </button>
            </div>
          </div>

        {/* Table */}
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
              postulantes={postulantes}
              onSelectPostulante={setSelected}
              onEliminar={handleEliminar}
              onActualizar={(actualizado) =>
                actualizarPostulanteLocal(actualizado)
              }
            />
          )}
        </div>
        </div>

      <ZipDownloadBriefNotice tick={avisoZipTick} />

      {/* Detail modal */}
      {selected && (
        <PostulanteDetail
          postulante={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </AdminLayout>
  )
}
