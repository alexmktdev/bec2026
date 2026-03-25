import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import logoMolina from '../../assets/logo-molina.png'

export function Login() {
  const navigate = useNavigate()
  const { signIn, user, loading, userRole, authError, requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // Vista de recuperación
  const [view, setView] = useState<'login' | 'forgot'>('login')
  const [resetSent, setResetSent] = useState(false)

  useEffect(() => {
    if (!loading && user && userRole) {
      navigate('/admin', { replace: true })
    }
  }, [loading, user, userRole, navigate])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (view === 'login') {
        await signIn(email, password)
        navigate('/admin', { replace: true })
      } else {
        await requestPasswordReset(email)
        setResetSent(true)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      const appCheckMsg =
        'No se pudo verificar la seguridad (App Check). Compruebe: dominio en reCAPTCHA, VITE_RECAPTCHA_SITE_KEY en Vercel, ' +
        'si en Firebase usó reCAPTCHA Enterprise ponga VITE_APPCHECK_USE_ENTERPRISE=true, sin bloqueadores; si ve “throttle” en consola, espere 1–2 min y reintente.'
      if (msg === 'ACCESO_BLOQUEADO') {
        setError(
          'Acceso bloqueado por seguridad (demasiados intentos fallidos). Por favor, utilice la opción de recuperar contraseña para reactivar su cuenta.',
        )
      } else if (
        msg === 'APP_CHECK_NOT_CONFIGURED' ||
        msg === 'APP_CHECK_NOT_INITIALIZED' ||
        msg === 'APP_CHECK_TOKEN_FAILED' ||
        msg === 'APP_CHECK_CALL_FAILED'
      ) {
        setError(appCheckMsg)
      } else {
        setError(
          view === 'login'
            ? 'Credenciales incorrectas. Verifique su email y contraseña.'
            : 'No se pudo procesar la solicitud. Verifique que el correo sea correcto.',
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (view === 'forgot') {
    return (
      <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center font-sans bg-slate-50 p-4">
        <form
          onSubmit={handleSubmit}
          className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-xl"
        >
          <img src={logoMolina} alt="Logo Molina" className="mx-auto h-20 w-auto object-contain" />
          
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-slate-900 leading-tight">Recuperar Acceso</h1>
            <p className="text-sm font-medium text-slate-500">Enviaremos un enlace a su correo institucional</p>
          </div>

          {resetSent ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-6 text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-emerald-100 p-3 text-emerald-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-bold text-emerald-800">¡Enlace enviado!</p>
              <p className="text-[13px] text-emerald-700">Por favor, revise su bandeja de entrada (y la carpeta de spam) para continuar con el restablecimiento.</p>
              <button
                type="button"
                onClick={() => { setView('login'); setResetSent(false) }}
                className="text-sm font-bold text-blue-800 hover:underline"
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-700">{error}</p>
                </div>
              )}
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">Ingrese su email</label>
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:ring-1 focus:ring-blue-500"
                  placeholder="correo@molina.cl"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-800 py-3 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
              <button
                type="button"
                onClick={() => setView('login')}
                className="w-full text-center text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors"
              >
                Cancelar y volver
              </button>
            </div>
          )}
        </form>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center font-sans bg-slate-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white px-8 py-10 shadow-xl"
      >
        <img
          src={logoMolina}
          alt="Logo Municipalidad de Molina"
          className="mx-auto h-24 w-auto object-contain"
        />
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">Acceso al Sistema</h1>
          <p className="text-sm font-bold text-blue-800 uppercase tracking-wide">Gestión de becas Municipales 2026</p>
        </div>

        {(error || authError) && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm font-semibold text-red-700">{error || authError}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-bold text-slate-700">
              Correo electrónico
            </label>
            <input
              id="email"
              type="text"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="correo@molina.cl"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                Contraseña
              </label>
              <button
                type="button"
                onClick={() => { setView('forgot'); setError('') }}
                className="text-[11px] font-bold text-blue-700 hover:underline"
              >
                ¿Olvidó su contraseña?
              </button>
            </div>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="********"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-800 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>

        <p className="text-center text-[9px] text-slate-400 font-medium pt-2 uppercase tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
          © 2026 Municipalidad de Molina · Beca municipal 2026
        </p>
      </form>
    </div>
  )
}
