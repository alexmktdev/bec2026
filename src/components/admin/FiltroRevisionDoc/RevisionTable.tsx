import type { PostulanteFirestore } from '../../../types/postulante'
import { formatDate, formatDateTime } from '../../../utils/inputFormatters'
import { resumenCuentaBancariaListado } from '../../../utils/cuentaBancariaDisplay'
import {
  conteoValidacionDocumentos,
  getRevisionDocumentosEstado,
  type RevisionDocumentosEstado,
} from '../../../utils/revisionDocumentosEstado'
import { useAuth } from '../../../hooks/useAuth'

function badgeRevisionDocs(
  p: PostulanteFirestore,
  modo: 'revision' | 'final_ok' | 'final_rechazo',
): { label: string; sub?: string; className: string; pulse?: boolean } {
  if (modo === 'final_rechazo') {
    return {
      label: 'Rechazado',
      className: 'border-red-300 bg-red-100 text-red-900',
    }
  }
  if (modo === 'final_ok') {
    return {
      label: 'Validado',
      sub: 'Listo para desempate',
      className: 'border-emerald-400 bg-emerald-100 text-emerald-900',
    }
  }
  const estado = getRevisionDocumentosEstado(p)
  const { total, validados } = conteoValidacionDocumentos(p)
  switch (estado) {
    case 'rechazado':
      return { label: 'Rechazado', className: 'border-red-300 bg-red-100 text-red-900' }
    case 'completo':
      return {
        label: 'Validado',
        sub: 'Documentación completa',
        className: 'border-emerald-400 bg-emerald-100 text-emerald-900',
      }
    case 'en_proceso':
      return {
        label: 'Validación incompleta',
        sub: total > 0 ? `En proceso · ${validados}/${total} documentos` : 'En proceso',
        className: 'border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-400/80',
        pulse: true,
      }
    case 'sin_docs':
      return {
        label: 'Sin documentos',
        sub: 'No hay archivos que revisar',
        className: 'border-orange-400 bg-orange-100 text-orange-950',
      }
    default:
      return {
        label: 'Pendiente de revisar',
        sub: 'Aún sin documentos validados',
        className: 'border-slate-300 bg-slate-100 text-slate-700',
      }
  }
}

function filaClassRevision(estado: RevisionDocumentosEstado, modoRevision: boolean): string {
  if (!modoRevision) return ''
  if (estado === 'en_proceso') return 'shadow-[inset_4px_0_0_0_#d97706]'
  if (estado === 'sin_docs') return 'shadow-[inset_4px_0_0_0_#ea580c]'
  if (estado === 'completo') return 'shadow-[inset_4px_0_0_0_#059669]'
  return ''
}

interface RevisionTableProps {
  postulantes: PostulanteFirestore[]
  onEvaluar?: (p: PostulanteFirestore) => void
  onVerMotivo?: (p: PostulanteFirestore) => void
  isFinalView?: boolean
  isRechazadosView?: boolean
  scrollRef?: React.RefObject<HTMLDivElement | null>
  startIndex?: number
}

