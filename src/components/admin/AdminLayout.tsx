import { type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { AdminNavBar } from './AdminNavBar'
import logoMolina from '../../assets/logo-molina.png'

interface Props {
  children: ReactNode
}

export function AdminLayout({ children }: Props) {
  const navigate = useNavigate()
  const { user, userRole, signOut } = useAuth()

  const displayName = userRole?.displayName || user?.email || 'Usuario'
  const roleLabel = userRole?.role || 'usuario'
  const initials = (() => {
    const base = displayName.includes('@') ? displayName.split('@')[0] : displayName
    return base.trim().split(/[\s_-]+/).filter(Boolean).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('')
  })()

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header superior fijo */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-3 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Logo — se achica en móvil */}
          <img
            src={logoMolina}
            alt="Logo Molina"
            className="block w-auto max-h-14 sm:max-h-24 object-contain shrink-0"
          />

          {/* Navbar — ocupa el espacio central */}
          <div className="flex-1 min-w-0 flex justify-center">
            <AdminNavBar />
          </div>

          {/* Usuario + cerrar sesión */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {/* Info del usuario — se oculta en móvil muy estrecho */}
            <div className="hidden sm:flex items-center gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-3 py-2.5">
              <div className="h-10 w-10 rounded-full bg-blue-800 text-white flex items-center justify-center text-[11px] font-bold">
                {initials || 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-slate-900 truncate max-w-[120px]">{displayName}</p>
                <p className="text-[10px] text-slate-500 capitalize truncate">{roleLabel}</p>
              </div>
            </div>

            {/* Avatar compacto en móvil */}
            <div className="sm:hidden h-9 w-9 rounded-full bg-blue-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              {initials || 'U'}
            </div>

            {/* Botón de Gestión de Usuarios (Solo Superadmin) */}
            {userRole?.role === 'superadmin' && (
              <button
                onClick={() => navigate('/admin/usuarios')}
                title="Gestión de Usuarios"
                className="rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-2 sm:px-3 sm:py-2.5 text-blue-700 hover:bg-blue-100 transition-colors shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </button>
            )}

            <button
              onClick={signOut}
              className="rounded-xl border border-slate-300 bg-white px-2.5 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">Cerrar sesión</span>
              <span className="sm:hidden">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Título del sistema */}
      <header className="bg-white border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-6">
        <h1 className="text-base sm:text-2xl font-bold text-blue-800 text-center uppercase leading-tight">
          Sistema de gestión de becas municipales 2026
        </h1>
      </header>

      {/* Contenido */}
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
