# SafeExit - Sistema de Control de Salida Escolar

## Overview
A PWA web application for managing student departures from a school using QR code-based carnets. Designed for PC (Administration) and Tablet (Door verification).

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components (PWA with service worker)
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL with Drizzle ORM
- **Key Libraries**: qrcode (QR generation), html5-qrcode (scanning), jsPDF (PDF carnet printing), pdfkit (exit document PDF generation), date-fns, bcrypt, xlsx (Excel import/export), nodemailer (email)
- **PWA**: manifest.json, sw.js service worker, installable on tablets/phones

## Data Models
- `users` - Admin and guard/teacher accounts with roles, optional email for password recovery
- `password_reset_tokens` - Token-based password reset (userId, token, expiresAt, used)
- `groups` - School class groups (e.g., "1A", "2B") with `allowAdvancement` boolean (default true) to control whether hour advancements can be applied to this group
- `students` - Student records with QR codes, photos, parental authorization, email (for notifications)
- `group_schedules` - Exit permission calendar per specific date (date + timeSlot per group)
- `exit_logs` - Audit log of all QR scan events (includes optional `signatureData` for accompanied exit signatures)
- `incidents` - Incident reports tied to exit logs
- `late_arrivals` - Late arrival records with optional email notification
- `authorized_pickups` - Authorized persons to pick up students (name, DNI/NIE, linked to student)
- `guard_zones` - Guard duty zones per building (buildingNumber 1-3, zoneName, zoneOrder, max 6 per building)
- `guard_duty_assignments` - Default teacher-to-zone/period assignments per day of week
- `guard_duty_registrations` - Teacher sign-in records with signature, date, zone, period, timestamp
- `teacher_absences` - Teacher absence records (userId, date, status: pending/confirmed/rejected, notes, createdBy)
- `teacher_absence_periods` - Absence detail: which time slot and group is left unattended per absence
- `teacher_absence_attachments` - File attachments for absence justification
- `guard_coverages` - Guard-to-absent-period assignments (admin assigns available guard to cover unattended slot)
- `teacher_schedules` - Weekly schedule per teacher: maps userId + dayOfWeek + timeSlotId to groupId. Used for auto-filling absence periods and informing guard/advancement assignment.
- `app_settings` - Key-value settings (school name, academic year, SMTP config, time slots config, accompanied exit email toggle, staffGuardTabVisible)

