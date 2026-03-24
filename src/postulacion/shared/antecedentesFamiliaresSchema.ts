import { z } from 'zod'

const siNo = z.string().refine((val) => ['Si', 'No'].includes(val), 'Seleccione una opción')
const siNoNA = z.string().refine((val) => ['Si', 'No', 'N/A'].includes(val), 'Seleccione una opción')

export const AntecedentesFamiliaresSchema = z.object({
  totalIntegrantes: z.string().refine((val) => {
    const n = parseInt(val)
    return !isNaN(n) && n > 0 && n <= 20
  }, 'Número de integrantes inválido'),
  tramoRegistroSocial: z.string().refine((val) => {
    return ['40%', '50%', '60%', '70%'].includes(val)
  }, 'Seleccione un tramo válido'),
  tieneHermanosOHijosEstudiando: siNo,
  tieneUnHermanOHijoEstudiando: siNoNA,
  tieneDosOMasHermanosOHijosEstudiando: siNoNA,
  enfermedadCatastrofica: siNo,
  enfermedadCronica: siNo,
})

export type AntecedentesFamiliaresData = z.infer<typeof AntecedentesFamiliaresSchema>
