# SafeExit - Sistema de Control de Salida Escolar

### Overview
SafeExit is a PWA web application designed to streamline student departure management in schools. It utilizes QR code-based carnets for verification, offering distinct interfaces for administration (PC) and door verification (Tablet). The system aims to enhance security, efficiency, and communication within the school environment regarding student exits and related activities. Key capabilities include student and group management, robust QR verification, attendance tracking, incident reporting, and a comprehensive communication system for staff.

### User Preferences
I prefer simple language. I want iterative development. Ask before making major changes.

### System Architecture
SafeExit is built as a Progressive Web Application (PWA) using a modern web stack.
-   **Frontend**: Developed with React, styled using Tailwind CSS, and utilizes `shadcn/ui` for UI components. It's designed to be installable on various devices, providing an app-like experience with offline capabilities via a service worker.
-   **Backend**: An Express.js server handles API requests and implements session-based authentication for secure access.
-   **Database**: PostgreSQL is used for data storage, with Drizzle ORM facilitating database interactions.
-   **UI/UX Decisions**: The application features distinct views optimized for different user roles and devices:
    -   **Admin View**: A full sidebar layout provides access to all administrative functionalities, designed for PC use.
    -   **Staff View (Guard/Tutor)**: A unified, mobile/tablet-optimized view with bottom tab navigation, designed for on-the-go use by guards and tutors. It features large buttons, live stats, and a clock. Tab visibility is configurable by the admin (settings keys: `staffGuardTabVisible`, `staffLateTabVisible`, `staffDutyTabVisible`, `staffAbsencesTabVisible`, `staffRecordsTabVisible`, `staffMessagesTabVisible`). All default to visible. Fail-closed: tabs hidden while settings load. Per-teacher overrides for Guardia, Tardías and Fichar via `guardTabVisible`, `lateTabVisible`, `dutyTabVisible` columns on users table (null = follow global, true = always visible, false = always hidden). API: PUT /api/guards/:id/guard-tab, /api/guards/:id/late-tab, /api/guards/:id/duty-tab.
    -   **Carnet Design**: Digital and printable carnets include a student photo, group badge, and a 22mm QR code, adhering to a 2x5 grid layout (85x55mm cards) with a distinct blue header.
    -   **Sound Feedback**: Configurable audio cues (beep/alert) are provided for QR scan results, with options for custom audio uploads.
