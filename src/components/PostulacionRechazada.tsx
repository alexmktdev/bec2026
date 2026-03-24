import { useLocation, useNavigate } from 'react-router-dom'
import logoMolina from '../assets/logo-molina.png'

export function PostulacionRechazada() {
  const navigate = useNavigate()
  const location = useLocation()
  const motivo = (location.state as { motivo?: string })?.motivo ?? 'Su postulación no cumple con los requisitos.'

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-2xl space-y-8 rounded-2xl border border-slate-200 bg-white px-8 py-12 shadow-xl text-center overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-red-600 to-red-700"></div>

        <div className="space-y-6">
          <img
            src={logoMolina}
            alt="Logo Municipalidad de Molina"
            className="mx-auto h-32 w-auto object-contain animate-[fadeIn_1s_ease-out]"
          />

          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-100 text-red-600 animate-scale-in">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <div className="space-y-4 animate-fade-in-up">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Postulación no aceptada
            </h1>

            <div className="mx-auto max-w-md rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Motivo:</p>
              <p className="mt-1 text-sm text-red-700">{motivo}</p>
            </div>
          </div>

          <div className="pt-4 animate-fade-in-up">
            <button
              onClick={() => navigate('/informacion_beca')}
              className="inline-flex items-center justify-center rounded-full bg-blue-800 px-8 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:bg-blue-700 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
