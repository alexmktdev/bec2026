import { describe, it, expect } from 'vitest'
import { normalizeRut, rutTieneFormatoMinimo, validarRutMatematico } from '../rut'

describe('RUT Utilities', () => {
  describe('normalizeRut', () => {
    it('should remove dots for a valid RUT', () => {
      expect(normalizeRut('12.345.678-9')).toBe('12345678-9')
    })

    it('should handle spaces and lowercase K', () => {
      expect(normalizeRut(' 12.345.678 - k ')).toBe('12345678-k')
    })
    
    it('should return empty string for null or empty input', () => {
      expect(normalizeRut('')).toBe('')
      // @ts-ignore
      expect(normalizeRut(null)).toBe('')
    })
  })

  describe('rutTieneFormatoMinimo', () => {
    it('should return true for RUTs with basic structure', () => {
      expect(rutTieneFormatoMinimo('12345678-9')).toBe(true)
      expect(rutTieneFormatoMinimo('17379095-3')).toBe(true)
    })

    it('should return false for invalid formats', () => {
      expect(rutTieneFormatoMinimo('')).toBe(false)
      expect(rutTieneFormatoMinimo('12345678')).toBe(false) // Missing dash
      expect(rutTieneFormatoMinimo('abc-d')).toBe(false)
    })
  })

  describe('validarRutMatematico', () => {
    it('should return true for mathematically valid RUTs', () => {
      expect(validarRutMatematico('12.345.678-5')).toBe(true)
      expect(validarRutMatematico('20.000.000-5')).toBe(true)
      expect(validarRutMatematico('19.984.473-3')).toBe(true)
    })

    it('should return false for mathematically invalid RUTs', () => {
      expect(validarRutMatematico('12.345.678-9')).toBe(false) // Incorrect DV
      expect(validarRutMatematico('20.000.000-1')).toBe(false)
    })
  })
})
