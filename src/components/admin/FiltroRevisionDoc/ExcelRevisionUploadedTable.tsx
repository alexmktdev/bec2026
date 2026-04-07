import { useMemo, useRef, useState, type ReactNode } from 'react'
import type { ExcelRevisionParseResult, ExcelRevisionRow } from '../../../services/excelRevisionImport'
import { formatFechaRegistro24h, intentarFormatearFechaRegistroDesdeTexto } from '../../../utils/inputFormatters'
import { TablePagination } from '../TablePagination'
import { TableScrollSlider } from '../TableScrollSlider'
import { tdClassExcelRevisionColumn, thClassExcelRevisionColumn } from './excelRevisionTableStyles'

const ITEMS_PER_PAGE = 10

function filaCoincideBusqueda(row: ExcelRevisionRow, headers: string[], q: string): boolean {
  if (!q.trim()) return true
  const n = q.trim().toLowerCase()
  for (const h of headers) {
    if ((row[h] ?? '').toLowerCase().includes(n)) return true
  }
  return false
}

interface Props {
  data: ExcelRevisionParseResult
  onClear: () => void
  /** Si se indica, la tabla parte de este subconjunto (mismos encabezados que el archivo). */
  rowsSubset?: ExcelRevisionRow[]
  /** Texto o bloque bajo el título de la vista previa (p. ej. contexto del filtro por puntaje). */
  subtituloFiltro?: ReactNode
  /** Oculta el botón que borra el archivo en Firestore (vista de solo lectura desde otra pestaña). */
  hideQuitarArchivo?: boolean
  /** No muestra el aviso verde de última persistencia en Firestore. */
  hidePersistenciaBanner?: boolean
  /** Clic en una fila de datos (p. ej. abrir ficha del postulante en otra pantalla). */
  onRowActivate?: (row: ExcelRevisionRow) => void
  /** Mensaje cuando no hay filas base y la búsqueda está vacía (p. ej. subconjunto filtrado vacío). */
  mensajeVacioSinBusqueda?: string
  /**
   * Si se indica (p. ej. 150), la celda # usa tono verde suave cuando la fila está entre las primeras `hasta`
   * posiciones del orden en `sourceRows` (ranking global, no solo la página o el filtro de búsqueda).
   */
  marcarVerdeRankingHasta?: number
}

function valorCeldaMostrar(header: string, raw: string): string {
  const h = header.trim().toLowerCase()
  if (h.includes('fecha registro')) return intentarFormatearFechaRegistroDesdeTexto(raw)
  return raw
}

