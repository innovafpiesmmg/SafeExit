# SafeExit - Sistema de Control de Salida Escolar

SafeExit es una aplicación web progresiva (PWA) para gestionar y controlar las salidas de alumnos en centros educativos de bachillerato y FP mediante carnets con código QR. Diseñada para funcionar en PC (administración), tablets en horizontal (verificación en puerta) y móviles (tutores).

## Características principales

### Gestión de alumnos
- Alta, edición y eliminación de alumnos con foto, curso y grupo
- Importación masiva desde Excel (.xlsx) con creación automática de grupos
- La plantilla Excel incluye columnas opcionales para personas autorizadas (nombre, apellidos y DNI/NIE, hasta 10 por alumno)
- Descarga de plantilla Excel para importación
- Autorización parental y de guagua (transporte) por alumno
- Campo de email opcional para notificaciones a la familia
- Código QR único autogenerado por alumno
- Gestión de personas autorizadas para recogida (hasta 10 por alumno, con nombre, apellido y DNI/NIE)

### Gestión de grupos y horarios
- Creación y edición de grupos (1A, 2B, 1 BACH A, etc.)
- Cada grupo tiene un **tipo de horario**: Mañana (tramos 1-6), Tarde (tramos 7-12) o Completo (tramos 1-12)
- El calendario muestra automáticamente solo los tramos correspondientes al horario del grupo
- Configuración de permisos de salida por grupo en fechas concretas
- Indicadores visuales (puntos verdes) en días con permisos configurados
- Fines de semana deshabilitados automáticamente

### Configuración de tramos horarios
- 12 tramos definibles por día de la semana (lunes a viernes)
- Nomenclatura: M1-M6 (mañana) y T1-T6 (tarde)
- Cada tramo tiene hora de inicio y fin configurables desde el panel de Ajustes
- Botón "Aplicar a todos los días" para copiar el horario de un día al resto
- Botón "Restaurar por defecto" para volver a los valores originales
- Los tramos se usan para la verificación automática de salidas

### Verificación de salida (QR)
- Tres pestañas en la vista del guardia: **QR**, **Buscar** y **Acompañada**
- Escaneo de carnets QR con cámara del tablet o pistola lectora de códigos
- Búsqueda manual de alumno por grupo y nombre
- Verificación instantánea: AUTORIZADO / DENEGADO en pantalla completa
- Algoritmo de verificación:
  1. Mayor de 18 años → AUTORIZADO (adulto)
  2. Menor sin autorización parental → DENEGADO
  3. Fin de semana → DENEGADO
  4. Fuera de tramos horarios configurados → DENEGADO
  5. Autorización de guagua en tramos 6/12 → AUTORIZADO
  6. Menor con autorización → Consulta horario del grupo para la fecha y tramo actual
  7. Horario permite salida → AUTORIZADO
  8. En caso contrario → DENEGADO
- Foto del alumno en pantalla de resultado
- Señal sonora: tono agudo (autorizado) / alerta grave (denegado)
- Auto-retorno configurable (3/5/7/10/15 segundos)
- Selección de cámara cuando hay varias disponibles

### Salida acompañada
- Pestaña dedicada en la vista del guardia para verificar la recogida de alumnos
- Flujo: seleccionar grupo → buscar alumno → introducir DNI/NIE del acompañante
- El DNI/NIE se puede introducir manualmente o **escanear con la cámara** (lectura del código de barras PDF417 del DNI español)
- Si la persona está en la lista de autorizados → salida AUTORIZADO + registro en historial
- Si no está autorizada → salida DENEGADO + incidencia automática
- Envío opcional de correo electrónico al registrar una salida acompañada (configurable por el administrador)
- Gestión de personas autorizadas desde la página de alumnos (hasta 10 por alumno)

### Entradas tardías
- Registro de llegadas tardías de alumnos
- Dos modos: escaneo de QR o selección manual (grupo + alumno)
- Campo de notas opcional por cada registro
- Envío automático de email a la familia (si está configurado SMTP y el alumno tiene email)
- Panel lateral con las entradas tardías del día actual
- Diseño horizontal optimizado para tablet en modo landscape

