import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import type { PostulanteFirestore } from '../types/postulante'
import type { ExcelRevisionParseResult } from './excelRevisionImport'
import { calcularPuntajeTotal } from './scoring'
import type { CriterioDesempate } from './filtroConfigService'

function parseTablaVistaDesempate(raw: unknown): ExcelRevisionParseResult | null {
  if (!raw || typeof raw !== 'object') return null
  const t = raw as Record<string, unknown>
  const headers = Array.isArray(t.headers) ? t.headers.map((x) => String(x ?? '')) : []
  if (headers.length === 0) return null
  const rawRows = Array.isArray(t.rows) ? t.rows : []
  const rows: Record<string, string>[] = rawRows.map((row) => {
    const o = row && typeof row === 'object' && !Array.isArray(row) ? (row as Record<string, unknown>) : {}
    const out: Record<string, string> = {}
    for (const h of headers) {
      const v = o[h]
      out[h] = v === null || v === undefined ? '' : String(v)
    }
    return out
  })
  return {
    headers,
    rows,
    sheetName: typeof t.sheetName === 'string' ? t.sheetName : 'Hoja1',
    coincideConPlantillaExport: t.coincideConPlantillaExport === true,
    persistedAt: typeof t.persistedAt === 'string' ? t.persistedAt : undefined,
  }
}

export type EmpateGrupoDetalle = {
  puntajeTotal: number
  cantidad: number
  postulantes: { id: string; nombres: string; apellidoPaterno: string; rut: string }[]
}

export type EmpatesResumenDesempate = {
  gruposConEmpate: number
  postulantesEnEmpate: number
  detalleGrupos: EmpateGrupoDetalle[]
}

export type FuenteVistaPuntajeDesempate = {
  sinDatos: boolean
  totalFilasVista: number
  umbralActivo: number | null
  mensaje?: string
}

type RankingDesempateResponse = {
  postulantes: PostulanteFirestore[]
  criterioHasta: CriterioDesempate | null
  empatesResumen: EmpatesResumenDesempate
  fuenteVistaPuntaje?: FuenteVistaPuntajeDesempate
  /** Objeto con headers, rows, sheetName, etc. (misma forma que vista filtro puntaje). */
  tablaVistaDesempate?: unknown
}

export type RankingDesempateData = {
  postulantes: PostulanteFirestore[]
  criterioHasta: CriterioDesempate | null
  empatesResumen: EmpatesResumenDesempate
  fuenteVistaPuntaje?: FuenteVistaPuntajeDesempate
  /** Misma forma que la tabla de filtrado por puntaje total; filas en orden de ranking. */
  tablaExcelDesempate: ExcelRevisionParseResult | null
}

/** Fuente única de ranking de desempate: backend. */
export async function obtenerRankingDesempate(
  criterioHasta: CriterioDesempate | null,
): Promise<RankingDesempateData> {
  const fn = httpsCallable<{ criterioHasta: CriterioDesempate | null }, RankingDesempateResponse>(
    functions,
    'obtenerRankingDesempateAdmin',
  )
  const { data } = await fn({ criterioHasta })
  const empatesResumen = data.empatesResumen ?? {
    gruposConEmpate: 0,
    postulantesEnEmpate: 0,
    detalleGrupos: [],
  }
  return {
    criterioHasta: data.criterioHasta,
    empatesResumen,
    fuenteVistaPuntaje: data.fuenteVistaPuntaje,
    tablaExcelDesempate: parseTablaVistaDesempate(data.tablaVistaDesempate),
    postulantes: (data.postulantes || []).map((p) => ({
      ...p,
      puntaje: calcularPuntajeTotal(p),
    })),
  }
}

