import { httpsCallable } from 'firebase/functions'
import { functions, prepareCallableSecurity } from '../firebase/config'

function envTrim(key: string): string {
  const v = import.meta.env[key as keyof ImportMetaEnv]
  if (v === undefined || v === null) return ''
  const s = String(v).trim()
  if (s === '' || s === 'undefined') return ''
  return s
}

/**
 * URL base de la función HTTP `descargarZipDocumentosPostulanteHttp`.
 * - Opcional: `VITE_DESCARGA_ZIP_HTTP_BASE` (copiar desde Firebase Console → Functions → URL de la función).
 * - Si no está, se arma con `VITE_FIREBASE_PROJECT_ID` y la misma región que `getFunctions` (`VITE_FUNCTIONS_REGION`).
 */
function baseUrlDescargaZipHttp(): string {
  const custom = envTrim('VITE_DESCARGA_ZIP_HTTP_BASE').replace(/\/$/, '')
  if (custom) return custom
  const projectId = envTrim('VITE_FIREBASE_PROJECT_ID')
  const region = envTrim('VITE_FUNCTIONS_REGION') || 'southamerica-west1'
  const name = 'descargarZipDocumentosPostulanteHttp'
  if (!projectId) return ''
  return `https://${region}-${projectId}.cloudfunctions.net/${name}`
}

/**
 * Pide un token opaco al backend y arma el enlace GET público (un solo uso al descargar).
 */
export async function emitirEnlaceDescargaZipDocumentos(postulanteId: string): Promise<string> {
  await prepareCallableSecurity()
  const fn = httpsCallable<{ postulanteId: string }, { token: string }>(
    functions,
    'emitirEnlaceDescargaZipDocumentos',
  )
  const { data } = await fn({ postulanteId: postulanteId.trim() })
  const token = typeof data?.token === 'string' ? data.token : ''
  const base = baseUrlDescargaZipHttp()
  if (!token || !base) return ''
  return `${base}?t=${encodeURIComponent(token)}`
}
