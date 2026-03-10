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
- **Control de adelantos por grupo**: toggle "Permitir adelantos" en la ficha del grupo. Los grupos con adelantos desactivados muestran una etiqueta naranja "Sin adelantos" y no pueden recibir adelantos de hora (validación en servidor y en interfaz)
- **Chat bidireccional por grupo**: toggle "Chat bidireccional" en la ficha del grupo. Controla si los profesores pueden escribir en el chat del grupo o solo el administrador
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
- Subida de foto por profesor (selector de archivo o captura de cámara)
- QR de acceso rápido para que los profesores inicien sesión escaneándolo

### Horarios del profesorado
- Página de administración (/teacher-schedules) para gestionar el horario semanal de cada profesor
- **Tabla semanal interactiva**: columnas de lunes a viernes, filas por cada tramo horario. En cada celda se asigna el grupo que imparte el profesor en ese tramo y día
- Edición manual libre: se puede modificar el horario en cualquier momento sin restricciones
- Botones "Guardar" y "Limpiar" por profesor
- **Importación por Excel**: plantilla descargable con columnas Profesor, Día, Tramo y Grupo. El día puede escribirse como nombre (Lunes, Martes...) o número (1-5). Valida que los profesores y grupos existan
- Vista resumen: cuando no hay profesor seleccionado, se muestran tarjetas de todos los profesores con su estado (número de clases y días asignados)
- Indicador visual "horario" en el desplegable de profesores para los que ya tienen horario cargado
- **Integración con ausencias**: cuando un profesor registra una ausencia y selecciona la fecha, el botón "Rellenar desde horario" auto-marca los tramos y grupos de ese día según su horario guardado. Solo tiene que desmarcar los tramos en los que sí estará

### Gestión de ausencias del profesorado
- Los profesores registran ausencias desde la pestaña "Ausencias" en su vista de staff (fecha, periodos, grupos, notas)
- Adjuntos de justificación: los profesores pueden subir archivos como justificante de su ausencia
- **Regla de antelación**: los profesores no pueden crear, eliminar ni modificar adjuntos de ausencias con menos de 12 horas de antelación. Aparece una etiqueta "Bloqueada" en lugar del botón de eliminar. Los administradores pueden gestionar cualquier ausencia sin restricción de tiempo
- Confirmación y rechazo de ausencias por el administrador
- Panel de administración (/absence-management) con tres pestañas:
  - **Motor de Guardias**: muestra los huecos sin cubrir por tramo horario, permite asignar profesores de guardia a cada hueco y crear adelantos
  - **Adelantos**: lista de adelantos del día con explicación del proceso
  - **Ausencias**: confirmar, rechazar o eliminar ausencias

### Adelantos de hora (Motor de Guardias)
- Cuando un profesor falta a media jornada, el administrador puede **adelantar** una clase posterior del mismo grupo para cubrir el hueco
- El tramo origen (donde falta el profesor) queda cubierto y el tramo destino (de donde se mueve la clase) queda libre
- Si con varios adelantos las últimas horas del día quedan libres para un grupo, el sistema sugiere **autorizar la salida anticipada**
- Al autorizar, se crean permisos de salida grupal automáticos: los alumnos de ese grupo podrán salir al escanear su QR en esos tramos
- **Validaciones del servidor**: el tramo destino debe ser posterior al origen, no puede haber adelantos duplicados, y los grupos con "Sin adelantos" activado no pueden recibir adelantos
- Los huecos cubiertos por guardia aparecen en verde, los cubiertos por adelanto en azul, y los sin cubrir en rojo
- **Notificación automática al profesor de guardia**: cuando el administrador asigna un profesor para cubrir un hueco, se le envía una notificación automática indicando el grupo, el tramo horario, la fecha y el nombre del profesor al que sustituye
- **Notificación automática de adelanto de clase**: cuando se adelanta una clase, el profesor afectado recibe una notificación con el grupo, el tramo original, el nuevo tramo y la fecha

