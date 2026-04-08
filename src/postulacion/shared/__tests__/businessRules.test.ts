import { describe, it, expect } from 'vitest'
import { 
  evaluarReglasPostulacion, 
  validarPathsStorage, 
  clavesDocumentosEsperadas 
} from '../businessRules'
import type { PostulanteData } from '../../../types/postulante'

describe('Business Rules', () => {
  describe('evaluarReglasPostulacion', () => {
    const validBaseData: Partial<PostulanteData> = {
      rut: '12.345.678-5',
      declaracionJuradaAceptada: true,
      edad: '20',
      nem: '6.0',
      anoIngreso: '2026'
    }

    it('should return ok: true for valid data', () => {
      const result = evaluarReglasPostulacion(validBaseData as PostulanteData)
      expect(result.ok).toBe(true)
    })

    it('should fail if RUT is invalid', () => {
      const data = { ...validBaseData, rut: '123' }
      const result = evaluarReglasPostulacion(data as PostulanteData)
      expect(result.ok).toBe(false)
      // @ts-ignore
      expect(result.code).toBe('rut_invalido')
    })

    it('should fail if declaration is not accepted', () => {
      const data = { ...validBaseData, declaracionJuradaAceptada: false }
      const result = evaluarReglasPostulacion(data as PostulanteData)
      expect(result.ok).toBe(false)
      // @ts-ignore
      expect(result.code).toBe('declaracion')
    })

    it('should fail if age is out of range', () => {
      expect(evaluarReglasPostulacion({ ...validBaseData, edad: '16' } as PostulanteData).ok).toBe(false)
      expect(evaluarReglasPostulacion({ ...validBaseData, edad: '24' } as PostulanteData).ok).toBe(false)
    })

    it('should fail if NEM is below 5.5', () => {
      const data = { ...validBaseData, nem: '5.4' }
      const result = evaluarReglasPostulacion(data as PostulanteData)
      expect(result.ok).toBe(false)
      // @ts-ignore
      expect(result.code).toBe('nem')
    })

    it('should fail if enrollment year is not 2026', () => {
      const data = { ...validBaseData, anoIngreso: '2025' }
      const result = evaluarReglasPostulacion(data as PostulanteData)
      expect(result.ok).toBe(false)
      // @ts-ignore
      expect(result.code).toBe('matricula_curso')
    })
  })

  describe('validarPathsStorage', () => {
    it('should fail if path does not start with postulaciones/', () => {
      const paths = { identidad: 'other/file.pdf' }
      const result = validarPathsStorage(paths)
      expect(result.ok).toBe(false)
      // @ts-ignore
      expect(result.code).toBe('urls_invalidas')
    })

    it('should fail if path contains traversal attempts', () => {
      const paths = { identidad: 'postulaciones/../secret.pdf' }
      expect(validarPathsStorage(paths).ok).toBe(false)
    })

    it('should succeed for valid paths', () => {
      const paths = { identidad: 'postulaciones/12345678-9/id.pdf' }
      expect(validarPathsStorage(paths).ok).toBe(true)
    })
  })

  describe('clavesDocumentosEsperadas', () => {
    it('should return mandatory docs by default', () => {
      const data = { 
        tieneHermanosOHijosEstudiando: 'No', 
        enfermedadCatastrofica: 'No', 
        enfermedadCronica: 'No' 
      }
      const keys = clavesDocumentosEsperadas(data as PostulanteData)
      expect(keys).toContain('identidad')
      expect(keys).toContain('matricula')
      expect(keys).toContain('rsh')
      expect(keys).toContain('nem')
      expect(keys).not.toContain('hermanos')
      expect(keys).not.toContain('medico')
    })

    it('should include optional docs if applicable', () => {
      const data = { 
        tieneHermanosOHijosEstudiando: 'Si', 
        enfermedadCatastrofica: 'Si', 
        enfermedadCronica: 'No' 
      }
      const keys = clavesDocumentosEsperadas(data as PostulanteData)
      expect(keys).toContain('hermanos')
      expect(keys).toContain('medico')
    })
  })
})
