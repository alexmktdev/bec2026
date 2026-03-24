import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import type { PostulanteRechazadoEntrada } from '../types/postulante'

export async function obtenerPostulantesRechazadosEntrada(): Promise<PostulanteRechazadoEntrada[]> {
  const fn = httpsCallable<void, { postulantes: PostulanteRechazadoEntrada[] }>(
    functions,
    'obtenerPostulantesRechazadosEntrada',
  )
  const { data } = await fn()
  return data.postulantes || []
}
