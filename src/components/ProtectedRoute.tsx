import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  requiredRole?: 'superadmin' | 'revisor'
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { user, userRole, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />
  }

  // Si el usuario existe pero aún no terminó de cargarse su rol desde Firestore,
  // mostramos un spinner en vez de redirigir para evitar bucles de navegación.
  if (!userRole) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-700" />
      </div>
    )
  }

  if (requiredRole === 'superadmin' && userRole.role !== 'superadmin') {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}
