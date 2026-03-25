/**
 * Orígenes permitidos para CORS en httpsCallable (Gen2).
 * El navegador solo podrá invocar las functions desde estos hosts.
 *
 * Override sin tocar código: variable de entorno al desplegar (ver functions/.env.example).
 */
const DEFAULT_ALLOWED_WEB_ORIGINS: string[] = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://bec2026.vercel.app',
  'https://beca-muni-2026.web.app',
  'https://beca-muni-2026.firebaseapp.com',
]

export function getCallableCorsOrigins(): string[] {
  const raw = process.env.ALLOWED_WEB_ORIGINS?.trim()
  if (!raw) return [...DEFAULT_ALLOWED_WEB_ORIGINS]

  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parsed.length > 0 ? parsed : [...DEFAULT_ALLOWED_WEB_ORIGINS]
}
