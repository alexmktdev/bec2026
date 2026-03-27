# Nodemailer con Office 365 y STARTTLS

## Instalación

```bash
npm install nodemailer
```

---

## Código

```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,        // false porque usamos STARTTLS (no SSL directo)
  requireTLS: true,     // fuerza STARTTLS obligatoriamente
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false  // útil si hay problemas con certificados
  },
  auth: {
    user: 'tucorreo@tudominio.com',
    pass: 'tucontraseña'
  }
});

// Verificar conexión
transporter.verify((error, success) => {
  if (error) {
    console.error('Error de conexión:', error);
  } else {
    console.log('Servidor listo para enviar correos');
  }
});

// Enviar correo
const mailOptions = {
  from: 'tucorreo@tudominio.com',
  to: 'destinatario@ejemplo.com',
  subject: 'Asunto del correo',
  text: 'Contenido en texto plano',
  html: '<p>Contenido en <b>HTML</b></p>'
};

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('Error al enviar:', error);
  } else {
    console.log('Correo enviado:', info.messageId);
  }
});
```

---

## Parámetros clave para Office 365

| Parámetro | Valor | Por qué |
|---|---|---|
| `host` | `smtp.office365.com` | Servidor SMTP de Microsoft |
| `port` | `587` | Puerto estándar STARTTLS |
| `secure` | `false` | SSL directo va en 465, no 587 |
| `requireTLS` | `true` | Fuerza el upgrade a TLS |
| `ciphers` | `'SSLv3'` | Compatibilidad con servidores Microsoft |

---

## Error común: 535 5.7.139

Si recibes este error al autenticarte:

```
535 5.7.139 Authentication unsuccessful
```

**No es un problema de código**, sino de configuración en Microsoft 365. Debes habilitar SMTP AUTH para el buzón:

1. Ir al **Centro de Administración de Microsoft 365**
2. **Usuarios activos** → seleccionar el usuario
3. Pestaña **Correo** → **Administrar aplicaciones de correo electrónico**
4. Activar **SMTP autenticado**

O via PowerShell:

```powershell
Connect-ExchangeOnline
Set-CASMailbox -Identity "usuario@dominio.com" -SmtpClientAuthenticationDisabled $false
```
