import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase/config'
import type { UserRole } from '../types/postulante'

export interface UserAdminInfo extends UserRole {
  uid: string
  bloqueado?: boolean
  lastAttempt?: string
  createdAt?: string
  updatedAt?: string
}

export async function obtenerUsuariosAdmin(): Promise<UserAdminInfo[]> {
  const fn = httpsCallable<void, { users: UserAdminInfo[] }>(functions, 'obtenerUsuariosAdmin')
  const { data } = await fn()
  return data.users
}

export async function obtenerRevisoresAdmin(): Promise<UserAdminInfo[]> {
  const users = await obtenerUsuariosAdmin()
  return users.filter(u => ['revisor', 'superadmin'].includes(u.role) && !u.bloqueado)
}

export async function toggleUserStatus(targetUid: string, nuevoEstado: boolean): Promise<void> {
  const fn = httpsCallable<{ targetUid: string, nuevoEstado: boolean }, { ok: boolean }>(functions, 'cambiarEstadoUsuario')
  await fn({ targetUid, nuevoEstado })
}
