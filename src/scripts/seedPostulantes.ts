/**
 * Script para crear postulantes de prueba con todos sus datos y documentos.
 *
 * Modo aleatorio (por defecto, 30 filas):
 *   npx tsx src/scripts/seedPostulantes.ts
 *   npm run seed:postulantes
 *
 * Modo desempate (100 filas, puntajes NEM/RSH/enfermedad/hermanos diversos y repetidos al final para empates):
 *   npm run seed:postulantes:100-desempate
 *   SEED_CANTIDAD=100 SEED_DESEMPATE=1 npx tsx src/scripts/seedPostulantes.ts
 *
 * Requisitos que cumple cada postulante:
 * - RUT válido (formato chileno con dígito verificador correcto)
 * - Edad entre 17 y 23 años
 * - NEM >= 5.5
 * - Documentos: identidad, matricula, rsh, nem (+ hermanos/medico según datos)
 *
 * Uso:
 *   1. Colocar serviceAccountKey.json en la raíz del proyecto (debe estar en .gitignore)
 *
 * Nota: Usa Firebase Admin SDK. Los RUTs se generan con dígito verificador válido.
 */

const MODO_DESEMPATE_100 = process.env.SEED_DESEMPATE === '1'
const CANTIDAD_POSTULANTES_SEED = MODO_DESEMPATE_100
  ? Math.min(500, Math.max(1, Number(process.env.SEED_CANTIDAD || 100)))
  : 30

function randomItem<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}

/** Muestra de tamaño `count`; sin repetir mientras haya suficientes elementos en `source`. */
function sampleWithOptionalRepeat<T>(source: readonly T[], count: number): T[] {
  const pool = [...source]
  const out: T[] = []
  for (let k = 0; k < count; k++) {
    if (pool.length === 0) {
      out.push(randomItem(source))
      continue
    }
    const idx = Math.floor(Math.random() * pool.length)
    out.push(pool[idx] as T)
    pool.splice(idx, 1)
  }
  return out
}

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
  'Tomás Alonso',
  'Valentina Sofía',
  'Benjamín Esteban',
  'Amanda Josefa',
  'Lucas Vicente',
  'Emilia Antonia',
  'Maximiliano Raúl',
  'Catalina Ignacia',
  'Nicolás Felipe',
  'Javiera Constanza',
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
  'Fuentes',
  'Castro',
  'Vargas',
  'Tapia',
  'Núñez',
  'Jiménez',
  'Ruiz',
  'Moreno',
  'Herrera',
  'Campos',
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
  'Araya',
  'Peña',
  'Cortés',
  'Figueroa',
  'Riquelme',
  'Espinoza',
  'Valenzuela',
  'Cárdenas',
  'Oyarzún',
  'Pizarro',
]
const INSTITUCIONES = [
  'Universidad de Chile',
  'Pontificia Universidad Católica',
  'Universidad de Concepción',
  'Universidad de Valparaíso',
  'Universidad Técnica Federico Santa María',
  'Universidad de Santiago',
  'Universidad Austral de Chile',
  'Universidad Católica del Norte',
  'Universidad de La Frontera',
  'Instituto Profesional DUOC UC',
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
  'Ingeniería Comercial',
  'Kinesiología',
  'Trabajo Social',
  'Periodismo',
  'Informática',
  'Arquitectura',
]
const COMUNAS = [
  'Santiago',
  'Providencia',
  'Ñuñoa',
  'La Florida',
  'Maipú',
  'Puente Alto',
  'Las Condes',
  'Valparaíso',
  'Viña del Mar',
  'Concepción',
]
const CALLES = [
  'Av. Libertador',
  'Calle Los Aromos',
  'Pasaje Las Violetas',
  'Av. Matta',
  'Diagonal Paraguay',
  'Los Leones',
  'Irarrázaval',
  'Gran Avenida',
  'Teniente Cruz',
  'Vicuña Mackenna',
]

