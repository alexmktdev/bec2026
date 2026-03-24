import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'
import { soloNumeros } from '../utils/inputFormatters'
import { CuentaBancariaSchema, type CuentaBancariaData } from '../postulacion/shared/cuentaBancariaSchema'

function formatRut(value: string): string {
  const cleanRut = value.replace(/\./g, '').replace(/-/g, '')
  if (cleanRut.length === 0) return ''
  const rutBody = cleanRut.slice(0, -1)
  const rutDv = cleanRut.slice(-1)
  let formattedRut = rutBody.length > 0 ? rutBody.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.') : ''
  if (rutDv.length > 0) formattedRut += '-' + rutDv
  return formattedRut
}

export function CuentaBancaria() {
  const navigate = useNavigate()
  const { data, updateFields, markStepCompleted } = usePostulacion()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CuentaBancariaData>({
    resolver: zodResolver(CuentaBancariaSchema),
    defaultValues: {
      numeroCuenta: (data.numeroCuenta as string) || '',
      rutCuenta: (data.rutCuenta as string) || '',
    },
  })

  // Sincronizar con el contexto global
  useEffect(() => {
    const subscription = watch((values) => {
      updateFields(values as Record<string, unknown>)
    })
    return () => subscription.unsubscribe()
  }, [watch, updateFields])

  const onFormSubmit: SubmitHandler<CuentaBancariaData> = () => {
    setIsSubmitting(true)
    markStepCompleted(4)
    setTimeout(() => {
      navigate('/observaciones_6')
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
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Paso 4 de 7</p>
          <h1 className="text-2xl font-bold text-slate-800">Cuenta Bancaria para transferencia</h1>
        </header>

        {/* Banner Informativo Premium */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex gap-4">
            <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-amber-100 text-amber-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 mb-1 uppercase tracking-tight">¡REQUISITO EXCLUYENTE! : Solo Cuenta RUT</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                Debe indicar exclusivamente una <span className="font-extrabold underline decoration-amber-400">Cuenta RUT</span> de Banco Estado. No se aceptarán transferencias a cuentas de otros bancos o productos diferentes.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {/* Número Cuenta */}
          <div className="space-y-1.5 ">
            <label className="text-sm font-bold text-slate-700">Número de Cuenta RUT (8 dígitos)</label>
            <input
              {...register('numeroCuenta', {
                onChange: (e) => setValue('numeroCuenta', soloNumeros(e.target.value.replace(/\D/g, '').slice(0, 8)))
              })}
              placeholder="Ej: 12345678"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.numeroCuenta ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
             <p className="text-[10px] text-slate-400">Sin dígito verificador. Generalmente es el RUT sin dígito.</p>
            {errors.numeroCuenta && <p className="text-xs font-medium text-red-500">{errors.numeroCuenta.message}</p>}
          </div>

          {/* RUT de la cuenta */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">RUT del titular</label>
            <input
              {...register('rutCuenta', {
                onChange: (e) => setValue('rutCuenta', formatRut(e.target.value))
              })}
              placeholder="12.345.678-9"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm font-mono transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.rutCuenta ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.rutCuenta && <p className="text-xs font-medium text-red-500">{errors.rutCuenta.message}</p>}
          </div>
        </div>

        <div className="pt-6 flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate('/antecedentes_familiares_4')}
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
