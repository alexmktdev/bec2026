/**
 * Creación y comprobaciones de postulación vía Cloud Functions (backend de confianza).
 * Firestore no permite `create` público en `postulantes`; estas funciones usan Admin SDK.
 */
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions'
import { functions, prepareCallableSecurity } from '../firebase/config'
import type { DocumentosSubidos, PostulanteData } from '../types/postulante'

export type ElegibilidadResponse =
  | { ok: true }
  | { ok: false; code: 'historical' | 'duplicate' | 'rechazo_entrada_previo' }

export async function verificarElegibilidadPostulacion(rut: string): Promise<ElegibilidadResponse> {
  await prepareCallableSecurity()
  const fn = httpsCallable<{ rut: string }, ElegibilidadResponse>(
    functions,
    'verificarElegibilidadPostulacion',
  )
  const res: HttpsCallableResult<ElegibilidadResponse> = await fn({ rut })
  return res.data
}

export type CrearPostulacionResponse = { postulanteId: string }

export async function crearPostulacionCallable(
  data: PostulanteData,
  documentosSubidos: DocumentosSubidos,
  documentPaths: Record<string, string>,
): Promise<CrearPostulacionResponse> {
  await prepareCallableSecurity()
  const fn = httpsCallable<
    { data: PostulanteData; documentosSubidos: DocumentosSubidos; documentPaths: Record<string, string> },
    CrearPostulacionResponse
  >(functions, 'crearPostulacion')
  const res = await fn({ data, documentosSubidos, documentPaths })
  return res.data
}

export async function registrarPostulanteRechazadoEntradaCallable(
  data: PostulanteData,
  reason?: string,
  message?: string,
): Promise<void> {
  await prepareCallableSecurity()
  const fn = httpsCallable<
    { data: PostulanteData; reason?: string; message?: string },
    { ok: boolean }
  >(functions, 'registrarPostulanteRechazadoEntrada')
  await fn({ data, reason, message })
}

/** Código Firebase Callable (p. ej. `functions/already-exists`). */
export function esErrorCallable(err: unknown): err is { code: string; message?: string; details?: unknown } {
  return typeof err === 'object' && err !== null && 'code' in err && typeof (err as { code: string }).code === 'string'
}

/** `details.reason` en `HttpsError` de Functions (p. ej. failed-precondition). */
export function razonHttpsCallable(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined
  const e = err as Record<string, unknown>
  for (const key of ['details', 'customData'] as const) {
    const block = e[key]
    if (block && typeof block === 'object' && block !== null && 'reason' in block) {
      const r = (block as { reason?: unknown }).reason
      if (typeof r === 'string' && r.length > 0) return r
    }
  }
  return undefined
}
