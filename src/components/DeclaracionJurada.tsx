import { useNavigate } from 'react-router-dom'
import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'

export function DeclaracionJurada() {
  const navigate = useNavigate()
  const { data, updateFields, markStepCompleted } = usePostulacion()

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (data.declaracionJuradaAceptada) {
      markStepCompleted(7)
      navigate('/evaluando_postulacion_9')
    }
  }

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-3xl space-y-6 rounded-xl border border-slate-200 bg-white px-8 md:px-12 py-7 shadow-sm"
      >
        <img
          src={logoMolina}
          alt="Logo Municipalidad de Molina"
          className="mx-auto mb-4 h-28 w-auto object-contain"
        />
        <header className="space-y-6 text-center">
          <p className="text-sm font-medium text-slate-500">Paso 7 de 7</p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Declaración Jurada
          </h1>
        </header>

        <div className="space-y-6 text-slate-700 leading-relaxed text-sm md:text-base text-justify text-balance">
          <p>
            El postulante declara que la información proporcionada en este formulario web y en sus
            documentos anexos es verídica y representa fielmente la realidad, no habiendo sido
            alterada, manipulada y/o falsificada por aquel o a instancia suya.
          </p>

          <p>
            Asimismo, declara no encontrarse contratado por la Municipalidad de Molina, ni ser hijo(a)
            de servidor municipal del mismo ente edilicio, cualquiera sea el estatuto por el que se rija
            su contratación.
          </p>
        </div>

        <div className="flex items-center space-x-3 pt-4">
          <input
            id="acepto"
            type="checkbox"
            checked={data.declaracionJuradaAceptada}
            onChange={(e) => updateFields({ declaracionJuradaAceptada: e.target.checked })}
            className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label
            htmlFor="acepto"
            className="text-sm font-medium text-slate-900 cursor-pointer select-none"
          >
            Declaro que he leído y acepto la declaración jurada anterior.
          </label>
        </div>

        <div className="flex justify-between pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={() => navigate('/documentos_7')}
            className="inline-flex items-center justify-center rounded-md bg-white border border-slate-300 px-6 py-2 text-sm font-semibold text-black shadow-md transition-colors duration-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2"
          >
            Atrás
          </button>
          <button
            type="submit"
            disabled={!data.declaracionJuradaAceptada}
            className={`inline-flex items-center justify-center rounded-md px-6 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${data.declaracionJuradaAceptada
              ? 'bg-blue-800 hover:bg-blue-700 cursor-pointer'
              : 'bg-slate-300 cursor-not-allowed'
              }`}
          >
            Finalizar Postulación
          </button>
        </div>
      </form>
    </div>
  )
}
