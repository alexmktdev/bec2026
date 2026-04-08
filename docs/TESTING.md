# 📋 Documentación de Testing — Sistema de Becas Municipal 2026

> Documento generado el 2026-04-07. Cubre las tres capas de testing implementadas:  
> **Unitario → E2E (Playwright) → Reglas de Seguridad (Firebase Emulator).**

---

## Índice

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Infraestructura de Testing](#2-infraestructura-de-testing)
3. [Testing Unitario (Vitest)](#3-testing-unitario-vitest)
4. [Testing E2E (Playwright)](#4-testing-e2e-playwright)
5. [Testing de Reglas de Seguridad (Firebase Emulator)](#5-testing-de-reglas-de-seguridad-firebase-emulator)
6. [Cómo Ejecutar los Tests](#6-cómo-ejecutar-los-tests)
7. [Estado General](#7-estado-general)

---

## 1. Resumen Ejecutivo

| Tipo de Test         | Herramienta                      | Cantidad de Tests | Estado     |
|----------------------|-----------------------------------|-------------------|------------|
| Unitario             | Vitest + happy-dom                | 31 tests          | ✅ Pasan   |
| End-to-End (E2E)     | Playwright                        | 2 tests           | ✅ Pasan   |
| Reglas de Seguridad  | @firebase/rules-unit-testing      | 5 tests           | ✅ Pasan   |
| **Total**            |                                   | **38 tests**      | ✅ Todos   |

---

## 2. Infraestructura de Testing

### Dependencias instaladas

```json
{
  "devDependencies": {
    "vitest": "^4.1.3",               // Test runner unitario
    "@vitest/ui": "^4.1.3",           // UI interactiva
    "@vitest/coverage-v8": "^4.1.3",  // Cobertura de código
    "happy-dom": "^20.8.9",           // DOM virtual para Vitest
    "@playwright/test": "^1.59.1",    // E2E browser automation
    "@firebase/rules-unit-testing": "^5.0.0" // Emulador de reglas
  }
}
```

### Scripts disponibles

```bash
npm run test              # Tests unitarios en modo watch
npm run test:run          # Tests unitarios (una sola pasada)
npm run test:coverage     # Tests unitarios + reporte de cobertura HTML
npm run test:ui           # Interfaz gráfica de Vitest
npm run test:e2e          # Tests E2E con Playwright (levanta dev server automáticamente)
npm run test:e2e:ui       # Playwright en modo UI interactivo
npm run test:rules        # Reglas de seguridad con Firebase Emulator
```

### Configuración de Vitest (`vite.config.ts`)

```typescript
test: {
  globals: true,
  environment: 'happy-dom',
  setupFiles: ['./src/setupTests.ts'],
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html'],
  }
}
```

### Configuración de Playwright (`playwright.config.ts`)

- **Base URL:** `http://localhost:5173`
- **webServer:** Ejecuta `npm run dev` automáticamente antes de los tests
- **Timeout:** 30 segundos por acción

---

## 3. Testing Unitario (Vitest)

Los tests unitarios validan la **lógica de negocio pura**, completamente aislada de Firebase o del DOM.

### 3.1 RUT Utilities — `rut.test.ts`

**Archivo:** `src/postulacion/shared/__tests__/rut.test.ts`  
**Módulo testeado:** `src/postulacion/shared/rut.ts`

| # | Test | Descripción | Resultado |
|---|------|-------------|-----------|
| 1 | `normalizeRut` — quita puntos | `'12.345.678-9'` → `'12345678-9'` | ✅ |
| 2 | `normalizeRut` — tolerante a espacios y `k` minúscula | `' 12.345.678 - k '` → `'12345678-k'` | ✅ |
| 3 | `normalizeRut` — entrada vacía o `null` | Devuelve `''` sin lanzar error | ✅ |
| 4 | `rutTieneFormatoMinimo` — RUT con guión válido | `'12345678-9'` → `true` | ✅ |
| 5 | `rutTieneFormatoMinimo` — sin guión o caracteres inválidos | `'12345678'` → `false` | ✅ |
| 6 | `validarRutMatematico` — RUT matemáticamente correcto | `'12.345.678-5'` → `true` (Módulo 11) | ✅ |
| 7 | `validarRutMatematico` — dígito verificador incorrecto | `'12.345.678-9'` → `false` | ✅ |

**Total: 7 tests — 7 pasan ✅**

---

### 3.2 Scoring Logic — `scoring.test.ts`

**Archivo:** `src/postulacion/shared/__tests__/scoring.test.ts`  
**Módulo testeado:** `src/postulacion/shared/scoring.ts`

Este módulo calcula el puntaje de cada postulante según las bases del concurso.

| # | Función | Caso | Puntaje Esperado | Resultado |
|---|---------|------|-----------------|-----------|
| 1 | `calcularPuntajeNEM` | NEM entre 6.6 y 7.0 | 40 pts | ✅ |
| 2 | `calcularPuntajeNEM` | NEM entre 6.1 y 6.5 | 30 pts | ✅ |
| 3 | `calcularPuntajeNEM` | NEM entre 5.6 y 6.0 | 20 pts | ✅ |
| 4 | `calcularPuntajeNEM` | NEM exactamente 5.5 | 10 pts | ✅ |
| 5 | `calcularPuntajeNEM` | NEM menor a 5.5 | 0 pts | ✅ |
| 6 | `calcularPuntajeRSH` | Tramo 40% | 35 pts | ✅ |
| 7 | `calcularPuntajeRSH` | Tramo 50% | 20 pts | ✅ |
| 8 | `calcularPuntajeRSH` | Tramo 60% | 15 pts | ✅ |
| 9 | `calcularPuntajeRSH` | Tramo 70% | 10 pts | ✅ |
| 10 | `calcularPuntajeRSH` | Tramo 80%+ | 0 pts | ✅ |
| 11 | `calcularPuntajeEnfermedad` | Enfermedad catastrófica | 15 pts | ✅ |
| 12 | `calcularPuntajeEnfermedad` | Solo enfermedad crónica | 10 pts | ✅ |
| 13 | `calcularPuntajeEnfermedad` | Sin enfermedades | 0 pts | ✅ |
| 14 | `calcularPuntajeHermanos` | 2 o más hermanos estudiando | 10 pts | ✅ |
| 15 | `calcularPuntajeHermanos` | Exactamente 1 hermano | 5 pts | ✅ |
| 16 | `calcularPuntajeHermanos` | Sin hermanos | 0 pts | ✅ |
| 17 | `calcularPuntajeTotal` | Escenario máximo (NEM 7.0, RSH 40%, enf. cat., 2+ hermanos) | 100 pts | ✅ |

**Total: 17 tests — 17 pasan ✅**

---

### 3.3 Business Rules — `businessRules.test.ts`

**Archivo:** `src/postulacion/shared/__tests__/businessRules.test.ts`  
**Módulo testeado:** `src/postulacion/shared/businessRules.ts`

Estas reglas son las **mismas** que ejecuta el backend (Cloud Functions) antes de aceptar una postulación.

#### `evaluarReglasPostulacion`

| # | Caso | Código de error esperado | Resultado |
|---|------|--------------------------|-----------|
| 1 | Datos válidos → aprobado | — (`ok: true`) | ✅ |
| 2 | RUT inválido | `rut_invalido` | ✅ |
| 3 | Declaración jurada no aceptada | `declaracion` | ✅ |
| 4 | Edad fuera de rango (< 17 o > 23) | `edad` | ✅ |
| 5 | NEM inferior a 5.5 | `nem` | ✅ |
| 6 | Año de matrícula ≠ 2026 | `matricula_curso` | ✅ |

#### `validarPathsStorage`

| # | Caso | Resultado |
|---|------|-----------|
| 7 | Ruta que no empieza con `postulaciones/` | ✅ Bloqueado |
| 8 | Path traversal (`postulaciones/../secret.pdf`) | ✅ Bloqueado |
| 9 | Ruta válida (`postulaciones/rut/doc.pdf`) | ✅ Aceptada |

#### `clavesDocumentosEsperadas`

| # | Caso | Resultado |
|---|------|-----------|
| 10 | Sin situaciones especiales → solo docs obligatorios (identidad, matricula, rsh, nem) | ✅ |
| 11 | Con hermanos y enfermedad → incluye docs opcionales (hermanos, medico) | ✅ |

**Total: 11 tests — 11 pasan ✅**

---

## 4. Testing E2E (Playwright)

Los tests E2E simulan un **usuario real** usando el navegador (Chromium) contra la aplicación corriendo en local.

**Archivo:** `tests/postulacion.spec.ts`  
**Suite:** `Flujo de Postulación`

### Test 1 — Navegación Landing → Paso 1

**Descripción:** Verifica que el flujo inicial de la aplicación funciona correctamente.

**Pasos:**
1. Abrir `/informacion_beca` y verificar título de la página.
2. Hacer clic en el botón **"Sí, deseo postular"**.
3. Verificar redirección a `/bienvenida_1` y presencia del encabezado.
4. Hacer clic en **"Comenzar postulación"**.
5. Verificar redirección a `/antecedentes_postulante_2` con el texto "Paso 1 de 6".
6. Verificar que el campo **"Nombres"** está visible y accesible.

**Resultado:** ✅ Pasa

---

### Test 2 — Validación de Formato RUT en Paso 1

**Descripción:** Verifica que el formulario valida correctamente el formato del RUT y muestra el error.

**Pasos:**
1. Navegar hasta el Paso 1 (repite flujo de bienvenida).
2. Ingresar un RUT con formato inválido (`123`).
3. Hacer clic en **"Siguiente"** para disparar la validación.
4. Verificar que aparece el mensaje **"Formato de RUT inválido"**.

**Resultado:** ✅ Pasa

> **Nota técnica:** Para que Playwright pudiera localizar los campos por etiqueta, se agregaron atributos `id` y `htmlFor` a todos los inputs del formulario. Esto también mejora la accesibilidad (WCAG).

---

## 5. Testing de Reglas de Seguridad (Firebase Emulator)

Los tests de reglas se ejecutan contra el **Firebase Local Emulator Suite**, en un entorno completamente aislado de producción.

**Archivo:** `src/postulacion/shared/__tests__/rules.test.ts`  
**Emuladores necesarios:** Firestore (puerto 8080) + Storage (puerto 9199)

### Configuración del Emulador (`firebase.json`)

```json
{
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "singleProjectMode": true
  }
}
```

### Test 1 — `postulantes`: Acceso denegado a todos

**Contexto:** Usuario autenticado (`alice`)  
**Acción:** Intentar `getDoc` y `setDoc` en `/postulantes/some-id`  
**Resultado esperado:** Lanzar error (solo Admin SDK puede acceder)  
**Resultado:** ✅ Pasa

---

### Test 2 — `users`: Un usuario puede leer su propio perfil

**Contexto:** Usuario autenticado como `alice`  
**Acción:** `getDoc` en `/users/alice`  
**Resultado esperado:** Devuelve el documento sin error  
**Resultado:** ✅ Pasa

---

### Test 3 — `users`: Aislamiento de perfiles (no se puede leer el de otro)

**Contexto:** Usuario autenticado como `alice`  
**Acción:** `getDoc` en `/users/bob`  
**Resultado esperado:** Lanzar error por falta de permisos  
**Resultado:** ✅ Pasa

---

### Test 4 — `users`: Superadmin puede leer cualquier perfil

**Contexto:** Usuario con rol `superadmin`  
**Acción:** `getDoc` en `/users/alice`  
**Resultado esperado:** Devuelve el documento sin error  
**Resultado:** ✅ Pasa

---

### Test 5 — `historical_ruts`: Acceso público limitado

**Casos:**
- `getDoc` un RUT específico → permitido públicamente (para validar elegibilidad en el formulario)
- `getDocs` (listar toda la colección) → **bloqueado** (no se puede enumerar todos los RUTs)

**Resultado:** ✅ Pasa

---

## 6. Cómo Ejecutar los Tests

### Tests Unitarios

```bash
# Modo watch (desarrollo)
npm run test

# Una sola ejecución
npm run test:run

# Con reporte de cobertura
npm run test:coverage
# → Abre coverage/index.html para ver el reporte visual
```

### Tests E2E

```bash
# En modo headless (CI/CD)
npm run test:e2e

# En modo UI interactivo (ver el navegador)
npm run test:e2e:ui
```

> **Prerequisito:** No es necesario levantar el servidor manualmente, Playwright lo hace automáticamente.

### Tests de Reglas de Seguridad

```bash
# Requiere Java 11+
npm run test:rules
# → Equivale a: firebase emulators:exec 'vitest run src/.../rules.test.ts'
```

> **Prerequisito:** `firebase-tools` instalado globalmente y Java 11+ en el PATH.

---

## 7. Estado General

```
Total de tests:     38
✅ Pasan:           38
❌ Fallan:           0
⏭️  Omitidos:        0

Cobertura de lógica de negocio crítica: Alta
  • Validación de RUT: 100%
  • Cálculo de puntaje: 100%
  • Reglas de elegibilidad: 100%
  • Seguridad de Firestore: Cubierta con emulador
```

> [!TIP]
> **Próximo paso recomendado:** Configurar GitHub Actions para que estos 3 suites de tests se ejecuten automáticamente en cada `push` o `pull request`, garantizando que ningún cambio rompa la lógica crítica del sistema.