## Key Features
- **Student Management**: CRUD with photo upload, parental/bus authorization toggles, email field
- **Excel Import (Students)**: Download template, bulk import students from .xlsx with auto group creation (includes Email column)
- **Group Management**: Create/edit groups with course assignment, schedule type (morning/afternoon/full), and `allowAdvancement` toggle. Schedule determines which time slots appear in the calendar. Groups with advancement disabled show an orange "Sin adelantos" badge and cannot have hour advancements applied (enforced both in UI and server-side).
- **Guard/Teacher Management**: CRUD with auto-generated usernames, shared password defined by admin, Excel import (Nombre/Apellidos columns), photo upload (file picker or camera capture) per teacher with hover overlay on avatar
- **Password Management**: All users can change their own password via account dialog (admin: key icon in sidebar footer, staff: gear icon in header). Staff users can set a recovery email. Login page has "¿Olvidaste tu contraseña?" link that sends a token-based reset email (1h validity). Reset page at /reset-password?token=xxx. Emails normalized (lowercase+trim). Reset URL built from APP_BASE_URL env var.
- **Teacher Schedule Management**: Admin page (/teacher-schedules) for managing weekly schedules per teacher. Weekly grid (days × time slots) with group selector per cell. Manual entry with save/clear. Excel import (Profesor/Día/Tramo/Grupo columns) with template download. Summary view shows all teachers' schedule status. When teachers create absences, a "Rellenar desde horario" button auto-populates periods from their schedule for that day of week.
- **Academic Year Archive & Reset**: Two options in Settings: 1) "Archivar y Comenzar Nuevo Curso" — saves all data as JSON archive, then clears DB (requires "ARCHIVAR CURSO" confirmation). 2) "Eliminar sin archivar" — deletes all without saving (requires "NUEVO CURSO" confirmation). Archives browsable from /archives page.
- **Archived Courses**: Admin-only page (/archives) to browse archived academic years. Shows summary stats (students, groups, exits, etc.). Click "Consultar" to view full data with tabbed interface (Alumnos, Grupos, Salidas, Tardías, Incidencias) + search filter. Can permanently delete archives.
- **Calendar System**: Date-based calendar — select a specific date, configure 12 time slots for exit permissions per group. Green dots indicate dates with permissions. Weekends disabled.
- **Time Slots Config**: Per-day-of-week time slot configuration (12 slots: M1-M6 morning, T1-T6 afternoon) stored as JSON in appSettings (key: "timeSlots"). Configurable from Settings page with day tabs, time inputs, "apply to all days" and "restore defaults" buttons. Backend uses it for verify logic.
- **QR Verification**: Camera-based scanning or manual code input with age/authorization/schedule algorithm
- **Late Arrivals**: Register student late arrivals via QR scan or manual group/student selection. Optional email notification to student's email. Today's arrivals sidebar.
- **SMTP Email**: Configurable SMTP settings in admin panel. Test connection button. Used for late arrival notifications and authorized minor exit notifications.
- **Accompanied Exit (Salida Acompañada)**: Guard tab to verify pickup persons by DNI/NIE. Admin manages authorized persons per student (up to 10). DNI/NIE can be scanned via camera (PDF417 barcode) or typed manually. Creates exit log + auto-incident if unauthorized. Optional email notification (admin toggle).
- **Audit History**: Filterable exit log table with Excel (.xlsx) export. PDF document download per exit log (includes student data, exit details, accompanying person info, and signature image). Signature viewer dialog with PNG download option.
- **Digital Carnet**: Public carnet page at /carnet/:token with QR code for mobile (no login needed). Share via link/QR from student management. Shows school name and academic year.
- **Carnet Printing**: PDF generation with 2x5 grid (85x55mm cards) with blue header (school name + academic year + "SafeExit"), photo, avatar with group badge, QR code (22mm/68px)
- **Sound Feedback**: Default beep/alert sounds, with optional custom audio upload per result (authorized/denied) from admin settings. MP3/WAV/OGG supported, max 5MB.
- **Guard Duty Management**: Admin configures buildings (1-3) with up to 6 guard zones each. Assigns teachers to zones/periods per day of week, including break periods (recreos) shown with amber-highlighted rows and ☕ emoji. Teachers sign in ("Fichar Guardia" tab in staff view) during their assigned period (+5 min grace) by selecting name, zone, and signing. **Substitution mode**: unassigned teachers can register via "Sustitución corta" button — select teacher from all staff, any zone, and enter a substitution plan (min 3 chars). Server validates: no prior assignment for that slot (must use normal sign-in if assigned). Substitution plan shown in registry table ("Plan sust." column) and included in PDF. Admin views registry (/guard-duty-registry) with filters (date, building, zone, teacher). PDF declaration document downloadable per registration.
- **Incident Reporting**: Optional note creation on authorized exits
- **Teacher Absence Management**: Teachers register absences via "Ausencias" tab in staff view (date, periods, groups, notes). 12h advance rule for non-admins: cannot create, delete, or modify attachments of absences less than 12 hours before the date — shows "Bloqueada" badge instead of delete button. Admins bypass all 12h restrictions. Admin manages all absences from /absence-management page with "Motor de Guardias" panel — shows unattended slots per period, assigns available guards to cover classes. Confirm/reject absence requests. Guard coverage tracking. **Adelantos (Hour Advancement)**: When a teacher is absent mid-day, admin can "adelantar" a later class from another teacher with the same group to fill the gap, pushing free hours to the end of the day. When consecutive hours are free at the end, admin can "Autorizar salida" — this auto-creates group schedule permissions so the group's students are authorized for early exit via QR verification. `hour_advancements` table tracks swaps; `POST /api/authorize-early-exit` creates group schedule entries for the freed slots.
- **Guard View**: Dedicated full-screen tablet-optimized view for guards (no sidebar, large buttons, live stats, clock, WiFi indicator)
- **Tutor→Guard Switch**: Tutors have a shield button in header to enter guard scanner mode (/guard route)

## Verification Algorithm
1. Age >= 18 → AUTHORIZED (adult)
2. Minor without parental authorization → DENIED
3. Weekend → DENIED
4. Bus authorization within configured minutes (5-30, per student) before end of morning/afternoon session → AUTHORIZED
5. Outside configured time slots → DENIED
6. Break time → DENIED
7. Minor with authorization → Check group schedule for current date + time slot
8. Schedule allows exit → AUTHORIZED
9. Otherwise → DENIED

