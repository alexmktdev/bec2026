import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminLayout } from './AdminLayout'
import {
  importarExcelRevisionDesdeArchivo,
  type ExcelRevisionParseResult,
} from '../../services/excelRevisionImport'
import {
  clearExcelRevisionImportFirestore,
  loadExcelRevisionImportFirestore,
  saveExcelRevisionImportFirestore,
} from '../../services/excelRevisionFirestoreService'
import { ExcelRevisionUploadedTable } from './FiltroRevisionDoc/ExcelRevisionUploadedTable'

export function FiltroRevisionDoc() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [parsed, setParsed] = useState<ExcelRevisionParseResult | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [restaurando, setRestaurando] = useState(true)
  const [advertenciaPersistencia, setAdvertenciaPersistencia] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const snap = await loadExcelRevisionImportFirestore()
        if (!cancel && snap) setParsed(snap)
      } catch (e) {
        if (!cancel) {
          setParseError(
            e instanceof Error ? e.message : 'No se pudo cargar la tabla guardada en Firestore.',
          )
        }
      } finally {
        if (!cancel) setRestaurando(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const abrirSelector = useCallback(() => {
    setParseError(null)
    inputRef.current?.click()
  }, [])

  const onArchivo = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setLeyendo(true)
    setParseError(null)
    setAdvertenciaPersistencia(null)
    try {
      const result = await importarExcelRevisionDesdeArchivo(file)
      try {
        const savedAt = await saveExcelRevisionImportFirestore(result)
        setParsed({ ...result, persistedAt: savedAt })
      } catch (persistErr) {
        setParsed({ ...result })
        setAdvertenciaPersistencia(
          persistErr instanceof Error
            ? persistErr.message
            : 'No se pudo guardar la tabla en Firestore. Compruebe conexión, permisos y reglas de seguridad.',
        )
      }
    } catch (err) {
      setParsed(null)
      setParseError(err instanceof Error ? err.message : 'No se pudo leer el archivo.')
    } finally {
      setLeyendo(false)
    }
  }, [])

  const quitarVista = useCallback(async () => {
    try {
      await clearExcelRevisionImportFirestore()
    } catch {
      // aun así limpiamos la vista local
    }
    setParsed(null)
    setAdvertenciaPersistencia(null)
  }, [])

  return (
    <AdminLayout>
      <header className="bg-white border-b border-slate-200 px-6 py-6 text-center">
        <h1 className="text-2xl font-bold text-blue-800 uppercase tracking-tight">Revisión de documentación</h1>
      </header>

      <div className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8 space-y-8 max-w-[1600px] mx-auto">
        <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-black uppercase tracking-wide text-blue-900">Flujo de trabajo</h2>
          <p className="text-sm text-blue-950 leading-relaxed">
            En esta pestaña el usuario debe <strong>descargar toda la información en formato Excel</strong> para realizar,
            fuera del sistema, una <strong>revisión y validación manual de la documentación</strong> de todos los
            postulantes. Utilice el mismo listado completo que genera el panel de control.
          </p>
          <p className="text-sm text-blue-950 leading-relaxed">
            Para descargar la planilla, vaya al <strong>Panel de control</strong> y pulse{' '}
            <strong>«Exportar Excel completo»</strong>. Trabaje el archivo en Excel (columnas adicionales, notas,
            estados manuales, etc.) y luego súbalo aquí. La tabla se <strong>guarda en Firestore</strong> (como el resto
            del sistema): podrá recuperarla al recargar la página o desde otro equipo con la misma cuenta.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Ir al Panel de control — Exportar Excel completo
            </Link>
            <button
              type="button"
              onClick={abrirSelector}
              disabled={leyendo}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-900 transition-colors disabled:opacity-60"
            >
              {leyendo ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Leyendo…
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-8-9l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                  Subir Excel revisado (.xlsx)
                </>
              )}
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            aria-hidden
            onChange={onArchivo}
          />
          <p className="text-xs text-blue-900/80 leading-relaxed border-t border-blue-200/80 pt-4">
            El archivo se procesa en el navegador y luego los datos se guardan en <strong>Firestore</strong> bajo su
            usuario (revisor/admin/superadmin). Cada cuenta tiene su propia copia; no sustituye los postulantes del
            panel. Límite de guardado: 5&nbsp;000 filas; el .xlsx puede pesar hasta 32&nbsp;MB al subirlo.
          </p>
        </section>

        {parseError && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {parseError}
          </div>
        )}

        {advertenciaPersistencia && (
          <div
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            {advertenciaPersistencia}
          </div>
        )}

        {restaurando && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
            Cargando tabla guardada en Firestore…
          </div>
        )}

        {!restaurando && parsed && <ExcelRevisionUploadedTable data={parsed} onClear={quitarVista} />}
      </div>
    </AdminLayout>
  )
}
