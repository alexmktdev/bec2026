import { z } from 'zod'

export const ObservacionesSchema = z.object({
  observaciones: z.string().max(1000, 'Las observaciones no pueden exceder los 1000 caracteres').optional(),
})

export type ObservacionesData = z.infer<typeof ObservacionesSchema>
