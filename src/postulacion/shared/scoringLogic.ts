import type { PostulanteData } from '../../types/postulante'

export interface PuntajeDesglosado {
  nem: number
  rsh: number
  enfermedad: number
  hermanos: number
  total: number
}

/** Puntos asignables por categoría (Senior: Centralizados en config) */
export const SCORING_CONFIG = {
  NEM: { MAX: 300, MID: 200, MIN: 100 },
  RSH: { MAX: 400, MID: 300, MIN: 200, LOW: 100 },
  SALUD: { CATASTROFICA: 200, CRONICA: 100 },
  HERMANOS: { DOS_O_MAS: 100, UNO: 50 },
}

/** Calcula el puntaje total basado en antecedentes del postulante */
export function calcularPuntajePostulacion(data: PostulanteData): PuntajeDesglosado {
  let nem = 0
  const nemNum = parseFloat(String(data.nem || '').replace(',', '.'))
  if (nemNum >= 6.5) nem = SCORING_CONFIG.NEM.MAX
  else if (nemNum >= 6.0) nem = SCORING_CONFIG.NEM.MID
  else if (nemNum >= 5.5) nem = SCORING_CONFIG.NEM.MIN

  let rsh = 0
  const rshTramo = parseInt(String(data.tramoRegistroSocial || '').replace('%', ''))
  if (rshTramo <= 40) rsh = SCORING_CONFIG.RSH.MAX
  else if (rshTramo <= 60) rsh = SCORING_CONFIG.RSH.MID
  else if (rshTramo <= 80) rsh = SCORING_CONFIG.RSH.LOW
  else rsh = 0

  let enfermedad = 0
  if (data.enfermedadCatastrofica === 'Sí' || data.enfermedadCatastrofica === 'Si') enfermedad = SCORING_CONFIG.SALUD.CATASTROFICA
  else if (data.enfermedadCronica === 'Sí' || data.enfermedadCronica === 'Si') enfermedad = SCORING_CONFIG.SALUD.CRONICA

  let hermanos = 0
  if (data.tieneDosOMasHermanosOHijosEstudiando === 'Sí' || data.tieneDosOMasHermanosOHijosEstudiando === 'Si') hermanos = SCORING_CONFIG.HERMANOS.DOS_O_MAS
  else if (data.tieneUnHermanOHijoEstudiando === 'Sí' || data.tieneUnHermanOHijoEstudiando === 'Si') hermanos = SCORING_CONFIG.HERMANOS.UNO

  return {
    nem,
    rsh,
    enfermedad,
    hermanos,
    total: nem + rsh + enfermedad + hermanos,
  }
}
