import { useState } from 'react'

interface ModalRechazoProps {
  nombreDocumento: string
  onConfirmar: (motivo: string) => void
  onCancelar: () => void
  guardando: boolean
}

export function ModalRechazo({ nombreDocumento, onConfirmar, onCancelar, guardando }: ModalRechazoProps) {
  const [motivo, setMotivo] = useState(`Documento no válido: ${nombreDocumento}`)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Rechazar documento</h3>
            <p className="text-xs text-slate-500">{nombreDocumento}.pdf</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold text-slate-700">
            Motivo del rechazo
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
            placeholder="Explique el motivo del rechazo..."
          />
          <p className="text-xs text-slate-400">Este motivo quedará registrado en Firestore junto a los datos del postulante.</p>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirmar(motivo.trim() || `Documento no válido: ${nombreDocumento}`)}
            disabled={guardando}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {guardando ? 'Rechazando...' : 'Confirmar rechazo'}
          </button>
        </div>
      </div>
    </div>
  )
}
