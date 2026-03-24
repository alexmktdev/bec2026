import type { PostulanteFirestore } from '../types/postulante'
import type { CriterioDesempate } from '../services/filtroConfigService'

export const ORDEN_ESTANDAR_DESEMPATE: CriterioDesempate[] = ['nem', 'rsh', 'enfermedad', 'hermanos', 'fecha']

export function compararCriterio(a: PostulanteFirestore, b: PostulanteFirestore, c: CriterioDesempate): number {
  if (c === 'fecha') {
    // Postulación más antigua primero (menor createdAt gana)
    return (a.createdAt || '').localeCompare(b.createdAt || '')
  }

  const puntosA = a.puntaje?.[c] || 0
  const puntosB = b.puntaje?.[c] || 0

  if (puntosA !== puntosB) {
    // A mayor puntaje en la categoría, mejor ranking
    return puntosB - puntosA
  }

  // SI LOS PUNTOS SON IGUALES, DESEMPATAMOS POR VALOR REAL (si aplica)
  if (c === 'nem') {
    // NEM real (6.8 vs 6.6)
    return (parseFloat(b.nem) || 0) - (parseFloat(a.nem) || 0)
  }

  if (c === 'rsh') {
    // RSH real (40% vs 50%). El % menor es más vulnerable, por ende mejor ranking.
    const valA = parseInt(a.tramoRegistroSocial) || 100
    const valB = parseInt(b.tramoRegistroSocial) || 100
    return valA - valB
  }

  return 0
}

export function sortByDesempate(
  list: PostulanteFirestore[],
  criterio: CriterioDesempate | null,
): PostulanteFirestore[] {
  const orden = criterio 
    ? [criterio, ...ORDEN_ESTANDAR_DESEMPATE.filter((c) => c !== criterio)] 
    : ORDEN_ESTANDAR_DESEMPATE
    
  return [...list].sort((a, b) => {
    // 1. Siempre manda el Puntaje Total
    const diffTotal = (b.puntaje?.total || 0) - (a.puntaje?.total || 0)
    if (diffTotal !== 0) return diffTotal

    // 2. Si empatan en Puntaje Total, aplicamos el orden de desempate
    for (const c of orden) {
      const diff = compararCriterio(a, b, c)
      if (diff !== 0) return diff
    }
    return 0
  })
}
