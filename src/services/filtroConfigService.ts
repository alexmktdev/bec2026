import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../firebase/config'

const CONFIG_DOC_REVISION = 'config/filtro_revision_doc'

// ── Filtro revisión de documentación ──

export async function getFiltroRevisionDocConfig(): Promise<boolean> {
  const snap = await getDoc(doc(db, CONFIG_DOC_REVISION))
  if (!snap.exists()) return false
  return snap.data()?.activo === true
}

export async function setFiltroRevisionDocConfig(activo: boolean): Promise<void> {
  await setDoc(doc(db, CONFIG_DOC_REVISION), {
    activo,
    updatedAt: new Date().toISOString(),
  })
}

// ── Filtro desempate ──

export type CriterioDesempate = 'nem' | 'rsh' | 'enfermedad' | 'hermanos' | 'fecha'

const CONFIG_DOC_DESEMPATE = 'config/filtro_desempate'

export async function getCriterioDesempateConfig(): Promise<CriterioDesempate | null> {
  const snap = await getDoc(doc(db, CONFIG_DOC_DESEMPATE))
  if (!snap.exists()) return null
  const criterio = snap.data()?.criterio
  if (!criterio || !['nem', 'rsh', 'enfermedad', 'hermanos', 'fecha'].includes(criterio)) return null
  return criterio as CriterioDesempate
}

export async function setCriterioDesempateConfig(criterio: CriterioDesempate): Promise<void> {
  await setDoc(doc(db, CONFIG_DOC_DESEMPATE), {
    criterio,
    updatedAt: new Date().toISOString(),
  })
}

export async function clearCriterioDesempateConfig(): Promise<void> {
  await deleteDoc(doc(db, CONFIG_DOC_DESEMPATE))
}
