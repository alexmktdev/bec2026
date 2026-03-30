/**
 * Encola correo de confirmación cuando la postulación se registra correctamente (pasó filtros de entrada).
 * Misma cola y envío que rechazo de entrada: processMailQueue + Nodemailer + SMTP.
 *
 * Activación: `ENABLE_POSTULACION_EXITOSA_EMAIL_QUEUE` (env o parámetro Firebase; por defecto `true`
 * para no depender de copiar `functions/.env` en cada deploy). Desactivar con `false` en consola o .env.
 */
import * as admin from 'firebase-admin'
import { defineString } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'

import type { PostulanteData } from '../../src/types/postulante'
import {
  buildMailFromHeader,
  emailPlausible,
  escapeHtml,
  getMailQueueBranding,
  logoFooterHtmlBlock,
  mailDisclaimerParagraph,
} from './mailQueueShared'

const enablePostulacionExitosaQueueParam = defineString('ENABLE_POSTULACION_EXITOSA_EMAIL_QUEUE', {
  default: 'true',
})

export function isPostulacionExitosaEmailEnabled(): boolean {
  const env = process.env.ENABLE_POSTULACION_EXITOSA_EMAIL_QUEUE
  if (env === 'false') return false
  if (env === 'true') return true
  const envAlt = process.env.ENABLE_POSTULACION_EXITOSA_EMAIL
  if (envAlt === 'false') return false
  if (envAlt === 'true') return true
  return enablePostulacionExitosaQueueParam.value() === 'true'
}

function nombreCompleto(data: PostulanteData): string {
  return [data.nombres, data.apellidoPaterno, data.apellidoMaterno].filter(Boolean).join(' ').trim()
}

function buildSubject(): string {
  return 'Postulación recibida correctamente - Beca Municipal de Molina 2026'
}

function buildPlainText(data: PostulanteData): string {
  const nombre = nombreCompleto(data) || 'Estimado/a postulante'
  const contacto = [data.telefono && `teléfono ${data.telefono}`, data.email && `correo ${data.email}`]
    .filter(Boolean)
    .join(' y ')
  return [
    `Estimado/a ${nombre},`,
    '',
    'Junto con saludar, la Dirección de Desarrollo Comunitario (DIDECO) de la Ilustre Municipalidad de Molina informa que su postulación a la Beca Municipal 2026 ha sido registrada de forma exitosa.',
    '',
    'Hemos recibido y registrado sus antecedentes en el sistema. A partir de este momento, le solicitamos mantenerse atento/a a futuras comunicaciones relativas al proceso.',
    '',
    contacto
      ? `En caso de resultar seleccionado/a para el beneficio de la beca, nos contactaremos a través de los canales que usted informó (${contacto}), conforme a las bases del proceso.`
      : 'En caso de resultar seleccionado/a para el beneficio de la beca, nos pondremos en contacto conforme a las bases del proceso.',
    '',
    'Si requiere orientación, puede acercarse a la DIDECO de Molina.',
    '',
    'Atentamente,',
    'Dirección de Desarrollo Comunitario (DIDECO)',
    'Ilustre Municipalidad de Molina',
    '',
    'Este mensaje es informativo y fue emitido de forma automática. Por favor, no responder directamente a este correo.',
  ].join('\n')
}

