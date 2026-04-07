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

/** Refleja `Origin` si coincide con la lista (necesario para POST + `Authorization`). */
export function origenPermitidoCorsHttp(origin: string | undefined): string | null {
  if (!origin || typeof origin !== 'string') return null
  const trimmed = origin.trim()
  if (!trimmed) return null
  for (const rule of CALLABLE_CORS_ORIGINS) {
    if (typeof rule === 'string' && rule === trimmed) return trimmed
    if (rule instanceof RegExp && rule.test(trimmed)) return trimmed
  }
  return null
}

type ResCorsMin = {
  setHeader(name: string, value: string | number): void
  status(code: number): { send(body?: string): void }
}

/**
 * Cabeceras CORS + respuesta al preflight OPTIONS.
 * Debe llamarse al inicio del handler (antes de cualquier `res.status` que corte el flujo).
 * @returns true si ya se respondió (OPTIONS); el handler debe hacer `return`.
 */
export function aplicarCorsZipDocumentacionCompleta(
  req: { method?: string; headers: { origin?: string } },
  res: ResCorsMin,
): boolean {
  const allow = origenPermitidoCorsHttp(req.headers.origin)
  if (allow) {
    res.setHeader('Access-Control-Allow-Origin', allow)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age', '86400')
  if (req.method === 'OPTIONS') {
    res.status(204).send('')
    return true
  }
  return false
}
