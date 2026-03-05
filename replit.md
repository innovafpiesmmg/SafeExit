# SafeExit - Sistema de Control de Salida Escolar

## Overview
A PWA web application for managing student departures from a school using QR code-based carnets. Designed for PC (Administration) and Tablet (Door verification).

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components (PWA with service worker)
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL with Drizzle ORM
- **Key Libraries**: qrcode (QR generation), html5-qrcode (scanning), jsPDF (PDF carnet printing), date-fns, bcrypt, xlsx (Excel import/export), nodemailer (email)
- **PWA**: manifest.json, sw.js service worker, installable on tablets/phones

## Data Models
- `users` - Admin and guard/teacher accounts with roles
- `groups` - School class groups (e.g., "1A", "2B")
- `students` - Student records with QR codes, photos, parental authorization, email (for notifications)
- `group_schedules` - Exit permission calendar per specific date (date + timeSlot per group)
- `exit_logs` - Audit log of all QR scan events
- `incidents` - Incident reports tied to exit logs
- `late_arrivals` - Late arrival records with optional email notification
- `authorized_pickups` - Authorized persons to pick up students (name, DNI/NIE, linked to student)
- `app_settings` - Key-value settings (school name, academic year, SMTP config, time slots config, accompanied exit email toggle)

## Key Features
- **Student Management**: CRUD with photo upload, parental/bus authorization toggles, email field
- **Excel Import (Students)**: Download template, bulk import students from .xlsx with auto group creation (includes Email column)
- **Group Management**: Create/edit groups with course assignment
- **Guard/Teacher Management**: CRUD with auto-generated usernames, shared password defined by admin, Excel import (Nombre/Apellidos columns)
- **Academic Year Reset**: Deletes all data except admin user (requires typing "NUEVO CURSO" to confirm) — located in Settings page
- **Calendar System**: Date-based calendar — select a specific date, configure 12 time slots for exit permissions per group. Green dots indicate dates with permissions. Weekends disabled.
- **Time Slots Config**: Per-day-of-week time slot configuration stored as JSON in appSettings (key: "timeSlots"). Backend uses it for verify logic. UI pending.
- **QR Verification**: Camera-based scanning or manual code input with age/authorization/schedule algorithm
- **Late Arrivals**: Register student late arrivals via QR scan or manual group/student selection. Optional email notification to student's email. Today's arrivals sidebar.
- **SMTP Email**: Configurable SMTP settings in admin panel. Test connection button. Used for late arrival notifications and authorized minor exit notifications.
- **Accompanied Exit (Salida Acompañada)**: Guard tab to verify pickup persons by DNI/NIE. Admin manages authorized persons per student (up to 10). DNI/NIE can be scanned via camera (PDF417 barcode) or typed manually. Creates exit log + auto-incident if unauthorized. Optional email notification (admin toggle).
- **Audit History**: Filterable exit log table with Excel (.xlsx) export
- **Digital Carnet**: Public carnet page at /carnet/:token with QR code for mobile (no login needed). Share via link/QR from student management. Shows school name and academic year.
- **Carnet Printing**: PDF generation with 2x5 grid (85x55mm cards) with blue header (school name + academic year + "SafeExit"), photo, avatar with group badge, QR code (22mm/68px)
- **Sound Feedback**: Beep for authorized, alert for denied
- **Incident Reporting**: Optional note creation on authorized exits
- **Guard View**: Dedicated full-screen tablet-optimized view for guards (no sidebar, large buttons, live stats, clock, WiFi indicator)
- **Tutor→Guard Switch**: Tutors have a shield button in header to enter guard scanner mode (/guard route)

## Verification Algorithm
1. Age >= 18 → AUTHORIZED (adult)
2. Minor without parental authorization → DENIED
3. Weekend → DENIED
4. Outside configured time slots → DENIED
5. Bus authorization at slots 6/12 → AUTHORIZED
6. Minor with authorization → Check group schedule for current date + time slot
7. Schedule allows exit → AUTHORIZED
8. Otherwise → DENIED

## Roles & Views
- **admin**: Full sidebar layout with all features (management, calendar, history, print, scan, late arrivals, settings). Can enter guard/tutor mode via QR URLs (?mode=guard or ?mode=tutor), with back-to-admin button.
- **guard**: StaffView with bottom tab navigation — 2 tabs: "Guardia" (QR verification) + "Tardías" (late arrivals registration). No sidebar, mobile/tablet optimized.
- **tutor**: StaffView with bottom tab navigation — 4 tabs: "Mi Grupo" (student management, photos, carnet sharing) + "Guardia" (QR verification) + "Tardías" (late arrivals) + "Registros" (exit logs and late arrivals history for their group). No sidebar, mobile optimized.
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
- `client/src/pages/settings.tsx` - Admin settings (school name, academic year, SMTP config, accompanied exit email, reset)
- `client/src/pages/calendar.tsx` - Date-based exit permission calendar
- `client/src/pages/` - Other page components (login, dashboard, students, groups, scanner, history, print)
- `client/src/components/app-sidebar.tsx` - Navigation sidebar (admin only)
- `client/src/components/footer.tsx` - Footer with ASD logo
- `client/src/lib/auth.tsx` - Authentication context
- `client/src/lib/sounds.ts` - Audio feedback for scans
- `client/public/manifest.json` - PWA manifest
- `client/public/sw.js` - Service worker for offline caching
- `client/public/icons/` - PWA icons (SVG)
- `install.sh` - Automated Ubuntu server installer
