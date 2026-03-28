/**
 * Orígenes permitidos para `cors` en callables v2 (se evalúa en cada petición).
 *
 * Incluye regex para cualquier subdominio `*.vercel.app` (producción y previews).
 * App Check sigue siendo obligatorio: dominios no registrados en la consola de
 * Firebase/reCAPTCHA no obtienen token válido aunque CORS permita el origen.
 *
 * Si el navegador muestra CORS pero en Cloud Run los logs dicen "not authenticated",
 * falta el rol **Cloud Run Invoker** para `allUsers` en el servicio (ver comentario en functionsInit).
 */
export const CALLABLE_CORS_ORIGINS: (string | RegExp)[] = [
  /^http:\/\/localhost(?::\d+)?$/i,
  /^http:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https:\/\/[a-z0-9.-]+\.vercel\.app$/i,
  'https://beca-muni-2026.web.app',
  'https://beca-muni-2026.firebaseapp.com',
]
