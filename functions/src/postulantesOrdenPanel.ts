import type { DocumentSnapshot, Firestore } from 'firebase-admin/firestore'

/**
 * Orden canónico de la nómina en el panel de revisión.
 * Debe usarse en `obtenerPostulantesRevisor` y en `asignarTramosRevisores` para que
 * la posición N (1-based) sea siempre la misma fila que ve el usuario.
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

/** Firestore limita getAll a 10 referencias por llamada. */
const GET_ALL_CHUNK = 10

export async function obtenerSnapshotsPostulantesPorIds(
  db: Firestore,
  ids: string[],
): Promise<DocumentSnapshot[]> {
  const out: DocumentSnapshot[] = []
  for (let i = 0; i < ids.length; i += GET_ALL_CHUNK) {
    const chunk = ids.slice(i, i + GET_ALL_CHUNK)
    const refs = chunk.map((id) => db.collection('postulantes').doc(id))
    const snaps = await db.getAll(...refs)
    out.push(...snaps)
  }
  return out
}
