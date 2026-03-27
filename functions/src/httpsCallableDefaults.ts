import { getCallableCorsOrigins } from './allowedWebOrigins'

/**
 * Opciones comunes para callables expuestas al navegador (postulación + panel admin).
 * Requiere `initializeAppCheck` en el cliente (`src/firebase/config.ts`).
 *
 * CORS: lista explícita vía `getCallableCorsOrigins()` (ver `allowedWebOrigins.ts`).
 *
 * Nota (consola Firebase): activar “Enforce” de App Check en Firestore/Storage/Auth
 * es independiente y puede bloquear SDKs o scripts sin token; hazlo solo si lo necesitas.
 */
export function webCallableBase() {
  // En el emulador de Functions, App Check no aplica; en Cloud (deploy) sí.
  const runningInFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true'
  return {
    cors: getCallableCorsOrigins(),
    invoker: 'public' as const,
    enforceAppCheck: !runningInFunctionsEmulator,
  }
}





