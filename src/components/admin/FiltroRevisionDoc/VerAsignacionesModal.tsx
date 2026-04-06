import { useEffect, useState } from 'react'
import type { TramoVigenteEstado } from '../../../types/postulante'
import { obtenerTramos } from '../../../services/tramosService'

interface Props {
  onClose: () => void
}

export function VerAsignacionesModal({ onClose }: Props) {
  const [asignaciones, setAsignaciones] = useState<TramoVigenteEstado[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    obtenerTramos()
      .then(tramos => setAsignaciones(tramos))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-200 bg-emerald-50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h2 className="text-xl font-bold text-emerald-900 tracking-tight">Tramos Vigentes</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] bg-slate-50">
          {loading ? (
            <div className="flex justify-center items-center py-10 text-slate-500 font-medium">Cargando asignaciones...</div>
          ) : asignaciones.length === 0 ? (
            <div className="text-center py-10 opacity-70 text-slate-500 font-medium">No hay tramos de revisión activos en este momento.</div>
          ) : (
            <ul className="space-y-3">
              {asignaciones.map((a) => (
                <li
                  key={a.segmentId || `${a.reviewerUid}-${a.startRange}-${a.endRange}`}
                  className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-slate-800 text-base flex items-center gap-2">
                      {a.reviewerName}
                      {a.terminado && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-800"
                          title="Terminó de validar todos sus postulantes asignados"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Terminado
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500">{a.reviewerEmail}</span>
                    <span className="text-[11px] text-slate-500">
                      Avance: <strong>{a.totalTerminados}</strong>/{a.totalAsignados}
                    </span>
                    <span className="text-[11px] text-slate-600">
                      Validados: <strong className="text-emerald-800">{a.totalValidados}</strong>
                      {' · '}
                      Rechazados: <strong className="text-rose-800">{a.totalRechazados}</strong>
                    </span>
                  </div>
                  <div className="bg-emerald-100 text-emerald-800 font-black px-4 py-1.5 rounded-lg border border-emerald-200 shadow-sm">
                    {a.startRange} - {a.endRange}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors border border-slate-300">
            Cerrar panel
          </button>
        </div>
      </div>
    </div>
  )
}
