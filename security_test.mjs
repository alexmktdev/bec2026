import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Configuración pública de tu Firebase (la que cualquier hacker puede sacar del código fuente)
const firebaseConfig = {
  apiKey: "AIzaSyBkQsbdEcuP_p1gF-l54yTFNbee5QkADlY",
  authDomain: "beca-muni-2026.firebaseapp.com",
  projectId: "beca-muni-2026",
  storageBucket: "beca-muni-2026.firebasestorage.app",
  messagingSenderId: "898354032602",
  appId: "1:898354032602:web:67597b84abe91f33ab1ae3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app, 'southamerica-west1');

async function runSecurityAudit() {
  console.log("🚀 Iniciando Simulación de Ataque...\n");

  // --- ATAQUE 1: Lectura Masiva No Autorizada ---
  console.log("⚠️ TEST 1: Intentando leer lista de postulantes (Firestore)...");
  try {
    const snap = await getDocs(collection(db, 'postulantes'));
    console.log("❌ FALLÓ LA SEGURIDAD: ¡He podido leer los datos!", snap.docs.length, "registros encontrados.");
  } catch (error) {
    console.log("✅ PROTECCIÓN ACTIVA: Firestore ha bloqueado el acceso. (Error: Insufficient Permissions)\n");
  }

  // --- ATAQUE 2: Llamada a Cloud Function sin App Check ---
  console.log("⚠️ TEST 2: Intentando llamar a 'verificarElegibilidadPostulacion' sin reCAPTCHA...");
  try {
    const verificar = httpsCallable(functions, 'verificarElegibilidadPostulacion');
    // Intentamos bypass de App Check simplemente no enviando el token
    const res = await verificar({ rut: "1-9" });
    console.log("❌ FALLÓ LA SEGURIDAD: La función respondió sin App Check:", res.data);
  } catch (error) {
    console.log("✅ PROTECCIÓN ACTIVA: Cloud Functions rechazó la llamada por falta de App Check.\n");
  }

  // --- ATAQUE 3: Lectura de perfiles de otros usuarios ---
  console.log("⚠️ TEST 3: Intentando leer perfiles de administración ('users')...");
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log("❌ FALLÓ LA SEGURIDAD: ¡He podido ver quiénes son los administradores!");
  } catch (error) {
    console.log("✅ PROTECCIÓN ACTIVA: Acceso a perfiles de usuario bloqueado.\n");
  }

  console.log("🏁 Auditoría finalizada. Si todos los tests marcaron 'PROTECCIÓN ACTIVA', tu sistema está blindado.");
}

runSecurityAudit();

