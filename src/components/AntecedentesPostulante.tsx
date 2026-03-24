import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'

import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'
import { soloTexto, formatEmail, soloTextoDomicilio } from '../utils/inputFormatters'
import { AntecedentesPostulanteSchema, type AntecedentesPostulanteData } from '../postulacion/shared/antecedentesPostulanteSchema'

// ---------------------------------------------------------------------------
// Helpers para formateo manual (mantienen la lógica original del proyecto)
// ---------------------------------------------------------------------------

function calcularEdad(fechaNacimiento: string): string {
  if (!fechaNacimiento) return ''
  const nacimiento = new Date(fechaNacimiento)
  const hoy = new Date()
  let edad = hoy.getFullYear() - nacimiento.getFullYear()
  const m = hoy.getMonth() - nacimiento.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) edad--
  return edad < 0 ? '' : String(edad)
}

function capitalizarToken(token: string): string {
  if (!token) return token
  return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()
}

function capitalizarApellidoManteniendoEspacios(texto: string): string {
  return texto.replace(/[A-Za-zÁÉÍÓÚÑáéíóúñÜü]+(?:-[A-Za-zÁÉÍÓÚÑáéíóúñÜü]+)*/g, (match) =>
    match.split('-').map(p => capitalizarToken(p)).join('-'),
  )
}

function formatRut(value: string): string {
  const cleanRut = value.replace(/\./g, '').replace(/-/g, '')
  if (cleanRut.length === 0) return ''
  const rutBody = cleanRut.slice(0, -1)
  const rutDv = cleanRut.slice(-1)
  let formattedRut = rutBody.length > 0 ? rutBody.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.') : ''
  if (rutDv.length > 0) formattedRut += '-' + rutDv
  return formattedRut
}

// ---------------------------------------------------------------------------
// Componente Principal
// ---------------------------------------------------------------------------

