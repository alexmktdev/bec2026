/**
 * Script para cargar los 1525 RUTs historicos del Excel a Firestore.
 *
 * Uso:
 *   1. Configurar las variables de entorno en .env
 *   2. Ejecutar: npx tsx src/scripts/loadHistoricalRuts.ts
 *
 * Nota: Este script usa el Firebase Admin SDK (no el client SDK)
 * para poder escribir directamente sin restricciones de reglas.
 * Necesitas un archivo serviceAccountKey.json descargado desde
 * Firebase Console > Project Settings > Service Accounts.
 */

import XLSX from 'xlsx'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const SERVICE_ACCOUNT_PATH = resolve(__dirname, '../../serviceAccountKey.json')

const serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))

initializeApp({
  credential: cert(serviceAccount),
})

const db = getFirestore()

function normalizeRut(rut: string): string {
  return rut.replace(/\./g, '').toLowerCase().trim()
}

async function main() {
  const excelPath = resolve(__dirname, '../../base_datos_historica.xlsx')
  const wb = XLSX.readFile(excelPath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

  console.log(`Leidos ${data.length} RUTs del Excel.`)

  // Firestore batch write (max 500 per batch)
  const BATCH_SIZE = 450
  let batch = db.batch()
  let count = 0
  let totalWritten = 0

  for (const row of data) {
    const rawRut = row[0]
    if (!rawRut || typeof rawRut !== 'string') continue

    const normalized = normalizeRut(rawRut)
    if (!normalized.includes('-')) continue

    const docRef = db.collection('historical_ruts').doc(normalized)
    batch.set(docRef, { rut: rawRut, normalized })
    count++

    if (count >= BATCH_SIZE) {
      await batch.commit()
      totalWritten += count
      console.log(`  Escritos ${totalWritten} RUTs...`)
      batch = db.batch()
      count = 0
    }
  }

  if (count > 0) {
    await batch.commit()
    totalWritten += count
  }

  console.log(`\nCompletado: ${totalWritten} RUTs cargados en Firestore (collection: historical_ruts).`)
}

main().catch(console.error)
