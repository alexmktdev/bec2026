import { useState } from 'react'
import { ref, getBlob } from 'firebase/storage'
import { storage } from '../../../firebase/config'
import { actualizarDocumentosValidados, cambiarEstado } from '../../../services/postulacionService'
import type { PostulanteFirestore } from '../../../types/postulante'
import { PostulanteEdit } from '../PostulanteEdit'
import { ModalRechazo } from './ModalRechazo'
import { labelDocumento, storagePathFromDownloadUrl } from './utils'

interface PanelEvaluacionProps {
  postulante: PostulanteFirestore
  onClose: () => void
  onValidado: () => void
  onActualizarPostulante?: (updated: PostulanteFirestore) => void
}

export function PanelEvaluacion({ postulante, onClose, onValidado, onActualizarPostulante }: PanelEvaluacionProps) {
  const [postulanteLocal, setPostulanteLocal] = useState<PostulanteFirestore>(postulante)
  const [validaciones, setValidaciones] = useState<Record<string, boolean>>(
    () => postulante.documentosValidados ?? {},
  )
  const [abriendo, setAbriendo] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [rechazandoDoc, setRechazandoDoc] = useState<string | null>(null)
  const [guardandoRechazo, setGuardandoRechazo] = useState(false)
  const [invalidoDoc, setInvalidoDoc] = useState<string | null>(null)
  const [editandoPostulante, setEditandoPostulante] = useState(false)

  const docEntries = Object.entries(postulanteLocal.documentUrls ?? {})
  const todosValidados =
    docEntries.length > 0 &&
    docEntries.every(([key]) => validaciones[key] === true)
  const algunDocValidadoLocal = docEntries.some(([key]) => validaciones[key] === true)
  const validadosCount = docEntries.filter(([key]) => validaciones[key] === true).length

  const handleGuardadoEdicion = async (actualizado: PostulanteFirestore) => {
    setPostulanteLocal(actualizado)
    setEditandoPostulante(false)
    setInvalidoDoc(null)
    onActualizarPostulante?.(actualizado)
  }

  const handleAbrir = async (key: string, url: string) => {
    const path = storagePathFromDownloadUrl(url)
    setAbriendo(key)
    try {
      if (path) {
        const fileRef = ref(storage, path)
        const blob = await getBlob(fileRef)
        const blobUrl = URL.createObjectURL(blob)
        window.open(blobUrl, '_blank')
      } else {
        window.open(url, '_blank')
      }
    } catch (err) {
      console.error('Error al abrir documento:', err)
      window.open(url, '_blank')
    } finally {
      setAbriendo(null)
    }
  }

  const toggleValidar = (key: string) => {
    setValidaciones((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleConfirmarRechazo = async (motivo: string) => {
    if (!postulanteLocal.id || !rechazandoDoc) return
    setGuardandoRechazo(true)
    try {
      await cambiarEstado(postulanteLocal.id, 'rechazado', motivo)
      setRechazandoDoc(null)
      onValidado()
      onClose()
    } catch (err) {
      console.error('Error al rechazar:', err)
    } finally {
      setGuardandoRechazo(false)
    }
  }

  const handleGuardar = async () => {
    if (!postulanteLocal.id) return
    setGuardando(true)
    try {
      const nuevoEstado = { ...validaciones }
      for (const [key] of docEntries) {
        if (!(key in nuevoEstado)) nuevoEstado[key] = false
      }
      await actualizarDocumentosValidados(
        postulanteLocal.id,
        nuevoEstado,
        postulanteLocal.documentUrls ?? {},
      )
      onValidado()
      onClose()
    } catch (err) {
      console.error('Error guardando validaciones:', err)
    } finally {
      setGuardando(false)
    }
  }

  const handleRestablecer = async () => {
    if (!postulanteLocal.id) return
    setGuardando(true)
    try {
      await actualizarDocumentosValidados(postulanteLocal.id, {}, postulanteLocal.documentUrls ?? {})
      setValidaciones({})
      onValidado()
      onClose()
    } catch (err) {
      console.error('Error al restablecer:', err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8">
        <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {postulanteLocal.nombres} {postulanteLocal.apellidoPaterno} {postulanteLocal.apellidoMaterno}
              </h2>
              <p className="text-sm text-slate-500">{postulanteLocal.rut} · Puntaje total: <span className="font-bold text-slate-800">{postulanteLocal.puntaje.total}</span></p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Revisión exhaustiva de documentos
              </p>
              <p className="text-sm text-slate-600 mt-1">
                Abra cada documento y valide que cumpla con lo requisitado. Marque como validado o rechace con su motivo si el documento no es válido.
              </p>
            </div>

            <div className="space-y-2">
              {docEntries.map(([docId, url]) => (
                <div
                  key={docId}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    validaciones[docId]
                      ? 'border-green-200 bg-green-50'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-slate-800 whitespace-nowrap">
                      {labelDocumento(docId)}.pdf
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAbrir(docId, url)}
                      disabled={!!abriendo}
                      className="text-xs font-semibold text-blue-700 hover:text-blue-900 whitespace-nowrap"
                    >
                      {abriendo === docId ? 'Abriendo...' : 'Abrir'}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setInvalidoDoc(docId)}
                      disabled={guardando}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      title="El documento no coincide con los datos ingresados"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Inválido
                    </button>
                    <button
                      type="button"
                      onClick={() => setRechazandoDoc(docId)}
                      disabled={guardando}
                      className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Rechazar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleValidar(docId)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        validaciones[docId]
                          ? 'bg-green-600 text-white'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {validaciones[docId] ? (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Validado
                        </>
                      ) : (
                        'Validar'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {todosValidados && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <p className="text-sm font-semibold text-green-800">
                  Todos los documentos validados. El postulante quedará con estado &quot;Documentación validada&quot; y podrá pasar al filtro final / desempate cuando active el filtro en esta sección.
                </p>
              </div>
            )}

            {!todosValidados && algunDocValidadoLocal && docEntries.length > 0 && (
              <div
                className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 shadow-md ring-2 ring-amber-400/70"
                role="alert"
              >
                <p className="text-sm font-black uppercase tracking-wide text-amber-950">
                  Validación incompleta · en proceso
                </p>
                <p className="mt-1 text-sm font-semibold text-amber-900">
                  Llevas {validadosCount} de {docEntries.length} documentos marcados como válidos. Debes validar todos los
                  documentos para cerrar la revisión de esta persona.
                </p>
                <p className="mt-2 text-xs text-amber-800">
                  Si guardas ahora, el postulante quedará en revisión y en la tabla verás el aviso &quot;Validación
                  incompleta&quot; hasta completar todos los documentos.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2">
              {postulante.estado !== 'pendiente' && (
                <button
                  type="button"
                  onClick={handleRestablecer}
                  disabled={guardando}
                  title="Borrar todas las validaciones y volver al estado inicial"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Restablecer
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={guardando}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleGuardar}
                  disabled={guardando}
                  className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar validaciones'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {rechazandoDoc && (
        <ModalRechazo
          nombreDocumento={labelDocumento(rechazandoDoc)}
          onConfirmar={handleConfirmarRechazo}
          onCancelar={() => setRechazandoDoc(null)}
          guardando={guardandoRechazo}
        />
      )}

      {invalidoDoc && !editandoPostulante && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Documento con problemas</h3>
                <p className="text-xs text-slate-500 mt-0.5">{labelDocumento(invalidoDoc)}.pdf</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              Al parecer se encontraron problemas en el documento. ¿Desea modificar los datos de la persona? Puede que no coincida el documento con los datos ingresados por el postulante.
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Al modificar los datos, el puntaje total será recalculado automáticamente. Podrá continuar la revisión de documentos una vez guardados los cambios.
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInvalidoDoc(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setEditandoPostulante(true)}
                className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Sí, modificar datos
              </button>
            </div>
          </div>
        </div>
      )}

      {editandoPostulante && (
        <PostulanteEdit
          postulante={postulanteLocal}
          onClose={() => { setEditandoPostulante(false); setInvalidoDoc(null) }}
          onGuardado={handleGuardadoEdicion}
        />
      )}
    </>
  )
}
