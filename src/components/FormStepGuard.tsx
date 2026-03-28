import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { usePostulacion } from '../contexts/PostulacionContext'

interface Props {
  step: number
  children: ReactNode
}

const STEP_TO_ROUTE: Record<number, string> = {
  1: '/antecedentes_postulante_2',
  2: '/antecedentes_academicos_3',
  3: '/antecedentes_familiares_4',
  4: '/cuenta_bancaria_5',
  5: '/documentos_7',
  6: '/declaracion_jurada_8',
  7: '/evaluando_postulacion_9',
}

export function FormStepGuard({ step, children }: Props) {
  const { maxStep } = usePostulacion()

  // Si intentan entrar a un paso que aún no les corresponde, redirigir al último permitido.
  if (maxStep < step) {
    const target = STEP_TO_ROUTE[maxStep] ?? STEP_TO_ROUTE[1]
    return <Navigate to={target} replace />
  }

  return <>{children}</>
}
