# SafeExit - Sistema de Control de Salida Escolar

## Overview
A PWA web application for managing student departures from a school using QR code-based carnets. Designed for PC (Administration) and Tablet (Door verification).

## Architecture
- **Frontend**: React + Tailwind CSS + shadcn/ui components (PWA with service worker)
- **Backend**: Express.js with session-based auth
- **Database**: PostgreSQL with Drizzle ORM
- **Key Libraries**: qrcode (QR generation), html5-qrcode (scanning), jsPDF (PDF carnet printing), date-fns, bcrypt, xlsx (Excel import/export)
- **PWA**: manifest.json, sw.js service worker, installable on tablets/phones

## Data Models
- `users` - Admin and guard/teacher accounts with roles
- `groups` - School class groups (e.g., "1A", "2B")
- `students` - Student records with QR codes, photos, parental authorization
- `group_schedules` - Exit permission calendar (12 time slots x 5 days per group)
- `exit_logs` - Audit log of all QR scan events
- `incidents` - Incident reports tied to exit logs

## Key Features
- **Student Management**: CRUD with photo upload, parental/bus authorization toggles
- **Excel Import**: Download template, bulk import students from .xlsx with auto group creation
- **Group Management**: Create/edit groups with course assignment
- **Calendar System**: Interactive 12-slot x 5-day grid for configuring exit permissions per group
- **QR Verification**: Camera-based scanning or manual code input with age/authorization/schedule algorithm
- **Audit History**: Filterable exit log table with CSV export
- **Carnet Printing**: PDF generation with 2x5 grid (85x55mm cards) containing photo, data, QR code
- **Sound Feedback**: Beep for authorized, alert for denied
- **Incident Reporting**: Optional note creation on authorized exits
- **Guard View**: Dedicated full-screen tablet-optimized view for guards (no sidebar, large buttons, live stats, clock, WiFi indicator)

## Verification Algorithm
1. Age >= 18 → AUTHORIZED (adult)
2. Minor without parental authorization → DENIED
3. Bus authorization at slots 6/12 → AUTHORIZED
4. Minor with authorization → Check group schedule for current day/time slot
5. Schedule allows exit → AUTHORIZED
6. Otherwise → DENIED

## Roles & Views
- **admin**: Full sidebar layout with all features (management, calendar, history, print, scan)
- **guard**: Dedicated full-screen view (guard-view.tsx) — no sidebar, tablet-optimized with large touch targets (h-14, h-16 buttons), live clock, WiFi status, and daily stats

## Demo Credentials
- Admin: `admin` / `admin123`
- Teacher: `profesor1` / `guard123`

## File Structure
- `shared/schema.ts` - Database models and types
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database CRUD operations
- `server/seed.ts` - Initial seed data
- `server/db.ts` - Database connection
- `client/src/pages/guard-view.tsx` - Dedicated guard/tablet view (full-screen, no sidebar)
- `client/src/pages/` - Page components (login, dashboard, students, groups, calendar, scanner, history, print)
- `client/src/components/app-sidebar.tsx` - Navigation sidebar (admin only)
- `client/src/lib/auth.tsx` - Authentication context
- `client/src/lib/sounds.ts` - Audio feedback for scans
- `client/public/manifest.json` - PWA manifest
- `client/public/sw.js` - Service worker for offline caching
- `client/public/icons/` - PWA icons (SVG)
