import { useEffect, useMemo, useState } from 'react'
import { AdminLayout } from './AdminLayout'
import type { PostulanteRechazadoEntrada } from '../../types/postulante'
import { obtenerPostulantesRechazadosEntrada } from '../../services/rechazosEntradaService'

function Cell({
  value,
  rejected = false,
}: {
  value: string | number | null | undefined
  rejected?: boolean
}) {
  return (
    <td className={`px-2 py-1.5 whitespace-nowrap ${rejected ? 'bg-red-50 text-red-800 font-bold' : 'text-slate-700'}`}>
      {value ?? '—'}
    </td>
  )
}

export function PostulantesRechazadosEntrada() {
  const [rows, setRows] = useState<PostulanteRechazadoEntrada[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    obtenerPostulantesRechazadosEntrada()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar rechazados de entrada'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return rows
    return rows.filter((r) =>
      [r.nombres, r.apellidoPaterno, r.apellidoMaterno, r.rut, r.rejectionLabel, r.rejectionMessage]
        .filter(Boolean)
        .some((x) => String(x).toLowerCase().includes(term)),
    )
  }, [q, rows])

  return (
    <AdminLayout>
      <div className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8 space-y-4 max-w-[1700px] mx-auto">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-lg font-bold text-red-900">Postulantes rechazados de entrada</h2>
          <p className="text-sm text-red-700 mt-1">
            Registro consolidado de rechazos automáticos por reglas excluyentes, base histórica o duplicidad.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre, RUT o motivo..."
            className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <span className="text-sm text-slate-500">{filtered.length} registros</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500">Cargando...</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-auto">
            <table className="min-w-max w-full text-[11px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Nombre</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">RUT</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Edad</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">NEM</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Sexo</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Estado civil</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Email</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Teléfono</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Domicilio</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">F. postulación</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Comuna</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Institución</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Carrera</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Año ingreso</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Duración</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Integrantes</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Tramo RSH</th>
                  <th className="px-2 py-2 text-left font-bold text-red-700">Motivo</th>
                  <th className="px-2 py-2 text-left font-bold text-red-700">Detalle</th>
                  <th className="px-2 py-2 text-left font-bold text-slate-600">Fecha rechazo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id ?? r.rutNormalizado}>
                    <Cell value={`${r.nombres} ${r.apellidoPaterno} ${r.apellidoMaterno}`} />
                    <Cell value={r.rut} rejected={r.rejectionFlags.historical || r.rejectionFlags.duplicate} />
                    <Cell value={r.edad} rejected={r.rejectionFlags.edad} />
                    <Cell value={r.nem} rejected={r.rejectionFlags.nem} />
                    <Cell value={r.sexo} />
                    <Cell value={r.estadoCivil} />
                    <Cell value={r.email} />
                    <Cell value={r.telefono} />
                    <Cell value={r.domicilioFamiliar} />
                    <Cell value={r.fechaPostulacion} />
                    <Cell value={r.comuna} />
                    <Cell value={r.nombreInstitucion} />
                    <Cell value={r.carrera} />
                    <Cell value={r.anoIngreso} />
                    <Cell value={r.duracionSemestres} />
                    <Cell value={r.totalIntegrantes} />
                    <Cell value={r.tramoRegistroSocial} />
                    <Cell
                      value={r.rejectionLabel}
                      rejected={
                        r.rejectionFlags.edad ||
                        r.rejectionFlags.nem ||
                        r.rejectionFlags.historical ||
                        r.rejectionFlags.duplicate
                      }
                    />
                    <Cell value={r.rejectionMessage} rejected />
                    <Cell value={r.updatedAt} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
