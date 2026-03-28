import type { PostulanteFirestore } from '../../../types/postulante'
import { formatDate, formatDateTime } from '../../../utils/inputFormatters'
import { resumenCuentaBancariaListado } from '../../../utils/cuentaBancariaDisplay'
import { useAuth } from '../../../hooks/useAuth'

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
              <th className="px-2 py-2 text-center font-black uppercase text-slate-800 whitespace-nowrap sticky left-0 z-10 bg-inherit shadow-[1px_0_0_0_rgba(203,213,225,1)]">#</th>
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

                return (
                <tr key={p.id} className={`hover:bg-slate-50/80 transition-colors ${!isAssigned ? 'opacity-70' : ''}`}>
                  <td className="px-3 py-1.5 text-center font-bold text-slate-500 whitespace-nowrap sticky left-0 z-10 bg-white shadow-[1px_0_0_0_rgba(241,245,249,1)]">
                    {p.ordenRevisionDoc ?? startIndex + idx}
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
                    <div className="flex justify-center gap-1">
                      {p.estado === 'rechazado' ? (
                        <button
                          type="button"
                          onClick={() => onVerMotivo?.(p)}
                          className="rounded bg-red-100 px-2 py-1 text-[9px] font-bold text-red-700 hover:bg-red-200 uppercase tracking-tighter"
                        >
                          Rechazado
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => isAssigned ? onEvaluar?.(p) : alert('No tienes permisos para evaluar a este postulante porque no se encuentra en tu tramo de asignación.')}
                          disabled={(isFinalView && !isRechazadosView) || !isAssigned}
                          title={!isAssigned ? "No puedes evaluar porque no pertenece a tu tramo asignado" : ""}
                          className={`rounded px-2 py-1 text-[9px] font-bold uppercase tracking-tighter whitespace-nowrap transition-colors ${
                            !isAssigned 
                              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                              : p.estado === 'documentacion_validada'
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-blue-800 text-white hover:bg-blue-700'
                          }`}
                        >
                          {p.estado === 'documentacion_validada' ? 'Validado' : 'Evaluar'}
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
