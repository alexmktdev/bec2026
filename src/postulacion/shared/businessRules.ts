import type { DocumentosSubidos, PostulanteData } from '../../types/postulante'
import { normalizeRut, rutTieneFormatoMinimo } from './rut'

/** Códigos alineados con HttpsError en Cloud Functions y navegación en el cliente. */
export type ReglaNegocioCode =
  | 'rut_invalido'
  | 'edad'
  | 'nem'
  | 'matricula_curso'
  | 'declaracion'
  | 'documentos'
  | 'urls_invalidas'

export interface ReglaNegocioFallo {
  ok: false
  code: ReglaNegocioCode
  message: string
}

export type ReglaNegocioResultado = { ok: true } | ReglaNegocioFallo

/** Lista de claves de documento obligatorias según respuestas del formulario. */
export function clavesDocumentosEsperadas(data: PostulanteData): string[] {
  const keys: string[] = ['identidad', 'matricula', 'rsh', 'nem']
  if (data.tieneHermanosOHijosEstudiando === 'Si') keys.push('hermanos')
  if (data.enfermedadCatastrofica === 'Si' || data.enfermedadCronica === 'Si') keys.push('medico')
  return keys
}

/** Comprueba que documentosSubidos y paths cubran lo esperado. */
export function validarDocumentosPresentes(
  data: PostulanteData,
  documentosSubidos: DocumentosSubidos,
  documentPaths: Record<string, string>,
): ReglaNegocioResultado {
  const esperadas = clavesDocumentosEsperadas(data)
  for (const key of esperadas) {
    if (!documentosSubidos[key as keyof DocumentosSubidos]) {
      return {
        ok: false,
        code: 'documentos',
        message: `Falta acreditar el documento: ${key}.`,
      }
    }
    const path = documentPaths[key]
    if (typeof path !== 'string' || path.trim().length === 0) {
      return {
        ok: false,
        code: 'documentos',
        message: `Falta la ruta del documento: ${key}.`,
      }
    }
  }
  return { ok: true }
}

/**
 * Valida que las rutas de Storage pertenezcan al prefijo postulaciones/
 * y no contengan intentos de path traversal.
 */
export function validarPathsStorage(
  documentPaths: Record<string, string>,
): ReglaNegocioResultado {
  for (const [key, path] of Object.entries(documentPaths)) {
    if (typeof path !== 'string' || path.trim().length === 0) {
      return {
        ok: false,
        code: 'urls_invalidas',
        message: `Falta la ruta del documento "${key}".`,
      }
    }
    if (!path.startsWith('postulaciones/')) {
      return {
        ok: false,
        code: 'urls_invalidas',
        message: `Ruta de almacenamiento no permitida para "${key}".`,
      }
    }
    // Prevenir path traversal
    if (path.includes('..') || path.includes('//')) {
      return {
        ok: false,
        code: 'urls_invalidas',
        message: `Ruta de documento inválida: ${key}.`,
      }
    }
  }
  return { ok: true }
}

/** Reglas de negocio excluyentes (edad, NEM, declaración, RUT). */
export function evaluarReglasPostulacion(data: PostulanteData): ReglaNegocioResultado {
  if (!rutTieneFormatoMinimo(data.rut)) {
    return {
      ok: false,
      code: 'rut_invalido',
      message: 'El RUT no tiene un formato válido.',
    }
  }

  if (!data.declaracionJuradaAceptada) {
    return {
      ok: false,
      code: 'declaracion',
      message: 'Debe aceptar la declaración jurada para postular.',
    }
  }

  const edad = parseInt(data.edad, 10)
  if (isNaN(edad) || edad < 17 || edad > 23) {
    return {
      ok: false,
      code: 'edad',
      message: `La edad (${data.edad}) está fuera del rango permitido (17–23 años).`,
    }
  }

  const nemNum = parseFloat(String(data.nem || '').replace(',', '.'))
  if (isNaN(nemNum) || nemNum < 5.5) {
    return {
      ok: false,
      code: 'nem',
      message: `El NEM debe ser mayor o igual a 5,5. Valor recibido: ${data.nem || '—'}.`,
    }
  }

  const anoMatricula = parseInt(String(data.anoIngreso || '').trim(), 10)
  if (isNaN(anoMatricula) || anoMatricula !== 2026) {
    return {
      ok: false,
      code: 'matricula_curso',
      message:
        'Solo pueden postular quienes acrediten matrícula en curso correspondiente al año 2026. El año indicado no cumple este requisito.',
    }
  }

  return { ok: true }
}

/** RUT normalizado para usar como ID de documento Firestore. */
export function rutNormalizadoPostulacion(data: PostulanteData): string {
  return normalizeRut(data.rut)
}
