import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'
import { soloNumeros } from '../utils/inputFormatters'
import { AntecedentesFamiliaresSchema, type AntecedentesFamiliaresData } from '../postulacion/shared/antecedentesFamiliaresSchema'

export function AntecedentesFamiliares() {
  const navigate = useNavigate()
  const { data, updateFields, markStepCompleted } = usePostulacion()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AntecedentesFamiliaresData>({
    resolver: zodResolver(AntecedentesFamiliaresSchema),
    defaultValues: {
      totalIntegrantes: (data.totalIntegrantes as string) || '',
      tramoRegistroSocial: (data.tramoRegistroSocial as string) || '',
      tieneHermanosOHijosEstudiando: (data.tieneHermanosOHijosEstudiando as any) || '',
      tieneUnHermanOHijoEstudiando: (data.tieneUnHermanOHijoEstudiando as any) || 'N/A',
      tieneDosOMasHermanosOHijosEstudiando: (data.tieneDosOMasHermanosOHijosEstudiando as any) || 'N/A',
      enfermedadCatastrofica: (data.enfermedadCatastrofica as any) || '',
      enfermedadCronica: (data.enfermedadCronica as any) || '',
    },
  })

  useEffect(() => {
    const subscription = watch((values) => {
      updateFields(values as Record<string, unknown>)
    })
    return () => subscription.unsubscribe()
  }, [watch, updateFields])

  // Lógica condicional: Si no tiene hermanos estudiando, forzar N/A en los detalles
  const tieneHermanosEstudiando = watch('tieneHermanosOHijosEstudiando')
  useEffect(() => {
    if (tieneHermanosEstudiando === 'No') {
      setValue('tieneUnHermanOHijoEstudiando', 'N/A')
      setValue('tieneDosOMasHermanosOHijosEstudiando', 'N/A')
    } else if (tieneHermanosEstudiando === 'Si') {
      const currentUno = watch('tieneUnHermanOHijoEstudiando')
      const currentDos = watch('tieneDosOMasHermanosOHijosEstudiando')
      if (currentUno === 'N/A') setValue('tieneUnHermanOHijoEstudiando', '' as any)
      if (currentDos === 'N/A') setValue('tieneDosOMasHermanosOHijosEstudiando', '' as any)
    }
  }, [tieneHermanosEstudiando, setValue, watch])

  // Lógica exclusiva: Solo uno puede ser Sí
  const tieneUno = watch('tieneUnHermanOHijoEstudiando')
  const tieneDos = watch('tieneDosOMasHermanosOHijosEstudiando')

  useEffect(() => {
    if (tieneUno === 'Si' && tieneDos === 'Si') {
      // Prioridad al último que cambió o simple reseteo del otro
      // Aquí simplemente evitamos que ambos queden en Sí
    }
  }, [tieneUno, tieneDos])

  const onFormSubmit: SubmitHandler<AntecedentesFamiliaresData> = () => {
    setIsSubmitting(true)
    markStepCompleted(3)
    setTimeout(() => {
      navigate('/cuenta_bancaria_5')
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
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Paso 3 de 6</p>
          <h1 className="text-2xl font-bold text-slate-800">Antecedentes familiares</h1>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          <h2 className="col-span-2 text-base font-bold text-slate-800 border-b border-slate-100 pb-1">a) Composición familiar</h2>
          
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Total de integrantes del hogar</label>
            <input
              {...register('totalIntegrantes', {
                onChange: (e) => setValue('totalIntegrantes', soloNumeros(e.target.value, { maxLength: 2 }))
              })}
              placeholder="Ej: 4"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.totalIntegrantes ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.totalIntegrantes && <p className="text-xs font-medium text-red-500">{errors.totalIntegrantes.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Tramo Registro Social de Hogares</label>
            <select
              {...register('tramoRegistroSocial')}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none bg-white ${errors.tramoRegistroSocial ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            >
              <option value="">Seleccione...</option>
              <option value="40%">40%</option>
              <option value="50%">50%</option>
              <option value="60%">60%</option>
              <option value="70%">70%</option>
            </select>
            {errors.tramoRegistroSocial && <p className="text-xs font-medium text-red-500">{errors.tramoRegistroSocial.message}</p>}
          </div>

          <h2 className="col-span-2 text-base font-bold text-slate-800 border-b border-slate-100 pb-1 pt-4">b) Hermanos/as y/o hijos/as estudiando</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">¿Tiene hermanos/as y/o hijos/as estudiando?</label>
            <select
              {...register('tieneHermanosOHijosEstudiando')}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none bg-white ${errors.tieneHermanosOHijosEstudiando ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            >
              <option value="">Seleccione...</option>
              <option value="Si">Sí</option>
              <option value="No">No</option>
            </select>
            {errors.tieneHermanosOHijosEstudiando && <p className="text-xs font-medium text-red-500">{errors.tieneHermanosOHijosEstudiando.message}</p>}
          </div>

          {tieneHermanosEstudiando === 'Si' && (
            <div className="col-span-2 grid gap-6 md:grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-200 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">¿Tiene un (1) hermano/hijo estudiando?</label>
                <select
                  {...register('tieneUnHermanOHijoEstudiando', {
                    onChange: (e) => { if (e.target.value === 'Si') setValue('tieneDosOMasHermanosOHijosEstudiando', 'No') }
                  })}
                  className={`block w-full rounded-lg border px-3 py-2 text-sm bg-white ${errors.tieneUnHermanOHijoEstudiando ? 'border-red-400' : 'border-slate-300'}`}
                >
                  <option value="">Seleccione...</option>
                  <option value="Si">Sí</option>
                  <option value="No">No</option>
                </select>
                {errors.tieneUnHermanOHijoEstudiando && <p className="text-[10px] font-medium text-red-500">{errors.tieneUnHermanOHijoEstudiando.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-600">¿Tiene 2 o más hermanos/hijos estudiando?</label>
                <select
                  {...register('tieneDosOMasHermanosOHijosEstudiando', {
                    onChange: (e) => { if (e.target.value === 'Si') setValue('tieneUnHermanOHijoEstudiando', 'No') }
                  })}
                  className={`block w-full rounded-lg border px-3 py-2 text-sm bg-white ${errors.tieneDosOMasHermanosOHijosEstudiando ? 'border-red-400' : 'border-slate-300'}`}
                >
                  <option value="">Seleccione...</option>
                  <option value="Si">Sí</option>
                  <option value="No">No</option>
                </select>
                {errors.tieneDosOMasHermanosOHijosEstudiando && <p className="text-[10px] font-medium text-red-500">{errors.tieneDosOMasHermanosOHijosEstudiando.message}</p>}
              </div>
            </div>
          )}

          <h2 className="col-span-2 text-base font-bold text-slate-800 border-b border-slate-100 pb-1 pt-4">c) Salud familiar</h2>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">¿Enfermedad catastrófica en el grupo?</label>
            <select
              {...register('enfermedadCatastrofica')}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none bg-white ${errors.enfermedadCatastrofica ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            >
              <option value="">Seleccione...</option>
              <option value="Si">Sí</option>
              <option value="No">No</option>
            </select>
            {errors.enfermedadCatastrofica && <p className="text-xs font-medium text-red-500">{errors.enfermedadCatastrofica.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">¿Enfermedad crónica en el grupo?</label>
            <select
              {...register('enfermedadCronica')}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none bg-white ${errors.enfermedadCronica ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            >
              <option value="">Seleccione...</option>
              <option value="Si">Sí</option>
              <option value="No">No</option>
            </select>
            {errors.enfermedadCronica && <p className="text-xs font-medium text-red-500">{errors.enfermedadCronica.message}</p>}
          </div>
        </div>

        <div className="pt-6 flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate('/antecedentes_academicos_3')}
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
