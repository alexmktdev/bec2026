import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import type { ExcelRevisionRow } from './excelRevisionImport'

export type VistaFiltroPuntajeTotal = {
  sinExcel: boolean
  sinColumnaEstado: boolean
  sinColumnaPuntajeTotal: boolean
  headers: string[]
  sheetName: string
  coincideConPlantillaExport: boolean
  persistedAt: string | null
  filasBaseValidado: ExcelRevisionRow[]
  filasVista: ExcelRevisionRow[]
  totalValidado: number
  totalVista: number
  umbralActivo: number | null
}

function asVista(raw: Record<string, unknown>): VistaFiltroPuntajeTotal {
  return {
    sinExcel: raw.sinExcel === true,
    sinColumnaEstado: raw.sinColumnaEstado === true,
    sinColumnaPuntajeTotal: raw.sinColumnaPuntajeTotal === true,
    headers: Array.isArray(raw.headers) ? raw.headers.map((x) => String(x ?? '')) : [],
    sheetName: typeof raw.sheetName === 'string' ? raw.sheetName : '',
    coincideConPlantillaExport: raw.coincideConPlantillaExport === true,
    persistedAt: typeof raw.persistedAt === 'string' ? raw.persistedAt : null,
    filasBaseValidado: Array.isArray(raw.filasBaseValidado)
      ? (raw.filasBaseValidado as ExcelRevisionRow[])
      : [],
    filasVista: Array.isArray(raw.filasVista) ? (raw.filasVista as ExcelRevisionRow[]) : [],
    totalValidado: typeof raw.totalValidado === 'number' ? raw.totalValidado : 0,
    totalVista: typeof raw.totalVista === 'number' ? raw.totalVista : 0,
    umbralActivo:
      typeof raw.umbralActivo === 'number' && Number.isFinite(raw.umbralActivo) ? raw.umbralActivo : null,
  }
}

/** Datos de la tabla y conteos calculados en el servidor (sin filtrar en el cliente). */
export async function obtenerVistaFiltroPuntajeTotal(): Promise<VistaFiltroPuntajeTotal> {
  const fn = httpsCallable<void, Record<string, unknown>>(functions, 'obtenerVistaFiltroPuntajeTotalAdmin')
  const { data } = await fn()
  return asVista(data ?? {})
}

export async function aplicarUmbralFiltroPuntajeTotal(puntajeMinimo: number): Promise<VistaFiltroPuntajeTotal> {
  const fn = httpsCallable<
    { puntajeMinimo: number },
    { ok: boolean; puntajeMinimo?: number; vista?: Record<string, unknown> }
  >(functions, 'aplicarUmbralFiltroPuntajeTotalAdmin')
  const { data } = await fn({ puntajeMinimo })
  if (!data?.ok || !data.vista) throw new Error('No se pudo aplicar el umbral.')
  return asVista(data.vista as Record<string, unknown>)
}

export async function limpiarUmbralFiltroPuntajeTotal(): Promise<VistaFiltroPuntajeTotal> {
  const fn = httpsCallable<void, { ok: boolean; vista?: Record<string, unknown> }>(
    functions,
    'limpiarUmbralFiltroPuntajeTotalAdmin',
  )
  const { data } = await fn()
  if (!data?.ok || !data.vista) throw new Error('No se pudo quitar el umbral.')
  return asVista(data.vista as Record<string, unknown>)
}

export async function exportarExcelFiltroPuntajeTotalDesdeServidor(): Promise<{ blob: Blob; filename: string }> {
  const fn = httpsCallable<
    void,
    { ok: boolean; base64?: string; filename?: string }
  >(functions, 'exportarExcelFiltroPuntajeTotalAdmin')
  const { data } = await fn()
  if (!data?.ok || typeof data.base64 !== 'string' || typeof data.filename !== 'string') {
    throw new Error('No se pudo generar el archivo.')
  }
  const binary = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0))
  return { blob: new Blob([binary], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename: data.filename }
}
