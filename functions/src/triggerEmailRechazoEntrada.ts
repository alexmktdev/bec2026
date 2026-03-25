/**
 * Encola correos para la extensión oficial "Trigger Email" (firestore-send-email).
 * Solo Admin SDK escribe en la colección configurada; el envío real depende de SMTP en la extensión.
 *
 * @see https://firebase.google.com/docs/extensions/official/firestore-send-email
 */
import * as admin from 'firebase-admin'

import type { PostulanteRechazadoEntrada } from '../../src/types/postulante'

export interface TriggerEmailRechazoEntradaConfig {
  enabled: boolean
  collection: string
  /** Nombre mostrado si se define remitente explícito (opcional). */
  fromDisplayName: string
  /** Si está vacío, la extensión usa el "Default FROM" de su configuración. */
  fromEmail: string
}

export function getTriggerEmailRechazoEntradaConfig(): TriggerEmailRechazoEntradaConfig {
  const enabled = process.env.ENABLE_TRIGGER_EMAIL_RECHAZO_ENTRADA === 'true'
  const collection = (process.env.TRIGGER_EMAIL_COLLECTION || 'mail').trim() || 'mail'
  const fromDisplayName = (
    process.env.TRIGGER_EMAIL_FROM_NAME || 'Beca Municipal de Molina 2026'
  ).trim()
  const fromEmail = (process.env.TRIGGER_EMAIL_FROM_EMAIL || '').trim()
  return { enabled, collection, fromDisplayName, fromEmail }
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
  return 'Notificación de rechazo — Beca Municipal de Molina 2026'
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
    'La Ilustre Municipalidad de Molina se comunica con usted en el marco del proceso de postulación a la Beca Municipal 2026.',
    '',
    'En base a su postulación y a lo establecido en las bases del proceso, le informamos que esta ha sido rechazada por el siguiente motivo:',
    '',
    registro.rejectionLabel,
    '',
  ]
  if (detalle) {
    lines.push(detalle, '')
  }
  lines.push(
    'Saludos cordiales.',
    '',
    'Este mensaje fue generado automáticamente. Por favor no responda a este correo.',
  )
  return lines.join('\n')
}

function buildHtml(registro: PostulanteRechazadoEntrada): string {
  const nombre = escapeHtml(nombreCompleto(registro) || 'postulante')
  const motivo = escapeHtml(registro.rejectionLabel)
  const detalle = detalleRechazo(registro)
  const detalleHtml = detalle
    ? `<p>${escapeHtml(detalle).replace(/\n/g, '<br/>')}</p>`
    : ''
  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:system-ui,sans-serif;line-height:1.55;color:#1e293b;max-width:36rem;">',
    `<p>Estimado/a ${nombre},</p>`,
    '<p>La <strong>Ilustre Municipalidad de Molina</strong> se comunica con usted en el marco del proceso de postulación a la <strong>Beca Municipal 2026</strong>.</p>',
    '<p>En base a su postulación y a lo establecido en las bases del proceso, le informamos que esta ha sido <strong>rechazada</strong> por el siguiente motivo:</p>',
    `<p style="margin:1rem 0;padding:0.75rem 1rem;background:#f1f5f9;border-left:4px solid #64748b;"><strong>${motivo}</strong></p>`,
    detalleHtml,
    '<p>Saludos cordiales.</p>',
    '<p style="font-size:0.8125rem;color:#64748b;margin-top:1.5rem;">Este mensaje fue generado automáticamente. Por favor no responda a este correo.</p>',
    '</body></html>',
  ].join('')
}

/**
 * Crea un documento en la colección de la extensión Trigger Email (si está habilitado por env).
 * No lanza: los fallos se registran en consola para no afectar el registro del rechazo.
 */
export async function enqueueRechazoEntradaEmail(
  db: admin.firestore.Firestore,
  registro: PostulanteRechazadoEntrada,
): Promise<void> {
  const cfg = getTriggerEmailRechazoEntradaConfig()
  if (!cfg.enabled) {
    return
  }

  const to = String(registro.email || '')
    .trim()
    .toLowerCase()
  if (!emailPlausible(to)) {
    console.error(
      'enqueueRechazoEntradaEmail: email inválido o vacío, se omite cola (RUT normalizado:',
      registro.rutNormalizado,
      ')',
    )
    return
  }

  const subject = buildSubject()
  const text = buildPlainText(registro)
  const html = buildHtml(registro)

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
    console.error('enqueueRechazoEntradaEmail:', e)
  }
}
