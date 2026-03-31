// @refresh reset
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { PostulanteFirestore } from '../types/postulante'
import { getFiltroPuntajeConfig, aplicarFiltroPuntajeConfig, clearFiltroPuntajeConfig } from '../services/filtroConfigService'
import { obtenerPostulantes } from '../services/postulacionService'

/** Postulantes elegibles para el filtro por puntaje: documentación validada y puntaje ≥ umbral. */
export function postulantesPasandoFiltroPuntaje(
  lista: PostulanteFirestore[],
  puntajeAplicado: number,
): PostulanteFirestore[] {
  return lista.filter(
    (p) =>
      p.estado === 'documentacion_validada' && (p.puntaje?.total ?? 0) >= puntajeAplicado,
  )
}

interface AdminFilterState {
  puntajeAplicado: number | null
  postulantesFiltrados: PostulanteFirestore[]
  postulantes: PostulanteFirestore[]
  loading: boolean
  errorPostulantes: string | null
}

interface AdminFilterContextValue extends AdminFilterState {
  /** Persiste el umbral en servidor y recalcula la lista (solo postulantes con documentación validada). */
  setFiltroPuntaje: (puntaje: number) => Promise<void>
  clearFiltro: () => Promise<void>
  refrescarPostulantes: () => Promise<void>
  actualizarPostulanteLocal: (actualizado: PostulanteFirestore) => void
  eliminarPostulanteLocal: (id: string) => void
}

const AdminFilterContext = createContext<AdminFilterContextValue | null>(null)

export function AdminFilterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminFilterState>({
    puntajeAplicado: null,
    postulantesFiltrados: [],
    postulantes: [],
    loading: true,
    errorPostulantes: null,
  })

  // Carga inicial: config del filtro + todos los postulantes
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [config, data] = await Promise.all([
          getFiltroPuntajeConfig(),
          obtenerPostulantes(),
        ])
        if (cancelled) return
        const puntajeAplicado = config?.puntajeAplicado ?? null
        setState({
          postulantes: data,
          puntajeAplicado,
          postulantesFiltrados:
            puntajeAplicado != null ? postulantesPasandoFiltroPuntaje(data, puntajeAplicado) : [],
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
    return () => { cancelled = true }
  }, [])

  // Recarga todos los postulantes desde Firestore y re-aplica el filtro activo
  const refrescarPostulantes = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, errorPostulantes: null }))
    try {
      const data = await obtenerPostulantes()
      setState((s) => ({
        ...s,
        loading: false,
        postulantes: data,
        postulantesFiltrados:
          s.puntajeAplicado != null
            ? postulantesPasandoFiltroPuntaje(data, s.puntajeAplicado)
            : [],
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

  // Actualiza un único postulante en memoria (sin ir a Firestore)
  const actualizarPostulanteLocal = useCallback((actualizado: PostulanteFirestore) => {
    setState((s) => {
      const postulantes = s.postulantes.map((p) => p.id === actualizado.id ? actualizado : p)
      return {
        ...s,
        postulantes,
        postulantesFiltrados:
          s.puntajeAplicado != null
            ? postulantesPasandoFiltroPuntaje(postulantes, s.puntajeAplicado)
            : [],
      }
    })
  }, [])

  // Elimina un postulante en memoria
  const eliminarPostulanteLocal = useCallback((id: string) => {
    setState((s) => {
      const postulantes = s.postulantes.filter((p) => p.id !== id)
      return {
        ...s,
        postulantes,
        postulantesFiltrados:
          s.puntajeAplicado != null
            ? postulantesPasandoFiltroPuntaje(postulantes, s.puntajeAplicado)
            : [],
      }
    })
  }, [])

  const setFiltroPuntaje = useCallback(async (puntaje: number) => {
    try {
      await aplicarFiltroPuntajeConfig(puntaje)
      setState((s) => ({
        ...s,
        puntajeAplicado: puntaje,
        postulantesFiltrados: postulantesPasandoFiltroPuntaje(s.postulantes, puntaje),
      }))
    } catch (err) {
      console.error('Error guardando filtro:', err)
      throw err
    }
  }, [])

  const clearFiltro = useCallback(async () => {
    try {
      await clearFiltroPuntajeConfig()
      setState((s) => ({ ...s, puntajeAplicado: null, postulantesFiltrados: [] }))
    } catch (err) {
      console.error('Error al limpiar filtro:', err)
      throw err
    }
  }, [])

  return (
    <AdminFilterContext.Provider
      value={{
        ...state,
        setFiltroPuntaje,
        clearFiltro,
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
