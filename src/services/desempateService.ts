import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import type { PostulanteFirestore } from '../types/postulante'
import { calcularPuntajeTotal } from './scoring'

type RankingDesempateResponse = {
  postulantes: PostulanteFirestore[]
  puntajeAplicado: number | null
}

/** Fuente única de ranking de desempate: backend. */
export async function obtenerRankingDesempate(): Promise<RankingDesempateResponse> {
  const fn = httpsCallable<void, RankingDesempateResponse>(functions, 'obtenerRankingDesempateAdmin')
  const { data } = await fn()
  return {
    puntajeAplicado: data.puntajeAplicado ?? null,
    postulantes: (data.postulantes || []).map((p) => ({
      ...p,
      puntaje: calcularPuntajeTotal(p),
    })),
  }
}

