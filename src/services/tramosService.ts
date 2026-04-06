import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import type { TramoAsignacion, TramoVigenteEstado } from '../types/postulante'

function normalizarTramoVigente(t: TramoVigenteEstado): TramoVigenteEstado {
  return {
    ...t,
    totalValidados: typeof t.totalValidados === 'number' ? t.totalValidados : 0,
    totalRechazados: typeof t.totalRechazados === 'number' ? t.totalRechazados : 0,
  }
}

export async function obtenerTramos(): Promise<TramoVigenteEstado[]> {
  try {
    const fn = httpsCallable<void, { tramos: TramoVigenteEstado[] }>(functions, 'obtenerTramosRevisores')
    const { data } = await fn()
    return (data.tramos || []).map(normalizarTramoVigente)
  } catch (error) {
    console.error('Error al obtener tramos:', error)
    return []
  }
}

export async function asignarTramos(
  assignments: TramoAsignacion[],
  scopePostulanteIds?: string[],
): Promise<void> {
  const fn = httpsCallable<
    { assignments: TramoAsignacion[]; scopePostulanteIds?: string[] },
    { ok: boolean }
  >(functions, 'asignarTramosRevisores')
  if (assignments.length === 0) {
    await fn({ assignments: [] })
    return
  }
  if (!scopePostulanteIds?.length) {
    throw new Error('Se requiere el alcance de la vista de revisión (IDs visibles con el filtro actual).')
  }
  await fn({ assignments, scopePostulanteIds })
}

/**
 * Vuelve a 0: borra config de tramos y elimina `assignedTo` en todos los postulantes (solo superadmin; lógica en Cloud Function).
 */
export async function limpiarTodasLasAsignacionesTramos(): Promise<void> {
  await asignarTramos([])
}

/** @alias limpiarTodasLasAsignacionesTramos */
export async function formatearTramos(): Promise<void> {
  await limpiarTodasLasAsignacionesTramos()
}
