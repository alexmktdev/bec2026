import { initializeApp, getApp, getApps } from 'firebase/app'
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

