import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { ref, getBlob } from 'firebase/storage'
import { storage } from '../firebase/config'
import type { PostulanteFirestore } from '../types/postulante'
import { generarReporteIndividualPDF } from './pdfGenerator'

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_')
}

/** Nombres descriptivos para cada tipo de documento al descargar */
const NOMBRES_DOCUMENTOS: Record<string, string> = {
  identidad: '01_Cedula_identidad.pdf',
  matricula: '02_Certificado_matricula.pdf',
  rsh: '03_Cartola_registro_social_hogares.pdf',
  nem: '04_Concentracion_notas_NEM.pdf',
  hermanos: '05_Certificado_alumno_regular.pdf',
  medico: '06_Certificado_medico.pdf',
}

function nombreArchivo(docId: string): string {
  return NOMBRES_DOCUMENTOS[docId] ?? `${docId}.pdf`
}

function storagePathFromDownloadUrl(url: string): string | null {
  try {
    const match = url.match(/\/o\/(.+?)(?:\?|$)/)
    if (!match) return null
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

/** Descarga un archivo desde Storage: intenta getBlob (SDK) y fetch como fallback */
async function descargarArchivo(url: string): Promise<Blob> {
  const path = storagePathFromDownloadUrl(url)

  // 1. Intentar getBlob (SDK Firebase) si tenemos el path
  if (path) {
    try {
      const fileRef = ref(storage, path)
      return await getBlob(fileRef)
    } catch {
      // Continuar al fallback
    }
  }

  // 2. Fallback: fetch con la URL directa (incluye token de acceso)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  const res = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    signal: controller.signal,
  })
  clearTimeout(timeout)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.blob()
}

async function descargarDocsEnZip(postulante: PostulanteFirestore, incluirReporte: boolean): Promise<Blob> {
  const zip = new JSZip()
  const rut = (postulante.rut || '').replace(/\./g, '')
  const folderName = sanitizeName(`${rut}_${postulante.nombres || ''}_${postulante.apellidoPaterno || ''}`)
  const folder = zip.folder(folderName)!

  if (incluirReporte) {
    const reporteBlob = generarReporteIndividualPDF(postulante)
    folder.file('reporte_postulante.pdf', reporteBlob)
  }

  if (postulante.documentUrls && Object.keys(postulante.documentUrls).length > 0) {
    await Promise.all(
      Object.entries(postulante.documentUrls).map(async ([docId, url]) => {
        if (!url || typeof url !== 'string') return
        try {
          const blob = await descargarArchivo(url)
          folder.file(nombreArchivo(docId), blob)
        } catch (err) {
          console.warn(`No se pudo descargar ${docId}:`, err)
        }
      }),
    )
  }

  return zip.generateAsync({ type: 'blob' })
}

/** Descarga los documentos de un solo postulante en un ZIP (incluye reporte PDF) */
export async function descargarDocumentosPostulante(postulante: PostulanteFirestore): Promise<void> {
  const blob = await descargarDocsEnZip(postulante, true)
  const nombre = sanitizeName(`${(postulante.rut || '').replace(/\./g, '')}_${postulante.apellidoPaterno || 'postulante'}`)
  saveAs(blob, `documentos_${nombre}.zip`)
}

export async function descargarTodosDocumentos(postulantes: PostulanteFirestore[]) {
  const zip = new JSZip()
  const root = zip.folder('carpeta_postulaciones')!

  for (const p of postulantes) {
    const rut = (p.rut || '').replace(/\./g, '')
    const folderName = sanitizeName(`${rut}_${p.nombres || ''}_${p.apellidoPaterno || ''}`)
    const folder = root.folder(folderName)!

    const reporteBlob = generarReporteIndividualPDF(p)
    folder.file('reporte_postulante.pdf', reporteBlob)

    if (p.documentUrls && Object.keys(p.documentUrls).length > 0) {
      await Promise.all(
        Object.entries(p.documentUrls).map(async ([docId, url]) => {
          if (!url || typeof url !== 'string') return
          try {
            const blob = await descargarArchivo(url)
            folder.file(nombreArchivo(docId), blob)
          } catch (err) {
            console.warn(`No se pudo descargar ${docId} para ${p.rut}:`, err)
          }
        }),
      )
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `documentos_postulantes_${new Date().toISOString().slice(0, 10)}.zip`)
}
