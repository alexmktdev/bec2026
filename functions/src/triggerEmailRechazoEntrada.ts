/**
 * Encola correos en Firestore para ser procesados por la Cloud Function propia `processMailQueue`.
 * Solo Admin SDK escribe en la colección configurada.
 */
import * as admin from 'firebase-admin'

import type { PostulanteRechazadoEntrada } from '../../src/types/postulante'
import {
  buildMailFromHeader,
  emailPlausible,
  escapeHtml,
  getMailQueueBranding,
  logoFooterHtmlBlock,
  mailDisclaimerParagraph,
} from './mailQueueShared'

export interface RechazoEntradaMailQueueConfig {
  enabled: boolean
  collection: string
  fromDisplayName: string
  fromEmail: string
  logoUrl: string
}

export function getRechazoEntradaMailQueueConfig(): RechazoEntradaMailQueueConfig {
  const enabled =
    process.env.ENABLE_RECHAZO_ENTRADA_EMAIL_QUEUE === 'true' ||
    process.env.ENABLE_TRIGGER_EMAIL_RECHAZO_ENTRADA === 'true'
  const branding = getMailQueueBranding()
  return { enabled, ...branding }
}

function nombreCompleto(data: PostulanteRechazadoEntrada): string {
  return [data.nombres, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' ').trim()
}

function buildSubject(): string {
  return 'Resultado de su postulación - Beca Municipal de Molina 2026'
}

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
    mailDisclaimerParagraph(),
    logoFooterHtmlBlock(logoUrl),
    '</body></html>',
  ].join('')
}

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

  const fromHeader = buildMailFromHeader(cfg.fromDisplayName, cfg.fromEmail)
  if (fromHeader) {
    payload.from = fromHeader
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
