export type EstadoPostulacion = 'pendiente' | 'en_revision' | 'documentacion_validada' | 'aprobado' | 'rechazado'

export interface PuntajeDesglosado {
  nem: number
  rsh: number
  enfermedad: number
  hermanos: number
  total: number
}

export interface PostulanteData {
  // Paso 1 - Datos personales
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  rut: string
  fechaNacimiento: string
  edad: string
  sexo: string
  estadoCivil: string
  telefono: string
  email: string
  domicilioFamiliar: string
  fechaPostulacion: string
  horaPostulacion: string

  // Paso 2 - Academicos
  nem: string
  nombreInstitucion: string
  comuna: string
  carrera: string
  duracionSemestres: string
  /** Año de matrícula en curso (debe ser 2026 para aprobar por este criterio). */
  anoIngreso: string

  // Paso 3 - Familiares
  totalIntegrantes: string
  tramoRegistroSocial: string
  tieneHermanosOHijosEstudiando: string
  tieneUnHermanOHijoEstudiando: string
  tieneDosOMasHermanosOHijosEstudiando: string
  enfermedadCatastrofica: string
  enfermedadCronica: string

  // Paso 4 - Cuenta bancaria (Cuenta RUT u otra cuenta; una sola vía válida)
  tipoCuentaBancaria: 'cuenta_rut' | 'otra'
  numeroCuenta: string
  rutCuenta: string
  otraNumeroCuenta: string
  otraTipoCuenta: string
  otraBanco: string
  /** Si otraBanco es "Otro", nombre del banco indicado por el postulante. */
  otraBancoDetalle: string
  otraRutTitular: string

  /** Legado: ya no hay paso de observaciones en el formulario; se mantiene para datos históricos. */
  observacion: string

  // Paso 7 - Declaracion jurada
  declaracionJuradaAceptada: boolean
}

export interface DocumentosSubidos {
  identidad: boolean
  matricula: boolean
  rsh: boolean
  nem: boolean
  hermanos?: boolean
  medico?: boolean
}

export interface PostulanteFirestore extends PostulanteData {
  id?: string
  assignedTo?: string
  /** Posición global en la tabla de Revisión de documentación (1-based). */
  ordenRevisionDoc?: number
  puntaje: PuntajeDesglosado
  estado: EstadoPostulacion
  motivoRechazo: string | null
  documentosSubidos: DocumentosSubidos
  documentUrls: Record<string, string>
  /** Documentos validados por el revisor (por docId) */
  documentosValidados?: Record<string, boolean>
  createdAt: string
  updatedAt: string
  /** Metadatos al encolar correo SMTP de postulación exitosa (Cloud Function). */
  emailPostulacionExitosaEncoladaAt?: string
  emailPostulacionExitosaColaDocId?: string
  emailPostulacionExitosaColaEstado?: 'encolado'
}

export interface UserRole {
  email: string
  displayName: string
  role: 'superadmin' | 'revisor' | 'admin'
}

export interface TramoAsignacion {
  /** Clave estable del segmento (varios por mismo revisor permitidos). */
  segmentId: string
  reviewerUid: string
  reviewerEmail: string
  reviewerName: string
  startRange: number
  endRange: number
  assignedByUid: string
  assignedByEmail: string
  createdAt: string
}

export interface TramoVigenteEstado extends TramoAsignacion {
  totalAsignados: number
  /** Postulantes con documentación validada dentro del tramo. */
  totalValidados: number
  /** Postulantes rechazados dentro del tramo. */
  totalRechazados: number
  totalTerminados: number
  terminado: boolean
}

export interface AuditLog {
  id?: string
  adminUid: string
  adminEmail: string
  action: string
  targetUid: string
  details: string
  timestamp: string
}

export type RechazoEntradaCode =
  | 'edad'
  | 'nem'
  | 'matricula_curso'
  | 'historical'
  | 'duplicate'
  | 'rut_invalido'
  | 'declaracion'
  | 'desconocido'

export interface PostulanteRechazadoEntrada extends PostulanteData {
  id?: string
  rutNormalizado: string
  rejectionCode: RechazoEntradaCode
  rejectionLabel: string
  rejectionMessage: string
  rejectionFlags: {
    edad: boolean
    nem: boolean
    /** Rechazo por matrícula distinta de 2026 (registros antiguos pueden no traer la clave). */
    matriculaCurso?: boolean
    historical: boolean
    duplicate: boolean
  }
  source: 'verificacion' | 'creacion' | 'frontend'
  createdAt: string
  updatedAt: string
  /** Seteado por Cloud Function al encolar correo (extensión Trigger Email). */
  emailNotificacionEncoladaAt?: string
  emailNotificacionColaDocId?: string
  emailNotificacionColaEstado?: 'encolado'
}
