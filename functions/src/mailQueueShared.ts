/**
 * Utilidades compartidas para encolar correos transaccionales (misma cola Firestore + processMailQueue + SMTP).
 */

export const DEFAULT_MAIL_LOGO_URL =
  'https://web.molina.cl/wp-content/uploads/2024/12/LogoMunicipalNew-1.png'

export interface MailQueueBranding {
  collection: string
  fromDisplayName: string
  fromEmail: string
  logoUrl: string
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function emailPlausible(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Colección de cola + apariencia del remitente y logo (variables de entorno comunes). */
export function getMailQueueBranding(): MailQueueBranding {
  const collection =
    (process.env.MAIL_QUEUE_COLLECTION || process.env.TRIGGER_EMAIL_COLLECTION || 'mail').trim() ||
    'mail'
  const fromDisplayName = (
    process.env.MAIL_FROM_NAME ||
    process.env.TRIGGER_EMAIL_FROM_NAME ||
    'Dirección de Desarrollo Comunitario (DIDECO) — Municipalidad de Molina'
  ).trim()
  const fromEmail = (process.env.MAIL_FROM_EMAIL || process.env.TRIGGER_EMAIL_FROM_EMAIL || '').trim()
  const publicAppUrl = process.env.PUBLIC_APP_URL || ''
  const logoUrl =
    (process.env.MAIL_LOGO_URL || '').trim() ||
    DEFAULT_MAIL_LOGO_URL ||
    (publicAppUrl ? `${publicAppUrl.replace(/\/$/, '')}/src/assets/logo-molina.png` : '')
  return { collection, fromDisplayName, fromEmail, logoUrl }
}

export function buildMailFromHeader(fromDisplayName: string, fromEmail: string): string | undefined {
  if (!fromEmail || !emailPlausible(fromEmail)) return undefined
  const safeName = fromDisplayName.replace(/[\r\n<>"\\]/g, ' ').trim()
  return safeName ? `${safeName} <${fromEmail}>` : fromEmail
}

export function logoFooterHtmlBlock(logoUrl: string): string {
  if (!logoUrl) return ''
  return `<div style="margin:16px 0 0 0;padding-top:14px;border-top:1px solid #e5e7eb;"><img src="${escapeHtml(logoUrl)}" alt="Municipalidad de Molina" style="max-width:140px;width:100%;height:auto;display:block;" /></div>`
}

export function mailDisclaimerParagraph(): string {
  return '<p style="margin:22px 0 0 0;font-size:12px;color:#64748b;">Este mensaje es informativo y fue emitido de forma automática. Por favor, no responder directamente a este correo.</p>'
}
