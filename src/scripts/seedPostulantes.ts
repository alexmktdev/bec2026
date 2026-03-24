/**
 * Script para crear 10 postulantes de prueba con todos sus datos y documentos.
 *
 * Requisitos que cumple cada postulante:
 * - RUT válido (formato chileno con dígito verificador correcto)
 * - Edad entre 17 y 23 años
 * - NEM >= 5.5
 * - No está en base histórica (usa RUTs nuevos)
 * - Documentos: identidad, matricula, rsh, nem (+ hermanos/medico según datos)
 *
 * Uso:
 *   1. Colocar serviceAccountKey.json en la raíz del proyecto
 *   2. Ejecutar: npx tsx src/scripts/seedPostulantes.ts
 *
 * Nota: Usa Firebase Admin SDK. Los RUTs se generan con dígito verificador válido.
 */

import { PDFDocument } from 'pdf-lib'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage, getDownloadURL } from 'firebase-admin/storage'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SERVICE_ACCOUNT_PATH = resolve(__dirname, '../../serviceAccountKey.json')

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
const projectId = serviceAccount.project_id
// Bucket por defecto; si usas firebasestorage.app, define STORAGE_BUCKET en env
const storageBucket =
  process.env.STORAGE_BUCKET || `${projectId}.firebasestorage.app`

initializeApp({
  credential: cert(serviceAccount),
  storageBucket,
})

const db = getFirestore()
const bucket = getStorage().bucket()

// --- Generar RUT chileno válido (módulo 11) ---
function calcularDv(body: string): string {
  let sum = 0
  let multiplier = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }
  const calculated = 11 - (sum % 11)
  return calculated === 11 ? '0' : calculated === 10 ? 'K' : calculated.toString()
}

function generarRutValido(): string {
  // Cuerpo: 7-8 dígitos (evitar rangos muy altos que puedan existir en histórico)
  const body = String(Math.floor(20000000 + Math.random() * 10000000))
  const dv = calcularDv(body)
  const rut = `${body}-${dv}`
  return rut.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.')
}

function normalizeRut(rut: string): string {
  return rut.replace(/\./g, '').toLowerCase().trim()
}

// --- Crear PDF de prueba (mínimo válido) ---
async function crearPdfPlaceholder(): Promise<Buffer> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  page.drawText('Documento de prueba - Beca Municipal 2026', {
    x: 50,
    y: 700,
    size: 14,
  })
  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

// --- Helpers Storage (mismo path que storageService) ---
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

const NOMBRES_ARCHIVOS: Record<string, string> = {
  identidad: '01_Cedula_identidad.pdf',
  matricula: '02_Certificado_matricula.pdf',
  rsh: '03_Cartola_registro_social_hogares.pdf',
  nem: '04_Concentracion_notas_NEM.pdf',
  hermanos: '05_Certificado_alumno_regular.pdf',
  medico: '06_Certificado_medico.pdf',
}

async function subirDocumento(
  rut: string,
  nombres: string,
  apellidoPaterno: string,
  docId: string,
  pdfBuffer: Buffer,
): Promise<string> {
  const folder = buildFolderName(rut, nombres, apellidoPaterno)
  const fileName = NOMBRES_ARCHIVOS[docId] ?? `${docId}.pdf`
  const path = `postulaciones/${folder}/${fileName}`
  const file = bucket.file(path)
  await file.save(pdfBuffer, {
    contentType: 'application/pdf',
    metadata: {
      firebaseStorageDownloadTokens: randomUUID(),
    },
  })
  return getDownloadURL(file)
}

// --- Datos de postulantes de prueba ---
const NOMBRES = [
  'Juan Carlos',
  'María Fernanda',
  'Pedro Antonio',
  'Ana Lucía',
  'Diego Andrés',
  'Camila Valentina',
  'Sebastián Ignacio',
  'Francisca Belén',
  'Matías Nicolás',
  'Isidora Paz',
]
const APELLIDOS_P = [
  'González',
  'Muñoz',
  'Rojas',
  'Díaz',
  'Pérez',
  'Soto',
  'Contreras',
  'Silva',
  'Martínez',
  'Sepúlveda',
]
const APELLIDOS_M = [
  'López',
  'Hernández',
  'Ramírez',
  'Torres',
  'Flores',
  'Rivera',
  'Gómez',
  'Díaz',
  'Reyes',
  'Morales',
]
const INSTITUCIONES = [
  'Universidad de Chile',
  'Pontificia Universidad Católica',
  'Universidad de Concepción',
  'Universidad de Valparaíso',
  'Universidad Técnica Federico Santa María',
]
const CARRERAS = [
  'Ingeniería Civil',
  'Medicina',
  'Derecho',
  'Psicología',
  'Enfermería',
  'Administración de Empresas',
  'Contador Auditor',
  'Pedagogía en Historia',
]

interface PostulanteSeed {
  data: Record<string, string | boolean>
  documentosSubidos: Record<string, boolean>
  documentUrls: Record<string, string>
}

