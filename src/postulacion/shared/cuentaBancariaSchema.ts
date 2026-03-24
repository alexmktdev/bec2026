import { z } from 'zod'
import { validarRutMatematico } from './rut'

export const CuentaBancariaSchema = z.object({
  numeroCuenta: z.string()
    .min(7, 'El número de cuenta es muy corto')
    .max(9, 'El número de cuenta es muy largo')
    .regex(/^\d+$/, 'Solo se permiten números'),
  rutCuenta: z.string()
    .regex(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/, 'Formato de RUT inválido (ej: 12.345.678-9)')
    .refine(validarRutMatematico, 'El RUT ingresado no es válido (dígito verificador incorrecto)'),
})

export type CuentaBancariaData = z.infer<typeof CuentaBancariaSchema>
