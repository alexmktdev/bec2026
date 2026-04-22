import type { Firestore } from 'firebase-admin/firestore'
import { loadExcelRevisionImportFromFirestore } from './excelRevisionFirestoreLoad'
import {
  filasConPuntajeMinimo,
  filasSoloEstadoValidado,
  findEstadoRevisionColumnKey,
  findPuntajeTotalColumnKey,
} from './filtroPuntajeTotalLogic'

export const CONFIG_UMBRAL_FILTRO_PUNTAJE_PATH = 'filtro_puntaje_total_umbral'
const UMBRALES_PERMITIDOS = new Set([40, 50, 60, 70, 80])

export type VistaFiltroPuntajeTotal = {
  sinExcel: boolean
  sinColumnaEstado: boolean
  sinColumnaPuntajeTotal: boolean
  headers: string[]
  sheetName: string
  coincideConPlantillaExport: boolean
  persistedAt: string | null
  filasBaseValidado: Record<string, string>[]
  filasVista: Record<string, string>[]
  totalValidado: number
  totalVista: number
  umbralActivo: number | null
}

export async function leerUmbralFiltroPuntajeGlobal(db: Firestore): Promise<number | null> {
  const snap = await db.collection('config').doc(CONFIG_UMBRAL_FILTRO_PUNTAJE_PATH).get()
  if (!snap.exists) return null
  const raw = snap.data()?.puntajeMinimo
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  if (!UMBRALES_PERMITIDOS.has(raw)) return null
  return raw
}

/** Vista de filtro por puntaje total del usuario (misma lógica que los callables de esa pestaña). */
export async function construirVistaFiltroPuntajeTotal(db: Firestore, uid: string): Promise<VistaFiltroPuntajeTotal> {
  const vacio = (): VistaFiltroPuntajeTotal => ({
    sinExcel: true,
    sinColumnaEstado: false,
    sinColumnaPuntajeTotal: false,
    headers: [],
    sheetName: '',
    coincideConPlantillaExport: false,
    persistedAt: null,
    filasBaseValidado: [],
    filasVista: [],
    totalValidado: 0,
    totalVista: 0,
    umbralActivo: null,
  })

  const pack = await loadExcelRevisionImportFromFirestore(db, uid)
  if (!pack || pack.rows.length === 0) {
    const v = vacio()
    v.umbralActivo = await leerUmbralFiltroPuntajeGlobal(db)
    return v
  }

  const estadoKey = findEstadoRevisionColumnKey(pack.headers, pack.rows)
  const puntajeKey = findPuntajeTotalColumnKey(pack.headers)
  const sinColumnaEstado = estadoKey == null
  const sinColumnaPuntajeTotal = puntajeKey == null

  const filasBaseValidado = sinColumnaEstado ? [] : filasSoloEstadoValidado(pack.rows, estadoKey)

  const umbralActivo = await leerUmbralFiltroPuntajeGlobal(db)

  let filasVista = filasBaseValidado
  if (umbralActivo != null) {
    if (puntajeKey == null) {
      // Umbral global sin columna «Puntaje total» reconocible: no hay forma de aplicar el corte solo con esa columna.
      filasVista = []
    } else {
      filasVista = filasConPuntajeMinimo(filasBaseValidado, puntajeKey, umbralActivo)
    }
  }

  return {
    sinExcel: false,
    sinColumnaEstado,
    sinColumnaPuntajeTotal,
    headers: pack.headers,
    sheetName: pack.sheetName,
    coincideConPlantillaExport: pack.coincideConPlantillaExport,
    persistedAt: pack.persistedAt,
    filasBaseValidado,
    filasVista,
    totalValidado: filasBaseValidado.length,
    totalVista: filasVista.length,
    umbralActivo,
  }
}