function buildHtml(data: PostulanteData, logoUrl: string): string {
  const nombre = escapeHtml(nombreCompleto(data) || 'postulante')
  const contactoParts: string[] = []
  if (data.telefono?.trim()) {
    contactoParts.push(`teléfono <strong>${escapeHtml(data.telefono.trim())}</strong>`)
  }
  if (data.email?.trim()) {
    contactoParts.push(`correo electrónico <strong>${escapeHtml(data.email.trim().toLowerCase())}</strong>`)
  }
  const contactoHtml =
    contactoParts.length > 0
      ? `<p style="margin:0 0 12px 0;">En caso de resultar seleccionado/a para el beneficio de la beca, nos contactaremos a través de los canales que usted informó (${contactoParts.join(' y ')}), conforme a las bases del proceso.</p>`
      : '<p style="margin:0 0 12px 0;">En caso de resultar seleccionado/a para el beneficio de la beca, nos pondremos en contacto conforme a las bases del proceso.</p>'

  return [
    '<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:28px 36px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;line-height:1.55;">',
    '<h1 style="margin:0 0 18px 0;font-size:24px;line-height:1.25;color:#1e3a8a;">Postulación recibida - Beca Municipal de Molina 2026</h1>',
    '<div style="height:3px;background:#dbeafe;margin:0 0 22px 0;"></div>',
    `<p style="margin:0 0 12px 0;">Estimado/a <strong>${nombre}</strong>:</p>`,
    '<p style="margin:0 0 12px 0;">Junto con saludar, la <strong>Dirección de Desarrollo Comunitario (DIDECO)</strong> de la Ilustre Municipalidad de Molina informa que su <strong>postulación a la Beca Municipal 2026 ha sido registrada de forma exitosa</strong>.</p>',
    '<p style="margin:0 0 12px 0;">Hemos recibido y registrado sus antecedentes en el sistema. A partir de este momento, le solicitamos mantenerse atento/a a futuras comunicaciones relativas al proceso.</p>',
    '<div style="margin:0 0 16px 0;padding:14px 16px;background:#ecfdf5;border:1px solid #a7f3d0;border-left:5px solid #059669;font-size:15px;">Su postulación consta como <strong>recibida</strong> y será evaluada según las bases vigentes.</div>',
    contactoHtml,
    '<p style="margin:0 0 12px 0;">Si requiere orientación, puede acercarse a la <strong>DIDECO</strong> de Molina.</p>',
    '<p style="margin:20px 0 0 0;">Atentamente,<br/><strong>Dirección de Desarrollo Comunitario (DIDECO)</strong><br/>Ilustre Municipalidad de Molina</p>',
    mailDisclaimerParagraph(),
    logoFooterHtmlBlock(logoUrl),
    '</body></html>',
  ].join('')
}

/**
 * Encola el correo y marca metadatos en el documento del postulante (merge). No lanza si falla el correo.
 */
export async function enqueuePostulacionExitosaMail(
  db: admin.firestore.Firestore,
  data: PostulanteData,
  rutNormalizado: string,
): Promise<void> {
  if (!isPostulacionExitosaEmailEnabled()) {
    logger.warn('enqueuePostulacionExitosaMail omitido: deshabilitado por ENABLE_POSTULACION_EXITOSA_EMAIL_QUEUE', {
      rutNormalizado,
    })
    return
  }

  const branding = getMailQueueBranding()
  const to = String(data.email || '')
    .trim()
    .toLowerCase()
  if (!emailPlausible(to)) {
    logger.error('enqueuePostulacionExitosaMail: email inválido o vacío, no se encola', {
      rutNormalizado,
      emailPresente: Boolean(data.email?.trim()),
    })
    return
  }

  const subject = buildSubject()
  const text = buildPlainText(data)
  const html = buildHtml(data, branding.logoUrl)

  const payload: Record<string, unknown> = {
    to: [to],
    message: {
      subject,
      text,
      html,
    },
    postulacionExitosaRutNormalizado: rutNormalizado,
    postulacionExitosaTipo: 'crearPostulacion',
  }

  const fromHeader = buildMailFromHeader(branding.fromDisplayName, branding.fromEmail)
  if (fromHeader) {
    payload.from = fromHeader
  }

  try {
    const ref = await db.collection(branding.collection).add(payload)
    const now = new Date().toISOString()
    await db.collection('postulantes').doc(rutNormalizado).set(
      {
        emailPostulacionExitosaEncoladaAt: now,
        emailPostulacionExitosaColaDocId: ref.id,
        emailPostulacionExitosaColaEstado: 'encolado',
      },
      { merge: true },
    )
    logger.info('enqueuePostulacionExitosaMail: documento encolado en mail', {
      rutNormalizado,
      mailDocId: ref.id,
      collection: branding.collection,
    })
  } catch (e) {
    logger.error('enqueuePostulacionExitosaMail: error al encolar', { rutNormalizado, error: e })
  }
}
