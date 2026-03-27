import * as admin from 'firebase-admin'
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { defineSecret } from 'firebase-functions/params'
import * as logger from 'firebase-functions/logger'
import nodemailer from 'nodemailer'

const SMTP_HOST = defineSecret('SMTP_HOST')
const SMTP_PORT = defineSecret('SMTP_PORT')
const SMTP_USER = defineSecret('SMTP_USER')
const SMTP_PASS = defineSecret('SMTP_PASS')

type MailMessage = {
  subject?: unknown
  text?: unknown
  html?: unknown
}

type MailDocData = {
  to?: unknown
  from?: unknown
  message?: MailMessage
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeRecipients(input: unknown): string[] {
  if (typeof input === 'string') {
    const single = input.trim().toLowerCase()
    return single ? [single] : []
  }
  if (Array.isArray(input)) {
    return input
      .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
      .filter((v) => v.length > 0)
  }
  return []
}

function fallbackFromAddress(): string {
  return asString(process.env.SMTP_FROM_EMAIL) || asString(process.env.SMTP_USER)
}

function parsePort(raw: string): number {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 465
}

export const processMailQueue = onDocumentCreated(
  {
    document: 'mail/{mailId}',
    timeoutSeconds: 60,
    memory: '256MiB',
    maxInstances: 10,
    secrets: [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS],
  },
  async (event) => {
    const snapshot = event.data
    if (!snapshot) return

    const mailId = event.params.mailId
    const raw = (snapshot.data() || {}) as MailDocData
    const to = normalizeRecipients(raw.to)
    const message = raw.message || {}
    const subject = asString(message.subject)
    const text = asString(message.text)
    const html = asString(message.html)
    const from = asString(raw.from) || fallbackFromAddress()

    if (!to.length || !subject || (!text && !html)) {
      logger.error('mail queue payload invalid', { mailId, toCount: to.length, subjectPresent: !!subject })
      await snapshot.ref.set(
        {
          delivery: {
            state: 'ERROR',
            error: 'INVALID_MAIL_PAYLOAD',
            attemptedAt: new Date().toISOString(),
          },
        },
        { merge: true },
      )
      return
    }

    const host = SMTP_HOST.value()
    const port = parsePort(SMTP_PORT.value())
    const user = SMTP_USER.value()
    const pass = SMTP_PASS.value()
    // 465 = TLS implícito; 587 = STARTTLS (secure false + upgrade)
    const secure = port === 465
    const requireTLS = port === 587

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      requireTLS,
      auth: { user, pass },
    })

    try {
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text: text || undefined,
        html: html || undefined,
      })

      logger.info('mail delivered', { mailId, toCount: to.length, messageId: info.messageId })
      await snapshot.ref.set(
        {
          delivery: {
            state: 'SUCCESS',
            attemptedAt: new Date().toISOString(),
            messageId: info.messageId || '',
          },
        },
        { merge: true },
      )
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error)
      logger.error('mail delivery error', { mailId, error: err })
      await snapshot.ref.set(
        {
          delivery: {
            state: 'ERROR',
            error: err,
            attemptedAt: new Date().toISOString(),
          },
        },
        { merge: true },
      )
    }
  },
)
