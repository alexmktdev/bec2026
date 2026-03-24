# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Configuración CORS para Firebase Storage

Si las descargas de documentos fallan con errores de CORS en la consola, debes configurar CORS en tu bucket de Storage:

1. Instala [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) (incluye `gsutil`).
2. Autentícate: `gcloud auth login`
3. Ejecuta desde la raíz del proyecto:

```bash
gsutil cors set storage-cors.json gs://beca-muni-2026.firebasestorage.app
```

Si tu bucket tiene otro nombre (ej. `beca-muni-2026.appspot.com`), ajusta el comando. El archivo `storage-cors.json` ya incluye `localhost:5173` y dominios de producción.

## Cargar postulantes de prueba

Para crear 10 postulantes de prueba con todos sus datos y documentos (sin usar el formulario):

1. Coloca `serviceAccountKey.json` en la raíz del proyecto (descárgalo desde Firebase Console > Project Settings > Service Accounts).
2. Ejecuta:

```bash
npm run seed:postulantes
```

Cada postulante cumple los filtros: RUT válido (dígito verificador correcto), edad 17–23, NEM ≥ 5.5. Los documentos son PDFs placeholder subidos a Storage.

Si tu bucket usa `.appspot.com` en lugar de `.firebasestorage.app`, define la variable de entorno:

```bash
STORAGE_BUCKET=tu-proyecto.appspot.com npm run seed:postulantes
```

## Cloud Functions (postulación segura)

La **creación** de documentos en `postulantes` solo ocurre en el servidor (Admin SDK). El cliente sube PDFs a Storage y luego llama a:

- `verificarElegibilidadPostulacion` — RUT duplicado o histórico
- `crearPostulacion` — validación de negocio + escritura en Firestore

Lógica compartida (puntaje, RUT, reglas): carpeta `src/postulacion/shared/` (también empaquetada en el bundle de `functions`).

### Despliegue

1. Instalar dependencias de functions (una vez):

```bash
cd functions && npm install && cd ..
```

2. **Región:** en `functions/src/index.ts` está `setGlobalOptions({ region: 'us-central1' })`. Debe coincidir con `VITE_FUNCTIONS_REGION` en tu `.env` del frontend (ver `.env.example`).

3. Desplegar reglas y funciones:

```bash
firebase deploy --only firestore:rules,functions
```

O por separado: `npm run deploy:rules` y `npm run deploy:functions`.

4. Si las llamadas fallan por permisos, en Google Cloud Console asegúrate de que las funciones **Gen 2** permitan invocación pública (`invoker: 'public'` en código suele bastar tras desplegar con Firebase CLI reciente).

---

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
