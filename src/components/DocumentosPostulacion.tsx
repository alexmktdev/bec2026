import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import logoMolina from '../assets/logo-molina.png'
import { usePostulacion } from '../contexts/PostulacionContext'

interface FileState {
  file: File | null
  status: 'idle' | 'uploading' | 'success'
}

function DocumentItem({
  id,
  title,
  description,
  extraContent,
  onUploaded,
}: {
  id: string
  title: string
  description: string
  extraContent?: ReactNode
  onUploaded: (id: string, file: File) => void
}) {
  const [state, setState] = useState<FileState>({ file: null, status: 'idle' })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        alert('Por favor, suba un archivo PDF.')
        return
      }
      if (selectedFile.size > 500 * 1024) {
        alert('El archivo supera los 500 KB.')
        return
      }

      setState({ file: selectedFile, status: 'uploading' })

      // Simular subida con animación más rápida
      setTimeout(() => {
        setState(prev => ({ ...prev, status: 'success' }))
        onUploaded(id, selectedFile)
      }, 600)
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`flex flex-col border rounded-lg overflow-hidden shadow-sm transition-all duration-300 ${state.status === 'success' ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white hover:border-blue-400'}`}>
      <div className={`p-3 border-b min-h-[85px] text-center ${state.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
        <h3 className="text-sm font-semibold text-slate-800 line-clamp-2">{title}</h3>
        <p className="text-[10px] text-slate-500 mt-1 leading-tight">{description}</p>
        {extraContent && <div className="mt-2 text-[10px] text-slate-600">{extraContent}</div>}
      </div>

      <div
        onClick={handleClick}
        className={`p-6 cursor-pointer flex flex-col items-center justify-center space-y-2 relative transition-colors duration-300 ${state.status === 'success' ? 'bg-green-50' : 'bg-white hover:bg-blue-50'
          }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf"
        />

        {state.status === 'idle' && (
          <>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full transition-transform hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-xs font-medium text-slate-600">Haz clic para subir PDF</p>
            <p className="text-[10px] text-slate-400">Máx. 500 KB · Solo PDF</p>
          </>
        )}

        {state.status === 'uploading' && (
          <div className="flex flex-col items-center space-y-2 py-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-xs font-medium text-blue-600 animate-pulse">Subiendo archivo...</p>
          </div>
        )}

        {state.status === 'success' && (
          <div className="flex flex-col items-center space-y-2 py-2 animate-[bounce_0.5s_ease-out]">
            <div className="p-3 bg-green-100 text-green-600 rounded-full scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs font-bold text-green-700">¡Cargado con éxito!</p>
            <p className="text-[10px] text-green-600 truncate max-w-[150px]">{state.file?.name}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClick()
              }}
              className="text-[10px] font-semibold text-blue-700 underline hover:text-blue-900"
            >
              Si quiere volver a subir su documento, presione aquí
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const ILOVEPDF_UNIR = 'https://www.ilovepdf.com/es/unir_pdf'

interface DocItem {
  id: string
  title: string
  description: string
  extraContent?: ReactNode
}

export function DocumentosPostulacion() {
  const navigate = useNavigate()
  const { data, setFile, markStepCompleted } = usePostulacion()
  const [mostrarErrores, setMostrarErrores] = useState(false)
  const [subidos, setSubidos] = useState<Record<string, boolean>>({})
  const tieneHermanosParent = data.tieneHermanosOHijosEstudiando === 'Si'
  const tieneUno = data.tieneUnHermanOHijoEstudiando === 'Si'
  const tieneDosOMas = data.tieneDosOMasHermanosOHijosEstudiando === 'Si'
  const tieneHermanos = tieneHermanosParent && (tieneUno || tieneDosOMas)
  
  const tieneDosOMasHermanos = tieneDosOMas
  const enfermedadCatastrofica = data.enfermedadCatastrofica === 'Si'
  const enfermedadCronica = data.enfermedadCronica === 'Si'
  const mostrarCertificadoMedico = enfermedadCatastrofica || enfermedadCronica
  const mostrarUnirCertificadosMedicos = enfermedadCatastrofica && enfermedadCronica

  const documentos: DocItem[] = useMemo(
    () => [
      {
        id: 'identidad',
        title: 'Fotocopia Cédula de Identidad (cara frontal)',
        description: 'Foto o escaneo legible donde se vea el rostro y los datos del carnet.'
      },
      {
        id: 'matricula',
        title: 'Certificado de matrícula o comprobante de pago',
        description: 'Documento que acredite matrícula o pago del período vigente.'
      },
      {
        id: 'rsh',
        title: 'Cartola registro social de hogares',
        description: 'Puede obtenerla en el sitio del RSH (registrosocial.gob.cl) o en ChileAtiende.'
      },
      {
        id: 'nem',
        title: 'Concentración de notas enseñanza media (NEM)',
        description: 'Notas de los 4 años de enseñanza media.'
      },
      ...(tieneHermanos
        ? [
            {
              id: 'hermanos',
              title: tieneDosOMasHermanos ? 'Subir acá ambos certificados de alumno regular' : 'Certificado alumno regular (1 hermano o hijo)',
              description: tieneDosOMasHermanos ? 'Un solo PDF con ambos certificados.' : 'Un certificado de alumno regular.',
              ...(tieneDosOMasHermanos && {
                extraContent: (
                  <p>
                    Si tiene dos documentos separados puede unirlos con{' '}
                    <a href={ILOVEPDF_UNIR} target="_blank" rel="noopener noreferrer" className="underline font-semibold text-blue-600 hover:text-blue-800">
                      ilovepdf.com/unir_pdf
                    </a>
                    {' '}y luego subirlos en esta sección.
                  </p>
                )
              })
            } as DocItem
          ]
        : []),
      ...(mostrarCertificadoMedico
        ? [
            {
              id: 'medico',
              title: 'Certificado médico de enfermedad',
              description: '',
              ...(mostrarUnirCertificadosMedicos && {
                extraContent: (
                  <p>
                    Si tiene enfermedades catastróficas y crónicas y más de un documento, debe unirlos con{' '}
                    <a href={ILOVEPDF_UNIR} target="_blank" rel="noopener noreferrer" className="underline font-semibold text-blue-600 hover:text-blue-800">
                      ilovepdf.com/unir_pdf
                    </a>{' '}
                    y luego subirlos a esta sección.
                  </p>
                )
              })
            } as DocItem
          ]
        : [])
    ],
    [mostrarCertificadoMedico, mostrarUnirCertificadosMedicos, tieneDosOMasHermanos, tieneHermanos],
  )

  const idsRequeridos = useMemo(() => documentos.map((d) => d.id), [documentos])
  const todosSubidos = useMemo(
    () => idsRequeridos.every((id) => subidos[id]),
    [idsRequeridos, subidos],
  )

  // Mantener el estado de "subido" sincronizado con los documentos visibles.
  useEffect(() => {
    setSubidos((current) => {
      let changed = false
      const next: Record<string, boolean> = {}
      for (const id of idsRequeridos) {
        next[id] = current[id] ?? false
        if (!(id in current)) changed = true
      }
      // Si se ocultó un documento, también hay cambio (quitamos keys antiguas).
      if (!changed) {
        for (const k of Object.keys(current)) {
          if (!idsRequeridos.includes(k)) {
            changed = true
            break
          }
        }
      }
      return changed ? next : current
    })
  }, [idsRequeridos])

  function onFormSubmit(event: FormEvent) {
    event.preventDefault()
    setMostrarErrores(true)

    if (!todosSubidos) return
    markStepCompleted(5)
    // Pequeño timeout para animación de éxito si hubiera
    setTimeout(() => {
      navigate('/declaracion_jurada_8')
    }, 100)
  }

  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center py-8">
      <form
        onSubmit={onFormSubmit}
        className="mx-auto w-full max-w-4xl space-y-6 rounded-xl border border-slate-200 bg-white px-8 py-8 shadow-sm"
      >
        <img src={logoMolina} alt="Logo" className="mx-auto h-24 w-auto object-contain mb-2" />
        
        <header className="space-y-1 text-center">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider">Paso 5 de 6</p>
          <h1 className="text-2xl font-bold text-slate-800">Documentos obligatorios</h1>
        </header>

        {/* Banner de Estado Constante */}
        <div className={`rounded-xl border p-5 shadow-sm transition-all ${mostrarErrores && !todosSubidos ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className={`shrink-0 flex items-center justify-center h-10 w-10 rounded-full ${mostrarErrores && !todosSubidos ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
              {mostrarErrores && !todosSubidos ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg>
              )}
            </div>
            <div className="flex-1">
              <h3 className={`text-sm font-bold uppercase tracking-tight mb-1 ${mostrarErrores && !todosSubidos ? 'text-red-800' : 'text-blue-900'}`}>
                {mostrarErrores && !todosSubidos ? 'Faltan documentos por subir' : 'Instrucciones de carga'}
              </h3>
              <p className={`text-sm leading-relaxed ${mostrarErrores && !todosSubidos ? 'text-red-700' : 'text-blue-800'}`}>
                Para continuar, debe adjuntar todos los documentos en formato <span className="font-bold underline decoration-blue-400">PDF</span> con un tamaño máximo de <span className="font-bold">500 KB</span>. Si su archivo es más pesado, puede comprimirlo gratis en <a href="https://www.ilovepdf.com/compress_pdf" target="_blank" rel="noopener noreferrer" className="font-bold hover:underline text-blue-900">ilovepdf.com</a>.
              </p>
            </div>
          </div>
        </div>

        {/* Cuadrícula de documentos adaptativa */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
          {documentos.map((doc) => (
            <DocumentItem
              key={doc.id}
              id={doc.id}
              title={doc.title}
              description={doc.description}
              extraContent={doc.extraContent}
              onUploaded={(id, file) => {
                setSubidos((current) => ({ ...current, [id]: true }))
                setFile(id, file)
              }}
            />
          ))}
        </div>

        <div className="pt-6 mt-4 flex justify-between items-center border-t border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/cuenta_bancaria_5')}
              className="px-6 py-2.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Atrás
            </button>
            <button
              type="submit"
              className="px-8 py-2.5 rounded-lg bg-blue-800 text-sm font-bold text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98]"
            >
               Siguiente
            </button>
        </div>
      </form>
    </div>
  )
}