export function AntecedentesPostulante() {
  const navigate = useNavigate()
  const { data, updateFields, markStepCompleted } = usePostulacion()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Configuración de react-hook-form con el esquema Zod
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitted },
  } = useForm<AntecedentesPostulanteData>({
    resolver: zodResolver(AntecedentesPostulanteSchema),
    defaultValues: {
      ...data,
      nombres: (data.nombres as string) || '',
      apellidoPaterno: (data.apellidoPaterno as string) || '',
      apellidoMaterno: (data.apellidoMaterno as string) || '',
      rut: (data.rut as string) || '',
      fechaNacimiento: (data.fechaNacimiento as string) || '',
      sexo: (data.sexo as any) || '',
      estadoCivil: (data.estadoCivil as any) || '',
      telefono: (data.telefono as string) || '',
      email: (data.email as string) || '',
      domicilioFamiliar: (data.domicilioFamiliar as string) || '',
      edad: (data.edad as string) || '',
      fechaPostulacion: (data.fechaPostulacion as string) || new Date().toISOString().split('T')[0],
      horaPostulacion: (data.horaPostulacion as string) || new Date().toTimeString().slice(0, 5),
    },
  })

  // Sincronizar cambios del formulario con el contexto (sin loop infinito)
  useEffect(() => {
    const subscription = watch((values) => {
      updateFields(values as Record<string, unknown>)
    })
    return () => subscription.unsubscribe()
  }, [watch, updateFields])

  // Lógica de cálculo automático de edad ante cambios en fechaNacimiento
  const birthDate = watch('fechaNacimiento')
  useEffect(() => {
    const age = calcularEdad(birthDate)
    setValue('edad', age, { shouldValidate: isSubmitted })
  }, [birthDate, setValue, isSubmitted])

  const onFormSubmit: SubmitHandler<AntecedentesPostulanteData> = (_formData) => {
    setIsSubmitting(true)
    markStepCompleted(1)
    setTimeout(() => {
      navigate('/antecedentes_academicos_3')
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
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Paso 1 de 7</p>
          <h1 className="text-2xl font-bold text-slate-800">Antecedentes del postulante</h1>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Nombres */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Nombres</label>
            <input
              {...register('nombres', {
                onChange: (e) => {
                  const val = soloTexto(e.target.value)
                  const formatted = val.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : '').join(' ')
                  setValue('nombres', formatted)
                }
              })}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.nombres ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.nombres && <p className="text-xs font-medium text-red-500">{errors.nombres.message}</p>}
          </div>

          {/* Otros campos siguiendo el mismo patrón... */}
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Apellido paterno</label>
            <input
              {...register('apellidoPaterno', {
                onChange: (e) => setValue('apellidoPaterno', capitalizarApellidoManteniendoEspacios(soloTexto(e.target.value)))
              })}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.apellidoPaterno ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.apellidoPaterno && <p className="text-xs font-medium text-red-500">{errors.apellidoPaterno.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Apellido materno</label>
            <input
              {...register('apellidoMaterno', {
                onChange: (e) => setValue('apellidoMaterno', capitalizarApellidoManteniendoEspacios(soloTexto(e.target.value)))
              })}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.apellidoMaterno ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.apellidoMaterno && <p className="text-xs font-medium text-red-500">{errors.apellidoMaterno.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">RUT</label>
            <input
              {...register('rut', {
                onChange: (e) => setValue('rut', formatRut(e.target.value))
              })}
              placeholder="12.345.678-9"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm font-mono transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.rut ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.rut && <p className="text-xs font-medium text-red-500">{errors.rut.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Fecha de nacimiento</label>
            <input
              type="date"
              {...register('fechaNacimiento')}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.fechaNacimiento ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.fechaNacimiento && <p className="text-xs font-medium text-red-500">{errors.fechaNacimiento.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-600">Edad calculada</label>
            <input
              {...register('edad')}
              readOnly
              className="block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 font-semibold focus:outline-none"
            />
            <p className="text-[10px] text-slate-400">Basada en la fecha de nacimiento.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Sexo</label>
            <select
              {...register('sexo')}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none bg-white ${errors.sexo ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            >
              <option value="">Seleccione una opción</option>
              <option value="Masculino">Masculino</option>
              <option value="Femenino">Femenino</option>
              <option value="Otro">Otro</option>
            </select>
            {errors.sexo && <p className="text-xs font-medium text-red-500">{errors.sexo.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Estado civil</label>
            <select
              {...register('estadoCivil')}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none bg-white ${errors.estadoCivil ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            >
              <option value="">Seleccione una opción</option>
              <option value="Soltero/a">Soltero/a</option>
              <option value="Casado/a">Casado/a</option>
              <option value="Divorciado/a">Divorciado/a</option>
              <option value="Viudo/a">Viudo/a</option>
            </select>
            {errors.estadoCivil && <p className="text-xs font-medium text-red-500">{errors.estadoCivil.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Teléfono móvil</label>
            <input
              {...register('telefono', {
                onChange: (e) => {
                  const val = e.target.value.replace(/\D/g, '')
                  const sin56 = val.startsWith('56') ? val.slice(2) : val
                  setValue('telefono', '+56' + sin56.slice(0, 9))
                }
              })}
              placeholder="+56 9 1234 5678"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.telefono ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.telefono && <p className="text-xs font-medium text-red-500">{errors.telefono.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Correo electrónico</label>
            <input
              type="text"
              {...register('email', {
                onChange: (e) => {
                  const val = formatEmail(e.target.value)
                  setValue('email', val)
                }
              })}
              placeholder="ejemplo@email.com"
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.email ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.email && <p className="text-xs font-medium text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-sm font-bold text-slate-700">Domicilio familiar</label>
            <input
              {...register('domicilioFamiliar', {
                onChange: (e) => {
                  const val = soloTextoDomicilio(e.target.value)
                  if (!val) { setValue('domicilioFamiliar', ''); return; }
                  setValue('domicilioFamiliar', val.charAt(0).toUpperCase() + val.slice(1).toLowerCase())
                }
              })}
              className={`block w-full rounded-lg border px-3 py-2.5 text-sm transition-all focus:ring-2 focus:ring-blue-100 outline-none ${errors.domicilioFamiliar ? 'border-red-400' : 'border-slate-300 focus:border-blue-500'}`}
            />
            {errors.domicilioFamiliar && <p className="text-xs font-medium text-red-500">{errors.domicilioFamiliar.message}</p>}
          </div>
        </div>

        <div className="pt-4 flex justify-between items-center">
            <button
              type="button"
              onClick={() => navigate('/bienvenida_1')}
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
