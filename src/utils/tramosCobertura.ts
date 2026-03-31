import type { PostulanteFirestore } from '../types/postulante'

export type RangoTramoLike = { startRange: number; endRange: number }

/**
 * Posiciones 1…totalNomina que no entran en ningún segmento (configuración de tramos).
 */
export function contarPosicionesSinCubrir(totalNomina: number, segmentos: RangoTramoLike[]): number {
  if (totalNomina <= 0) return 0
  const covered = new Set<number>()
  for (const s of segmentos) {
    const desde = Math.max(1, Math.min(Math.floor(s.startRange), totalNomina))
    const hasta = Math.min(totalNomina, Math.max(Math.floor(s.endRange), 1))
    if (desde > hasta) continue
    for (let p = desde; p <= hasta; p++) covered.add(p)
  }
  return totalNomina - covered.size
}

/**
 * Hay al menos un postulante con orden de revisión persistido dentro de la nómina (hubo guardado de tramos).
 */
export function existeOrdenRevisionEnNomina(
  postulantes: PostulanteFirestore[],
  totalNomina: number,
): boolean {
  if (totalNomina <= 0) return false
  return postulantes.some((p) => {
    const o = Number(p.ordenRevisionDoc)
    return Number.isFinite(o) && o >= 1 && o <= totalNomina
  })
}

/**
 * Postulantes con posición en nómina y sin `assignedTo` (estado tras último guardado en servidor).
 */
export function contarPostulantesSinRevisorEnNomina(
  postulantes: PostulanteFirestore[],
  totalNomina: number,
): number {
  if (totalNomina <= 0) return 0
  let n = 0
  for (const p of postulantes) {
    const o = Number(p.ordenRevisionDoc)
    if (!Number.isFinite(o) || o < 1 || o > totalNomina) continue
    if (!p.assignedTo) n++
  }
  return n
}

export type ResumenFaltantesAsignacion = {
  totalNomina: number
  /** Huecos según segmentos en config (servidor o borrador). */
  posicionesSinCubrir: number
  /** null si aún no hay órdenes persistidos en la nómina. */
  postulantesSinRevisor: number | null
}

export function resumenFaltantesAsignacionRevision(
  totalNomina: number,
  segmentos: RangoTramoLike[],
  postulantes: PostulanteFirestore[],
): ResumenFaltantesAsignacion {
  const posicionesSinCubrir = contarPosicionesSinCubrir(totalNomina, segmentos)
  const hayOrden = existeOrdenRevisionEnNomina(postulantes, totalNomina)
  return {
    totalNomina,
    posicionesSinCubrir,
    postulantesSinRevisor: hayOrden
      ? contarPostulantesSinRevisorEnNomina(postulantes, totalNomina)
      : null,
  }
}
