import { useState, useEffect } from 'react'
import type { PostulanteFirestore, TramoAsignacion } from '../../../types/postulante'
import { obtenerTramos, asignarTramos, limpiarTodasLasAsignacionesTramos } from '../../../services/tramosService'

interface Props {
  onClose: () => void
  /** Misma lista y orden que la tabla de «Revisión de documentación» (p. ej. filtro por puntaje). */
  postulantesEnVistaRevision: PostulanteFirestore[]
  /** Tras guardar o limpiar tramos, para refrescar la nómina sin cerrar el modal. */
  onTramosActualizados?: () => void
}

// We assume there's a service fetch implementation to get user roles (Revisores)
import { obtenerRevisoresAdmin, type UserAdminInfo } from '../../../services/userService'

export function AsignacionRevisoresModal({
  onClose,
  postulantesEnVistaRevision,
  onTramosActualizados,
}: Props) {
  const totalEnVista = postulantesEnVistaRevision.length
  const [revisores, setRevisores] = useState<UserAdminInfo[]>([])
  const [asignaciones, setAsignaciones] = useState<TramoAsignacion[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ title: string, message: string, danger?: boolean, onConfirm: () => void } | null>(null)

  // Temporal state to edit
  const [selectedRevisor, setSelectedRevisor] = useState<string>('')
  const [startRange, setStartRange] = useState<number>(1)
  const [endRange, setEndRange] = useState<number>(1)

  useEffect(() => {
    setStartRange(1)
    setEndRange(totalEnVista > 0 ? totalEnVista : 1)
  }, [totalEnVista])

  useEffect(() => {
    async function load() {
      try {
        const rev = await obtenerRevisoresAdmin()
        setRevisores(rev)
        const currentTramos = await obtenerTramos()
        setAsignaciones(currentTramos)
      } catch (err) {
        console.error(err)
        setErrorMsg('Error al cargar datos del servidor')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleAddTramo = () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    
    const rev = revisores.find(r => r.email === selectedRevisor)
    if (!rev) return setErrorMsg('Seleccione un revisor')
    
    if (startRange < 1 || startRange > endRange) return setErrorMsg('Rango inválido. El inicio no puede ser mayor al final.')
    if (endRange > totalEnVista) {
      return setErrorMsg(`El rango no puede superar el total en esta vista (${totalEnVista}).`)
    }

    // Block overlapping ranges
    const overlap = asignaciones.find(a => 
      (startRange >= a.startRange && startRange <= a.endRange) ||
      (endRange >= a.startRange && endRange <= a.endRange) ||
      (startRange <= a.startRange && endRange >= a.endRange)
    )

    if (overlap) {
      return setErrorMsg(`Conflicto de tramo: Este tramo se cruza con la asignación de ${overlap.reviewerName} (tramos del ${overlap.startRange} al ${overlap.endRange}).`)
    }

    // A reviewer should only have a single continuous block to prevent logic inconsistencies
    const alreadyAssigned = asignaciones.find(a => a.reviewerUid === rev.uid)
    if (alreadyAssigned) return setErrorMsg('Este usuario ya tiene un tramo asignado. Quítalo primero en la lista de abajo para asignarle uno nuevo.')
    
    const nueva: TramoAsignacion = {
      reviewerUid: rev.uid,
      reviewerEmail: rev.email,
      reviewerName: rev.displayName,
      startRange,
      endRange,
      assignedByUid: '',
      assignedByEmail: '',
      createdAt: new Date().toISOString()
    }
    setAsignaciones([...asignaciones, nueva])
  }

  const handleRemoveTramo = (email: string) => {
    setAsignaciones(asignaciones.filter(a => a.reviewerEmail !== email))
  }

  const handleSave = async () => {
    setConfirmDialog({
      title: 'Guardar asignaciones',
      message: '¿Desea guardar estas asignaciones? Esto limitará rigurosamente la vista y permisos de los revisores a sus tramos en pantalla.',
      onConfirm: async () => {
        setConfirmDialog(null)
        setSaving(true)
        setErrorMsg(null)
        try {
          const scopeIds = postulantesEnVistaRevision
            .map((p) => p.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
          if (scopeIds.length !== totalEnVista) {
            setErrorMsg('Faltan identificadores en la vista actual. Recargue la página e intente de nuevo.')
            return
          }
          await asignarTramos(asignaciones, scopeIds)
          onTramosActualizados?.()
          setSuccessMsg('Asignaciones guardadas impecablemente.')
          setTimeout(() => onClose(), 2000)
        } catch (err) {
          setErrorMsg('Ocurrió un error guardando las asignaciones en el servidor.')
          console.error(err)
        } finally {
          setSaving(false)
        }
      }
    })
  }

  const handleReset = async () => {
    setConfirmDialog({
      title: 'Formatear asignaciones',
      message: '¿Está absolutamente seguro de formatear (borrar) todas las asignaciones actuales? Esto dejará la base en blanco y los revisores quedarán sin tramos.',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null)
        setSaving(true)
        setErrorMsg(null)
        try {
          await limpiarTodasLasAsignacionesTramos()
          onTramosActualizados?.()
          setSuccessMsg('Se eliminaron todas las asignaciones por tramos. Los revisores vuelven a ver la nómina completa (pueden necesitar recargar la página).')
          setAsignaciones([])
          setTimeout(() => setSuccessMsg(null), 5000)
        } catch (err) {
          setErrorMsg('Error crítico al formatear la base de datos.')
        } finally {
          setSaving(false)
        }
      }
    })
  }

  if (loading) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"><div className="bg-white p-6 rounded-xl">Cargando datos...</div></div>

  if (totalEnVista === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Sin postulantes en esta vista</h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Los tramos se definen solo sobre la lista que ve en «Revisión de documentación» (filtrada por puntaje).
            Configure el filtro en <strong>Filtro puntaje total</strong> y vuelva a abrir «Asignar tramos».
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-slate-800 py-2 text-sm font-bold text-white hover:bg-slate-900"
          >
            Cerrar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-blue-50">
          <h2 className="text-xl font-bold text-blue-900 uppercase">Panel de Asignación de Tramos</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800">Cerrar</button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1 text-sm space-y-6">
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {errorMsg}
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-900 font-black px-2">✕</button>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl font-medium text-sm flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {successMsg}
              </div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-900 font-black px-2">✕</button>
            </div>
          )}

          <div className="bg-blue-100/50 border border-blue-200 text-blue-800 p-4 rounded-lg">
            <p>
              <strong>Alcance (vista Revisión de documentación):</strong> {totalEnVista} postulante
              {totalEnVista !== 1 ? 's' : ''}
            </p>
            <p className="mt-1 text-xs">
              Las posiciones 1…{totalEnVista || 'N'} son <strong>solo</strong> quienes entran hoy en esta pantalla con el
              filtro de puntaje activo (mismo orden que la tabla: más recientes primero). Quienes están fuera de esta lista
              no reciben tramo y se les quita cualquier asignación previa.
            </p>
            <p className="mt-1 text-xs">
              Para cubrir a todos los del concurso, aplique primero el filtro que deje la nómina deseada y luego asigne
              tramos del 1 al {totalEnVista || '—'}.
            </p>
            <p className="mt-2 text-xs text-blue-900/90 border-t border-blue-200/80 pt-2">
              Para <strong>quitar todos los tramos</strong> y volver al modo sin reparto, use el botón rojo <strong>«Quitar todos los tramos»</strong> abajo a la izquierda.
            </p>
          </div>

          <div className="flex gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="flex-1">
              <label className="block text-xs font-bold text-slate-700 mb-1">Revisor</label>
              <select 
                className="w-full rounded-lg border-slate-300 p-2" 
                value={selectedRevisor} 
                onChange={(e) => setSelectedRevisor(e.target.value)}
              >
                <option value="">Seleccione...</option>
                {revisores.map(r => (
                  <option key={r.email} value={r.email}>{r.displayName} ({r.email})</option>
                ))}
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-bold text-slate-700 mb-1">Del #</label>
              <input type="number" min={1} className="w-full rounded-lg border-slate-300 p-2 text-center" value={startRange} onChange={e => setStartRange(Number(e.target.value))} />
            </div>
            <div className="w-24">
              <label className="block text-xs font-bold text-slate-700 mb-1">Al #</label>
              <input type="number" min={1} className="w-full rounded-lg border-slate-300 p-2 text-center" value={endRange} onChange={e => setEndRange(Number(e.target.value))} />
            </div>
            <button onClick={handleAddTramo} className="bg-blue-800 text-white font-bold px-4 py-2 rounded-lg hover:bg-blue-700">Agregar</button>
          </div>

          <div>
            <h3 className="font-bold text-slate-800 mb-3 border-b pb-2">Asignaciones Actuales</h3>
            {asignaciones.length === 0 ? <p className="text-slate-400 text-sm">No hay tramos asignados.</p> : (
              <ul className="space-y-2">
                {asignaciones.map(a => (
                  <li key={a.reviewerEmail} className="flex justify-between items-center bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                    <div>
                      <span className="font-bold text-blue-900">{a.reviewerName}</span> <span className="text-xs text-slate-500">({a.reviewerEmail})</span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <span className="px-3 py-1 bg-green-100 text-green-800 font-bold rounded">Tramo: {a.startRange} - {a.endRange}</span>
                      <button onClick={() => handleRemoveTramo(a.reviewerEmail)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase">Quitar</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap gap-3 justify-between items-center">
          <button
            type="button"
            disabled={saving}
            onClick={handleReset}
            className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Quitar todos los tramos
          </button>
          <div className="flex gap-2">
            <button disabled={saving} onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-slate-300 text-slate-700 hover:bg-slate-100">Cancelar</button>
            <button disabled={saving} onClick={handleSave} className="px-4 py-2 rounded-lg text-sm bg-blue-800 text-white font-bold disabled:opacity-50">
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </div>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col transform transition-all zoom-in-95">
            <div className={`px-6 py-4 border-b border-slate-200 flex items-center gap-3 ${confirmDialog.danger ? 'bg-rose-50/80' : 'bg-blue-50/80'}`}>
              <svg className={`w-6 h-6 ${confirmDialog.danger ? 'text-rose-600' : 'text-blue-800'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={confirmDialog.danger ? "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"} />
              </svg>
              <h2 className={`text-lg font-black tracking-tight ${confirmDialog.danger ? 'text-rose-900' : 'text-blue-900'}`}>
                {confirmDialog.title}
              </h2>
            </div>
            <div className="p-6 text-slate-700 font-medium">
              <p className="text-sm leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-2xl">
              <button 
                disabled={saving}
                onClick={() => setConfirmDialog(null)} 
                className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 border border-slate-300 bg-white hover:bg-slate-100 transition-colors"
              >
                Cancelar
              </button>
              <button 
                disabled={saving}
                onClick={confirmDialog.onConfirm} 
                className={`px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-colors shadow-sm disabled:opacity-50 ${
                  confirmDialog.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-800 hover:bg-blue-900'
                }`}
              >
                {saving ? 'Procesando...' : 'Sí, confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
