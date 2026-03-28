import { useState } from 'react'
import type { PostulanteFirestore, EstadoPostulacion } from '../../types/postulante'
import { generarReporteIndividualPDF } from '../../services/pdfGenerator'
import { formatDate } from '../../utils/inputFormatters'
import { ref, getBlob } from 'firebase/storage'
import { storage } from '../../firebase/config'
import { etiquetaBancoOtra } from '../../postulacion/shared/cuentaBancariaSchema'

interface Props {
  postulante: PostulanteFirestore
  onClose: () => void
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1 mb-2">{children}</h3>
}

function Field({ label, value }: { label: string; value: string | number | undefined | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 mt-0.5">{value || '—'}</dd>
    </div>
  )
}

const BADGE: Record<EstadoPostulacion, string> = {
  pendiente: 'bg-blue-100 text-blue-800',
  en_revision: 'bg-amber-100 text-amber-800',
  documentacion_validada: 'bg-emerald-100 text-emerald-800',
  aprobado: 'bg-green-100 text-green-800',
  rechazado: 'bg-red-100 text-red-800',
}

function getEstadoLabel(estado: EstadoPostulacion): string {
  if (estado === 'pendiente') return 'Pre-aprobado'
  if (estado === 'en_revision') return 'En revisión'
  if (estado === 'documentacion_validada') return 'Documentación validada'
  return estado.toUpperCase()
}

/** Nombres descriptivos para documentos (mismo mapeo que zipDownload/storageService) */
const NOMBRES_DOCUMENTOS: Record<string, string> = {
  identidad: 'Cédula de identidad',
  matricula: 'Certificado de matrícula',
  rsh: 'Cartola registro social hogares',
  nem: 'Concentración notas NEM',
  hermanos: 'Certificado alumno regular',
  medico: 'Certificado médico',
}

function labelDocumento(docId: string): string {
  return NOMBRES_DOCUMENTOS[docId] ?? docId.replace(/_/g, ' ')
}

/** Extrae el path relativo de Storage desde una URL de descarga de Firebase */
function storagePathFromDownloadUrl(url: string): string | null {
  try {
    const decodedUrl = decodeURIComponent(url)
    const parts = decodedUrl.split('/o/')
    if (parts.length < 2) return null
    return parts[1].split('?')[0]
  } catch (e) {
    return null
  }
}

