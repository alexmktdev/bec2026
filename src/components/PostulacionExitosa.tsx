import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'

export function PostulacionExitosa() {
  const navigate = useNavigate()
  const { reset } = usePostulacion()

  useEffect(() => {
    reset()
  }, [reset])

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-2xl space-y-8 rounded-2xl border border-slate-200 bg-white px-8 py-12 shadow-xl text-center overflow-hidden relative">
        {/* Decoración de fondo sutil */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-blue-800 to-blue-900"></div>
        
        <div className="space-y-6">
          <img
            src={logoMolina}
            alt="Logo Municipalidad de Molina"
            className="mx-auto h-32 w-auto object-contain animate-[fadeIn_1s_ease-out]"
          />

          <div className="relative">
            {/* Círculo animado del check */}
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-green-600 animate-scale-in">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-14 w-14" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={3}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M5 13l4 4L19 7" 
                  className="animate-draw-check [stroke-dasharray:30] [stroke-dashoffset:30]"
                />
              </svg>
            </div>
          </div>

          <div className="space-y-4 animate-fade-in-up">
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">
              ¡Postulación exitosa!
            </h1>
            
            <div className="max-w-md mx-auto space-y-2">
              <p className="text-lg text-slate-600">
                Hemos recibido sus datos correctamente.
              </p>
              <p className="text-xl font-medium text-blue-800 leading-relaxed">
                Gracias por postular a la <br className="hidden sm:block" />
                <span className="font-bold">
                  Beca Municipal de Molina 2026
                </span>
              </p>
            </div>
          </div>

          <div className="pt-8 animate-fade-in-up">
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
