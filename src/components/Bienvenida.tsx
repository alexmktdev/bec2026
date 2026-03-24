import { useNavigate } from 'react-router-dom'
import logoMolina from '../assets/logo-molina.png'

export function Bienvenida() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center">
      <section className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center space-y-8 rounded-2xl bg-white p-10 text-center shadow-sm">
        <img
          src={logoMolina}
          alt="Logo Municipalidad de Molina"
          className="mb-6 h-28 w-auto object-contain md:h-36"
        />
        <h1 className="text-3xl font-semibold leading-tight text-blue-800">
          Formulario de Postulación Beca Municipal de Molina 2026
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-slate-700 text-justify text-balance">
          Bienvenido/a al formulario de postulación. En las siguientes pantallas te
          solicitaremos todos los datos necesarios para iniciar tu postulación, si desea continuar con el proceso, por favor
          presione el botón para comenzar con su postulación.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-8 py-4 text-lg font-semibold text-slate-600 shadow-sm transition-colors duration-500 hover:bg-slate-50 focus-visible:outline-none"
          >
            Atrás
          </button>
          <button
            type="button"
            onClick={() => navigate('/antecedentes_postulante_2')}
            className="inline-flex items-center justify-center rounded-lg bg-blue-800 px-8 py-4 text-lg font-semibold text-white shadow-sm transition-colors duration-500 hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            Comenzar postulación
          </button>
        </div>
      </section>
    </div>
  )
}