interface PostulanteSeed {
  data: Record<string, string | boolean>
  documentosSubidos: Record<string, boolean>
  documentUrls: Record<string, string>
}

type PerfilFijoLote = {
  nombres: string
  apellidoPaterno: string
  apellidoMaterno: string
  email: string
}

type CamposPuntajeSeed = {
  nem: string
  tramoRegistroSocial: string
  enfermedadCatastrofica: string
  enfermedadCronica: string
  tieneHermanosOHijosEstudiando: string
  tieneUnHermanOHijoEstudiando: string
  tieneDosOMasHermanosOHijosEstudiando: string
}

/**
 * 100 perfiles pensados para probar desempate:
 * - i 0–79: las 20 parejas (NEM banda × tramo RSH) × 4 variantes de enfermedad/hermanos.
 * - i 80–94: misma grilla con la 5.ª variante (máxima mezcla hermanos/enfermedad).
 * - i 95–99: mismo puntaje que i 0–4 (empates de criterio; distinto RUT y fecha/hora de postulación).
 */
function perfilPuntajeDesempateDesdeIndice(i: number): CamposPuntajeSeed {
  const i100 = i % 100
  const nems = ['5.5', '5.8', '6.3', '6.8'] as const
  const tramos = ['80%', '70%', '60%', '50%', '40%'] as const
  const herNone = {
    tieneHermanosOHijosEstudiando: 'No',
    tieneUnHermanOHijoEstudiando: 'No',
    tieneDosOMasHermanosOHijosEstudiando: 'No',
  } as const
  const herUno = {
    tieneHermanosOHijosEstudiando: 'Si',
    tieneUnHermanOHijoEstudiando: 'Si',
    tieneDosOMasHermanosOHijosEstudiando: 'No',
  } as const
  const herDos = {
    tieneHermanosOHijosEstudiando: 'Si',
    tieneUnHermanOHijoEstudiando: 'No',
    tieneDosOMasHermanosOHijosEstudiando: 'Si',
  } as const
  const enfVariants = [
    { enfermedadCatastrofica: 'No', enfermedadCronica: 'No', ...herNone },
    { enfermedadCatastrofica: 'No', enfermedadCronica: 'Si', ...herNone },
    { enfermedadCatastrofica: 'Si', enfermedadCronica: 'No', ...herNone },
    { enfermedadCatastrofica: 'No', enfermedadCronica: 'No', ...herUno },
    { enfermedadCatastrofica: 'No', enfermedadCronica: 'No', ...herDos },
  ] as const

  if (i100 >= 95) {
    const j = i100 - 95
    const base = j
    const nem = nems[base % 4]
    const tramo = tramos[Math.floor(base / 4)]
    return { nem, tramoRegistroSocial: tramo, ...enfVariants[0] }
  }
  if (i100 >= 80) {
    const base = i100 - 80
    const nem = nems[base % 4]
    const tramo = tramos[Math.floor(base / 4)]
    return { nem, tramoRegistroSocial: tramo, ...enfVariants[4] }
  }
  const base = i100 % 20
  const v = Math.floor(i100 / 20)
  const nem = nems[base % 4]
  const tramo = tramos[Math.floor(base / 4)]
  return { nem, tramoRegistroSocial: tramo, ...enfVariants[v] }
}

