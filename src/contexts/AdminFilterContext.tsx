// @refresh reset
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { PostulanteFirestore } from '../types/postulante'
import { obtenerPostulantes } from '../services/postulacionService'

interface AdminFilterState {
  postulantes: PostulanteFirestore[]
  loading: boolean
  errorPostulantes: string | null
}

interface AdminFilterContextValue extends AdminFilterState {
  refrescarPostulantes: () => Promise<void>
  actualizarPostulanteLocal: (actualizado: PostulanteFirestore) => void
  eliminarPostulanteLocal: (id: string) => void
}

const AdminFilterContext = createContext<AdminFilterContextValue | null>(null)

export function AdminFilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminFilterState>({
    postulantes: [],
    loading: true,
    errorPostulantes: null,
  })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await obtenerPostulantes()
        if (cancelled) return
        setState({
          postulantes: data,
          loading: false,
          errorPostulantes: null,
        })
      } catch (err) {
        if (!cancelled) {
          console.error('Error cargando datos iniciales:', err)
          setState((s) => ({
            ...s,
            loading: false,
            errorPostulantes: `Error de conexión: ${err instanceof Error ? err.message : 'Error desconocido'}. Intente recargar.`,
          }))
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const refrescarPostulantes = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, errorPostulantes: null }))
    try {
      const data = await obtenerPostulantes()
      setState((s) => ({
        ...s,
        loading: false,
        postulantes: data,
      }))
    } catch (err) {
      console.error('Error refrescando postulantes:', err)
      setState((s) => ({
        ...s,
        loading: false,
        errorPostulantes: 'Error al actualizar los datos. Verifique su conexión e intente nuevamente.',
      }))
    }
  }, [])

  const actualizarPostulanteLocal = useCallback((actualizado: PostulanteFirestore) => {
    setState((s) => ({
      ...s,
      postulantes: s.postulantes.map((p) => (p.id === actualizado.id ? actualizado : p)),
    }))
  }, [])

  const eliminarPostulanteLocal = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      postulantes: s.postulantes.filter((p) => p.id !== id),
    }))
  }, [])

  return (
    <AdminFilterContext.Provider
      value={{
        ...state,
        refrescarPostulantes,
        actualizarPostulanteLocal,
        eliminarPostulanteLocal,
      }}
    >
      {children}
    </AdminFilterContext.Provider>
  )
}

export function useAdminFilter() {
  const ctx = useContext(AdminFilterContext)
  if (!ctx) throw new Error('useAdminFilter debe usarse dentro de AdminFilterProvider')
  return ctx
}
