import { z } from 'zod'

export const AntecedentesAcademicosSchema = z.object({
  nem: z.string().refine((val) => {
    const n = parseFloat(val)
    return !isNaN(n) && n >= 4.0 && n <= 7.0
  }, 'El NEM debe ser entre 4.0 y 7.0'),
  nombreInstitucion: z.string().min(3, 'Nombre de institución inválido'),
  comuna: z.string().min(3, 'Nombre de comuna inválido'),
  carrera: z.string().min(3, 'Nombre de carrera inválido'),
  duracionSemestres: z.string().refine((val) => {
    const n = parseInt(val)
    return !isNaN(n) && n > 0 && n <= 20
  }, 'Duración inválida'),
  anoIngreso: z.string().refine((val) => {
    const n = parseInt(val)
    const currentYear = new Date().getFullYear()
    return !isNaN(n) && n > 1900 && n <= currentYear
  }, 'Año de ingreso inválido'),
})

export type AntecedentesAcademicosData = z.infer<typeof AntecedentesAcademicosSchema>