export function PostulanteDetail({ postulante: p, onClose }: Props) {
  const [descargando, setDescargando] = useState<string | null>(null)

  const handleVerDocumento = async (key: string, url: string) => {
    const path = storagePathFromDownloadUrl(url)
    if (!path) {
      window.open(url, '_blank')
      return
    }

    try {
      setDescargando(key)
      const fileRef = ref(storage, path)
      const blob = await getBlob(fileRef)
      const blobUrl = URL.createObjectURL(blob)
      window.open(blobUrl, '_blank')
      // Nota: No revocamos inmediatamente para que el navegador pueda mostrarlo
    } catch (error) {
      console.error('Error al descargar documento:', error)
      window.open(url, '_blank') // Fallback al link directo
    } finally {
      setDescargando(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 pt-8 pb-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {p.nombres} {p.apellidoPaterno} {p.apellidoMaterno}
            </h2>
            <p className="text-sm text-slate-500">{p.rut}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${BADGE[p.estado]}`}>
              {getEstadoLabel(p.estado)}
            </span>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-10rem)] overflow-y-auto">
          {/* Puntaje */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <h3 className="text-sm font-bold text-blue-800 mb-3">Desglose de puntaje</h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                { label: 'NEM', value: p.puntaje.nem },
                { label: 'RSH', value: p.puntaje.rsh },
                { label: 'Enfermedad', value: p.puntaje.enfermedad },
                { label: 'Hermanos', value: p.puntaje.hermanos },
                { label: 'TOTAL', value: p.puntaje.total },
              ].map((item) => (
                <div key={item.label} className={`rounded-lg p-2 ${item.label === 'TOTAL' ? 'bg-blue-700 text-white' : 'bg-white'}`}>
                  <p className={`text-[10px] font-semibold uppercase ${item.label === 'TOTAL' ? 'text-blue-200' : 'text-slate-500'}`}>{item.label}</p>
                  <p className={`text-lg font-bold ${item.label === 'TOTAL' ? '' : 'text-slate-900'}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {p.motivoRechazo && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-bold text-red-800 uppercase">Motivo de rechazo</p>
              <p className="text-sm text-red-700 mt-1">{p.motivoRechazo}</p>
            </div>
          )}

          {/* Datos personales */}
          <div>
            <SectionTitle>Datos personales</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label="Nombres" value={p.nombres} />
              <Field label="Apellido paterno" value={p.apellidoPaterno} />
              <Field label="Apellido materno" value={p.apellidoMaterno} />
              <Field label="RUT" value={p.rut} />
              <Field label="Fecha nacimiento" value={formatDate(p.fechaNacimiento)} />
              <Field label="Edad" value={p.edad} />
              <Field label="Sexo" value={p.sexo} />
              <Field label="Estado civil" value={p.estadoCivil} />
              <Field label="Teléfono" value={p.telefono} />
              <Field label="Email" value={p.email} />
              <Field label="Domicilio" value={p.domicilioFamiliar} />
              <Field label="Fecha postulación" value={formatDate(p.fechaPostulacion)} />
              <Field label="Hora postulación" value={p.horaPostulacion} />
            </dl>
          </div>

          {/* Académicos */}
          <div>
            <SectionTitle>Antecedentes académicos</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label="NEM" value={p.nem} />
              <Field label="Institución" value={p.nombreInstitucion} />
              <Field label="Comuna" value={p.comuna} />
              <Field label="Carrera" value={p.carrera} />
              <Field label="Duración (semestres)" value={p.duracionSemestres} />
              <Field label="Matrícula en curso (año)" value={p.anoIngreso} />
            </dl>
          </div>

          {/* Familiares */}
          <div>
            <SectionTitle>Antecedentes familiares</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              <Field label="Total integrantes" value={p.totalIntegrantes} />
              <Field label="Tramo RSH" value={p.tramoRegistroSocial} />
              <Field label="Hermanos/hijos estudiando" value={p.tieneHermanosOHijosEstudiando} />
              <Field label="1 hermano/hijo" value={p.tieneUnHermanOHijoEstudiando} />
              <Field label="2+ hermanos/hijos" value={p.tieneDosOMasHermanosOHijosEstudiando} />
              <Field label="Enfermedad catastrófica" value={p.enfermedadCatastrofica} />
              <Field label="Enfermedad crónica" value={p.enfermedadCronica} />
            </dl>
          </div>

          {/* Bancario */}
          <div>
            <SectionTitle>Cuenta bancaria</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Field
                label="Modalidad"
                value={p.tipoCuentaBancaria === 'otra' ? 'Otra cuenta bancaria' : 'Cuenta RUT'}
              />
              {p.tipoCuentaBancaria === 'otra' ? (
                <>
                  <Field label="Banco" value={etiquetaBancoOtra(p)} />
                  <Field label="Tipo de cuenta" value={p.otraTipoCuenta} />
                  <Field label="Número de cuenta" value={p.otraNumeroCuenta} />
                  <Field label="RUT titular" value={p.otraRutTitular} />
                </>
              ) : (
                <>
                  <Field label="Número cuenta RUT" value={p.numeroCuenta} />
                  <Field label="RUT titular" value={p.rutCuenta} />
                </>
              )}
            </dl>
          </div>

          {/* Observaciones */}
          {p.observacion && (
            <div>
              <SectionTitle>Observaciones</SectionTitle>
              <p className="text-sm text-slate-700">{p.observacion}</p>
            </div>
          )}

          {/* Documentos */}
          <div>
            <SectionTitle>Documentos subidos</SectionTitle>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(p.documentUrls || {}).map(([key, url]) => (
                <button
                  key={key}
                  onClick={() => handleVerDocumento(key, url)}
                  disabled={descargando === key}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 flex-shrink-0 ${descargando === key ? 'animate-pulse' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {descargando === key ? 'Cargando...' : `${labelDocumento(key)}.pdf`}
                </button>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
            <button
              onClick={() => {
                const blob = generarReporteIndividualPDF(p)
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `reporte_${(p.rut || '').replace(/\s/g, '')}_${p.apellidoPaterno || 'postulante'}.pdf`
                a.click()
                URL.revokeObjectURL(url)
              }}
              className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Descargar reporte PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