async function crearPostulanteSeed(index: number): Promise<PostulanteSeed> {
  const rut = generarRutValido()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void normalizeRut(rut) // warming-up para main()
  const edad = 17 + Math.floor(Math.random() * 7) // 17-23
  const añoNac = new Date().getFullYear() - edad
  const mes = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const dia = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const fechaNacimiento = `${dia}-${mes}-${añoNac}`

  // NEM entre 5.5 y 7.0
  const nemVal = 5.5 + Math.random() * 1.5
  const nem = nemVal.toFixed(1)

  const tieneHermanos = Math.random() > 0.5 ? 'Si' : 'No'
  const tieneUnHijo = tieneHermanos === 'Si' && Math.random() > 0.5 ? 'Si' : 'No'
  const tieneDosOMas = tieneHermanos === 'Si' && Math.random() > 0.6 ? 'Si' : 'No'
  const enfermedadCat = Math.random() > 0.85 ? 'Si' : 'No'
  const enfermedadCron = Math.random() > 0.9 ? 'Si' : 'No'

  const tramoOpciones = ['40%', '50%', '60%', '70%', '80%'] as const
  const tramo = tramoOpciones[Math.floor(Math.random() * tramoOpciones.length)]

  const hoy = new Date()
  const fechaPost = hoy.toISOString().slice(0, 10).split('-').reverse().join('-')
  const horaPost = hoy.toTimeString().slice(0, 8)

  const data: Record<string, string | boolean> = {
    nombres: NOMBRES[index],
    apellidoPaterno: APELLIDOS_P[index],
    apellidoMaterno: APELLIDOS_M[index],
    rut,
    fechaNacimiento,
    edad: String(edad),
    sexo: index % 2 === 0 ? 'Masculino' : 'Femenino',
    estadoCivil: 'Soltero',
    telefono: `+56${9}${Math.floor(10000000 + Math.random() * 90000000)}`,
    email: `postulante${index + 1}.test@ejemplo.cl`,
    domicilioFamiliar: `Av. Principal ${100 + index * 10}, Santiago`,
    fechaPostulacion: fechaPost,
    horaPostulacion: horaPost,
    nem,
    nombreInstitucion: INSTITUCIONES[index % INSTITUCIONES.length],
    comuna: 'Santiago',
    carrera: CARRERAS[index % CARRERAS.length],
    duracionSemestres: '10',
    anoIngreso: String(new Date().getFullYear() - 1),
    totalIntegrantes: '4',
    tramoRegistroSocial: tramo,
    tieneHermanosOHijosEstudiando: tieneHermanos,
    tieneUnHermanOHijoEstudiando: tieneUnHijo,
    tieneDosOMasHermanosOHijosEstudiando: tieneDosOMas,
    enfermedadCatastrofica: enfermedadCat,
    enfermedadCronica: enfermedadCron,
    numeroCuenta: String(10000000 + index).padStart(8, '0'),
    rutCuenta: rut,
    observacion: '',
    declaracionJuradaAceptada: true,
  }

  const documentosSubidos: Record<string, boolean> = {
    identidad: true,
    matricula: true,
    rsh: true,
    nem: true,
    ...(tieneHermanos === 'Si' ? { hermanos: true } : {}),
    ...(enfermedadCat === 'Si' || enfermedadCron === 'Si' ? { medico: true } : {}),
  }

  const docIds = Object.keys(documentosSubidos)
  const pdfBuffer = await crearPdfPlaceholder()
  const documentUrls: Record<string, string> = {}

  for (const docId of docIds) {
    const url = await subirDocumento(
      rut,
      data.nombres as string,
      data.apellidoPaterno as string,
      docId,
      pdfBuffer,
    )
    documentUrls[docId] = url
  }

  return { data, documentosSubidos, documentUrls }
}

// --- Calcular puntaje (mismo algoritmo que scoring.ts) ---
function calcularPuntaje(data: Record<string, string | boolean>): {
  nem: number
  rsh: number
  enfermedad: number
  hermanos: number
  total: number
} {
  const nemVal = parseFloat(String(data.nem))
  let nem = 0
  if (!isNaN(nemVal)) {
    if (nemVal >= 6.6 && nemVal <= 7.0) nem = 40
    else if (nemVal >= 6.1 && nemVal <= 6.5) nem = 30
    else if (nemVal >= 5.6 && nemVal <= 6.0) nem = 20
    else if (nemVal === 5.5) nem = 10
  }

  const tramo = String(data.tramoRegistroSocial)
  const rsh =
    tramo === '40%' ? 35 : tramo === '50%' ? 20 : tramo === '60%' ? 15 : tramo === '70%' ? 10 : 0

  const cat = data.enfermedadCatastrofica === 'Si'
  const cron = data.enfermedadCronica === 'Si'
  const enfermedad = cat ? 15 : cron ? 10 : 0

  const dosOMas = data.tieneDosOMasHermanosOHijosEstudiando === 'Si'
  const uno = data.tieneUnHermanOHijoEstudiando === 'Si'
  const hermanos = dosOMas ? 10 : uno ? 5 : 0

  return { nem, rsh, enfermedad, hermanos, total: nem + rsh + enfermedad + hermanos }
}

async function main() {
  console.log('Creando 10 postulantes de prueba...\n')

  for (let i = 0; i < 10; i++) {
    const { data, documentosSubidos, documentUrls } = await crearPostulanteSeed(i)
    const puntaje = calcularPuntaje(data)

    const registro = {
      ...data,
      rutNormalizado: normalizeRut(data.rut as string),
      puntaje,
      estado: 'pendiente',
      motivoRechazo: null,
      documentosSubidos,
      documentUrls,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const docRef = await db.collection('postulantes').add(registro)
    console.log(
      `  ${i + 1}. ${data.nombres} ${data.apellidoPaterno} - RUT ${data.rut} - NEM ${data.nem} - Edad ${data.edad} - id: ${docRef.id}`,
    )
  }

  console.log('\n¡Completado! 10 postulantes creados con documentos en Storage.')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
