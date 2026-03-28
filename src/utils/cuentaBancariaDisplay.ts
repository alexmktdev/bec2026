import type { PostulanteData } from '../types/postulante'
import { etiquetaBancoOtra } from '../postulacion/shared/cuentaBancariaSchema'

type CuentaFields = Pick<
  PostulanteData,
  | 'tipoCuentaBancaria'
  | 'numeroCuenta'
  | 'rutCuenta'
  | 'otraNumeroCuenta'
  | 'otraTipoCuenta'
  | 'otraBanco'
  | 'otraBancoDetalle'
  | 'otraRutTitular'
>

/** Texto compacto para tablas admin (compat. registros sin tipoCuentaBancaria). */
export function resumenCuentaBancariaListado(p: Partial<CuentaFields>): string {
  const tipo = p.tipoCuentaBancaria === 'otra' ? 'otra' : 'cuenta_rut'
  if (tipo === 'otra') {
    const banco = etiquetaBancoOtra({
      otraBanco: String(p.otraBanco ?? ''),
      otraBancoDetalle: String(p.otraBancoDetalle ?? ''),
    })
    const parts = [banco, p.otraTipoCuenta, p.otraNumeroCuenta, p.otraRutTitular].filter(
      (x) => x != null && String(x).trim() !== '',
    )
    return parts.length ? parts.map(String).join(' · ') : '—'
  }
  const n = p.numeroCuenta
  const r = p.rutCuenta
  if ((n && String(n).trim()) || (r && String(r).trim())) {
    return `Cuenta RUT: ${n ?? '—'} · Titular ${r ?? '—'}`
  }
  return '—'
}
