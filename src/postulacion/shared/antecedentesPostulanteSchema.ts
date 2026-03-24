import { z } from 'zod'
import { validarRutMatematico } from './rut'

export const AntecedentesPostulanteSchema = z.object({
  nombres: z.string().min(2, 'El nombre es muy corto').max(100, 'El nombre es muy largo'),
  apellidoPaterno: z.string().min(2, 'El apellido es muy corto').max(100, 'El apellido es muy largo'),
  apellidoMaterno: z.string().min(2, 'El apellido es muy corto').max(100, 'El apellido es muy largo'),
  rut: z.string()
    .regex(/^\d{1,2}\.\d{3}\.\d{3}-[\dkK]$/, 'Formato de RUT inválido (ej: 12.345.678-9)')
    .refine(validarRutMatematico, 'El RUT ingresado no es válido (dígito verificador incorrecto)'),
  fechaNacimiento: z.string().refine((val) => {
    const date = new Date(val)
    return !isNaN(date.getTime()) && date.getFullYear() < new Date().getFullYear()
  }, 'Fecha de nacimiento inválida'),
  sexo: z.string().refine((val) => ['Masculino', 'Femenino', 'Otro'].includes(val), 'Seleccione una opción válida'),
  estadoCivil: z.string().refine((val) => ['Soltero/a', 'Casado/a', 'Divorciado/a', 'Viudo/a'].includes(val), 'Seleccione una opción válida'),
  telefono: z.string().regex(/^\+56\d{9}$/, 'Teléfono inválido (ej: +56912345678)'),
  email: z.string().email('Correo electrónico inválido'),
  domicilioFamiliar: z.string().min(5, 'El domicilio es muy corto').max(200, 'El domicilio es muy largo'),
  edad: z.string().min(1, 'La edad es requerida'),
  fechaPostulacion: z.string(),
  horaPostulacion: z.string(),
})

export type AntecedentesPostulanteData = z.infer<typeof AntecedentesPostulanteSchema>
