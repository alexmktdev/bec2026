/**
 * Schemas Zod para validar el payload de la Cloud Function crearPostulacion.
 * Compartido entre frontend y backend para mantener consistencia.
 */
import { z } from 'zod'
import { validarRutMatematico } from './rut'
import { refinarCuentaBancaria } from './cuentaBancariaSchema'

/** Schema para los datos del postulante (formulario completo). */
export const PostulanteDataSchema = z.object({
  nombres: z.string().min(1, 'Nombres es obligatorio'),
  apellidoPaterno: z.string().min(1, 'Apellido paterno es obligatorio'),
  apellidoMaterno: z.string().min(1, 'Apellido materno es obligatorio'),
  rut: z.string().min(9, 'RUT inválido').refine(validarRutMatematico, 'Dígito verificador de RUT incorrecto'),
  fechaNacimiento: z.string().min(1, 'Fecha de nacimiento es obligatoria'),
  edad: z.string().min(1, 'Edad es obligatoria'),
  sexo: z.string().min(1, 'Sexo es obligatorio'),
  estadoCivil: z.string().min(1, 'Estado civil es obligatorio'),
  telefono: z.string().min(1, 'Teléfono es obligatorio'),
  email: z.string().email('Email inválido'),
  domicilioFamiliar: z.string().min(1, 'Domicilio es obligatorio'),
  fechaPostulacion: z.string().min(1),
  horaPostulacion: z.string().min(1),

  nem: z.string().min(1, 'NEM es obligatorio'),
  nombreInstitucion: z.string().min(1, 'Institución es obligatoria'),
  comuna: z.string().min(1, 'Comuna es obligatoria'),
  carrera: z.string().min(1, 'Carrera es obligatoria'),
  duracionSemestres: z.string().min(1, 'Duración es obligatoria'),
  anoIngreso: z.string().min(1, 'Matrícula en curso es obligatoria'),

  totalIntegrantes: z.string().min(1, 'Total de integrantes es obligatorio'),
  tramoRegistroSocial: z.string().min(1, 'Tramo RSH es obligatorio'),
  tieneHermanosOHijosEstudiando: z.string().min(1),
  tieneUnHermanOHijoEstudiando: z.string(),
  tieneDosOMasHermanosOHijosEstudiando: z.string(),
  enfermedadCatastrofica: z.string().min(1),
  enfermedadCronica: z.string().min(1),

  tipoCuentaBancaria: z.enum(['cuenta_rut', 'otra']),
  numeroCuenta: z.string(),
  rutCuenta: z.string(),
  otraNumeroCuenta: z.string(),
  otraTipoCuenta: z.string(),
  otraBanco: z.string(),
  otraBancoDetalle: z.string(),
  otraRutTitular: z.string(),

  observacion: z.string(),

  declaracionJuradaAceptada: z.literal(true, {
    message: 'Debe aceptar la declaración jurada',
  }),
}).superRefine(refinarCuentaBancaria)

/** Schema para los booleanos de documentos subidos. */
export const DocumentosSubidosSchema = z.object({
  identidad: z.boolean(),
  matricula: z.boolean(),
  rsh: z.boolean(),
  nem: z.boolean(),
  hermanos: z.boolean().optional(),
  medico: z.boolean().optional(),
})

/** Schema para las rutas de Storage (paths, no URLs). */
export const DocumentPathsSchema = z.record(
  z.string(),
  z.string().min(1).startsWith('postulaciones/', {
    message: 'Ruta de documento debe comenzar con postulaciones/',
  }),
)

/** Schema completo del payload de crearPostulacion. */
export const CrearPostulacionPayloadSchema = z.object({
  data: PostulanteDataSchema,
  documentosSubidos: DocumentosSubidosSchema,
  documentPaths: DocumentPathsSchema,
})

export type CrearPostulacionPayload = z.infer<typeof CrearPostulacionPayloadSchema>