### Gestión de guardias de profesorado
- El administrador configura edificios (1-3) con hasta 6 zonas de guardia cada uno
- Asignación de profesores a zonas y periodos por día de la semana, incluyendo recreos
- Los profesores fichan su guardia ("Fichar Guardia" en la vista de staff) durante su periodo asignado (+5 min de gracia), seleccionando nombre, zona y firmando
- **Modo sustitución**: profesores no asignados pueden registrarse como sustitutos con plan de sustitución
- Registro de guardias consultable por el administrador (/guard-duty-registry) con filtros por fecha, edificio, zona y profesor
- Descarga de documento PDF de declaración por fichaje

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
- Pestañas: **Guardia** (QR + búsqueda + acompañada), **Tardías**, **Fichar** (fichaje de guardia), **Ausencias** (registro de ausencias propias) y **Mensajes** (avisos del admin + chat de grupos)
- Botones grandes táctiles
- Reloj en tiempo real y estado de conexión WiFi
- Auto-retorno configurable al estado de espera
- Estadísticas diarias: total de salidas, permitidas y denegadas
- Compatible con pistola lectora de códigos de barras (envía Enter automáticamente)
- Selección de cámara cuando hay varias disponibles
- Badge de mensajes no leídos en la pestaña "Mensajes"

### Vista de tutor (móvil)
- Vista optimizada para móvil con navegación por pestañas inferiores
- Hasta 7 pestañas (configurables por el admin): **Mi Grupo**, **Guardia**, **Tardías**, **Fichar**, **Ausencias**, **Registros** y **Mensajes**
- **Navegación adaptativa**: cuando hay más de 5 pestañas, los iconos y textos se reducen automáticamente y la barra permite deslizamiento horizontal para que todas las pestañas queden accesibles sin cortarse
- Mi Grupo: lista de alumnos del grupo asignado, subida de fotos desde cámara, compartir carnet digital
- Guardia: verificación de salida con QR, búsqueda y salida acompañada (visibilidad configurable globalmente y por profesor individual)
- Tardías: registro de entradas tardías
- Fichar: fichaje de guardia con firma digital
- Ausencias: registro y consulta de ausencias propias
- Registros: historial de salidas y tardías del grupo
- Mensajes: avisos del administrador (Avisos) + chat con el equipo educativo del grupo (Equipo)
- Búsqueda de alumnos dentro del grupo

### Gestión de contraseñas
- Todos los usuarios pueden cambiar su contraseña desde un diálogo en la aplicación
  - **Admin**: icono de llave en el pie del menú lateral
  - **Profesores**: icono de engranaje en la cabecera → "Mi cuenta"
- Los profesores pueden configurar un email de recuperación desde su perfil
- **Recuperación de contraseña**: enlace "¿Olvidaste tu contraseña?" en la página de login
  - Envía un email con enlace de restablecimiento (token válido 1 hora, un solo uso)
  - Página de restablecimiento en `/reset-password?token=xxx`
  - Requiere configuración SMTP y variable `APP_BASE_URL`
  - Email normalizado (minúsculas + trim)

### Sistema de permisos granulares
- El administrador puede asignar permisos específicos a cada profesor desde la página de Profesores
- 17 claves de permiso: Alumnos, Grupos, Profesores, Calendario, Entradas Tardías, Historial Salidas, Historial Entradas, Guardias Prof., Reg. Guardias, Ausencias, Horarios, Imprimir Carnets, Verificación QR, Cursos Archivados, Ajustes, Notificaciones, Mensajería
- Los profesores con permisos asignados ven el **panel de administración** en lugar de la vista de staff, con el menú lateral filtrado mostrando solo las secciones permitidas
- Protección por ruta: componente `PermissionGate` en el frontend impide acceso a secciones no autorizadas
- Protección en el backend: middleware `requirePermission()` valida cada petición API
- Los profesores con permisos ven un botón "Vista de profesor" en el pie del menú lateral para volver a su vista de staff normal
- Diálogo de permisos con selección individual, "Todos" y "Ninguno"
- Los controles de edición/eliminación/importación de profesores solo son visibles para el administrador

### Pestañas de staff configurables
- El administrador puede ocultar o mostrar cada pestaña de la vista de staff desde Ajustes: Guardia, Tardías, Fichar, Ausencias, Registros y Mensajes
- Botones "Mostrar todas" y "Ocultar todas" para activar/desactivar en bloque
- **Override individual para Guardia**: desde la ficha de cada profesor, se puede forzar que vea (o no) la pestaña Guardia independientemente del ajuste global. Tres opciones: Sí (siempre visible), No (siempre oculta), Global (usar ajuste global)
- Patrón fail-closed: mientras cargan los ajustes, todas las pestañas permanecen ocultas
- Si todas las pestañas están ocultas para un usuario, se muestra un mensaje indicando que contacte con el administrador

