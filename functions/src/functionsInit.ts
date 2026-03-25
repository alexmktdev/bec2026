/**
 * Debe cargarse antes que cualquier `onCall`.
 * Si `setGlobalOptions` va solo en index.ts, esbuild puede dejar el código de admin.ts
 * antes en el bundle y las callables de admin quedan con la región por defecto (us-central1).
 */
import { setGlobalOptions } from 'firebase-functions/v2'

setGlobalOptions({ region: 'southamerica-west1', maxInstances: 10 })
