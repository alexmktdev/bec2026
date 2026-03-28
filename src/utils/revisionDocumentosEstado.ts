import type { PostulanteFirestore } from '../types/postulante'

/** Estado de la revisión documental según URLs y marcas guardadas (coherente con backend). */
export type RevisionDocumentosEstado =
  | 'rechazado'
  | 'completo'
  | 'en_proceso'
  | 'sin_iniciar'
  | 'sin_docs'

export function conteoValidacionDocumentos(p: PostulanteFirestore): { total: number; validados: number } {
  const keys = Object.keys(p.documentUrls ?? {})
  const v = p.documentosValidados ?? {}
  const validados = keys.filter((k) => v[k] === true).length
  return { total: keys.length, validados }
}

export function getRevisionDocumentosEstado(p: PostulanteFirestore): RevisionDocumentosEstado {
  if (p.estado === 'rechazado') return 'rechazado'
  if (p.estado === 'documentacion_validada') return 'completo'

  const keys = Object.keys(p.documentUrls ?? {})
  if (keys.length === 0) return 'sin_docs'

  const { total, validados } = conteoValidacionDocumentos(p)
  if (validados === total) return 'completo'
  if (validados > 0) return 'en_proceso'
  return 'sin_iniciar'
}
