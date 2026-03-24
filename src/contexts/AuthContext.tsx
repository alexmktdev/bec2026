import { createContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { auth, db, functions } from '../firebase/config'
import type { UserRole } from '../types/postulante'

interface AuthContextValue {
  user: User | null
  userRole: UserRole | null
  loading: boolean
  authError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  // Auto-logout por inactividad
  const inactivityMs = 60 * 60 * 1000 // 1 hora
  const lastActivityRef = useRef<number>(Date.now())
  const logoutTimeoutRef = useRef<number | null>(null)
  const isLoggingOutRef = useRef<boolean>(false)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      setAuthError(null)
      if (firebaseUser) {
        try {
          const roleDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
          if (roleDoc.exists()) {
            setUserRole(roleDoc.data() as UserRole)
          } else {
            setUserRole(null)
            setAuthError('Su cuenta no tiene un perfil de acceso configurado. Contacte al administrador.')
          }
        } catch {
          setUserRole(null)
          setAuthError('No se pudo verificar su perfil de acceso. Verifique su conexión e intente nuevamente.')
        }
      } else {
        setUserRole(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signIn(email: string, password: string) {
    // 1. Verificar si está bloqueado preventivamente (en el backend)
    const checkFn = httpsCallable<{ email: string }, { bloqueado: boolean }>(functions, 'verificarEstadoBloqueo')
    const { data: { bloqueado } } = await checkFn({ email })
    
    if (bloqueado) {
      throw new Error('ACCESO_BLOQUEADO')
    }

    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      // 2. Registrar fallo en el backend si el error es de credenciales
      const regFn = httpsCallable<{ email: string }, { ok: boolean }>(functions, 'registrarIntentoFallido')
      await regFn({ email })
      throw err
    }
  }

  async function requestPasswordReset(email: string) {
    // 1. Desbloqueamos en el backend (resetea contador)
    const resetFn = httpsCallable<{ email: string }, { ok: boolean }>(functions, 'solicitarRecuperacionPassword')
    await resetFn({ email })
    
    // 2. Enviamos el correo real usando el SDK de cliente
    // Esto es lo que dispara el envío de Google y usa tu template personalizado.
    await sendPasswordResetEmail(auth, email)
  }

  async function signOut() {
    await firebaseSignOut(auth)
    setUserRole(null)
  }

  // Cierra sesión si el usuario no interactúa por `inactivityMs`.
  useEffect(() => {
    if (!user) return

    lastActivityRef.current = Date.now()
    isLoggingOutRef.current = false

    const resetTimer = () => {
      lastActivityRef.current = Date.now()
      if (logoutTimeoutRef.current) window.clearTimeout(logoutTimeoutRef.current)
      logoutTimeoutRef.current = window.setTimeout(async () => {
        // Si ya se inició un logout, no disparamos otro.
        if (isLoggingOutRef.current) return
        isLoggingOutRef.current = true
        try {
          await firebaseSignOut(auth)
        } catch {
          // Si falla, igual dejamos de intentar.
        } finally {
          setUserRole(null)
          isLoggingOutRef.current = false
        }
      }, inactivityMs)
    }

    const activityEvents: (keyof DocumentEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
    ]

    activityEvents.forEach((evt) => {
      document.addEventListener(evt, resetTimer, { passive: true })
    })
    window.addEventListener('focus', resetTimer)

    // Inicia el temporizador al entrar.
    resetTimer()

    return () => {
      activityEvents.forEach((evt) => {
        document.removeEventListener(evt, resetTimer)
      })
      window.removeEventListener('focus', resetTimer)
      if (logoutTimeoutRef.current) window.clearTimeout(logoutTimeoutRef.current)
    }
  }, [user])

  return (
    <AuthContext.Provider value={{ user, userRole, loading, authError, signIn, signOut, requestPasswordReset }}>
      {children}
    </AuthContext.Provider>
  )
}
