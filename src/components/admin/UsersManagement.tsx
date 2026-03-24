import { useEffect, useState } from 'react'
import { obtenerUsuariosAdmin, toggleUserStatus, type UserAdminInfo } from '../../services/userService'
import { AdminLayout } from './AdminLayout'

export function UsersManagement() {
  const [users, setUsers] = useState<UserAdminInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Tracking individual row loading for actions
  const [updatingUid, setUpdatingUid] = useState<string | null>(null)

  async function load() {
    try {
      setLoading(true)
      const data = await obtenerUsuariosAdmin()
      setUsers(data)
    } catch (err: any) {
      console.error('Error cargando usuarios:', err)
      setError('Acceso denegado o error de conexión.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleToggle(uid: string, currentStatus: boolean) {
    if (updatingUid) return
    setUpdatingUid(uid)
    try {
      await toggleUserStatus(uid, !currentStatus)
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, bloqueado: !currentStatus } : u))
    } catch (err) {
      alert('Error al modificar el estado.')
    } finally {
      setUpdatingUid(null)
    }
  }

  // Formateador de fecha simple
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '20/03/2026' // Fallback para fines visuales
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const getRoleStyle = (role: string) => {
    switch (role.toLowerCase()) {
      case 'superadmin': return 'bg-[#F3E8FF] text-[#A855F7]' // Purpura
      case 'director': return 'bg-[#FFEDD5] text-[#F97316]' // Naranja
      case 'supervisor': return 'bg-[#DCFCE7] text-[#22C55E]' // Verde
      default: return 'bg-[#FEF9C3] text-[#CA8A04]' // Amarillo (Municipal)
    }
  }

  return (
    <AdminLayout>
      <div className="flex-1 w-full px-4 py-8 sm:px-6 lg:px-8 space-y-6 max-w-[1600px] mx-auto bg-[#F8FAFC]">
        
        {/* Header Sección */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-100 p-2.5 text-blue-700 shadow-sm transition-transform hover:scale-105">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">Gestión de Usuarios</h1>
              <p className="mt-1 text-sm font-bold text-slate-500">Listado de Usuarios ({users.length})</p>
            </div>
          </div>
          
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-5 py-2.5 text-[11px] font-black uppercase tracking-wider text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sincronizar Directorio
          </button>
        </div>

        {/* Board de la Tabla */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {loading && users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3 bg-white">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Cargando credenciales administrativas...</p>
            </div>
          ) : error ? (
            <div className="p-20 text-center bg-white space-y-4">
              <div className="inline-flex rounded-full bg-red-100 p-4 text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-red-600 font-bold block">{error}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#FAFAFA] border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Usuario</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Email</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Rol</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Estado</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Fecha Creación</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors">
                      {/* Usuario */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-[#1E3A8A] text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-lg shadow-blue-900/10">
                            {u.displayName?.substring(0, 2).toUpperCase() || 'US'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 truncate">{u.displayName}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">UID: {u.uid.substring(0, 10)}...</p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 opacity-40 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-600">{u.email}</span>
                        </div>
                      </td>

                      {/* Rol */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-sm border ${getRoleStyle(u.role)}`}>
                          {(u.role === 'superadmin') ? 'SuperAdmin' : u.role}
                        </span>
                      </td>

                      {/* Estado */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center">
                          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight border shadow-inner ${
                            u.bloqueado 
                              ? 'bg-red-50 text-red-600 border-red-100' 
                              : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              {u.bloqueado 
                                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              }
                            </svg>
                            {u.bloqueado ? 'Inactivo' : 'Activo'}
                          </span>
                        </div>
                      </td>

                      {/* Fecha de Creación */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0 opacity-40 text-slate-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="text-xs font-semibold text-slate-600">{formatDate(u.createdAt)}</span>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {/* Botón Activar/Desactivar */}
                          <button
                            onClick={() => handleToggle(u.uid, !!u.bloqueado)}
                            disabled={!!updatingUid}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50 min-w-[100px] justify-center ${
                              u.bloqueado 
                                ? 'bg-[#22C55E] text-white hover:bg-[#16A34A] border border-emerald-600' 
                                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {updatingUid === u.uid ? (
                              <div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                            ) : (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  {u.bloqueado 
                                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                                  }
                                </svg>
                                {u.bloqueado ? 'Activar' : 'Desactivar'}
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Mensaje de pie de página */}
        <footer className="text-center py-8">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">
            © 2026 Beca Municipal de Molina - 2026  -  I. Municipalidad de Molina
          </p>
        </footer>

      </div>
    </AdminLayout>
  )
}