## Roles & Views
- **admin**: Full sidebar layout with all features (management, calendar, history, print, scan, late arrivals, settings). Can enter guard/tutor mode via QR URLs (?mode=guard or ?mode=tutor), with back-to-admin button.
- **guard**: StaffView with bottom tab navigation — 4 tabs: "Guardia" (QR verification) + "Tardías" (late arrivals) + "Fichar" (guard duty sign-in) + "Ausencias" (register/view own absences). No sidebar, mobile/tablet optimized.
- **tutor**: StaffView with bottom tab navigation — 6 tabs: "Mi Grupo" (student management, photos, carnet sharing) + "Guardia" (QR verification) + "Tardías" (late arrivals) + "Fichar" (guard duty sign-in) + "Ausencias" (register/view own absences) + "Registros" (exit logs and late arrivals history for their group). No sidebar, mobile optimized.
- **StaffView** (staff-view.tsx): Unified wrapper for guard/tutor roles with shared header (app name, user, WiFi, logout) and bottom tab bar. GuardView and TutorView accept `embedded` prop to strip their headers. Guard fullscreen result overlays tabs using fixed positioning.

## Default Credentials (dev only)
- Admin: `admin` / `admin123` (env ADMIN_USER/ADMIN_PASS override in production)

## Deployment
- `install.sh` - Automated installer for Ubuntu servers (PostgreSQL, Node.js, Nginx, dnsmasq for safeexit.local, systemd)
- Seed creates admin from ADMIN_USER/ADMIN_PASS/ADMIN_NAME env vars
- SECURE_COOKIES env var controls cookie security (false for HTTP, true for HTTPS/Cloudflare)
- Config stored at /etc/safeexit/env (outside repo, survives git pull)
- Uploads in production stored at ./uploads/ (served by static.ts)
- Optional Cloudflare Tunnel support

## File Structure
- `shared/schema.ts` - Database models, types, time slots config types and helpers
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database CRUD operations
- `server/email.ts` - SMTP email service (nodemailer) for late arrival notifications
- `server/seed.ts` - Initial seed data (admin from env vars)
- `server/static.ts` - Production static file serving (includes uploads)
- `server/db.ts` - Database connection
- `client/src/pages/landing.tsx` - Public landing page with stock images
- `client/src/pages/staff-view.tsx` - Unified wrapper for guard/tutor with bottom tab navigation
- `client/src/pages/guard-view.tsx` - Guard QR scanner content (supports embedded mode for StaffView)
- `client/src/pages/tutor-view.tsx` - Tutor group management (supports embedded mode for StaffView)
- `client/src/pages/guards.tsx` - Guard/teacher/tutor management with role toggle, group assignment, Excel import
- `client/src/pages/late-arrivals.tsx` - Late arrival registration (QR scan + manual selection)
- `client/src/pages/tutor-records.tsx` - Tutor records view (exit logs + late arrivals for their group)
- `client/src/pages/settings.tsx` - Admin settings (school name, academic year, time slots, SMTP config, accompanied exit email, archive/reset)
- `client/src/pages/archives.tsx` - Archived academic years browser (list + detail viewer with tabs)
- `client/src/pages/calendar.tsx` - Date-based exit permission calendar
- `client/src/pages/teacher-absences.tsx` - Teacher absence registration/view (staff view tab)
- `client/src/pages/absence-management.tsx` - Admin absence management + guard engine panel
- `client/src/pages/teacher-schedules.tsx` - Admin teacher schedule management (weekly grid + Excel import)
- `client/src/pages/reset-password.tsx` - Token-based password reset page (public, no auth required)
- `client/src/pages/` - Other page components (login, dashboard, students, groups, scanner, history, print)
- `client/src/components/app-sidebar.tsx` - Navigation sidebar (admin only)
- `client/src/components/footer.tsx` - Footer with ASD logo
- `client/src/lib/auth.tsx` - Authentication context
- `client/src/lib/sounds.ts` - Audio feedback for scans
- `client/public/manifest.json` - PWA manifest
- `client/public/sw.js` - Service worker for offline caching
- `client/public/icons/` - PWA icons (SVG)
- `install.sh` - Automated Ubuntu server installer