export function ExcelRevisionUploadedTable({
  data,
  onClear,
  rowsSubset,
  subtituloFiltro,
  hideQuitarArchivo = false,
  hidePersistenciaBanner = false,
  onRowActivate,
  mensajeVacioSinBusqueda,
  marcarVerdeRankingHasta,
}: Props) {
  const { headers, rows, sheetName, coincideConPlantillaExport, persistedAt } = data
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const sourceRows = rowsSubset ?? rows

  const filtrados = useMemo(() => {
    if (!busqueda.trim()) return sourceRows
    return sourceRows.filter((r) => filaCoincideBusqueda(r, headers, busqueda))
  }, [sourceRows, headers, busqueda])

  const paginaItems = useMemo(() => {
    const start = (pagina - 1) * ITEMS_PER_PAGE
    return filtrados.slice(start, start + ITEMS_PER_PAGE)
  }, [filtrados, pagina])

  const startIndex = (pagina - 1) * ITEMS_PER_PAGE

  const totalArchivo = rows.length
  const baseMostradas = sourceRows.length

  return (
    <div className="space-y-4">
      {persistedAt && !hidePersistenciaBanner && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2 text-xs text-emerald-900">
          <strong>Guardado en Firestore</strong> (proyecto Firebase): última actualización{' '}
          <span className="font-mono font-semibold">{formatFechaRegistro24h(persistedAt)}</span>. Visible al iniciar sesión
          con la misma cuenta en cualquier dispositivo; otras cuentas tienen su propia copia.
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">
            Vista previa del archivo{' '}
            <span className="font-mono text-blue-800">({sheetName})</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {rowsSubset != null ? (
              <>
                Mostrando <strong className="text-slate-700">{baseMostradas}</strong> de {totalArchivo} fila
                {totalArchivo !== 1 ? 's' : ''} del archivo (alineadas al filtro de esta pestaña). ·{' '}
              </>
            ) : (
              <>
                {totalArchivo} fila{totalArchivo !== 1 ? 's' : ''} ·{' '}
              </>
            )}
            {headers.length} columna
            {headers.length !== 1 ? 's' : ''}
            {!coincideConPlantillaExport && (
              <span className="text-amber-700 font-semibold">
                {' '}
                · Encabezados distintos al export estándar: se muestran todas las columnas tal cual vienen en el archivo.
              </span>
            )}
          </p>
          {subtituloFiltro ? <div className="mt-2 text-xs text-slate-600 leading-relaxed">{subtituloFiltro}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="search"
            name="excel_revision_busqueda"
            autoComplete="off"
            placeholder="Buscar en todas las columnas…"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(1)
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm min-w-[200px] focus:ring-1 focus:ring-blue-500"
          />
          {!hideQuitarArchivo && (
            <button
              type="button"
              onClick={() => {
                onClear()
                setBusqueda('')
                setPagina(1)
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Quitar archivo
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
        <div ref={scrollRef} className="overflow-x-auto no-scrollbar">
          <table className="min-w-max w-full divide-y divide-slate-200 text-[10px]">
            <thead>
              <tr className="divide-x divide-slate-100">
                <th className="sticky left-0 z-20 min-w-[3.5rem] bg-slate-100 px-2 py-2 text-center font-black uppercase text-slate-800 shadow-[1px_0_0_0_rgba(203,213,225,1)] border-b border-slate-200">
                  #
                </th>
                {headers.map((h) => (
                  <th key={h} className={thClassExcelRevisionColumn(h)}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginaItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length + 1}
                    className="py-12 text-center text-slate-400 font-medium text-sm"
                  >
                    {sourceRows.length === 0 && !busqueda.trim()
                      ? (mensajeVacioSinBusqueda ?? 'Ningún dato para mostrar.')
                      : 'Ninguna fila coincide con la búsqueda.'}
                  </td>
                </tr>
              ) : (
                paginaItems.map((row, idx) => {
                  const n = startIndex + idx + 1
                  const posicionRankingGlobal =
                    marcarVerdeRankingHasta != null && marcarVerdeRankingHasta > 0
                      ? sourceRows.indexOf(row) + 1
                      : 0
                  const resaltarNumeroVerde =
                    marcarVerdeRankingHasta != null &&
                    marcarVerdeRankingHasta > 0 &&
                    posicionRankingGlobal >= 1 &&
                    posicionRankingGlobal <= marcarVerdeRankingHasta
                  const numeroMostrar =
                    marcarVerdeRankingHasta != null && marcarVerdeRankingHasta > 0 && posicionRankingGlobal > 0
                      ? posicionRankingGlobal
                      : n
                  return (
                    <tr
                      key={`excel-revision-row-${startIndex}-${idx}`}
                      className={`divide-x divide-slate-50 hover:bg-slate-50/90 transition-colors ${onRowActivate ? 'cursor-pointer' : ''}`}
                      onClick={onRowActivate ? () => onRowActivate(row) : undefined}
                    >
                      <td
                        className={`sticky left-0 z-10 px-2 py-1.5 text-center text-xs font-bold tabular-nums shadow-[1px_0_0_0_rgba(241,245,249,1)] border-b border-slate-100 ${
                          resaltarNumeroVerde
                            ? 'bg-emerald-100/85 text-emerald-900'
                            : 'bg-slate-50/95 text-slate-600'
                        }`}
                      >
                        {numeroMostrar}
                      </td>
                      {headers.map((h) => {
                        const raw = row[h] ?? ''
                        const mostrar = valorCeldaMostrar(h, raw)
                        return (
                          <td key={h} className={tdClassExcelRevisionColumn(h)} title={raw || undefined}>
                            {mostrar}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TableScrollSlider scrollRef={scrollRef} />
      <TablePagination
        totalItems={filtrados.length}
        itemsPerPage={ITEMS_PER_PAGE}
        currentPage={pagina}
        onPageChange={setPagina}
      />
    </div>
  )
}