async function crearPostulanteSeed(perfil: PerfilFijoLote): Promise<PostulanteSeed> {
  const rut = generarRutValido()
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
  const enfermedadCron = enfermedadCat === 'Si' ? 'No' : Math.random() > 0.9 ? 'Si' : 'No'

  const tramoOpciones = ['40%', '50%', '60%', '70%', '80%'] as const
  const tramo = randomItem(tramoOpciones)

  const hoy = new Date()
  hoy.setMinutes(hoy.getMinutes() - Math.floor(Math.random() * 120))
  const fechaPost = hoy.toISOString().slice(0, 10).split('-').reverse().join('-')
  const hh = String(hoy.getHours()).padStart(2, '0')
  const mm = String(hoy.getMinutes()).padStart(2, '0')
  const ss = String(hoy.getSeconds()).padStart(2, '0')
  const horaPost = `${hh}:${mm}:${ss}`

  const comuna = randomItem(COMUNAS)
  const calle = randomItem(CALLES)
  const nCalle = 100 + Math.floor(Math.random() * 3800)

  const data: Record<string, string | boolean> = {
    nombres: perfil.nombres,
    apellidoPaterno: perfil.apellidoPaterno,
    apellidoMaterno: perfil.apellidoMaterno,
    rut,
    fechaNacimiento,
    edad: String(edad),
    sexo: Math.random() > 0.5 ? 'Masculino' : 'Femenino',
    estadoCivil: randomItem(['Soltero', 'Soltero', 'Casado'] as const),
    telefono: `+569${String(Math.floor(10000000 + Math.random() * 90000000))}`,
    email: perfil.email,
    domicilioFamiliar: `${calle} ${nCalle}, ${comuna}`,
    fechaPostulacion: fechaPost,
    horaPostulacion: horaPost,
    nem,
    nombreInstitucion: randomItem(INSTITUCIONES),
    comuna,
    carrera: randomItem(CARRERAS),
    duracionSemestres: randomItem(['8', '10', '12'] as const),
    anoIngreso: '2026',
    totalIntegrantes: String(3 + Math.floor(Math.random() * 5)),
    tramoRegistroSocial: tramo,
    tieneHermanosOHijosEstudiando: tieneHermanos,
    tieneUnHermanOHijoEstudiando: tieneUnHijo,
    tieneDosOMasHermanosOHijosEstudiando: tieneDosOMas,
    enfermedadCatastrofica: enfermedadCat,
    enfermedadCronica: enfermedadCron,
    tipoCuentaBancaria: 'cuenta_rut',
    numeroCuenta: String(Math.floor(10_000_000 + Math.random() * 89_999_999)),
    rutCuenta: rut,
    otraNumeroCuenta: '',
    otraTipoCuenta: '',
    otraBanco: '',
    otraBancoDetalle: '',
    otraRutTitular: '',
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

async function crearPostulanteSeedDesempate(perfil: PerfilFijoLote, indice: number): Promise<PostulanteSeed> {
  const rut = generarRutValido()
  const edad = 17 + Math.floor(Math.random() * 7)
  const añoNac = new Date().getFullYear() - edad
  const mes = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')
  const dia = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0')
  const fechaNacimiento = `${dia}-${mes}-${añoNac}`

  const pf = perfilPuntajeDesempateDesdeIndice(indice)

  const hoy = new Date()
  hoy.setMinutes(hoy.getMinutes() - indice * 13 - (indice % 17))

  const fechaPost = hoy.toISOString().slice(0, 10).split('-').reverse().join('-')
  const hh = String(hoy.getHours()).padStart(2, '0')
  const mm = String(hoy.getMinutes()).padStart(2, '0')
  const ss = String(hoy.getSeconds()).padStart(2, '0')
  const horaPost = `${hh}:${mm}:${ss}`

  const comuna = randomItem(COMUNAS)
  const calle = randomItem(CALLES)
  const nCalle = 100 + Math.floor(Math.random() * 3800)

  const data: Record<string, string | boolean> = {
    nombres: perfil.nombres,
    apellidoPaterno: perfil.apellidoPaterno,
    apellidoMaterno: perfil.apellidoMaterno,
    rut,
    fechaNacimiento,
    edad: String(edad),
    sexo: Math.random() > 0.5 ? 'Masculino' : 'Femenino',
    estadoCivil: randomItem(['Soltero', 'Soltero', 'Casado'] as const),
    telefono: `+569${String(Math.floor(10000000 + Math.random() * 90000000))}`,
    email: perfil.email,
    domicilioFamiliar: `${calle} ${nCalle}, ${comuna}`,
    fechaPostulacion: fechaPost,
    horaPostulacion: horaPost,
    nem: pf.nem,
    nombreInstitucion: randomItem(INSTITUCIONES),
    comuna,
    carrera: randomItem(CARRERAS),
    duracionSemestres: randomItem(['8', '10', '12'] as const),
    anoIngreso: '2026',
    totalIntegrantes: String(3 + Math.floor(Math.random() * 5)),
    tramoRegistroSocial: pf.tramoRegistroSocial,
    tieneHermanosOHijosEstudiando: pf.tieneHermanosOHijosEstudiando,
    tieneUnHermanOHijoEstudiando: pf.tieneUnHermanOHijoEstudiando,
    tieneDosOMasHermanosOHijosEstudiando: pf.tieneDosOMasHermanosOHijosEstudiando,
    enfermedadCatastrofica: pf.enfermedadCatastrofica,
    enfermedadCronica: pf.enfermedadCronica,
    tipoCuentaBancaria: 'cuenta_rut',
    numeroCuenta: String(Math.floor(10_000_000 + Math.random() * 89_999_999)),
    rutCuenta: rut,
    otraNumeroCuenta: '',
    otraTipoCuenta: '',
    otraBanco: '',
    otraBancoDetalle: '',
    otraRutTitular: '',
    observacion: '',
    declaracionJuradaAceptada: true,
  }

  const tieneHermanos = pf.tieneHermanosOHijosEstudiando === 'Si'
  const documentosSubidos: Record<string, boolean> = {
    identidad: true,
    matricula: true,
    rsh: true,
    nem: true,
    ...(tieneHermanos ? { hermanos: true } : {}),
    ...(pf.enfermedadCatastrofica === 'Si' || pf.enfermedadCronica === 'Si' ? { medico: true } : {}),
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
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`
  if (MODO_DESEMPATE_100) {
    console.log(
      `Modo DESEMPATE: ${CANTIDAD_POSTULANTES_SEED} postulantes con NEM/RSH/enfermedad/hermanos diversos (lote ${runId})\n`,
    )
  } else {
    console.log(`Creando ${CANTIDAD_POSTULANTES_SEED} postulantes de prueba (lote ${runId})...\n`)
  }

  const nombresLote = sampleWithOptionalRepeat(NOMBRES, CANTIDAD_POSTULANTES_SEED)
  const apPatLote = sampleWithOptionalRepeat(APELLIDOS_P, CANTIDAD_POSTULANTES_SEED)
  const apMatLote = sampleWithOptionalRepeat(APELLIDOS_M, CANTIDAD_POSTULANTES_SEED)

  for (let i = 0; i < CANTIDAD_POSTULANTES_SEED; i++) {
    const perfil: PerfilFijoLote = {
      nombres: nombresLote[i] as string,
      apellidoPaterno: apPatLote[i] as string,
      apellidoMaterno: apMatLote[i] as string,
      email: `seed.${runId}.${i + 1}@ejemplo-prueba.cl`,
    }
    const { data, documentosSubidos, documentUrls } = MODO_DESEMPATE_100
      ? await crearPostulanteSeedDesempate(perfil, i)
      : await crearPostulanteSeed(perfil)
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
    if (MODO_DESEMPATE_100) {
      console.log(
        `  ${i + 1}. ${data.nombres} ${data.apellidoPaterno} - RUT ${data.rut} - Pt NEM ${puntaje.nem} RSH ${puntaje.rsh} Enf ${puntaje.enfermedad} Hnos ${puntaje.hermanos} **Total ${puntaje.total}** - id: ${docRef.id}`,
      )
    } else {
      console.log(
        `  ${i + 1}. ${data.nombres} ${data.apellidoPaterno} - RUT ${data.rut} - NEM ${data.nem} - Edad ${data.edad} - id: ${docRef.id}`,
      )
    }
  }

  console.log(
    `\n¡Completado! ${CANTIDAD_POSTULANTES_SEED} postulantes creados con documentos en Storage.`,
  )
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
