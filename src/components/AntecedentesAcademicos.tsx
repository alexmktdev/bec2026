import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'
import { soloTexto, soloNumeros } from '../utils/inputFormatters'
import { AntecedentesAcademicosSchema, type AntecedentesAcademicosData } from '../postulacion/shared/antecedentesAcademicosSchema'

function formatearPrimeraLetraCadaPalabra(texto: string): string {
  return texto
    .split(/\s+/)
    .map((word) =>
      word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : ''
    )
    .join(' ')
}

export function AntecedentesAcademicos() {
  const navigate = useNavigate()
  const { data, updateFields, markStepCompleted } = usePostulacion()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AntecedentesAcademicosData>({
    resolver: zodResolver(AntecedentesAcademicosSchema),
    defaultValues: {
      nem: (data.nem as string) || '',
      nombreInstitucion: (data.nombreInstitucion as string) || '',
      comuna: (data.comuna as string) || '',
      carrera: (data.carrera as string) || '',
      duracionSemestres: (data.duracionSemestres as string) || '',
      anoIngreso: (data.anoIngreso as string) || '',
    },
  })

  useEffect(() => {
    const subscription = watch((values) => {
      updateFields(values as Record<string, unknown>)
    })
    return () => subscription.unsubscribe()
  }, [watch, updateFields])

  const onFormSubmit: SubmitHandler<AntecedentesAcademicosData> = () => {
    setIsSubmitting(true)
    markStepCompleted(2)
    setTimeout(() => {
      navigate('/antecedentes_familiares_4')
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
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Paso 2 de 7</p>
          <h1 className="text-2xl font-bold text-slate-800">Antecedentes académicos</h1>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* NEM */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Promedio NEM (1.0 - 7.0)</label>
            <input
              {...register('nem', {
                onChange: (e) => setValue('nem', soloNumeros(e.target.value.replace(',', '.'), { allowDecimal: true }))
              })}
              placeholder="Ej: 6.5"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.nem ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.nem && <p className="text-xs font-medium text-red-500">{errors.nem.message}</p>}
          </div>

          {/* Institución */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Institución de Educación Superior</label>
            <input
              {...register('nombreInstitucion', {
                onChange: (e) => setValue('nombreInstitucion', formatearPrimeraLetraCadaPalabra(soloTexto(e.target.value)))
              })}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.nombreInstitucion ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.nombreInstitucion && <p className="text-xs font-medium text-red-500">{errors.nombreInstitucion.message}</p>}
          </div>

          {/* Comuna */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Comuna de la institución</label>
            <input
              {...register('comuna', {
                onChange: (e) => {
                  const val = soloTexto(e.target.value)
                  setValue('comuna', val ? val.charAt(0).toUpperCase() + val.slice(1).toLowerCase() : '')
                }
              })}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.comuna ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.comuna && <p className="text-xs font-medium text-red-500">{errors.comuna.message}</p>}
          </div>

          {/* Carrera */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Carrera</label>
            <input
              {...register('carrera', {
                onChange: (e) => setValue('carrera', formatearPrimeraLetraCadaPalabra(soloTexto(e.target.value)))
              })}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.carrera ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.carrera && <p className="text-xs font-medium text-red-500">{errors.carrera.message}</p>}
          </div>

          {/* Duración */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Duración (Semestres)</label>
            <input
              type="number"
              {...register('duracionSemestres', {
                onChange: (e) => setValue('duracionSemestres', soloNumeros(e.target.value, { maxLength: 2 }))
              })}
              placeholder="Ej: 10"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.duracionSemestres ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.duracionSemestres && <p className="text-xs font-medium text-red-500">{errors.duracionSemestres.message}</p>}
          </div>

          {/* Año Ingreso */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Año de ingreso</label>
            <input
              {...register('anoIngreso', {
                onChange: (e) => setValue('anoIngreso', soloNumeros(e.target.value, { maxLength: 4 }))
              })}
              placeholder="Ej: 2024"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.anoIngreso ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.anoIngreso && <p className="text-xs font-medium text-red-500">{errors.anoIngreso.message}</p>}
          </div>
        </div>

        <div className="pt-4 flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate('/antecedentes_postulante_2')}
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
