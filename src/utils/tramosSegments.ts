/**
 * Utilidades de segmentos de tramo (validación en cliente para UX; el servidor vuelve a validar todo).
 */

export type RangoTramo = { startRange: number; endRange: number }

export function segmentosSeSolapan(a: RangoTramo, b: RangoTramo): boolean {
  return (
    (a.startRange >= b.startRange && a.startRange <= b.endRange) ||
    (a.endRange >= b.startRange && a.endRange <= b.endRange) ||
    (a.startRange <= b.startRange && a.endRange >= b.endRange)
  )
}

export function findSegmentoSolapado<T extends RangoTramo & { segmentId?: string }>(
  candidato: RangoTramo,
  lista: T[],
  excluirSegmentId?: string,
): T | undefined {
  return lista.find((s) => {
    if (excluirSegmentId && s.segmentId === excluirSegmentId) return false
    return segmentosSeSolapan(candidato, s)
  })
}

export function legacySegmentId(reviewerUid: string, start: number, end: number): string {
  return `legacy-${reviewerUid}-${start}-${end}`
}
