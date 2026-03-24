import { ref, uploadBytes, listAll, getBlob } from 'firebase/storage'
import { storage } from '../firebase/config'

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] // %PDF-

/** Valida que el archivo comience con la firma PDF (%PDF-). */
async function isPdfFile(file: File): Promise<boolean> {
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return PDF_MAGIC.every((b, i) => header[i] === b)
}

function sanitizeForPath(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
}

function buildFolderName(rut: string, nombres: string, apellidoPaterno: string): string {
  const cleanRut = rut.replace(/\./g, '')
  const name = sanitizeForPath(`${nombres}_${apellidoPaterno}`).replace(/_+/g, '_')
  return `${cleanRut}_${name}`
}

/** Nombres descriptivos para cada tipo de documento en Storage */
const NOMBRES_DOCUMENTOS: Record<string, string> = {
  identidad: '01_Cedula_identidad.pdf',
  matricula: '02_Certificado_matricula.pdf',
  rsh: '03_Cartola_registro_social_hogares.pdf',
  nem: '04_Concentracion_notas_NEM.pdf',
  hermanos: '05_Certificado_alumno_regular.pdf',
  medico: '06_Certificado_medico.pdf',
}

function nombreArchivoStorage(docId: string): string {
  return NOMBRES_DOCUMENTOS[docId] ?? `${docId}.pdf`
}

/**
 * Sube un documento PDF a Storage y devuelve la **ruta de Storage** (no la URL).
 * La Cloud Function genera la URL de descarga con Admin SDK.
 * Esto permite que Storage Rules bloqueen `read` público.
 */
export async function subirDocumento(
  rut: string,
  nombres: string,
  apellidoPaterno: string,
  docId: string,
  file: File,
): Promise<string> {
  if (!(await isPdfFile(file))) {
    throw new Error(`El archivo "${file.name}" no es un PDF válido.`)
  }

  const folder = buildFolderName(rut, nombres, apellidoPaterno)
  const storagePath = `postulaciones/${folder}/${nombreArchivoStorage(docId)}`
  const storageRef = ref(storage, storagePath)
  await uploadBytes(storageRef, file, { contentType: 'application/pdf' })
  return storagePath
}

export async function subirTodosLosDocumentos(
  rut: string,
  nombres: string,
  apellidoPaterno: string,
  files: Record<string, File>,
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {}
  const entries = Object.entries(files)

  await Promise.all(
    entries.map(async ([docId, file]) => {
      const url = await subirDocumento(rut, nombres, apellidoPaterno, docId, file)
      urls[docId] = url
    }),
  )

  return urls
}

export async function listarDocumentosPostulante(
  rut: string,
  nombres: string,
  apellidoPaterno: string,
): Promise<{ name: string; fullPath: string }[]> {
  const folder = buildFolderName(rut, nombres, apellidoPaterno)
  const folderRef = ref(storage, `postulaciones/${folder}`)
  const result = await listAll(folderRef)
  return result.items.map((item) => ({ name: item.name, fullPath: item.fullPath }))
}

export async function descargarDocumento(fullPath: string): Promise<Blob> {
  const fileRef = ref(storage, fullPath)
  return getBlob(fileRef)
}
