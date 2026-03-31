import type { ResumenFaltantesAsignacion } from '../../../utils/tramosCobertura'

type Props = {
  resumen: ResumenFaltantesAsignacion
  /** 'page' = textos para la pestaña; 'modal' = textos para el panel de asignación */
  variant: 'page' | 'modal'
}

/**
 * Aviso de cobertura de tramos (solo agrega UI; los números vienen calculados fuera).
 */
export function CoberturaTramosRevisionResumen({ resumen, variant }: Props) {
  const { totalNomina, posicionesSinCubrir, postulantesSinRevisor } = resumen
  if (totalNomina <= 0) return null

  const hayAlerta =
    posicionesSinCubrir > 0 || (postulantesSinRevisor !== null && postulantesSinRevisor > 0)

  const titulo =
    variant === 'page'
      ? 'Cobertura de asignación a revisores'
      : 'Estado de la nómina en este borrador'

  return (
    <div
      className={`rounded-xl border p-4 text-sm leading-relaxed ${
        hayAlerta
          ? 'border-amber-300 bg-amber-50/95 text-amber-950'
          : 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
      }`}
      role="status"
    >
      <p className="text-xs font-bold uppercase tracking-wide opacity-90">{titulo}</p>
      <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm">
        <li>
          <strong>Nómina:</strong> {totalNomina} postulante{totalNomina !== 1 ? 's' : ''} (posiciones 1–{totalNomina}).
        </li>
        <li>
          <strong>Posiciones sin tramo definido</strong> en la configuración
          {variant === 'page' ? ' vigente' : ''}:{' '}
          <strong>{posicionesSinCubrir}</strong>
          {posicionesSinCubrir > 0
            ? ' (asigne tramos que las cubran o guarde de nuevo tras corregir).'
            : '.'}
        </li>
        {postulantesSinRevisor !== null && (
          <li>
            <strong>Sin revisor asignado</strong> según último guardado en base:{' '}
            <strong>{postulantesSinRevisor}</strong>
            {postulantesSinRevisor > 0
              ? ' (postulantes con posición en nómina y sin revisor).'
              : ' (todos los de la nómina con orden tienen revisor).'}
          </li>
        )}
        {postulantesSinRevisor === null && variant === 'page' && (
          <li className="list-none pl-0 text-xs opacity-90">
            Aún no hay orden de revisión guardado para esta nómina: el conteo «sin revisor» aparecerá tras el primer guardado
            de tramos.
          </li>
        )}
      </ul>
    </div>
  )
}