### Sistema de notificaciones
- El administrador puede enviar avisos a todos los profesores, a un grupo específico, o a un profesor individual
- Los avisos pueden incluir archivos adjuntos (PDF, imágenes, documentos Office, texto)
- Panel de notificaciones enviadas con estadísticas de lectura (leídas/total destinatarios)
- Los profesores reciben los avisos en la pestaña "Mensajes" → "Avisos" de su vista de staff
- Indicador de avisos no leídos (punto azul) y expansión inline para leer el contenido
- Destinatarios de grupo incluyen tanto tutores asignados como profesores que imparten clase en ese grupo

### Mensajería de grupos (Chat)
- Chat por grupo: el equipo educativo de cada grupo puede comunicarse
- El administrador ve todos los grupos y puede escribir en cualquiera
- Los profesores ven los grupos donde son tutores o donde imparten clase (según su horario)
- **Chat bidireccional/unidireccional**: el admin puede configurar si los profesores pueden escribir en el chat de cada grupo (toggle "Bidireccional" por grupo)
- Soporte para archivos adjuntos en mensajes
- Indicador de mensajes no leídos por grupo (badges en la lista de grupos y en la pestaña)
- Encuesta automática cada 5-15 segundos para nuevos mensajes
- Panel admin en /chat con lista de grupos a la izquierda y chat a la derecha
- Pestaña "Mensajes" → "Equipo" en la vista de staff para profesores

### Autorizaciones en el carnet
- El carnet digital muestra una sección de **Autorizaciones** con:
  - Estado de salida autónoma (autorizada / no autorizada) con icono visual
  - Si el alumno tiene autorización de **guagua**: muestra la hora exacta de salida calculada automáticamente (X minutos antes del fin de sesión según el horario del grupo)
- El carnet impreso (PDF) incluye etiquetas compactas:
  - "✓ Salida" en verde para alumnos con autorización parental
  - "🚌 Guagua" en azul para alumnos con autorización de transporte

### Configuración y ajustes (admin)
- Nombre del centro educativo (usado en emails y carnets)
- Curso académico (mostrado en carnets)
- Configuración de tramos horarios por día de la semana (12 tramos con hora de inicio y fin)
- Configuración completa del servidor SMTP (host, puerto, usuario, contraseña, dirección de envío, SSL/TLS)
- Toggle para activar/desactivar el correo en salida acompañada
- Toggle para mostrar/ocultar la pestaña de guardia para profesores
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
| **Admin** | Panel completo: alumnos, grupos, profesores, horarios, calendario, historial, impresión, escáner, guardias, ausencias, notificaciones, mensajería, permisos, cursos archivados, ajustes | PC |
| **Guardia** | Verificación de salida (QR + búsqueda + acompañada) + tardías + fichar guardia + ausencias + mensajes (avisos + chat). Con permisos: acceso al panel admin filtrado | Tablet |
| **Tutor** | Mi Grupo + verificación + tardías + fichar guardia + ausencias + registros + mensajes (avisos + chat). Con permisos: acceso al panel admin filtrado | Móvil |

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
| `APP_BASE_URL` | URL base para enlaces de restablecimiento de contraseña (ej: `http://safeexit.local`) |

---

## Stack tecnológico

- **Frontend**: React + Tailwind CSS + shadcn/ui
- **Backend**: Express.js (Node.js)
- **Base de datos**: PostgreSQL + Drizzle ORM
- **Autenticación**: Sesiones con express-session
- **QR**: qrcode (generación) + html5-qrcode (escaneo con soporte PDF417 para DNI)
- **PDF**: jsPDF (impresión de carnets) + PDFKit (documentos de salida y fichaje)
- **Excel**: xlsx (importación y exportación .xlsx de alumnos, profesores y horarios)
- **Email**: nodemailer (notificaciones SMTP)
- **PWA**: manifest.json + service worker (instalable en tablets y móviles)
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