### Notificaciones por correo electrónico
- Configuración completa del servidor SMTP desde el panel de administración
- Botón de prueba de conexión SMTP
- Notificaciones automáticas para:
  - Entradas tardías de alumnos
  - Salidas autorizadas de menores
  - Salidas acompañadas (opcional, activable por el admin)

### Profesores de guardia y tutores
- Gestión de profesores con nombre y apellidos
- Dos roles: **Guardia** (verificación en puerta) y **Tutor** (gestión de grupo + registros)
- Asignación de grupo a tutores
- Contraseña común definida por el administrador
- Importación masiva desde Excel (columnas Nombre/Apellidos)
- Usuarios autogenerados automáticamente
- QR de acceso rápido para que los profesores inicien sesión escaneándolo

### Historial y auditoría
- Registro de cada verificación de salida con fecha, hora, resultado, motivo y verificador
- Registro de cada entrada tardía con fecha, hora, email enviado, registrador y notas
- Filtros por rango de fechas, grupo y nombre de alumno
- **Exportación a Excel (.xlsx)** del historial de salidas y entradas tardías con los filtros aplicados
- Registro de incidencias vinculadas a salidas
- Incidencias automáticas en intentos de recogida no autorizada

### Registros del tutor
- Pestaña "Registros" en la vista de tutor para consultar el historial de su grupo
- Dos sub-pestañas: **Salidas** y **Tardías**
- Filtros por fecha y nombre de alumno
- Datos automáticamente limitados al grupo asignado del tutor (sin acceso a otros grupos)

### Archivo de cursos académicos
- Al finalizar un curso, el administrador puede **archivar** todos los datos antes de empezar el nuevo
- El archivo guarda una copia completa de: alumnos, grupos, horarios, historial de salidas, entradas tardías, profesores, incidencias y ajustes
- Tras archivar, la base de datos se limpia automáticamente para el nuevo curso
- Opción alternativa de eliminar datos sin archivar (para casos excepcionales)
- Archivado requiere confirmación escribiendo "ARCHIVAR CURSO"
- Eliminación sin archivar requiere confirmación escribiendo "NUEVO CURSO"

### Consulta de cursos archivados
- Página "Cursos Archivados" en el menú lateral del administrador
- Lista de todos los cursos archivados con fecha y estadísticas resumidas (alumnos, grupos, salidas, tardías, incidencias)
- Visor completo de cada archivo con pestañas: **Alumnos**, **Grupos**, **Salidas**, **Tardías** e **Incidencias**
- Buscador por nombre dentro de cada archivo
- Posibilidad de eliminar permanentemente un archivo (requiere escribir "ELIMINAR")
- Solo accesible para el administrador

### Impresión de carnets
- Generación de PDF con carnets en formato 2x5 (85x55mm por tarjeta)
- Cada carnet incluye: cabecera azul con nombre del centro, curso académico y "SafeExit", foto del alumno, nombre, apellidos, curso, grupo y código QR
- QR de 22mm/68px optimizado para lectura rápida

### Carnet digital
- Página pública de carnet en `/carnet/:token` (sin necesidad de login)
- QR del carnet visible en el móvil del alumno
- Compartir enlace o QR desde la gestión de alumnos o desde la vista de tutor
- Muestra nombre del centro y curso académico

### Vista de guardia (tablet)
- Pantalla completa optimizada para tablets en horizontal
- Tres pestañas internas: escaneo QR, búsqueda por nombre y salida acompañada
- Botones grandes táctiles
- Reloj en tiempo real y estado de conexión WiFi
- Auto-retorno configurable al estado de espera
- Estadísticas diarias: total de salidas, permitidas y denegadas
- Compatible con pistola lectora de códigos de barras (envía Enter automáticamente)
- Selección de cámara cuando hay varias disponibles

### Vista de tutor (móvil)
- Vista optimizada para móvil con navegación por pestañas inferiores
- 4 pestañas: **Mi Grupo**, **Guardia**, **Tardías** y **Registros**
- Mi Grupo: lista de alumnos del grupo asignado, subida de fotos desde cámara, compartir carnet digital
- Guardia: verificación de salida con QR, búsqueda y salida acompañada
- Tardías: registro de entradas tardías
- Registros: historial de salidas y tardías del grupo
- Búsqueda de alumnos dentro del grupo

