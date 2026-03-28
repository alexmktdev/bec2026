import { z } from 'zod'
import { validarRutMatematico } from './rut'

const RUT_CUENTA_REGEX = /^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/

export const cuentaRutNumeroSchema = z
  .string()
  .min(7, 'El número de cuenta es muy corto')
  .max(9, 'El número de cuenta es muy largo')
  .regex(/^\d+$/, 'Solo se permiten números')

export const cuentaRutTitularSchema = z
  .string()
  .regex(RUT_CUENTA_REGEX, 'Formato de RUT inválido (ej: 12.345.678-9)')
  .refine(validarRutMatematico, 'El RUT ingresado no es válido (dígito verificador incorrecto)')

export type CuentaBancariaFormShape = {
  tipoCuentaBancaria: 'cuenta_rut' | 'otra'
  numeroCuenta: string
  rutCuenta: string
  otraNumeroCuenta: string
  otraTipoCuenta: string
  otraBanco: string
  otraBancoDetalle: string
  otraRutTitular: string
}

/** Validación compartida formulario público y payload Zod (crearPostulacion). */
export function refinarCuentaBancaria(data: CuentaBancariaFormShape, ctx: z.RefinementCtx): void {
  if (data.tipoCuentaBancaria === 'cuenta_rut') {
    const n = cuentaRutNumeroSchema.safeParse(data.numeroCuenta.trim())
    if (!n.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['numeroCuenta'],
        message: n.error.issues[0]?.message ?? 'Número de cuenta inválido',
      })
    }
    const r = cuentaRutTitularSchema.safeParse(data.rutCuenta.trim())
    if (!r.success) {
      ctx.addIssue({
        code: 'custom',
        path: ['rutCuenta'],
        message: r.error.issues[0]?.message ?? 'RUT inválido',
      })
    }
    return
  }

  const num = data.otraNumeroCuenta.trim()
  if (num.length < 4 || num.length > 34) {
    ctx.addIssue({
      code: 'custom',
      path: ['otraNumeroCuenta'],
      message: 'Indique un número de cuenta válido (4–34 caracteres).',
    })
  } else if (!/^[a-zA-Z0-9\-.\s]+$/.test(num)) {
    ctx.addIssue({
      code: 'custom',
      path: ['otraNumeroCuenta'],
      message: 'Use solo letras, números, espacios, guiones o puntos.',
    })
  }

  const tipo = data.otraTipoCuenta.trim()
  if (tipo.length < 2) {
    ctx.addIssue({ code: 'custom', path: ['otraTipoCuenta'], message: 'Indique el tipo de cuenta.' })
  }

  const banco = data.otraBanco.trim()
  if (banco.length < 3) {
    ctx.addIssue({
      code: 'custom',
      path: ['otraBanco'],
      message: 'Indique el nombre del banco (mín. 3 caracteres).',
    })
  }

  const rut = data.otraRutTitular.trim()
  if (!RUT_CUENTA_REGEX.test(rut) || !validarRutMatematico(rut)) {
    ctx.addIssue({
      code: 'custom',
      path: ['otraRutTitular'],
      message: 'Formato de RUT del titular inválido.',
    })
  }
}

export const CuentaBancariaSchema = z
  .object({
    tipoCuentaBancaria: z.enum(['cuenta_rut', 'otra']),
    numeroCuenta: z.string(),
    rutCuenta: z.string(),
    otraNumeroCuenta: z.string(),
    otraTipoCuenta: z.string(),
    otraBanco: z.string(),
    otraBancoDetalle: z.string(),
    otraRutTitular: z.string(),
  })
  .superRefine(refinarCuentaBancaria)

export type CuentaBancariaData = z.infer<typeof CuentaBancariaSchema>

/** Texto del banco para mostrar en admin/export (compat. registros antiguos con "Otro" + detalle). */
export function etiquetaBancoOtra(data: Pick<CuentaBancariaFormShape, 'otraBanco' | 'otraBancoDetalle'>): string {
  const b = data.otraBanco.trim()
  const det = data.otraBancoDetalle.trim()
  if (b === 'Otro' && det) return det
  return b || det || '—'
}
