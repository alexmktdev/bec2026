import { CALLABLE_CORS_ORIGINS } from './allowedWebOrigins'

/**
 * Opciones comunes para callables expuestas al navegador (postulación + panel admin).
 * Requiere `initializeAppCheck` en el cliente (`src/firebase/config.ts`).
 *
 * - `cors`: lista + regex (Vercel producción/previews y Firebase Hosting). Evita depender
 *   solo de `cors: true` si el runtime no refleja bien el Origin en algunos despliegues.
 * - `invoker: 'public'`: el servicio Cloud Run debe permitir invocaciones sin login de Google;
 *   si falta, Google responde 403 **sin** cabeceras CORS y el navegador muestra error CORS.
 */
export function webCallableBase() {
  const runningInFunctionsEmulator = process.env.FUNCTIONS_EMULATOR === 'true'
  return {
    cors: runningInFunctionsEmulator ? true : CALLABLE_CORS_ORIGINS,
    invoker: 'public' as const,
    enforceAppCheck: !runningInFunctionsEmulator,
  }
}
