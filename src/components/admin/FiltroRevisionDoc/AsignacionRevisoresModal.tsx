import { useState, useEffect, useMemo } from 'react'
import type { PostulanteFirestore, TramoAsignacion, TramoVigenteEstado } from '../../../types/postulante'
import { obtenerTramos, asignarTramos, limpiarTodasLasAsignacionesTramos } from '../../../services/tramosService'
import { findSegmentoSolapado, legacySegmentId } from '../../../utils/tramosSegments'
import { resumenFaltantesAsignacionRevision } from '../../../utils/tramosCobertura'
import { CoberturaTramosRevisionResumen } from './CoberturaTramosRevisionResumen'
import { obtenerRevisoresAdmin, type UserAdminInfo } from '../../../services/userService'

interface Props {
  onClose: () => void
  postulantesEnVistaRevision: PostulanteFirestore[]
  onTramosActualizados?: () => void
}

function vigenteABorrador(t: TramoVigenteEstado): TramoAsignacion {
  return {
    segmentId: t.segmentId || legacySegmentId(t.reviewerUid, t.startRange, t.endRange),
    reviewerUid: t.reviewerUid,
    reviewerEmail: t.reviewerEmail,
    reviewerName: t.reviewerName,
    startRange: t.startRange,
    endRange: t.endRange,
    assignedByUid: t.assignedByUid,
    assignedByEmail: t.assignedByEmail,
    createdAt: t.createdAt,
  }
}

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
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    danger?: boolean
    onConfirm: () => void
  } | null>(null)

  const [selectedRevisor, setSelectedRevisor] = useState<string>('')
  const [startRange, setStartRange] = useState<number>(1)
  const [endRange, setEndRange] = useState<number>(1)
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)

  useEffect(() => {
    if (editingSegmentId) return
    setStartRange(1)
    setEndRange(totalEnVista > 0 ? totalEnVista : 1)
  }, [totalEnVista, editingSegmentId])

  useEffect(() => {
    async function load() {
      try {
        const rev = await obtenerRevisoresAdmin()
        setRevisores(rev)
        const currentTramos = await obtenerTramos()
        setAsignaciones(currentTramos.map(vigenteABorrador))
      } catch (err) {
        console.error(err)
        setErrorMsg('Error al cargar datos del servidor')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const cancelarEdicion = () => {
    setEditingSegmentId(null)
    setSelectedRevisor('')
    setStartRange(1)
    setEndRange(totalEnVista > 0 ? totalEnVista : 1)
  }

  const aplicarTramoAlFormulario = (a: TramoAsignacion) => {
    setSelectedRevisor(a.reviewerEmail)
    setStartRange(a.startRange)
    setEndRange(a.endRange)
    setEditingSegmentId(a.segmentId)
  }

  const agregarOActualizarTramo = () => {
    setErrorMsg(null)
    setSuccessMsg(null)

    const rev = revisores.find((r) => r.email === selectedRevisor)
    if (!rev) return setErrorMsg('Seleccione un revisor')

    if (startRange < 1 || startRange > endRange) {
      return setErrorMsg('Rango inválido. El inicio no puede ser mayor al final.')
    }
    if (endRange > totalEnVista) {
      return setErrorMsg(`El rango no puede superar el total en esta vista (${totalEnVista}).`)
    }

    const candidato = { startRange, endRange }
    const overlap = findSegmentoSolapado(candidato, asignaciones, editingSegmentId ?? undefined)
    if (overlap) {
      return setErrorMsg(
        `Este tramo se cruza con el de ${overlap.reviewerName} (posiciones ${overlap.startRange}–${overlap.endRange}). Ajuste los números para que no se solapen.`,
      )
    }

    if (editingSegmentId) {
      const actualizado: TramoAsignacion = {
        segmentId: editingSegmentId,
        reviewerUid: rev.uid,
        reviewerEmail: rev.email,
        reviewerName: rev.displayName,
        startRange,
        endRange,
        assignedByUid: '',
        assignedByEmail: '',
        createdAt: new Date().toISOString(),
      }
      setAsignaciones((prev) => prev.map((x) => (x.segmentId === editingSegmentId ? actualizado : x)))
      cancelarEdicion()
      return
    }

    const nueva: TramoAsignacion = {
      segmentId: crypto.randomUUID(),
      reviewerUid: rev.uid,
      reviewerEmail: rev.email,
      reviewerName: rev.displayName,
      startRange,
      endRange,
      assignedByUid: '',
      assignedByEmail: '',
      createdAt: new Date().toISOString(),
    }
    setAsignaciones((prev) => [...prev, nueva])
    setSelectedRevisor('')
    setStartRange(1)
    setEndRange(totalEnVista > 0 ? totalEnVista : 1)
  }

  const quitarSegmento = (segmentId: string) => {
    setAsignaciones((prev) => prev.filter((a) => a.segmentId !== segmentId))
    if (editingSegmentId === segmentId) cancelarEdicion()
  }

  const asignacionesOrdenadas = useMemo(
    () => [...asignaciones].sort((a, b) => a.startRange - b.startRange || a.endRange - b.endRange),
    [asignaciones],
  )

  const resumenCoberturaModal = useMemo(
    () =>
      resumenFaltantesAsignacionRevision(
        totalEnVista,
        asignaciones,
        postulantesEnVistaRevision,
      ),
    [totalEnVista, asignaciones, postulantesEnVistaRevision],
  )

  const handleSave = async () => {
    setConfirmDialog({
      title: 'Guardar asignaciones',
      message:
        '¿Desea guardar estas asignaciones? Esto limitará rigurosamente la vista y permisos de los revisores a sus tramos en pantalla.\n\n' +
        `Si está reasignando después de un primer reparto, confirme que esta lista (${totalEnVista} postulantes) es la nómina con la que desea trabajar: quienes no entren en ella dejarán de tener tramo asignado hasta un guardado futuro que los incluya.`,
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
          setSuccessMsg('Asignaciones guardadas correctamente.')
          setTimeout(() => onClose(), 2000)
        } catch (err) {
          setErrorMsg('Ocurrió un error guardando las asignaciones en el servidor.')
          console.error(err)
        } finally {
          setSaving(false)
        }
      },
    })
  }

  const handleReset = async () => {
    setConfirmDialog({
      title: 'Formatear asignaciones',
      message:
        '¿Está absolutamente seguro de formatear (borrar) todas las asignaciones actuales? Esto dejará la base en blanco y los revisores quedarán sin tramos.',
      danger: true,
      onConfirm: async () => {
        setConfirmDialog(null)
        setSaving(true)
        setErrorMsg(null)
        try {
          await limpiarTodasLasAsignacionesTramos()
          onTramosActualizados?.()
          setSuccessMsg(
            'Se eliminaron todas las asignaciones por tramos. Los revisores vuelven a ver la nómina completa (pueden necesitar recargar la página).',
          )
          setAsignaciones([])
          cancelarEdicion()
          setTimeout(() => setSuccessMsg(null), 5000)
        } catch {
          setErrorMsg('Error crítico al formatear la base de datos.')
        } finally {
          setSaving(false)
        }
      },
    })
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="rounded-xl bg-white p-6">Cargando datos...</div>
      </div>
    )
  }

  if (totalEnVista === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl">
          <h2 className="text-lg font-bold text-slate-900">Sin postulantes en esta vista</h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Los tramos se definen sobre la nómina de «Revisión de documentación». Cuando existan postulantes, vuelva a abrir
            «Asignar tramos».
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
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50 px-6 py-4">
          <h2 className="text-xl font-bold uppercase text-blue-900">Asignación de tramos</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800">
            Cerrar
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-sm">
          {errorMsg && (
            <div className="flex animate-in items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 shadow-sm fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                {errorMsg}
              </div>
              <button type="button" onClick={() => setErrorMsg(null)} className="px-2 font-black text-rose-500 hover:text-rose-900">
                ✕
              </button>
            </div>
          )}

          {successMsg && (
            <div className="flex animate-in items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-sm fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {successMsg}
              </div>
              <button
                type="button"
                onClick={() => setSuccessMsg(null)}
                className="px-2 font-black text-emerald-500 hover:text-emerald-900"
              >
                ✕
              </button>
            </div>
          )}

          <CoberturaTramosRevisionResumen resumen={resumenCoberturaModal} variant="modal" />

          <div className="rounded-lg border border-blue-200 bg-blue-100/50 p-4 text-blue-800">
            <p>
              <strong>Alcance:</strong> {totalEnVista} postulante{totalEnVista !== 1 ? 's' : ''} (orden de la tabla de revisión,
              mismo que usa el servidor).
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              Puede definir <strong>varios tramos por revisor</strong> (por ejemplo, otro bloque cuando terminó el primero),{' '}
              <strong>editar</strong> un tramo ya listado o <strong>asignar</strong> a quien aún no tiene ninguno. Dos tramos no
              pueden compartir la misma posición (el servidor valida solapamientos).
            </p>
            <p className="mt-2 text-xs border-t border-blue-200/80 pt-2 text-blue-900/90">
              <strong>Quitar todos los tramos</strong> restablece el modo sin reparto (botón rojo abajo).
            </p>
          </div>

          <details className="group rounded-lg border border-emerald-200 bg-emerald-50/90 text-emerald-950 open:shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-bold text-emerald-900 marker:content-none [&::-webkit-details-marker]:hidden">
              <span>Guía: reasignar o corregir errores</span>
              <span className="text-xs font-semibold text-emerald-700 transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="space-y-2 border-t border-emerald-200/80 px-4 pb-4 pt-2 text-xs leading-relaxed text-emerald-900">
              <p>
                Use <strong>Editar</strong> para corregir números o cambiar el revisor de un bloque. Use <strong>Agregar
                tramo</strong> para un bloque nuevo al mismo u otro revisor, siempre sin solapar posiciones.
              </p>
              <p>
                Al <strong>guardar</strong>, quienes queden fuera de esta lista de {totalEnVista} pierden tramo hasta un próximo
                guardado que los incluya.
              </p>
            </div>
          </details>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-600">
              {editingSegmentId ? 'Editar tramo seleccionado' : 'Nuevo tramo'}
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label htmlFor="asignacion-tramo-revisor" className="mb-1 block text-xs font-bold text-slate-700">
                  Revisor
                </label>
                <select
                  id="asignacion-tramo-revisor"
                  name="asignacion_tramo_revisor"
                  className="w-full rounded-lg border-slate-300 p-2"
                  value={selectedRevisor}
                  onChange={(e) => setSelectedRevisor(e.target.value)}
                >
                  <option value="">Seleccione...</option>
                  {revisores.map((r) => (
                    <option key={r.email} value={r.email}>
                      {r.displayName} ({r.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <label htmlFor="asignacion-tramo-desde" className="mb-1 block text-xs font-bold text-slate-700">
                  Del #
                </label>
                <input
                  id="asignacion-tramo-desde"
                  name="asignacion_tramo_desde"
                  type="number"
                  min={1}
                  className="w-full rounded-lg border-slate-300 p-2 text-center"
                  value={startRange}
                  onChange={(e) => setStartRange(Number(e.target.value))}
                />
              </div>
              <div className="w-24">
                <label htmlFor="asignacion-tramo-hasta" className="mb-1 block text-xs font-bold text-slate-700">
                  Al #
                </label>
                <input
                  id="asignacion-tramo-hasta"
                  name="asignacion_tramo_hasta"
                  type="number"
                  min={1}
                  className="w-full rounded-lg border-slate-300 p-2 text-center"
                  value={endRange}
                  onChange={(e) => setEndRange(Number(e.target.value))}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={agregarOActualizarTramo}
                  className="rounded-lg bg-blue-800 px-4 py-2 font-bold text-white hover:bg-blue-700"
                >
                  {editingSegmentId ? 'Actualizar tramo' : 'Agregar tramo'}
                </button>
                {editingSegmentId && (
                  <button
                    type="button"
                    onClick={cancelarEdicion}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Cancelar edición
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 border-b pb-2 font-bold text-slate-800">Tramos configurados ({asignaciones.length})</h3>
            {asignaciones.length === 0 ? (
              <p className="text-sm text-slate-400">No hay tramos. Agregue al menos uno antes de guardar.</p>
            ) : (
              <ul className="space-y-2">
                {asignacionesOrdenadas.map((a) => (
                  <li
                    key={a.segmentId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                  >
                    <div>
                      <span className="font-bold text-blue-900">{a.reviewerName}</span>{' '}
                      <span className="text-xs text-slate-500">({a.reviewerEmail})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-green-100 px-3 py-1 font-bold text-green-800">
                        #{a.startRange} – #{a.endRange}
                      </span>
                      <button
                        type="button"
                        onClick={() => aplicarTramoAlFormulario(a)}
                        className="text-xs font-bold uppercase text-blue-600 hover:text-blue-800"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => quitarSegmento(a.segmentId)}
                        className="text-xs font-bold uppercase text-red-500 hover:text-red-700"
                      >
                        Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={handleReset}
            className="rounded-lg border-2 border-red-300 bg-red-50 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-100 disabled:opacity-50"
          >
            Quitar todos los tramos
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving || asignaciones.length === 0}
              onClick={handleSave}
              className="rounded-lg bg-blue-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-[70] flex animate-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm fade-in duration-200">
          <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl zoom-in-95 transform transition-all">
            <div
              className={`flex items-center gap-3 border-b border-slate-200 px-6 py-4 ${confirmDialog.danger ? 'bg-rose-50/80' : 'bg-blue-50/80'}`}
            >
              <svg
                className={`h-6 w-6 ${confirmDialog.danger ? 'text-rose-600' : 'text-blue-800'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d={
                    confirmDialog.danger
                      ? 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                      : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                  }
                />
              </svg>
              <h2
                className={`text-lg font-black tracking-tight ${confirmDialog.danger ? 'text-rose-900' : 'text-blue-900'}`}
              >
                {confirmDialog.title}
              </h2>
            </div>
            <div className="p-6 font-medium text-slate-700">
              <p className="whitespace-pre-line text-sm leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-4">
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmDialog(null)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={confirmDialog.onConfirm}
                className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50 ${
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
