import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { PostulanteData } from '../types/postulante'

function getFechaHoraLocal() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return { fecha: `${y}-${m}-${d}`, hora: `${hh}:${mm}:${ss}` }
}

function getInitialData(): PostulanteData {
  const { fecha, hora } = getFechaHoraLocal()
  return {
    nombres: '',
    apellidoPaterno: '',
    apellidoMaterno: '',
    rut: '',
    fechaNacimiento: '',
    edad: '',
    sexo: '',
    estadoCivil: '',
    telefono: '+56',
    email: '',
    domicilioFamiliar: '',
    fechaPostulacion: fecha,
    horaPostulacion: hora,
    nem: '',
    nombreInstitucion: '',
    comuna: '',
    carrera: '',
    duracionSemestres: '',
    anoIngreso: '',
    totalIntegrantes: '',
    tramoRegistroSocial: '',
    tieneHermanosOHijosEstudiando: '',
    tieneUnHermanOHijoEstudiando: '',
    tieneDosOMasHermanosOHijosEstudiando: '',
    enfermedadCatastrofica: '',
    enfermedadCronica: '',
    numeroCuenta: '',
    rutCuenta: '',
    observacion: '',
    declaracionJuradaAceptada: false,
  }
}

interface PostulacionContextValue {
  data: PostulanteData
  files: Record<string, File>
  maxStep: number
  updateFields: (fields: Partial<PostulanteData>) => void
  setFile: (id: string, file: File) => void
  removeFile: (id: string) => void
  markStepCompleted: (step: number) => void
  reset: () => void
}

const PostulacionContext = createContext<PostulacionContextValue | null>(null)

export function PostulacionProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<PostulanteData>(getInitialData)
  const [files, setFiles] = useState<Record<string, File>>({})
  // Solo en memoria: al recargar (F5) se reinicia
  const [maxStep, setMaxStep] = useState<number>(1)

  const updateFields = useCallback((fields: Partial<PostulanteData>) => {
    setData((prev) => ({ ...prev, ...fields }))
  }, [])

  const setFile = useCallback((id: string, file: File) => {
    setFiles((prev) => ({ ...prev, [id]: file }))
  }, [])

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const markStepCompleted = useCallback((step: number) => {
    setMaxStep((current) => {
      return Math.max(current, step + 1)
    })
  }, [])

  const reset = useCallback(() => {
    setData(getInitialData())
    setFiles({})
    setMaxStep(1)
  }, [])

  return (
    <PostulacionContext.Provider
      value={{ data, files, maxStep, updateFields, setFile, removeFile, markStepCompleted, reset }}
    >
      {children}
    </PostulacionContext.Provider>
  )
}

export function usePostulacion() {
  const ctx = useContext(PostulacionContext)
  if (!ctx) throw new Error('usePostulacion must be used within PostulacionProvider')
  return ctx
}
