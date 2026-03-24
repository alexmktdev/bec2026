import { AdminLayout } from './AdminLayout'

export function FiltroInicial() {
  return (
    <AdminLayout>
        <div className="flex-1 w-full px-4 py-5 sm:px-6 lg:px-8 max-w-4xl mx-auto flex items-start justify-center">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 w-full max-w-4xl">
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">1. Rango de Edad</h2>
              </div>
              <div className="ml-12 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">
                  El sistema valida automáticamente que el postulante tenga entre <span className="font-bold text-blue-700">17 y 23 años</span> al momento de la postulación.
                  Si la fecha de nacimiento ingresada no cumple con este rango, la postulación es rechazada de inmediato.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">2. Promedio NEM</h2>
              </div>
              <div className="ml-12 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">
                  Es requisito obligatorio contar con un Promedio de Notas de Enseñanza Media (NEM) <span className="font-bold text-green-700">mayor o igual a 5.5</span>.
                  Este valor es verificado antes de permitir el registro de cualquier documento o dato adicional.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">3. Base de Datos Histórica</h2>
              </div>
              <div className="ml-12 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">
                  El sistema realiza una consulta en tiempo real a la <span className="font-bold text-purple-700">base de datos de beneficiarios anteriores</span>.
                  Si el RUT del postulante ya figura como beneficiario en procesos pasados, el sistema impide una nueva postulación para asegurar la rotación del beneficio.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-slate-800 uppercase tracking-tight">4. Postulaciones Duplicadas</h2>
              </div>
              <div className="ml-12 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <p className="text-sm text-slate-700 leading-relaxed">
                  El sistema verifica si el RUT del postulante <span className="font-bold text-amber-700">ya registró una postulación en el proceso actual</span>.
                  Si el mismo estudiante intenta postular más de una vez en la misma convocatoria, la solicitud es rechazada para evitar duplicados.
                </p>
              </div>
            </section>

            <div className="pt-5 border-t border-slate-100">
              <div className="rounded-xl bg-blue-800 p-5 text-center shadow-md">
                <p className="text-white font-semibold text-base">
                  Los datos filtrados inicialmente son los que se encuentran disponibles en el panel de control.
                </p>
              </div>
            </div>
          </div>
        </div>
    </AdminLayout>
  )
}
