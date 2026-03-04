# SafeExit - Sistema de Control de Salida Escolar

SafeExit es una aplicación web progresiva (PWA) para gestionar y controlar las salidas de alumnos en centros educativos mediante carnets con código QR. Diseñada para funcionar en PC (administración) y tablets (verificación en puerta).

## Características principales

### Gestión de alumnos
- Alta, edición y eliminación de alumnos con foto, curso y grupo
- Importación masiva desde Excel (.xlsx) con creación automática de grupos
- Descarga de plantilla Excel para importación
- Autorización parental y de guagua (transporte) por alumno
- Código QR único autogenerado por alumno

### Gestión de grupos y horarios
- Creación y edición de grupos (1A, 2B, 1 BACH A, etc.)
- Calendario visual de salidas: 12 tramos horarios x 5 días por grupo
- Configuración rápida de los tramos permitidos con un clic

### Verificación de salida (QR)
- Escaneo de carnets QR con cámara del tablet o pistola lectora de códigos
- Verificación instantánea: AUTORIZADO / DENEGADO en pantalla completa
- Algoritmo de verificación:
  1. Mayor de 18 años → AUTORIZADO (adulto)
  2. Menor sin autorización parental → DENEGADO
  3. Autorización de guagua en tramos 6/12 → AUTORIZADO
  4. Menor con autorización → Consulta horario del grupo
  5. Horario permite salida → AUTORIZADO
  6. En caso contrario → DENEGADO
- Foto del alumno en pantalla de resultado
- Señal sonora: tono agudo (autorizado) / alerta grave (denegado)

### Profesores de guardia
- Gestión de profesores con nombre y apellidos
- Contraseña común definida por el administrador
- Importación masiva desde Excel
- Usuarios autogenerados automáticamente
- Vista dedicada para tablet: pantalla completa, sin sidebar

### Historial y auditoría
- Registro de cada verificación con fecha, hora, resultado y motivo
- Filtros por fecha, grupo y nombre de alumno
- Exportación a CSV del historial completo
- Registro de incidencias vinculadas a salidas

### Impresión de carnets
- Generación de PDF con carnets en formato 2x5 (85x55mm)
- Cada carnet incluye: foto, nombre, apellidos, curso, grupo y código QR

### Vista de guardia (tablet)
- Pantalla completa optimizada para tablets
- Botones grandes táctiles (h-14, h-16)
- Reloj en tiempo real y estado de conexión WiFi
- Auto-retorno configurable (3/5/7/10/15 segundos)
- Estadísticas diarias: salidas permitidas y denegadas
- Compatible con pistola lectora de códigos de barras (envía Enter)

### Gestión de curso académico
- Función "Nuevo Curso Académico" que elimina todos los datos
- Conserva únicamente el usuario administrador
- Requiere confirmación escribiendo "NUEVO CURSO"

### PWA (Progressive Web App)
- Instalable en tablets y móviles como aplicación nativa
- Service worker para caché de recursos
- Iconos y manifest configurados

### Landing page
- Página de presentación atractiva con fotos
- Acceso directo al login

---

## Requisitos del servidor

- Ubuntu 20.04, 22.04 o 24.04 (x64 o ARM64)
- Mínimo 1 GB de RAM
- Mínimo 10 GB de disco
- Acceso a internet para la instalación
- Acceso root (sudo)

---

## Instalación automática

El instalador configura automáticamente todo lo necesario: actualiza el sistema operativo, instala Node.js 20.x, PostgreSQL, Nginx, crea la base de datos, compila la aplicación y configura los servicios del sistema.

### Paso 1: Descargar e instalar

```bash
# Clonar el repositorio
git clone https://github.com/innovafpiesmmg/SafeExit.git /var/www/safeexit

# Ejecutar el instalador
cd /var/www/safeexit
sudo bash install.sh
```

El instalador te pedirá:
- **Usuario administrador** (por defecto: admin)
- **Contraseña del administrador** (mínimo 4 caracteres)
- **Nombre completo** (por defecto: Administrador)
- **Token de Cloudflare Tunnel** (opcional, para acceso desde internet)

### Paso 2: Acceder a la aplicación

Abre en el navegador:
```
http://IP_DEL_SERVIDOR
```

---

## Actualización