### Configuración y ajustes (admin)
- Nombre del centro educativo (usado en emails y carnets)
- Curso académico (mostrado en carnets)
- Configuración de tramos horarios por día de la semana (12 tramos con hora de inicio y fin)
- Configuración completa del servidor SMTP (host, puerto, usuario, contraseña, dirección de envío, SSL/TLS)
- Toggle para activar/desactivar el correo en salida acompañada
- Archivar curso académico o eliminar datos sin archivar

### PWA (Progressive Web App)
- Instalable en tablets y móviles como aplicación nativa
- Service worker para caché de recursos
- Iconos y manifest configurados
- Banner de instalación automático

### DNS local
- El instalador configura automáticamente `dnsmasq` para resolver `safeexit.local` a la IP del servidor
- Acceso a la aplicación mediante `http://safeexit.local` desde cualquier dispositivo de la red
- Compatible con servidores DNS locales como Umbrella o Pi-hole

### Landing page
- Página de presentación con fotos de stock
- Acceso directo al login

---

## Roles del sistema

| Rol | Acceso | Dispositivo |
|-----|--------|-------------|
| **Admin** | Panel completo: alumnos, grupos, profesores, calendario, historial, impresión, escáner, entradas tardías, cursos archivados, ajustes | PC |
| **Guardia** | Verificación de salida (QR + búsqueda + acompañada) + registro de tardías | Tablet |
| **Tutor** | Gestión de su grupo + verificación + tardías + historial de registros de su grupo | Móvil |

---

## Requisitos del servidor

- Ubuntu 20.04, 22.04 o 24.04 (x64 o ARM64)
- Mínimo 1 GB de RAM
- Mínimo 10 GB de disco
- Acceso a internet para la instalación
- Acceso root (sudo)

---

## Instalación automática

El instalador configura automáticamente todo lo necesario: actualiza el sistema operativo, instala Node.js 20.x, PostgreSQL, Nginx, dnsmasq, crea la base de datos, compila la aplicación y configura los servicios del sistema.

### Paso 1: Preparar el servidor

Antes de instalar SafeExit, actualiza el sistema operativo e instala las herramientas necesarias:

```bash
# Actualizar la lista de paquetes y el sistema
sudo apt update && sudo apt upgrade -y

# Instalar git y curl (necesarios para la instalación)
sudo apt install -y git curl
```

### Paso 2: Descargar e instalar

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

### Paso 3: Acceder a la aplicación

Abre en el navegador:
```
http://safeexit.local
```
O usa la IP directamente: `http://IP_DEL_SERVIDOR`

El instalador configura automáticamente un servicio DNS local (`dnsmasq`) que resuelve `safeexit.local` a la IP del servidor. Para que los dispositivos de la red usen este DNS, configura el router del centro para que apunte su DNS primario a la IP del servidor, o usa un servidor DNS local como Umbrella/Pi-hole.

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
/etc/dnsmasq.d/safeexit.conf          # DNS local (safeexit.local)
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

## Stack tecnológico

- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Backend**: Express.js (Node.js)
- **Base de datos**: PostgreSQL + Drizzle ORM
- **Autenticación**: Sesiones con express-session
- **QR**: qrcode (generación) + html5-qrcode (escaneo con soporte PDF417 para DNI)
- **PDF**: jsPDF (impresión de carnets)
- **Excel**: xlsx (importación y exportación .xlsx)
- **Email**: nodemailer (notificaciones SMTP)
- **DNS**: dnsmasq (resolución local safeexit.local)
- **Proxy**: Nginx
- **Proceso**: systemd
- **Tunnel**: Cloudflare (opcional)

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
| La cámara no funciona | HTTPS necesario para cámara | Configurar Cloudflare Tunnel o certificado SSL |
| No se escanea el DNI | Código de barras no enfocado | Acercar/alejar la cámara, buena iluminación |
| safeexit.local no resuelve | DNS no configurado | Configurar DNS del router o usar IP directamente |

---

Desarrollado por **Atrreyu Servicios Digitales**
