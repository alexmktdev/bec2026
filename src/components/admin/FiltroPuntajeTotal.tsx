import { AdminLayout } from './AdminLayout'

/**
 * Pestaña «Filtrado por puntaje total»: por ahora solo contenido informativo.
 * La lógica (filtro, Excel, export) se volverá a implementar aparte.
 */
export function FiltroPuntajeTotal() {
  return (
    <AdminLayout>
      <div className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-xs text-blue-900 leading-relaxed">
            <strong>Orden del proceso:</strong> primero se revisa la documentación de todos los postulantes ingresados;
            solo quienes queden con estado <strong>documentación validada</strong> entran aquí. La tabla principal es la
            misma planilla que sube en <strong>Revisión de documentación</strong>, mostrando solo quienes tengan en la
            columna <strong>Estado</strong> el texto <strong>Validado</strong>, «Validada», o el rotulo del export{' '}
            <strong>DOC. VALIDADA</strong>; el resto no aparece. Esas filas se ordenan por{' '}
            <strong>puntaje total de mayor a menor</strong> según el listado del servidor. Al aplicar el filtro, el servidor
            registra el umbral y la lista resultante alimenta la etapa de <strong>filtrado por desempate</strong>.
          </div>
          <h2 className="text-sm font-bold uppercase text-slate-700 mb-2">
            Cómo se calcula el puntaje total
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-blue-800 uppercase">NEM (Promedio)</p>
              <p className="text-xs text-slate-700 mt-1">
                5.5: 10 pts · 5.6-6.0: 20 pts · 6.1-6.5: 30 pts · 6.6-7.0: 40 pts
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-blue-800 uppercase">RSH (Tramo)</p>
              <p className="text-xs text-slate-700 mt-1">
                40%: 35 pts · 50%: 20 pts · 60%: 15 pts · 70%: 10 pts · Otros: 0 pts
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-blue-800 uppercase">Enfermedades</p>
              <p className="text-xs text-slate-700 mt-1">
                Catastrófica: 15 pts · Crónica: 10 pts · Ninguna: 0 pts
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-blue-800 uppercase">Hermanos/Hijos</p>
              <p className="text-xs text-slate-700 mt-1">
                1: 5 pts · 2 o más: 10 pts · No: 0 pts
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <p className="text-xs font-bold text-blue-900 uppercase">Fórmula</p>
            <p className="text-xs text-blue-800 mt-1">
              Puntaje total = NEM + RSH + Enfermedad + Hermanos/Hijos (máximo 100 pts).
            </p>
            <p className="text-xs text-blue-700 mt-2 font-medium">
              El umbral se guarda en el servidor (solo superadmin puede aplicarlo o quitarlo) y persiste al recargar.
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