export function RevisionTable({ 
  postulantes, 
  onEvaluar, 
  onVerMotivo, 
  isFinalView, 
  isRechazadosView,
  scrollRef,
  startIndex = 1
}: RevisionTableProps) {
  const { user, userRole } = useAuth()
  
  const theadBg = isRechazadosView ? 'bg-red-50' : isFinalView ? 'bg-emerald-50' : 'bg-slate-50'
  const emptyMsg = isRechazadosView 
    ? 'No hay postulantes rechazados.' 
    : isFinalView 
      ? 'No hay postulantes con documentación validada.' 
      : 'No hay postulantes en esta sección.'

  return (
    <div className="rounded-xl border border-slate-200 shadow-sm overflow-hidden bg-white">
      <div ref={scrollRef} className="overflow-x-scroll no-scrollbar">
        <table className="min-w-max w-full divide-y divide-slate-200 text-[10px]">
          <thead className={theadBg}>
            <tr>
              <th className="px-2 py-2 text-center font-black uppercase text-slate-800 whitespace-nowrap sticky left-0 z-10 bg-inherit shadow-[1px_0_0_0_rgba(203,213,225,1)] min-w-[7.5rem]">
                <span className="block">#</span>
                {!isFinalView && !isRechazadosView && (
                  <span className="mt-1 block text-[8px] font-bold uppercase tracking-wide text-amber-800 normal-case">
                    Validación
                  </span>
                )}
              </th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Nombres</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Apellido Paterno</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Apellido Materno</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">RUT</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">F. Nacimiento</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Edad</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Sexo</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Estado Civil</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Teléfono</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Email</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Domicilio</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap bg-blue-50/30">F. Postulación</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-indigo-600 whitespace-nowrap bg-indigo-50/30">NEM</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Institución</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Comuna</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Carrera</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap text-center">Duración</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap text-center">Matrícula en curso (año)</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap text-center">Integrantes</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-teal-600 whitespace-nowrap bg-teal-50/30">Tramo RSH</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-purple-600 whitespace-nowrap bg-purple-50/30">Hnos. Estudiando</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-purple-600 whitespace-nowrap bg-purple-50/30">1 Hno/Hijo</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-purple-600 whitespace-nowrap bg-purple-50/30">2+ Hnos/Hijos</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-rose-600 whitespace-nowrap bg-rose-50/30">Enf. Catastrófica</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-rose-600 whitespace-nowrap bg-rose-50/30">Enf. Crónica</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap min-w-[180px]">Cuenta bancaria</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap">Obs.</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-indigo-700 whitespace-nowrap bg-indigo-50/50">Pts. NEM</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-teal-700 whitespace-nowrap bg-teal-50/50">Pts. RSH</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-rose-700 whitespace-nowrap bg-rose-50/50">Pts. Enf.</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-purple-700 whitespace-nowrap bg-purple-50/50">Pts. Hnos.</th>
              <th className="px-2 py-2 text-left font-bold uppercase text-blue-900 whitespace-nowrap bg-blue-100">Puntaje Total</th>
              <th className="px-2 py-2 text-left font-semibold uppercase text-slate-500 whitespace-nowrap bg-slate-50/30">F. Registro</th>
              <th className={`sticky right-0 z-10 ${theadBg} px-3 py-2 text-center font-semibold uppercase text-slate-500 whitespace-nowrap border-l border-slate-200 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]`}>
                Acción
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {postulantes.length === 0 ? (
              <tr>
                <td colSpan={35} className="py-12 text-center text-slate-400 font-medium">
                  {emptyMsg}
                </td>
              </tr>
            ) : (
              postulantes.map((p, idx) => {
                const isAssigned = userRole?.role === 'superadmin' || p.assignedTo === user?.uid
                const modoBadge: 'revision' | 'final_ok' | 'final_rechazo' = isRechazadosView
                  ? 'final_rechazo'
                  : isFinalView
                    ? 'final_ok'
                    : 'revision'
                const docBadge = badgeRevisionDocs(p, modoBadge)
                const estadoDoc = getRevisionDocumentosEstado(p)
                const modoRevision = !isFinalView && !isRechazadosView
                const filaExtra = filaClassRevision(estadoDoc, modoRevision)
                const stickyBg =
                  modoRevision && estadoDoc === 'en_proceso'
                    ? 'bg-amber-50'
                    : modoRevision && estadoDoc === 'sin_docs'
                      ? 'bg-orange-50'
                      : modoRevision && estadoDoc === 'completo'
                        ? 'bg-emerald-50/80'
                        : 'bg-white'

                return (
                <tr
                  key={p.id}
                  className={`transition-colors ${filaExtra} ${!isAssigned ? 'opacity-70' : ''} ${modoRevision ? 'hover:brightness-[0.985]' : 'hover:bg-slate-50/80'}`}
                >
                  <td
                    className={`px-2 py-2 text-center sticky left-0 z-10 shadow-[1px_0_0_0_rgba(241,245,249,1)] ${stickyBg}`}
                  >
                    <span className="block text-sm font-bold text-slate-600 tabular-nums">
                      {p.ordenRevisionDoc ?? startIndex + idx}
                    </span>
                    <div
                      className={`mt-1.5 inline-flex max-w-[9rem] flex-col items-center gap-0.5 rounded-md border px-1.5 py-1 text-center text-[8px] font-extrabold uppercase leading-tight tracking-tight ${docBadge.className} ${docBadge.pulse ? 'animate-pulse' : ''}`}
                    >
                      <span>{docBadge.label}</span>
                      {docBadge.sub && (
                        <span className="text-[7px] font-semibold normal-case leading-snug opacity-95">{docBadge.sub}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap font-medium">{p.nombres}</td>
                  <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{p.apellidoPaterno}</td>

                  <td className="px-2 py-1.5 text-slate-700 whitespace-nowrap">{p.apellidoMaterno}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap font-mono">{p.rut}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{formatDate(p.fechaNacimiento)}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.edad}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.sexo}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.estadoCivil}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.telefono}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.email}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap max-w-[120px] truncate" title={p.domicilioFamiliar}>{p.domicilioFamiliar}</td>
                  <td className="px-2 py-1.5 text-blue-800 whitespace-nowrap text-center bg-blue-50/20 font-medium italic">{formatDate(p.fechaPostulacion)}</td>
                  <td className="px-2 py-1.5 text-indigo-800 whitespace-nowrap text-center bg-indigo-50/20 font-bold">{p.nem}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap truncate max-w-[120px]" title={p.nombreInstitucion}>{p.nombreInstitucion}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap">{p.comuna}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap truncate max-w-[100px]" title={p.carrera}>{p.carrera}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-center">{p.duracionSemestres}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-center">{p.anoIngreso}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap text-center">{p.totalIntegrantes}</td>
                  <td className="px-2 py-1.5 text-teal-800 whitespace-nowrap text-center bg-teal-50/20 font-bold">{p.tramoRegistroSocial}</td>
                  <td className="px-2 py-1.5 text-purple-700 whitespace-nowrap text-center bg-purple-50/20 font-medium">{p.tieneHermanosOHijosEstudiando}</td>
                  <td className="px-2 py-1.5 text-purple-700 whitespace-nowrap text-center bg-purple-50/20 font-medium">{p.tieneUnHermanOHijoEstudiando}</td>
                  <td className="px-2 py-1.5 text-purple-700 whitespace-nowrap text-center bg-purple-50/20 font-medium">{p.tieneDosOMasHermanosOHijosEstudiando}</td>
                  <td className="px-2 py-1.5 text-rose-700 whitespace-nowrap text-center bg-rose-50/20 font-semibold">{p.enfermedadCatastrofica}</td>
                  <td className="px-2 py-1.5 text-rose-700 whitespace-nowrap text-center bg-rose-50/20 font-semibold">{p.enfermedadCronica}</td>
                  <td
                    className="px-2 py-1.5 text-slate-600 text-[9px] leading-tight max-w-[200px]"
                    title={resumenCuentaBancariaListado(p)}
                  >
                    {resumenCuentaBancariaListado(p)}
                  </td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap truncate max-w-[100px]" title={p.observacion}>{p.observacion}</td>
                  <td className="px-2 py-1.5 text-indigo-900 whitespace-nowrap text-center font-black bg-indigo-50/40">{p.puntaje.nem}</td>
                  <td className="px-2 py-1.5 text-teal-900 whitespace-nowrap text-center font-black bg-teal-50/40">{p.puntaje.rsh}</td>
                  <td className="px-2 py-1.5 text-rose-900 whitespace-nowrap text-center font-black bg-rose-50/40">{p.puntaje.enfermedad}</td>
                  <td className="px-2 py-1.5 text-purple-900 whitespace-nowrap text-center font-black bg-purple-50/40">{p.puntaje.hermanos}</td>
                  <td className="px-2 py-1.5 bg-blue-100 text-blue-900 whitespace-nowrap text-center font-black shadow-[inset_0_0_0_1px_rgba(30,64,175,0.1)]">{p.puntaje.total}</td>
                  <td className="px-2 py-1.5 text-slate-600 whitespace-nowrap font-semibold">{formatDateTime(p.createdAt)}</td>
                  <td className={`sticky right-0 z-10 bg-white px-3 py-1.5 text-center border-l border-slate-200 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.06)]`}>
                    <div className="flex flex-wrap justify-center gap-1">
                      {p.estado === 'rechazado' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onVerMotivo?.(p)}
                            className="rounded bg-red-100 px-2 py-1 text-[9px] font-bold text-red-700 hover:bg-red-200 uppercase tracking-tighter"
                          >
                            Motivo
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              isAssigned
                                ? onEvaluar?.(p)
                                : alert(
                                    'No tienes permisos para evaluar a este postulante porque no se encuentra en tu tramo de asignación.',
                                  )
                            }
                            disabled={!isAssigned}
                            title={
                              !isAssigned
                                ? 'No puedes editar porque no pertenece a tu tramo asignado'
                                : 'Corregir validación o levantar el rechazo'
                            }
                            className={`rounded px-2 py-1 text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap ${
                              !isAssigned
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-amber-600 text-white hover:bg-amber-700'
                            }`}
                          >
                            Editar
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            isAssigned
                              ? onEvaluar?.(p)
                              : alert(
                                  'No tienes permisos para evaluar a este postulante porque no se encuentra en tu tramo de asignación.',
                                )
                          }
                          disabled={!isAssigned}
                          title={
                            !isAssigned
                              ? 'No puedes evaluar porque no pertenece a tu tramo asignado'
                              : p.estado === 'documentacion_validada'
                                ? 'Modificar la revisión de documentos'
                                : undefined
                          }
                          className={`rounded px-2 py-1 text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap transition-colors ${
                            !isAssigned
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : p.estado === 'documentacion_validada'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-blue-800 text-white hover:bg-blue-700'
                          }`}
                        >
                          {p.estado === 'documentacion_validada' ? 'Editar revisión' : 'Evaluar'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
