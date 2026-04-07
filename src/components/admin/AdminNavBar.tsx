import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'

const navItems = [
  { path: '/admin', label: 'Panel de control', paths: ['M3 9l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z', 'M9 22V12h6v10'] },
  { path: '/admin/filtro-inicial', label: 'Filtrado inicial', paths: ['M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'] },
  { path: '/admin/filtro-revision-doc', label: 'Revisión de documentos', paths: ['M9 12h.01M12 12h.01M15 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'] },
  { path: '/admin/filtro-puntaje-total', label: 'Filtrado por puntaje total', paths: ['M3 4h18l-7 9v6l-4 2v-8L3 4z'] },
  { path: '/admin/filtro-desempate', label: 'Filtrado por desempate', paths: ['M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4'] },
  { path: '/admin/postulantes-rechazados-entrada', label: 'Postulantes rechazados de entrada', paths: ['M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z'] },
] as const

export function AdminNavBar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Desktop: barra horizontal */}
      <nav className="hidden lg:flex items-center justify-start gap-2 flex-nowrap overflow-x-auto min-w-0 py-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            type="button"
            onClick={() => navigate(item.path)}
            className={`shrink-0 select-none rounded-xl px-4 py-2.5 text-[11px] font-semibold inline-flex items-center gap-2 outline-none active:scale-100 touch-manipulation transition-all duration-500 ease-in-out cursor-pointer ${
              isActive(item.path)
                ? 'bg-blue-900 text-white border-b-2 border-white shadow-xl'
                : 'bg-blue-800 text-white border-b-2 border-transparent hover:bg-blue-700/80 shadow-sm'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              {item.paths.map((d) => (
                <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
              ))}
            </svg>
            <span className="whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Mobile: botón hamburguesa + menú desplegable (renderizado en portal para evitar errores removeChild) */}
      <div className="lg:hidden relative">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="flex items-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-white text-xs font-semibold shadow-sm"
        >
          {menuOpen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
          <span>Menú</span>
        </button>

        {menuOpen && createPortal(
          <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/20" onClick={() => setMenuOpen(false)} aria-hidden />
            <div className="absolute left-4 top-20 z-[61] w-64 rounded-xl border border-slate-200 bg-white shadow-xl py-2">
              {navItems.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => { navigate(item.path); setMenuOpen(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                    isActive(item.path)
                      ? 'bg-blue-50 text-blue-800 font-bold'
                      : 'text-slate-700 hover:bg-slate-50 font-medium'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 shrink-0 ${isActive(item.path) ? 'text-blue-600' : 'text-slate-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    {item.paths.map((d) => (
                      <path key={d} strokeLinecap="round" strokeLinejoin="round" d={d} />
                    ))}
                  </svg>
                  <span>{item.label}</span>
                  {isActive(item.path) && (
                    <div className="ml-auto h-2 w-2 rounded-full bg-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
      </div>
    </>
  )
}
