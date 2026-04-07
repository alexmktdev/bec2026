import './functionsInit'
import * as admin from 'firebase-admin'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { webCallableBase } from './httpsCallableDefaults'
import { assertRevisorOrAdmin, verifySuperAdmin } from './admin'
import {
  CONFIG_UMBRAL_FILTRO_PUNTAJE_PATH,
  construirVistaFiltroPuntajeTotal,
  type VistaFiltroPuntajeTotal,
} from './filtroPuntajeTotalVista'

const UMBRALES_PERMITIDOS = new Set([40, 50, 60, 70, 80])

function serializarVista(v: VistaFiltroPuntajeTotal): Record<string, unknown> {
  return {
    sinExcel: v.sinExcel,
    sinColumnaEstado: v.sinColumnaEstado,
    sinColumnaPuntajeTotal: v.sinColumnaPuntajeTotal,
    headers: v.headers,
    sheetName: v.sheetName,
    coincideConPlantillaExport: v.coincideConPlantillaExport,
    persistedAt: v.persistedAt,
    filasBaseValidado: v.filasBaseValidado,
    filasVista: v.filasVista,
    totalValidado: v.totalValidado,
    totalVista: v.totalVista,
    umbralActivo: v.umbralActivo,
  }
}

/** Vista y filas calculadas 100 % en servidor (Validado + umbral global opcional). */
export const obtenerVistaFiltroPuntajeTotalAdmin = onCall(
  { ...webCallableBase(), memory: '512MiB', timeoutSeconds: 120, maxInstances: 10 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)

    try {
      const vista = await construirVistaFiltroPuntajeTotal(db, callerUid)
      return serializarVista(vista)
    } catch (e: unknown) {
      console.error('Error obtenerVistaFiltroPuntajeTotalAdmin:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'No se pudo obtener la vista de filtrado por puntaje.')
    }
  },
)

export const aplicarUmbralFiltroPuntajeTotalAdmin = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 60, maxInstances: 5 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await verifySuperAdmin(callerUid, db)

    const raw = (request.data as { puntajeMinimo?: unknown })?.puntajeMinimo
    const puntajeMinimo =
      typeof raw === 'number' && Number.isFinite(raw)
        ? raw
        : typeof raw === 'string'
          ? Number.parseInt(raw, 10)
          : NaN

    if (!Number.isFinite(puntajeMinimo) || !UMBRALES_PERMITIDOS.has(puntajeMinimo)) {
      throw new HttpsError('invalid-argument', 'Umbral no permitido (use 40, 50, 60, 70 u 80).')
    }

    try {
      await db.collection('config').doc(CONFIG_UMBRAL_FILTRO_PUNTAJE_PATH).set({
        puntajeMinimo,
        updatedAt: new Date().toISOString(),
        updatedByUid: callerUid,
      })
      const vista = await construirVistaFiltroPuntajeTotal(db, callerUid)
      return { ok: true as const, puntajeMinimo, vista: serializarVista(vista) }
    } catch (e: unknown) {
      console.error('Error aplicarUmbralFiltroPuntajeTotalAdmin:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'No se pudo guardar el umbral.')
    }
  },
)

export const limpiarUmbralFiltroPuntajeTotalAdmin = onCall(
  { ...webCallableBase(), memory: '256MiB', timeoutSeconds: 30, maxInstances: 5 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await verifySuperAdmin(callerUid, db)

    try {
      const ref = db.collection('config').doc(CONFIG_UMBRAL_FILTRO_PUNTAJE_PATH)
      const snap = await ref.get()
      if (snap.exists) await ref.delete()
      const vista = await construirVistaFiltroPuntajeTotal(db, callerUid)
      return { ok: true as const, vista: serializarVista(vista) }
    } catch (e: unknown) {
      console.error('Error limpiarUmbralFiltroPuntajeTotalAdmin:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'No se pudo quitar el umbral.')
    }
  },
)

export const exportarExcelFiltroPuntajeTotalAdmin = onCall(
  { ...webCallableBase(), memory: '512MiB', timeoutSeconds: 120, maxInstances: 5 },
  async (request) => {
    const callerUid = request.auth?.uid
    if (!callerUid) throw new HttpsError('unauthenticated', 'Debe iniciar sesión.')

    const db = admin.firestore()
    await assertRevisorOrAdmin(callerUid, db, request.auth?.token?.email)

    try {
      const vista = await construirVistaFiltroPuntajeTotal(db, callerUid)
      if (vista.sinExcel || vista.filasVista.length === 0) {
        throw new HttpsError('failed-precondition', 'No hay datos para exportar en la vista actual.')
      }

      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Filtrado puntaje total', {
        views: [{ state: 'frozen', ySplit: 1 }],
      })

      ws.addRow(vista.headers)
      for (const row of vista.filasVista) {
        ws.addRow(vista.headers.map((h) => row[h] ?? ''))
      }

      const headerRow = ws.getRow(1)
      headerRow.font = { bold: true }

      const buf = await wb.xlsx.writeBuffer()
      const base64 = Buffer.from(buf).toString('base64')
      const umbral = vista.umbralActivo != null ? `_umbral${vista.umbralActivo}` : ''
      const filename = `filtro_puntaje_total${umbral}_${new Date().toISOString().slice(0, 10)}.xlsx`

      return {
        ok: true as const,
        base64,
        filename,
        totalFilas: vista.totalVista,
        umbralActivo: vista.umbralActivo,
      }
    } catch (e: unknown) {
      console.error('Error exportarExcelFiltroPuntajeTotalAdmin:', e)
      if (e instanceof HttpsError) throw e
      throw new HttpsError('internal', 'No se pudo generar el Excel.')
    }
  },
)
