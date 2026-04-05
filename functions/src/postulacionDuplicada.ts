import * as admin from 'firebase-admin'

/**
 * Indica si ya hay una postulación para el RUT normalizado.
 * - Documento con ID = norm (flujo oficial `crearPostulacion`).
 * - O cualquier documento con campo `rutNormalizado` = norm (p. ej. datos creados con `.add()` o legado).
 */
export async function postulacionYaExistePorRutNorm(
  db: admin.firestore.Firestore,
  norm: string,
): Promise<boolean> {
  const byId = await db.collection('postulantes').doc(norm).get()
  if (byId.exists) return true
  const byField = await db.collection('postulantes').where('rutNormalizado', '==', norm).limit(1).get()
  return !byField.empty
}
