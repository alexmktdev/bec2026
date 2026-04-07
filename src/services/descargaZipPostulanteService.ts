import { getAuth } from 'firebase/auth'
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
 * URL de `descargarZipDocumentacionCompletaHttp` (ZIP masivo con Bearer).
 * Opcional: `VITE_DESCARGA_ZIP_COMPLETA_HTTP_BASE`.
 */
function baseUrlDescargaZipCompletaHttp(): string {
  const custom = envTrim('VITE_DESCARGA_ZIP_COMPLETA_HTTP_BASE').replace(/\/$/, '')
  if (custom) return custom
  const projectId = envTrim('VITE_FIREBASE_PROJECT_ID')
  const region = envTrim('VITE_FUNCTIONS_REGION') || 'southamerica-west1'
  const name = 'descargarZipDocumentacionCompletaHttp'
  if (!projectId) return ''
  return `https://${region}-${projectId}.cloudfunctions.net/${name}`
}

/**
 * Descarga masiva en el servidor (un solo ZIP); evita cientos de peticiones desde el navegador.
 */
export async function solicitarDescargaZipCompleta(postulanteIds: string[]): Promise<Blob> {
  await prepareCallableSecurity()
  const ids = [...new Set(postulanteIds.map((id) => String(id ?? '').trim()).filter((s) => s.length > 0))]
  if (ids.length === 0) {
    throw new Error('No hay postulantes para descargar.')
  }

  const base = baseUrlDescargaZipCompletaHttp()
  if (!base) {
    throw new Error(
      'Falta configurar el proyecto (VITE_FIREBASE_PROJECT_ID) o la URL VITE_DESCARGA_ZIP_COMPLETA_HTTP_BASE.',
    )
  }

  const user = getAuth().currentUser
  if (!user) {
    throw new Error('Debe iniciar sesión.')
  }
  const idToken = await user.getIdToken()

  const res = await fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ postulanteIds: ids }),
  })

  if (!res.ok) {
    const t = (await res.text().catch(() => '')).trim()
    throw new Error(t || `Error ${res.status} al generar el ZIP.`)
  }

  return await res.blob()
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

/**
 * Una sola llamada al backend para todos los enlaces del export (misma longitud que `postulanteIds`).
 */
export async function emitirEnlacesDescargaZipDocumentosLote(postulanteIds: string[]): Promise<string[]> {
  await prepareCallableSecurity()
  const fn = httpsCallable<
    { postulanteIds: string[] },
    { batchId?: string; tokens: string[] }
  >(functions, 'emitirEnlacesDescargaZipDocumentosLote')
  const { data } = await fn({ postulanteIds })
  const base = baseUrlDescargaZipHttp()
  const tokens = Array.isArray(data?.tokens) ? data.tokens : []
  const batchId = typeof data?.batchId === 'string' ? data.batchId.trim() : ''
  if (!base || tokens.length !== postulanteIds.length) {
    return postulanteIds.map(() => '')
  }
  return tokens.map((t) => {
    const cell = typeof t === 'string' ? t.trim() : ''
    if (!cell) return ''
    if (batchId) {
      return `${base}?b=${encodeURIComponent(batchId)}&p=${encodeURIComponent(cell)}`
    }
    return `${base}?t=${encodeURIComponent(cell)}`
  })
}
