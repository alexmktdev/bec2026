import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import type { PostulanteFirestore } from '../types/postulante'
import { calcularPuntajeTotal } from './scoring'
import type { CriterioDesempate } from './filtroConfigService'

type RankingDesempateResponse = {
  postulantes: PostulanteFirestore[]
  puntajeAplicado: number | null
  criterioHasta: CriterioDesempate | null
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
  return {
    puntajeAplicado: data.puntajeAplicado ?? null,
    criterioHasta: data.criterioHasta,
    postulantes: (data.postulantes || []).map((p) => ({
      ...p,
      puntaje: calcularPuntajeTotal(p),
    })),
  }
}

