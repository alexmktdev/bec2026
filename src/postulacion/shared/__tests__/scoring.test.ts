import { describe, it, expect } from 'vitest'
import { 
  calcularPuntajeNEM, 
  calcularPuntajeRSH, 
  calcularPuntajeEnfermedad, 
  calcularPuntajeHermanos,
  calcularPuntajeTotal 
} from '../scoring'
import type { PostulanteData } from '../../../types/postulante'

describe('Scoring Logic', () => {
  describe('calcularPuntajeNEM', () => {
    it('should assign 40 points for NEM 6.6-7.0', () => {
      expect(calcularPuntajeNEM('6.6')).toBe(40)
      expect(calcularPuntajeNEM('7.0')).toBe(40)
    })

    it('should assign 30 points for NEM 6.1-6.5', () => {
      expect(calcularPuntajeNEM('6.1')).toBe(30)
      expect(calcularPuntajeNEM('6.5')).toBe(30)
    })

    it('should assign 20 points for NEM 5.6-6.0', () => {
      expect(calcularPuntajeNEM('5.6')).toBe(20)
      expect(calcularPuntajeNEM('6.0')).toBe(20)
    })

    it('should assign 10 points for NEM exactly 5.5', () => {
      expect(calcularPuntajeNEM('5.5')).toBe(10)
    })

    it('should assign 0 points for NEM below 5.5', () => {
      expect(calcularPuntajeNEM('5.4')).toBe(0)
    })
  })

  describe('calcularPuntajeRSH', () => {
    it('should assign correct points for each tramo', () => {
      expect(calcularPuntajeRSH('40%')).toBe(35)
      expect(calcularPuntajeRSH('50%')).toBe(20)
      expect(calcularPuntajeRSH('60%')).toBe(15)
      expect(calcularPuntajeRSH('70%')).toBe(10)
      expect(calcularPuntajeRSH('80%')).toBe(0)
    })
  })

  describe('calcularPuntajeEnfermedad', () => {
    it('should assign 15 points if catastrophic disease is present', () => {
      expect(calcularPuntajeEnfermedad('Si', 'No')).toBe(15)
      expect(calcularPuntajeEnfermedad('Si', 'Si')).toBe(15)
    })

    it('should assign 10 points if only chronic disease is present', () => {
      expect(calcularPuntajeEnfermedad('No', 'Si')).toBe(10)
    })

    it('should assign 0 if no diseases', () => {
      expect(calcularPuntajeEnfermedad('No', 'No')).toBe(0)
    })
  })

  describe('calcularPuntajeHermanos', () => {
    it('should assign 10 points for two or more siblings', () => {
      expect(calcularPuntajeHermanos('Si', 'Si')).toBe(10)
      expect(calcularPuntajeHermanos('No', 'Si')).toBe(10)
    })

    it('should assign 5 points for exactly one sibling', () => {
      expect(calcularPuntajeHermanos('Si', 'No')).toBe(5)
    })

    it('should assign 0 points if no siblings', () => {
      expect(calcularPuntajeHermanos('No', 'No')).toBe(0)
    })
  })

  describe('calcularPuntajeTotal', () => {
    it('should calculate the sum correctly (max hypothetical scenario)', () => {
      // @ts-ignore
      const mockData: PostulanteData = {
        nem: '7.0',
        tramoRegistroSocial: '40%',
        enfermedadCatastrofica: 'Si',
        enfermedadCronica: 'No',
        tieneUnHermanOHijoEstudiando: 'No',
        tieneDosOMasHermanosOHijosEstudiando: 'Si'
      }
      const puntaje = calcularPuntajeTotal(mockData)
      expect(puntaje.total).toBe(40 + 35 + 15 + 10) // 100
    })
  })
})
