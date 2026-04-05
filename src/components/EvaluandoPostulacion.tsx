import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'
import { evaluarReglasPostulacion } from '../postulacion/shared/businessRules'
import { MENSAJE_RECHAZO_ENTRADA_PREVIO } from '../postulacion/shared/rechazoEntradaPrevioMessage'
import {
  crearPostulacionCallable,
  esErrorCallable,
  razonHttpsCallable,
  registrarPostulanteRechazadoEntradaCallable,
  verificarElegibilidadPostulacion,
} from '../services/postulacionCallableService'
import { subirTodosLosDocumentos } from '../services/storageService'
import type { DocumentosSubidos } from '../types/postulante'

type EvalState = 'checking' | 'saving' | 'done' | 'error'

const MOTIVO_HISTORICO =
  'El RUT ingresado corresponde a un postulante que ya fué beneficiado en procesos anteriores. En consecuencia, su postulación para el presente año fué rechazada de conformidad con las bases del concurso.'

export function EvaluandoPostulacion() {
  const navigate = useNavigate()
  const { data, files } = usePostulacion()
  const [state, setState] = useState<EvalState>('checking')
  const [mensaje, setMensaje] = useState('Verificando datos del postulante...')

  useEffect(() => {
    let cancelled = false

    async function evaluar() {
      try {
        // 1. Reglas de negocio (misma lógica que valida el backend)
        if (!cancelled) setMensaje('Verificando requisitos...')
        const reglas = evaluarReglasPostulacion(data)
        if (!reglas.ok) {
          void registrarPostulanteRechazadoEntradaCallable(data, reglas.code, reglas.message).catch(console.error)
          if (cancelled) return
          navigate('/postulacion_rechazada', {
            replace: true,
            state: { motivo: reglas.message },
          })
          return
        }

        // 2. Elegibilidad (duplicado + histórico) — Cloud Function
        if (!cancelled) setMensaje('Verificando elegibilidad del RUT...')
        const elig = await verificarElegibilidadPostulacion(data.rut)
        if (cancelled) return
        if (!elig.ok) {
          if (elig.code === 'duplicate') {
            void registrarPostulanteRechazadoEntradaCallable(
              data,
              'duplicate',
              'Ya existe una postulación con este RUT.',
            ).catch(console.error)
            navigate('/postulacion_ya_realizada', { replace: true })
            return
          }
          if (elig.code === 'historical') {
            void registrarPostulanteRechazadoEntradaCallable(data, 'historical', MOTIVO_HISTORICO).catch(console.error)
            navigate('/postulacion_rechazada', {
              replace: true,
              state: { motivo: MOTIVO_HISTORICO },
            })
            return
          }
          if (elig.code === 'rechazo_entrada_previo') {
            navigate('/postulacion_rechazada', {
              replace: true,
              state: { motivo: MENSAJE_RECHAZO_ENTRADA_PREVIO },
            })
            return
          }
        }

        // 3. Subir documentos a Storage (igual que antes — versión simple B)
        if (cancelled) return
        setState('saving')
        setMensaje('Subiendo documentos...')

        const documentPaths = await subirTodosLosDocumentos(
          data.rut,
          data.nombres,
          data.apellidoPaterno,
          files,
        )

        const documentosSubidos: DocumentosSubidos = {
          identidad: !!files['identidad'],
          matricula: !!files['matricula'],
          rsh: !!files['rsh'],
          nem: !!files['nem'],
          ...(files['hermanos'] ? { hermanos: true } : {}),
          ...(files['medico'] ? { medico: true } : {}),
        }

        // 4. Registrar postulación — Cloud Function (Firestore create bloqueado al cliente)
        if (cancelled) return
        setMensaje('Guardando postulación...')
        try {
          await crearPostulacionCallable(data, documentosSubidos, documentPaths)
        } catch (createErr: unknown) {
          if (cancelled) return
          if (esErrorCallable(createErr)) {
            if (createErr.code === 'functions/already-exists') {
              void registrarPostulanteRechazadoEntradaCallable(
                data,
                'duplicate',
                'Ya existe una postulación con este RUT.',
              ).catch(console.error)
              navigate('/postulacion_ya_realizada', { replace: true })
              return
            }
            if (createErr.code === 'functions/failed-precondition') {
              const reason = razonHttpsCallable(createErr)
              const msg = typeof createErr.message === 'string' ? createErr.message : ''
              if (
                reason === 'rechazo_entrada_previo' ||
                msg === MENSAJE_RECHAZO_ENTRADA_PREVIO
              ) {
                navigate('/postulacion_rechazada', {
                  replace: true,
                  state: { motivo: msg || MENSAJE_RECHAZO_ENTRADA_PREVIO },
                })
                return
              }
              void registrarPostulanteRechazadoEntradaCallable(data, 'historical', MOTIVO_HISTORICO).catch(console.error)
              navigate('/postulacion_rechazada', {
                replace: true,
                state: { motivo: MOTIVO_HISTORICO },
              })
              return
            }
            if (createErr.code === 'functions/invalid-argument' && createErr.message) {
              navigate('/postulacion_rechazada', {
                replace: true,
                state: { motivo: createErr.message },
              })
              return
            }
          }
          throw createErr
        }

        if (cancelled) return
        setState('done')
        navigate('/postulacion_exitosa_9', { replace: true })
      } catch (err) {
        if (cancelled) return
        console.error('Error en evaluación:', err)
        setState('error')
        setMensaje('Ocurrió un error al procesar su postulación. Por favor, intente nuevamente.')
      }
    }

    evaluar()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center">
      <div className="mx-auto w-full max-w-2xl space-y-8 rounded-2xl border border-slate-200 bg-white px-8 py-12 shadow-xl text-center overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 via-blue-800 to-blue-900"></div>

        <div className="space-y-6">
          <img
            src={logoMolina}
            alt="Logo Municipalidad de Molina"
            className="mx-auto h-32 w-auto object-contain animate-fade-in"
          />

          {state !== 'error' ? (
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-blue-50 text-blue-700">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
            </div>
          ) : (
            <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          )}

          <div className="space-y-3 animate-fade-in-up">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              {state === 'error' ? 'Error en la postulación' : 'Evaluando postulación...'}
            </h1>
            <p className="text-base text-slate-600">{mensaje}</p>
          </div>

          {state === 'error' && (
            <button
              onClick={() => navigate('/declaracion_jurada_8')}
              className="mt-4 inline-flex items-center justify-center rounded-full bg-blue-800 px-8 py-3 text-sm font-bold text-white shadow-lg transition-all duration-300 hover:bg-blue-700"
            >
              Volver al formulario
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