Para actualizar la aplicación a la última versión:

```bash
cd /var/www/safeexit
sudo bash install.sh
```

El instalador detecta automáticamente que ya existe una instalación y:
- Conserva la base de datos y todos los datos
- Conserva las credenciales y configuración
- Actualiza el código desde GitHub
- Recompila la aplicación
- Reinicia los servicios

---

## Cloudflare Tunnel (acceso desde internet)

Si necesitas acceder a la aplicación desde fuera de la red local sin abrir puertos:

1. Crea un Tunnel en [Cloudflare Zero Trust](https://one.dash.cloudflare.com/)
2. Configura un hostname público apuntando a `http://localhost:5000`
3. Copia el token del Tunnel
4. Ejecuta el instalador y pega el token cuando lo pida

Si ya instalaste sin Tunnel y quieres añadirlo después:

```bash
# Instalar cloudflared
curl -L -o /tmp/cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i /tmp/cloudflared.deb

# Instalar servicio con tu token
sudo cloudflared service install TU_TOKEN
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

# Activar cookies seguras (necesario con HTTPS)
sudo sed -i 's/SECURE_COOKIES=false/SECURE_COOKIES=true/' /etc/safeexit/env
sudo systemctl restart safeexit
```

---

## Comandos útiles

| Acción | Comando |
|--------|---------|
| Ver estado | `systemctl status safeexit` |
| Ver logs en tiempo real | `journalctl -u safeexit -f` |
| Reiniciar aplicación | `systemctl restart safeexit` |
| Parar aplicación | `systemctl stop safeexit` |
| Reiniciar Nginx | `systemctl restart nginx` |
| Ver configuración | `cat /etc/safeexit/env` |
| Ver puertos en uso | `ss -ltnp \| grep :5000` |
| Probar conexión local | `curl http://localhost:5000` |
| Estado de PostgreSQL | `systemctl status postgresql` |

---

## Estructura de archivos en el servidor

```
/var/www/safeexit/          # Código de la aplicación
/var/www/safeexit/uploads/  # Fotos subidas de alumnos
/var/www/safeexit/dist/     # Aplicación compilada
/etc/safeexit/env           # Configuración (credenciales, BD)
/etc/systemd/system/safeexit.service  # Servicio systemd
/etc/nginx/sites-available/safeexit   # Configuración Nginx
```

---

## Variables de entorno

Archivo: `/etc/safeexit/env`

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | Entorno (production) |
| `PORT` | Puerto de la aplicación (5000) |
| `DATABASE_URL` | Conexión PostgreSQL |
| `SESSION_SECRET` | Secreto para sesiones (generado automáticamente) |
| `SECURE_COOKIES` | `true` si hay HTTPS (Cloudflare), `false` en red local |
| `ADMIN_USER` | Usuario admin inicial |
| `ADMIN_PASS` | Contraseña admin inicial |
| `ADMIN_NAME` | Nombre completo del admin |

---

## Solución de problemas

| Problema | Causa probable | Solución |
|----------|---------------|----------|
| No carga la página | Servicio caído | `sudo systemctl restart safeexit` |
| Login no funciona (cookie) | Cookies seguras sin HTTPS | Verificar `SECURE_COOKIES=false` en `/etc/safeexit/env` |
| Error 502 en Nginx | App no arrancó | `journalctl -u safeexit -f` para ver errores |
| No conecta a la BD | PostgreSQL parado | `sudo systemctl start postgresql` |
| Error de permisos | Usuario sin acceso | `sudo chown -R safeexit:safeexit /var/www/safeexit` |
| Fotos no se ven | Uploads sin permisos | `sudo chown safeexit:safeexit /var/www/safeexit/uploads` |

---

## Stack tecnológico

- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Backend**: Express.js (Node.js)
- **Base de datos**: PostgreSQL + Drizzle ORM
- **Autenticación**: Sesiones con express-session
- **QR**: qrcode (generación) + html5-qrcode (escaneo)
- **PDF**: jsPDF (impresión de carnets)
- **Excel**: xlsx (importación/exportación)
- **Proxy**: Nginx
- **Proceso**: systemd
- **Tunnel**: Cloudflare (opcional)

---

Desarrollado por **Atrreyu Servicios Digitales**
