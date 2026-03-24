import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'
import { ObservacionesSchema, type ObservacionesData } from '../postulacion/shared/observacionesSchema'

export function Observaciones() {
  const navigate = useNavigate()
  const { data, updateFields, markStepCompleted } = usePostulacion()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ObservacionesData>({
    resolver: zodResolver(ObservacionesSchema),
    defaultValues: {
      observaciones: (data.observacion as string) || '',
    },
  })

  const currentText = watch('observaciones') || ''
  
  useEffect(() => {
    const subscription = watch((values) => {
      updateFields({ observacion: values.observaciones ?? '' })
    })
    return () => subscription.unsubscribe()
  }, [watch, updateFields])

  const onFormSubmit: SubmitHandler<ObservacionesData> = () => {
    setIsSubmitting(true)
    markStepCompleted(5)
    setTimeout(() => {
      navigate('/documentos_7')
    }, 100)
  }

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center">
      <form
        onSubmit={handleSubmit(onFormSubmit)}
        className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white px-10 py-8 shadow-sm"
      >
        <img src={logoMolina} alt="Logo" className="mx-auto h-24 w-auto object-contain mb-2" />
        
        <header className="space-y-1 text-center">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Paso 5 de 7</p>
          <h1 className="text-2xl font-bold text-slate-800">Observaciones adicionales</h1>
        </header>

        <div className="space-y-2">
            <div className="flex justify-between items-end">
              <label className="text-sm font-bold text-slate-700">Comentarios (Opcional)</label>
              <span className={`text-[10px] font-bold ${currentText.length > 900 ? 'text-red-500' : 'text-slate-400'}`}>
                {currentText.length} / 1000
              </span>
            </div>
            <textarea
                {...register('observaciones')}
                rows={6}
                placeholder="Escriba aquí si desea agregar algo adicional..."
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none resize-none ${errors.observaciones ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.observaciones && <p className="text-xs font-medium text-red-500">{errors.observaciones.message}</p>}
            <p className="text-xs text-slate-400 leading-relaxed italic">
              Use este espacio para explicar situaciones especiales de salud, familiares o académicas que considere importantes para su evaluación.
            </p>
        </div>

        <div className="pt-6 flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate('/cuenta_bancaria_5')}
              className="px-6 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-8 py-2.5 rounded-lg bg-blue-800 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isSubmitting ? 'Cargando...' : 'Siguiente'}
            </button>
        </div>
      </form>
    </div>
  )
}
