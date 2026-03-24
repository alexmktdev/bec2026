import type { PostulanteData, PuntajeDesglosado } from '../../types/postulante'

export function calcularPuntajeNEM(nem: string): number {
  const valor = parseFloat(nem)
  if (isNaN(valor)) return 0
  if (valor >= 6.6 && valor <= 7.0) return 40
  if (valor >= 6.1 && valor <= 6.5) return 30
  if (valor >= 5.6 && valor <= 6.0) return 20
  if (valor === 5.5) return 10
  return 0
}

export function calcularPuntajeRSH(tramo: string): number {
  switch (tramo) {
    case '40%':
      return 35
    case '50%':
      return 20
    case '60%':
      return 15
    case '70%':
      return 10
    default:
      return 0
  }
}

export function calcularPuntajeEnfermedad(catastrofica: string, cronica: string): number {
  const tieneCatastrofica = catastrofica === 'Si'
  const tieneCronica = cronica === 'Si'
  if (tieneCatastrofica) return 15
  if (tieneCronica) return 10
  return 0
}

export function calcularPuntajeHermanos(tieneUno: string, tieneDosOMas: string): number {
  if (tieneDosOMas === 'Si') return 10
  if (tieneUno === 'Si') return 5
  return 0
}

export function calcularPuntajeTotal(data: PostulanteData): PuntajeDesglosado {
  const nem = calcularPuntajeNEM(data.nem)
  const rsh = calcularPuntajeRSH(data.tramoRegistroSocial)
  const enfermedad = calcularPuntajeEnfermedad(data.enfermedadCatastrofica, data.enfermedadCronica)
  const hermanos = calcularPuntajeHermanos(
    data.tieneUnHermanOHijoEstudiando,
    data.tieneDosOMasHermanosOHijosEstudiando,
  )

  return {
    nem,
    rsh,
    enfermedad,
    hermanos,
    total: nem + rsh + enfermedad + hermanos,
  }
}
