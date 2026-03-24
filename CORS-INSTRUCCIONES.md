# Configurar CORS para Storage desde la consola (Cloud Shell)

Firebase Storage no tiene interfaz gráfica para CORS. Usa **Cloud Shell** en el navegador (no necesitas instalar nada).

## Pasos

### 1. Abre Google Cloud Console
- Ve a: https://console.cloud.google.com
- Inicia sesión con la cuenta del proyecto Firebase `beca-muni-2026`
- Selecciona el proyecto **beca-muni-2026**

### 2. Abre Cloud Shell
- En la esquina superior derecha, haz clic en el icono **>_** (Cloud Shell)
- Se abrirá una terminal en la parte inferior del navegador
- Espera a que termine de cargar

### 3. Crea el archivo CORS
En la terminal de Cloud Shell, ejecuta:

```bash
cat > cors.json << 'EOF'
[
  {
    "origin": ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "https://beca-muni-2026.web.app", "https://beca-muni-2026.firebaseapp.com"],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Content-Length", "Content-Disposition"]
  }
]
EOF
```

### 4. Aplica la configuración CORS
```bash
gsutil cors set cors.json gs://beca-muni-2026.firebasestorage.app
```

Si tu bucket tiene otro nombre (ej. `beca-muni-2026.appspot.com`), cámbialo en el comando.

### 5. Verifica
```bash
gsutil cors get gs://beca-muni-2026.firebasestorage.app
```

Deberías ver el JSON que configuraste.

---

**Listo.** Recarga tu app en `http://localhost:5173` y prueba de nuevo la descarga de documentos.
