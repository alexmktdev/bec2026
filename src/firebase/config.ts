import { initializeApp, getApp, getApps } from 'firebase/app'
import { initializeAppCheck, getToken } from 'firebase/app-check'
import { createRecaptchaAppCheckProvider } from './appCheckProvider'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, memoryLocalCache, setLogLevel } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

// Solo mostrar errores reales de Firestore, no warnings de transporte
setLogLevel('error')

/** Evita valores vacíos o el texto "undefined" pegado por error en Vercel. */
function viteEnvString(key: string): string | undefined {
  const v = import.meta.env[key as keyof ImportMetaEnv]
  if (v === undefined || v === null) return undefined
  const s = String(v).trim()
  if (s === '' || s === 'undefined') return undefined
  return s
}

const firebaseConfig = {
  apiKey: viteEnvString('VITE_FIREBASE_API_KEY'),
  authDomain: viteEnvString('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: viteEnvString('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: viteEnvString('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: viteEnvString('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: viteEnvString('VITE_FIREBASE_APP_ID'),
}

if (typeof window !== 'undefined' && import.meta.env.PROD && !firebaseConfig.appId) {
  console.error(
    '[Firebase] Falta VITE_FIREBASE_APP_ID en el build. En Vercel → Settings → Environment Variables añade el App ID de la app Web (Firebase Console → ⚙️ Project settings → Your apps → App ID). Sin esto App Check responde 400 "Invalid App ID".',
  )
}

// Evitar inicializar la app más de una vez durante HMR (Hot Module Replacement)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

/** Instancia devuelta por initializeAppCheck; se usa para forzar token antes de httpsCallable */
let appCheckInstance: ReturnType<typeof initializeAppCheck> | null = null

/** Obligatorio en cliente si las callables usan enforceAppCheck: true */
function initAppCheckIfNeeded(firebaseApp: ReturnType<typeof getApp>): void {
  if (typeof window === 'undefined') return

  if (!firebaseConfig.appId) {
    if (import.meta.env.PROD) {
      console.error('[App Check] No se inicializa: falta VITE_FIREBASE_APP_ID en variables de entorno del deploy.')
    }
    return
  }

  const siteKey = String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim()
  if (!siteKey) {
    if (import.meta.env.PROD) {
      console.error(
        '[App Check] Falta VITE_RECAPTCHA_SITE_KEY. Las callables con enforceAppCheck fallarán hasta configurarla.',
      )
    }
    return
  }

  if (import.meta.env.DEV) {
    const fixed = String(import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || '').trim()
    const w = globalThis as typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string }
    w.FIREBASE_APPCHECK_DEBUG_TOKEN = fixed.length > 0 ? fixed : true
  }

  try {
    appCheckInstance = initializeAppCheck(firebaseApp, {
      provider: createRecaptchaAppCheckProvider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/already been initialized|already initialized/i.test(msg)) {
      // HMR u otra doble carga: App Check ya está activo; las callables siguen adjuntando token.
      appCheckInstance = null
    } else {
      console.error('[App Check] No se pudo inicializar:', e)
    }
  }
}

initAppCheckIfNeeded(app)

/** Evita ráfagas concurrentes a content-firebaseappcheck (empeora appCheck/initial-throttle). */
let prepareAppCheckInFlight: Promise<void> | null = null

/**
 * Asegura un token de App Check antes de httpsCallable con enforceAppCheck.
 * Usa caché del SDK (`forceRefresh: false`) para no multiplicar peticiones 400/throttle en cada clic.
 */
export async function prepareCallableSecurity(): Promise<void> {
  if (typeof window === 'undefined') return

  const siteKey = String(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').trim()
  if (!siteKey) {
    if (import.meta.env.PROD) {
      throw new Error('APP_CHECK_NOT_CONFIGURED')
    }
    return
  }

  if (!appCheckInstance) {
    if (import.meta.env.PROD) {
      throw new Error('APP_CHECK_NOT_INITIALIZED')
    }
    return
  }

  if (prepareAppCheckInFlight) {
    return prepareAppCheckInFlight
  }

  const ac = appCheckInstance
  prepareAppCheckInFlight = (async () => {
    try {
      await getToken(ac, false)
    } catch (e) {
      console.error(
        '[App Check] getToken falló. Si en consola registraste reCAPTCHA Enterprise, pon VITE_APPCHECK_USE_ENTERPRISE=true. Revisa dominio y clave en Vercel. Tras muchos fallos, espera el throttle (appCheck/initial-throttle).',
        e,
      )
      throw new Error('APP_CHECK_TOKEN_FAILED')
    } finally {
      prepareAppCheckInFlight = null
    }
  })()

  return prepareAppCheckInFlight
}

// Inicializar Firestore solo si no ha sido inicializado antes, para evitar el error de "already been called"
let db: ReturnType<typeof getFirestore>

try {
  db = initializeFirestore(app, {
    // Memoria en lugar de IndexedDB: evita conflictos de multi-pestaña y errores de "primary lease"
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
  })
} catch (e) {
  // Si ya fue inicializado (común en recargas rápidas de Vite), obtenemos la instancia existente
  db = getFirestore(app)
}

export { db }
export const auth = getAuth(app)
export const storage = getStorage(app)
export const functions = getFunctions(app, 'southamerica-west1')
export default app

