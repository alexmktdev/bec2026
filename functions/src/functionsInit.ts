/**
 * Debe cargarse antes que cualquier `onCall`.
 * Si `setGlobalOptions` va solo en index.ts, esbuild puede dejar el código de admin.ts
 * antes en el bundle y las callables de admin quedan con la región por defecto (us-central1).
 *
 * Si ves error CORS en el navegador pero Cloud Run dice "not authenticated":
 * Console GCP → Cloud Run → servicio de la función → Permisos → añade principal
 * `allUsers` con rol **Cloud Run Invoker** (o redeploy con `invoker: 'public'` en cada callable).
 */
import { setGlobalOptions } from 'firebase-functions/v2'

setGlobalOptions({
  region: 'southamerica-west1',
  maxInstances: 10,
  ingressSettings: 'ALLOW_ALL',
})
