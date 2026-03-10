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
    -   **Staff View (Guard/Tutor)**: A unified, mobile/tablet-optimized view with bottom tab navigation, designed for on-the-go use by guards and tutors. It features large buttons, live stats, and a clock.
    -   **Carnet Design**: Digital and printable carnets include a student photo, group badge, and a 22mm QR code, adhering to a 2x5 grid layout (85x55mm cards) with a distinct blue header.
    -   **Sound Feedback**: Configurable audio cues (beep/alert) are provided for QR scan results, with options for custom audio uploads.
-   **Technical Implementations & Feature Specifications**:
    -   **Student & Group Management**: Comprehensive CRUD operations for students (with photo upload, parental/bus authorization toggles) and groups (with schedule types, `allowAdvancement` toggle). Bulk import/export functionality via Excel for students and teachers.
    -   **Authentication & Authorization**: Role-based access control with granular permissions for admin panel sections. Password management includes self-service changes and token-based reset via email.
    -   **Calendar & Scheduling**: A date-based calendar system allows configuration of 12 time slots for exit permissions per group. Admins can manage weekly schedules per teacher, which auto-populates absence forms.
    -   **QR Verification Algorithm**: A multi-step algorithm verifies student exits based on age, parental authorization, schedule adherence, bus authorization, and defined time slots.
    -   **Attendance & Incident Reporting**: Features include late arrival registration with optional email notifications and incident reporting tied to exit logs.
    -   **Accompanied Exit**: Guards can verify authorized pickup persons via DNI/NIE (manual input or barcode scan), generating an exit log and optional incidents.
    -   **Audit & Archiving**: All exit events are logged and exportable. An academic year archive and reset system allows archiving historical data as JSON and resetting the database for a new academic year. Archived data is browsable with search filters.
    -   **Staff Management**: Teachers and guards can be managed, including photo uploads and role assignments.
    -   **Guard Duty Management**: Admins configure guard zones and assign teachers to specific zones and periods. Teachers sign in digitally, with a substitution mode for unassigned teachers.
    -   **Teacher Absence & Hour Advancement (Adelantos)**: Teachers can register absences. Admins manage these, assigning coverages and having the ability to "adelantar" (advance) classes to fill gaps, which can lead to authorized early exits for groups.
    -   **Communication Systems**:
        -   **Notifications**: Admins can send targeted notifications (all staff, specific groups, or individual teachers) with file attachments and track read receipts.
        -   **Group Chat**: A group-based chat system allows communication between admins and teachers, with file attachments. Admins can control chat bidirectional settings per group.

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
-   **Cloudflare**: Optional Cloudflare Tunnel support for deployment.