import type { DocumentSnapshot } from 'firebase-admin/firestore'

/**
 * Orden canónico de la nómina en el panel de revisión (`obtenerPostulantesRevisor`, ranking, etc.).
 *
 * Reglas: `createdAt` descendente (más reciente primero); empate por `id`; sin `createdAt` al final.
 */
export function comparePostulantesOrdenPanel(
  a: { id: string; createdAt?: unknown },
  b: { id: string; createdAt?: unknown },
): number {
  const ca = createdAtSortKey(a.createdAt)
  const cb = createdAtSortKey(b.createdAt)
  const cmp = cb.localeCompare(ca)
  if (cmp !== 0) return cmp
  return a.id.localeCompare(b.id)
}

function createdAtSortKey(v: unknown): string {
  if (v == null) return ''
  const s = String(v).trim()
  return s
}

export function ordenarDocsPostulantesComoEnPanel(docs: DocumentSnapshot[]): DocumentSnapshot[] {
  return [...docs].sort((a, b) =>
    comparePostulantesOrdenPanel(
      { id: a.id, createdAt: a.data()?.createdAt },
      { id: b.id, createdAt: b.data()?.createdAt },
    ),
  )
}
