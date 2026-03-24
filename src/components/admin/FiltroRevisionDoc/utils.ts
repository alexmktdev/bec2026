/** Nombres descriptivos para documentos */
export const NOMBRES_DOCUMENTOS: Record<string, string> = {
  identidad: 'Cédula de identidad',
  matricula: 'Certificado de matrícula',
  rsh: 'Cartola registro social hogares',
  nem: 'Concentración notas NEM',
  hermanos: 'Certificado alumno regular',
  medico: 'Certificado médico',
}

export function labelDocumento(docId: string): string {
  return NOMBRES_DOCUMENTOS[docId] ?? docId.replace(/_/g, ' ')
}

export function storagePathFromDownloadUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const decodedUrl = decodeURIComponent(url)
    const parts = decodedUrl.split('/o/')
    if (parts.length < 2) return null
    return parts[1].split('?')[0]
  } catch {
    return null
  }
}
