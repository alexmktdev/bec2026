import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { normalizeRut } from '../postulacion/shared/rut'

export { normalizeRut } from '../postulacion/shared/rut'

/**
 * Indica si el RUT está en la base histórica (beneficiarios anteriores).
 * Solo lectura pública por documento (get), no listado.
 */
export async function isRutInHistorical(rut: string): Promise<boolean> {
  const normalized = normalizeRut(rut)
  const docRef = doc(db, 'historical_ruts', normalized)
  const snap = await getDoc(docRef)
  return snap.exists()
}
