import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import type { PostulanteFirestore } from '../types/postulante'
import { calcularPuntajeTotal } from './scoring'
import type { CriterioDesempate } from './filtroConfigService'

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

type RankingDesempateResponse = {
  postulantes: PostulanteFirestore[]
  criterioHasta: CriterioDesempate | null
  empatesResumen: EmpatesResumenDesempate
}

/** Fuente única de ranking de desempate: backend. */
export async function obtenerRankingDesempate(
  criterioHasta: CriterioDesempate | null,
): Promise<RankingDesempateResponse> {
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
    postulantes: (data.postulantes || []).map((p) => ({
      ...p,
      puntaje: calcularPuntajeTotal(p),
    })),
  }
}