-   **Technical Implementations & Feature Specifications**:
    -   **Student & Group Management**: Comprehensive CRUD operations for students (with photo upload, parental/bus authorization toggles) and groups (with schedule types, `allowAdvancement` toggle). Bulk import/export functionality via Excel for students and teachers.
    -   **Authentication & Authorization**: Role-based access control with granular permissions for admin panel sections. Password management includes self-service changes and token-based reset via email. **Two-Factor Authentication (2FA)**: Optional TOTP-based 2FA (Google Authenticator, Authy, etc.) for any user. Managed from the account dialog in the sidebar/staff view. Login shows a second step for TOTP code when 2FA is enabled. New DB columns: `totp_secret`, `totp_enabled` on `users`. New endpoints: `POST /api/auth/totp/setup`, `POST /api/auth/totp/confirm`, `POST /api/auth/totp/disable`, `POST /api/auth/totp/verify-login`. Library: `otplib`.
    -   **Calendar & Scheduling**: A date-based calendar system allows configuration of 12 time slots for exit permissions per group. Admins can manage weekly schedules per teacher, which auto-populates absence forms. Schedule views use a consistent 20-color HSL palette (`ENTITY_PALETTE`) via `buildColorMap()` and `EntityColorCell`/`ColorLegend` components for both teacher-by-group and group-by-teacher color coding.
    -   **QR Verification Algorithm**: A multi-step algorithm verifies student exits based on age, parental authorization, schedule adherence, bus authorization, and defined time slots.
    -   **Attendance & Incident Reporting**: Features include late arrival registration with optional email notifications and incident reporting tied to exit logs.
    -   **Accompanied Exit**: Guards can verify authorized pickup persons via DNI/NIE (manual input or barcode scan), generating an exit log and optional incidents.
    -   **Audit & Archiving**: All exit events are logged and exportable. An academic year archive and reset system allows archiving historical data as JSON and resetting the database for a new academic year. Archived data is browsable with search filters.
    -   **Cumplimiento LOPD/RGPD**: SafeExit implementa las siguientes medidas para cumplir con el Reglamento General de Protección de Datos (RGPD), la Ley Orgánica de Protección de Datos y Garantía de los Derechos Digitales (LOPDGDD) y la Ley de Servicios de la Sociedad de la Información (LSSI-CE):
        -   **Registro de auditoría** (`audit_logs`): Registra acciones relevantes para la seguridad: inicio/cierre de sesión, alta/modificación/eliminación de alumnos y usuarios, cambios de permisos, modificación de ajustes, archivado/reinicio de curso académico y operaciones de limpieza. Cada entrada almacena usuario, acción, entidad, detalles, dirección IP y marca temporal. Página de administración en `/audit` (solo admin) con filtros por acción y entidad, y paginación. API: `GET /api/audit-logs`.
        -   **Política de privacidad** (`/privacy`): Página accesible sin autenticación, enlazada desde la pantalla de inicio de sesión. Documenta: responsable del tratamiento, datos recogidos, finalidades, base legal (arts. 6.1.c/e/f RGPD), plazos de conservación, destinatarios, derechos ARCO-POL, medidas de seguridad, tratamiento de datos de menores (art. 7 LOPDGDD), política de cookies (art. 22.2 LSSI-CE) y notificaciones push.
        -   **Cookies**: Solo cookies técnicas esenciales. Cookie de sesión `safeexit.sid` (httpOnly, 30 días, se elimina al cerrar sesión). Preferencia de tema en localStorage (no se transmite al servidor). Exentas de consentimiento según art. 22.2 LSSI-CE.
        -   **Retención y limpieza de datos**: Limpieza automática diaria de registros con más de 3 años (salidas, tardanzas, chat, mensajes directos, notificaciones, incidencias). Limpieza manual configurable (1-10 años) desde `/audit` vía `POST /api/admin/cleanup`. La limpieza queda registrada en la auditoría.
        -   **Minimización de datos**: Control de acceso basado en roles con permisos granulares. Cada usuario accede únicamente a la información necesaria para sus funciones.
        -   **Seguridad técnica**: Autenticación con sesiones seguras (cookies httpOnly), comunicaciones cifradas (HTTPS/TLS vía Cloudflare), contraseñas hasheadas con bcrypt, y principio de mínimo privilegio en cada vista.
    -   **Staff Management**: Teachers and guards can be managed, including photo uploads and role assignments.
    -   **Guard Duty Management**: Admins configure guard zones and assign teachers to specific zones and periods. Teachers sign in digitally, with a substitution mode for unassigned teachers.
    -   **Teacher Absence & Hour Advancement (Adelantos)**: Teachers can register absences. Admins manage these, assigning coverages and having the ability to "adelantar" (advance) classes to fill gaps, which can lead to authorized early exits for groups. Early exit ("salida anticipada") uses the group's actual scheduled class slots from `teacher_schedules` to determine "end of day" — if a group only has morning classes, absence at the last morning slot triggers early exit eligibility. API: `GET /api/group-scheduled-slots?day=N` returns `{groupId: [slotIds]}`. Backend `POST /api/authorize-early-exit` also validates against group-specific slots.
    -   **Communication Systems**:
        -   **Notifications**: Admins can send targeted notifications (all staff, specific groups, or individual teachers) with file attachments and track read receipts. Users can dismiss notifications (per-user, not global delete).
        -   **Group Chat**: A group-based chat system allows communication between admins and teachers, with file attachments. Admins can control chat bidirectional settings per group. Messages can be deleted by sender or admin.
        -   **Direct Messages**: 1-to-1 messaging between any staff members (admin, teachers, guards). Stored in `direct_messages` table. Features: file attachments, read receipts (check mark), delete own messages (admin can delete any), push notifications on new DM. Staff page has "Directo" subtab; admin chat page has "Mensajes Directos" tab. API routes: `/api/dm/*`. Staff user list via `/api/staff-users`.
        -   **Web Push Notifications**: Native push notifications via Web Push API (VAPID). Push sent for: admin notifications, guard coverage assignments, hour advancements, chat messages, and direct messages. Service worker handles push events with vibration and click-to-focus. Auto-subscribes on login. VAPID keys stored in env vars (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT). Push subscriptions stored in `push_subscriptions` table. Expired subscriptions auto-cleaned.

### External Dependencies
-   **Database**: PostgreSQL
-   **ORM**: Drizzle ORM
-   **QR Code Generation**: `qrcode` library
-   **QR Scanning**: `html5-qrcode` library
-   **PDF Generation**: `jsPDF` (for carnets), `pdfkit` (for exit documents)
-   **Date Manipulation**: `date-fns`
-   **Password Hashing**: `bcrypt`
-   **Excel Processing**: `xlsx` (for import/export)
-   **Email Service**: `nodemailer` (for SMTP email functionality)
-   **Web Push**: `web-push` (for native push notifications via VAPID)
-   **Cloudflare**: Optional Cloudflare Tunnel support for deployment.