import { functions } from '../firebase/config'
import { httpsCallable } from 'firebase/functions'
import type { PostulanteFirestore, EstadoPostulacion } from '../types/postulante'
import { calcularPuntajeTotal } from './scoring'

/**
 * Lista de postulantes: solo vía Cloud Function (Admin SDK).
 * Firestore no permite `list` en la colección desde el cliente (reglas).
 */
export async function obtenerPostulantes(): Promise<PostulanteFirestore[]> {
  const fn = httpsCallable<void, { postulantes: PostulanteFirestore[] }>(
    functions,
    'obtenerPostulantesRevisor',
  )
  const { data } = await fn()
  return data.postulantes.map((p) => ({
    ...p,
    puntaje: calcularPuntajeTotal(p),
  }))
}

export async function obtenerPostulante(id: string): Promise<PostulanteFirestore | null> {
  const fn = httpsCallable<{ postId: string }, { postulante: PostulanteFirestore | null }>(
    functions,
    'obtenerPostulanteRevisor',
  )
  const { data } = await fn({ postId: id })
  if (!data.postulante) return null
  const p = data.postulante
  return {
    ...p,
    puntaje: calcularPuntajeTotal(p),
  }
}

export async function actualizarPostulante(
  id: string,
  fields: Partial<PostulanteFirestore>,
): Promise<void> {
  const { puntaje: _p, id: _i, ...rest } = fields
  const fn = httpsCallable<{ postId: string; fields: Record<string, unknown> }, { ok: boolean }>(
    functions,
    'actualizarPostulanteRevisor',
  )
  await fn({ postId: id, fields: rest as Record<string, unknown> })
}

export async function cambiarEstado(
  id: string,
  estado: EstadoPostulacion,
  motivoRechazo: string | null = null,
): Promise<void> {
  await actualizarPostulante(id, { estado, motivoRechazo })
}

export async function actualizarDocumentosValidados(
  id: string,
  documentosValidados: Record<string, boolean>,
  documentUrls: Record<string, string>,
): Promise<void> {
  const requiredKeys = Object.keys(documentUrls)
  const allValidated =
    requiredKeys.length > 0 &&
    requiredKeys.every((k) => documentosValidados[k] === true)
  const anyReviewed =
    requiredKeys.some((k) => documentosValidados[k] === true)
  const nuevoEstado = allValidated
    ? 'documentacion_validada'
    : anyReviewed
      ? 'en_revision'
      : 'pendiente'
  await actualizarPostulante(id, {
    documentosValidados,
    estado: nuevoEstado,
  })
}

export async function eliminarPostulante(id: string): Promise<void> {
  const fn = httpsCallable<{ postId: string }, { ok: boolean }>(functions, 'eliminarPostulanteRevisor')
  await fn({ postId: id })
}
