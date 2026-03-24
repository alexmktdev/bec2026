import { initializeApp, getApp, getApps } from 'firebase/app'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore, memoryLocalCache, setLogLevel } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

// Solo mostrar errores reales de Firestore, no warnings de transporte
setLogLevel('error')

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Evitar inicializar la app más de una vez durante HMR (Hot Module Replacement)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

/** Obligatorio en cliente si las callables usan enforceAppCheck: true */
function initAppCheckIfNeeded(firebaseApp: ReturnType<typeof getApp>): void {
  if (typeof window === 'undefined') return

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
    initializeAppCheck(firebaseApp, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!/already been initialized|already initialized/i.test(msg)) {
      console.error('[App Check] No se pudo inicializar:', e)
    }
  }
}

initAppCheckIfNeeded(app)

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
export const functions = getFunctions(app, 'us-central1')
export default app

