import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'
import { capitalizarTituloPorPalabras, soloNumeros, soloTexto } from '../utils/inputFormatters'
import { CuentaBancariaSchema, type CuentaBancariaData } from '../postulacion/shared/cuentaBancariaSchema'
import { TIPOS_CUENTA_OTRA } from '../postulacion/shared/bancosChile'

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
      tipoCuentaBancaria: data.tipoCuentaBancaria ?? 'cuenta_rut',
      numeroCuenta: data.numeroCuenta || '',
      rutCuenta: data.rutCuenta || '',
      otraNumeroCuenta: data.otraNumeroCuenta || '',
      otraTipoCuenta: data.otraTipoCuenta || '',
      otraBanco: data.otraBanco || '',
      otraBancoDetalle: data.otraBancoDetalle || '',
      otraRutTitular: data.otraRutTitular || '',
    },
  })

  const tipo = watch('tipoCuentaBancaria')

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
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Paso 4 de 6</p>
          <h1 className="text-2xl font-bold text-slate-800">Cuenta bancaria para transferencia</h1>
        </header>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex gap-4">
            <div className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full bg-amber-100 text-amber-700">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900 mb-1 uppercase tracking-tight">Idealmente cuenta RUT</h3>
              <p className="text-sm text-amber-800 leading-relaxed">
                Se prefiere una cuenta RUT (por ejemplo de Banco Estado). Si no dispone de ella, puede indicar otra cuenta
                bancaria completando el segundo bloque: tipo de cuenta, banco y RUT del titular.
              </p>
            </div>
          </div>
        </div>

        <fieldset className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="text-sm font-bold text-slate-800 px-1">¿Cómo desea recibir el pago?</legend>
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                value="cuenta_rut"
                className="h-4 w-4 text-blue-800"
                {...register('tipoCuentaBancaria')}
              />
              Cuenta RUT (número y RUT titular)
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input type="radio" value="otra" className="h-4 w-4 text-blue-800" {...register('tipoCuentaBancaria')} />
              Otra cuenta bancaria
            </label>
          </div>
        </fieldset>

        {tipo === 'cuenta_rut' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Número de cuenta RUT (8 dígitos)</label>
              <input
                {...register('numeroCuenta', {
                  onChange: (e) =>
                    setValue('numeroCuenta', soloNumeros(e.target.value.replace(/\D/g, '').slice(0, 8))),
                })}
                placeholder="Ej: 12345678"
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.numeroCuenta ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
              />
              <p className="text-[10px] text-slate-400">Sin dígito verificador. Suele coincidir con el RUT sin DV.</p>
              {errors.numeroCuenta && <p className="text-xs font-medium text-red-500">{errors.numeroCuenta.message}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">RUT del titular</label>
              <input
                {...register('rutCuenta', {
                  onChange: (e) => setValue('rutCuenta', formatRut(e.target.value)),
                })}
                placeholder="12.345.678-9"
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm font-mono transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.rutCuenta ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
              />
              {errors.rutCuenta && <p className="text-xs font-medium text-red-500">{errors.rutCuenta.message}</p>}
            </div>
          </div>
        )}

        {tipo === 'otra' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-bold text-slate-700">Número de cuenta</label>
              <input
                {...register('otraNumeroCuenta')}
                placeholder="Número según conste en el banco"
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.otraNumeroCuenta ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
              />
              {errors.otraNumeroCuenta && (
                <p className="text-xs font-medium text-red-500">{errors.otraNumeroCuenta.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-slate-700">Tipo de cuenta</label>
              <select
                {...register('otraTipoCuenta')}
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-100 outline-none ${errors.otraTipoCuenta ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
              >
                {TIPOS_CUENTA_OTRA.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {errors.otraTipoCuenta && (
                <p className="text-xs font-medium text-red-500">{errors.otraTipoCuenta.message}</p>
              )}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-bold text-slate-700">Banco</label>
              <input
                {...register('otraBanco', {
                  onChange: (e) => {
                    const limpio = soloTexto(e.target.value)
                    setValue('otraBanco', capitalizarTituloPorPalabras(limpio))
                  },
                })}
                placeholder="Ej: Banco Estado"
                autoComplete="organization"
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-100 outline-none ${errors.otraBanco ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
              />
              <p className="text-[10px] text-slate-400">Escriba el nombre; se formatea automáticamente (cada palabra con mayúscula inicial).</p>
              {errors.otraBanco && <p className="text-xs font-medium text-red-500">{errors.otraBanco.message}</p>}
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-sm font-bold text-slate-700">RUT asociado al titular de la cuenta</label>
              <input
                {...register('otraRutTitular', {
                  onChange: (e) => setValue('otraRutTitular', formatRut(e.target.value)),
                })}
                placeholder="12.345.678-9"
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm font-mono focus:ring-2 focus:ring-blue-100 outline-none ${errors.otraRutTitular ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
              />
              {errors.otraRutTitular && (
                <p className="text-xs font-medium text-red-500">{errors.otraRutTitular.message}</p>
              )}
            </div>
          </div>
        )}

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
