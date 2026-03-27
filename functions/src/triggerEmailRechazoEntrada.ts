/**
 * Encola correos en Firestore para ser procesados por la Cloud Function propia `processMailQueue`.
 * Solo Admin SDK escribe en la colección configurada.
 */
import * as admin from 'firebase-admin'

import type { PostulanteRechazadoEntrada } from '../../src/types/postulante'

const DEFAULT_MAIL_LOGO_URL = 'https://web.molina.cl/wp-content/uploads/2024/12/LogoMunicipalNew-1.png'

export interface RechazoEntradaMailQueueConfig {
  enabled: boolean
  collection: string
  /** Nombre mostrado si se define remitente explícito (opcional). */
  fromDisplayName: string
  /** Si está vacío, `processMailQueue` usa SMTP_FROM_EMAIL/SMTP_USER como fallback. */
  fromEmail: string
  /** URL pública del logo institucional para renderizar en HTML. */
  logoUrl: string
}

export function getRechazoEntradaMailQueueConfig(): RechazoEntradaMailQueueConfig {
  const enabled =
    process.env.ENABLE_RECHAZO_ENTRADA_EMAIL_QUEUE === 'true' ||
    process.env.ENABLE_TRIGGER_EMAIL_RECHAZO_ENTRADA === 'true'
  const collection = (
    process.env.MAIL_QUEUE_COLLECTION ||
    process.env.TRIGGER_EMAIL_COLLECTION ||
    'mail'
  ).trim() || 'mail'
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
    // Fallback: apunta al archivo del proyecto frontend si está publicado en el mismo dominio.
    // Recomendado: definir MAIL_LOGO_URL con una URL pública estable (Firebase Hosting/Storage/CDN).
    (publicAppUrl ? `${publicAppUrl.replace(/\/$/, '')}/src/assets/logo-molina.png` : '')
  return { enabled, collection, fromDisplayName, fromEmail, logoUrl }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function emailPlausible(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function nombreCompleto(data: PostulanteRechazadoEntrada): string {
  return [data.nombres, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' ').trim()
}

function buildSubject(): string {
  return 'Resultado de su postulación - Beca Municipal de Molina 2026'
}

/** Detalle adicional si aporta algo distinto al motivo principal. */
function detalleRechazo(registro: PostulanteRechazadoEntrada): string | null {
  const msg = String(registro.rejectionMessage || '').trim()
  const label = String(registro.rejectionLabel || '').trim()
  if (!msg || msg === label) return null
  return msg
}

function buildPlainText(registro: PostulanteRechazadoEntrada): string {
  const nombre = nombreCompleto(registro) || 'Estimado/a postulante'
  const detalle = detalleRechazo(registro)
  const lines = [
    `Estimado/a ${nombre},`,
    '',
    'Junto con saludar, la Dirección de Desarrollo Comunitario (DIDECO) de la Ilustre Municipalidad de Molina informa el resultado de la revisión de su postulación a la Beca Municipal 2026.',
    '',
    'De acuerdo con los antecedentes ingresados y conforme a las bases vigentes del proceso, su postulación no ha sido admitida en esta etapa por el siguiente motivo:',
    '',
    `- ${registro.rejectionLabel}`,
    '',
  ]
  if (detalle) {
    lines.push(`Detalle: ${detalle}`, '')
  }
  lines.push(
    'Si requiere orientación sobre el proceso o actualización de antecedentes para futuras convocatorias, puede acercarse a la Dirección de Desarrollo Comunitario (DIDECO) de Molina.',
    '',
    'Atentamente,',
    'Dirección de Desarrollo Comunitario (DIDECO)',
    'Ilustre Municipalidad de Molina',
    '',
    'Este mensaje es informativo y fue emitido de forma automática. Por favor, no responder directamente a este correo.',
  )
  return lines.join('\n')
}

function buildHtml(registro: PostulanteRechazadoEntrada, logoUrl: string): string {
  const nombre = escapeHtml(nombreCompleto(registro) || 'postulante')
  const motivo = escapeHtml(registro.rejectionLabel)
  const detalle = detalleRechazo(registro)
  const detalleHtml = detalle
    ? `<p style="margin:0 0 12px 0;"><strong>Detalle:</strong> ${escapeHtml(detalle).replace(/\n/g, '<br/>')}</p>`
    : ''
  const logoHtml = logoUrl
    ? `<div style="margin:16px 0 0 0;padding-top:14px;border-top:1px solid #e5e7eb;"><img src="${escapeHtml(logoUrl)}" alt="Municipalidad de Molina" style="max-width:140px;width:100%;height:auto;display:block;" /></div>`
    : ''
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:28px 36px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55;">',
    '<h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.25;color:#1e3a8a;">Resultado de postulación - Beca Municipal de Molina 2026</h1>',
    '<div style="height:3px;background:#dbeafe;margin:0 0 22px 0;"></div>',
    `<p style="margin:0 0 12px 0;">Estimado/a <strong>${nombre}</strong>:</p>`,
    '<p style="margin:0 0 12px 0;">Junto con saludar, la <strong>Dirección de Desarrollo Comunitario (DIDECO)</strong> de la Ilustre Municipalidad de Molina informa el resultado de la revisión de su postulación a la Beca Municipal 2026.</p>',
    '<p style="margin:0 0 16px 0;">Conforme a los antecedentes ingresados y a las bases vigentes del proceso, su postulación no ha sido admitida en esta etapa por el siguiente motivo:</p>',
    `<div style="margin:0 0 16px 0;padding:14px 16px;background:#f8fafc;border:1px solid #dbeafe;border-left:5px solid #1d4ed8;font-size:15px;"><strong>${motivo}</strong></div>`,
    detalleHtml,
    '<p style="margin:0 0 12px 0;">Si requiere orientación sobre el proceso o actualización de antecedentes para futuras convocatorias, puede acercarse a la DIDECO de Molina.</p>',
    '<p style="margin:20px 0 0 0;">Atentamente,<br/><strong>Dirección de Desarrollo Comunitario (DIDECO)</strong><br/>Ilustre Municipalidad de Molina</p>',
    '<p style="margin:22px 0 0 0;font-size:12px;color:#64748b;">Este mensaje es informativo y fue emitido de forma automática. Por favor, no responder directamente a este correo.</p>',
    logoHtml,
    '</body></html>',
  ].join('')
}

/**
 * Crea un documento en la colección de cola de correo (si está habilitado por env).
 * No lanza: los fallos se registran en consola para no afectar el registro del rechazo.
 */
export async function enqueueRechazoEntradaMail(
  db: admin.firestore.Firestore,
  registro: PostulanteRechazadoEntrada,
): Promise<void> {
  const cfg = getRechazoEntradaMailQueueConfig()
  if (!cfg.enabled) {
    return
  }

  const to = String(registro.email || '')
    .trim()
    .toLowerCase()
  if (!emailPlausible(to)) {
    console.error(
      'enqueueRechazoEntradaMail: email inválido o vacío, se omite cola (RUT normalizado:',
      registro.rutNormalizado,
      ')',
    )
    return
  }

  const subject = buildSubject()
  const text = buildPlainText(registro)
  const html = buildHtml(registro, cfg.logoUrl)

  const payload: Record<string, unknown> = {
    to: [to],
    message: {
      subject,
      text,
      html,
    },
    rechazoEntradaRutNormalizado: registro.rutNormalizado,
    rechazoEntradaCreatedAt: registro.createdAt,
  }

  if (cfg.fromEmail && emailPlausible(cfg.fromEmail)) {
    const safeName = cfg.fromDisplayName.replace(/[\r\n<>"\\]/g, ' ').trim()
    payload.from = safeName ? `${safeName} <${cfg.fromEmail}>` : cfg.fromEmail
  }

  try {
    const ref = await db.collection(cfg.collection).add(payload)
    const now = new Date().toISOString()
    await db
      .collection('postulantes_rechazados_entrada')
      .doc(registro.rutNormalizado)
      .set(
        {
          emailNotificacionEncoladaAt: now,
          emailNotificacionColaDocId: ref.id,
          emailNotificacionColaEstado: 'encolado',
        },
        { merge: true },
      )
  } catch (e) {
    console.error('enqueueRechazoEntradaMail:', e)
  }
}
