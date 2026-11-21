# IMPACT CAMPUS — Complete Feature Inventory & Architecture Guide

**Institution:** Impact College of Engineering and Applied Sciences (ICEAS), Bengaluru, Karnataka, India  
**Platform:** Complete College ERP, 17-Section Student Information Lifecycle & AI-Assisted Smart Attendance System

This document describes **every feature currently implemented** in the codebase—both in the user interface and on the Express + Cloud SQL PostgreSQL backend—along with **ready-to-wire extensions and gaps** so you can plan what to customize, extend, or add next.

---

## 1. Platform Stack & Visual Identity

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Lucide icons + Workbox PWA (`manifest.webmanifest`, service worker offline caching, install prompt, and offline banner).
- **Backend:** Express.js (`server.ts`) running Drizzle ORM on Google Cloud SQL (PostgreSQL).
- **Authentication:** Firebase Authentication (Google SSO) + Institution-controlled allowlist provisioning (`account_provisions`) + Demo Role Switcher (`X-Demo-Role` header for testing all 4 roles).
- **Database Scale:** **60 relational PostgreSQL tables** across 9 logical domains (`drizzle/0000`–`0002` + auto-seeding in `src/db/seed.ts`).
- **Official Brand System (`src/index.css` & `src/components/ui/primitives.tsx`):**
  - **Primary Blue:** `#4A90E2` (WCAG AA dark-text accent `#1D5FA8` on light surfaces)
  - **Accent Teal:** `#50E3C2` (`#0B6B56` dark text for high-contrast positive indicators)
  - **Warning Amber:** `#F5A623` (`#9A5B00` dark text for `<75%` warnings/holds)
  - **Neutral Grey & Structural Navy:** `#7F8C8D` / `#0F172A` fixed 260px sidebar, Light & Dark theme toggle, and clean print CSS rules for PDF transcripts, marksheets, receipts, and rosters.

---

## 2. Authentication, Access Control & Role Portals

### 2.1 Public Portal (`PublicPortal.tsx`)
- **Institutional Landing & Sign-In:** Live database snapshot (student count, department count, active academic year fetched from `GET /api/public/overview`) plus Google SSO sign-in button and one-click Demo Role Switcher entry.
- **Access Recovery Guide:** Registrar & IT cell onboarding instructions (`admissions@impactcampus.edu.in`) for account activation or USN/role mismatch.
- **Platform Architecture Brief:** Public overview of the 60-table relational model, role isolation, and biometric privacy design.

### 2.2 Institution-Controlled Account Provisioning (`src/middleware/auth.ts` & `src/routes/system.ts`)
- When a new Google account signs in (with `Live Google Account` selected), the backend checks `account_provisions`:
  - **Invited email found:** Automatically creates an `active` profile with the pre-assigned institutional role (`super_admin`, `faculty`, `student`, or `parent`), binds `departmentId` / `studentId` / `parentId`, and marks the invite `claimed`.
  - **Unrecognized email:** Creates a `pending_approval` profile and displays a **Pending Institutional Approval** screen blocking workspace access until a Super Admin approves/activates the account or switches it via `account_provisions`.
- **Demo Role Switcher:** Built into the header (`Demo: Super Admin`, `Demo: Faculty`, `Demo: Student`, `Demo: Parent`, or `Live Google Account`). Controlled by server env `ALLOW_DEMO_ROLE_SWITCHER` (enabled unless explicitly set to `'false'`).

### 2.3 Role-Based Navigation Summary (`WorkspaceShell.tsx`)

| Module | Super Admin | Faculty | Student | Parent (Read-Only) |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | Institutional KPIs, `<75%` alerts | Teaching KPIs, assigned classes | Attendance %, CGPA, fees, alerts | Ward attendance, CGPA, fees |
| **Students & 360°** | Full roster, add, CSV import, verify docs, transcript PDF | Scoped view + Student 360° modal | Own inline 17-section 360° profile + address/doc submit | Ward inline 360° read-only profile |
| **Academics & Years** | Depts, subjects, materials, faculty, assignments, AY promotion | View assigned subjects + attach study materials | View subjects + download/open study materials | — |
| **Timetable** | View all + create conflict-checked slots | View own teaching schedule | View section timetable | View ward timetable |
| **Exams & SGPA** | Schemes, marks entry, CoE publish, mark changes, SGPA compute, backlogs, reval | Enter draft/submit marks, request changes, review reval/backlogs | Published marksheets, SGPA/CGPA, PDF transcript, submit reval | Published ward results, SGPA, marksheet PDF |
| **Attendance** | Start/close sessions, rotating QR, roster mark/edit + audit, CSV/PDF | Start/close assigned sessions, rotating QR, roster mark/edit | Live camera QR scan, 6-char code, AI face consent & liveness check, appeals | Ward attendance ledger & subject % |
| **Campus Lifecycle** | Review leaves, verify docs, issue/return library, view all 10 services | Review leaves, view projects/achievements/internships | Apply leaves, add achievements/projects/internships/placements/docs | Read-only view of ward lifecycle |
| **Finance & Fees** | Multi-year ledgers, record payments, PDF receipts, fee structures | **Blocked (`403`)** | View multi-year fees, scholarships, PDF receipts | View ward fee ledger & PDF receipts |
| **Communications** | Publish scoped announcements + inbox | Publish announcements + inbox | Campus circulars + personal inbox | Announcements + attendance alerts |
| **Governance & DB** | Users/provisions, audit logs, settings, JSON backup + SHA-256 verify, 60-table ER & RLS, 20-workflow test suite | 60-table ER Schema viewer | 60-table ER Schema viewer | — |

---

## 3. Global Workspace Utilities (`WorkspaceShell.tsx`)

- **Global Search (`GET /api/search?q=...`):** Debounced header search returning role-scoped matches across Students (Admin/Faculty only), Subjects, Faculty, Examinations, and Announcements; clicking any hit jumps directly to its workspace tab.
- **Academic Year Context Switcher:** Filters sessions, analytics, timetables, students, and fees across `2025-26`, `2026-27`, and `2027-28` without losing historical records.
- **Interactive Notification Centre:** Bell icon with unread count, dropdown preview, individual mark-as-read, and "Mark all read" action.
- **Light / Dark Theme Toggle & Profile Menu:** Persistent dark mode preference and active Google account / role summary.

---

## 4. Detailed Module-by-Module Features

### 4.1 Role-Tailored Dashboards (`DashboardView.tsx`)
- **Super Admin:** Total active students, overall attendance %, published/active fees, low-attendance `<75%` count, subject-wise attendance bars (`#50E3C2` for `>=75%`, `#F5A623` for `<75%`), at-risk student list, recent announcements, quick navigation buttons.
- **Faculty:** Assigned subjects, total sessions conducted, pending leave requests & pending AI reviews, subject attendance summary, circulars.
- **Student:** Overall attendance %, latest CGPA/SGPA, pending fee balance, total classes attended, subject-by-subject `<75%` threshold bars, quick action links (QR scan, marksheet, lifecycle).
- **Parent:** Read-only overview of ward attendance %, academic summary, fee balance due, `<75%` subject warnings, and circulars.

### 4.2 Student Master & 17-Section Student 360° Lifecycle (`StudentsView.tsx` & `Student360Panel.tsx`)
- **Directory Controls:** Search by USN, name, admission number, or email; filter by Department and Academic Year; export roster to **CSV** or formatted **Print/PDF**.
- **Add Student Modal (Super Admin):** Transactionally creates `profiles`, `students`, and initial `student_enrollments` with duplicate USN/Admission Number enforcement (`409`).
- **Bulk CSV Import (Super Admin):** Paste CSV rows (`usn, admissionNumber, fullName, email, phone, dateOfBirth, address`), auto-assigns target Year/Semester/Section/Department/Program, and reports imported vs. skipped duplicate rows.
- **Unified 17-Section Student 360° Record (`GET /api/students/:id`):**
  1. **Overview & Identity:** USN, admission number, admission year, status, DOB, gender, email, phone, biometric consent flag.
  2. **Addresses:** Current & permanent address ledger + inline **Add Address** form (Student/Admin).
  3. **Emergency Contacts & Parents/Guardians:** Linked parents (`student_parent_links`) + emergency contacts (`student_emergency_contacts`).
  4. **Previous Qualifications & Admission History:** 10th/12th/Diploma marks (`student_qualifications`) + CET/COMEDK rank & category (`student_admission_history`).
  5. **Semester Enrollments:** Full multi-year semester/section promotion trail (`student_enrollments`).
  6. **Admission & Verification Documents:** Reference numbers, verification status badges (`pending`, `verified`, `rejected`), inline **Submit Document Reference** (Student/Admin), and **Verify / Reject** actions (Super Admin).
  7. **Subject-Wise Attendance Summary & Recent Log:** Total/present/% breakdown per subject across academic years.
  8. **CIE & SEE Component Assessment Marks:** Respects publication visibility (Students/Parents only see `published` marks).
  9. **Semester SGPA / CGPA & Official Transcript:** Credits registered/earned, SGPA, cumulative CGPA, percentage, backlog count, plus **Download Official Transcript PDF** (`/api/academics/transcript/:studentId`).
  10. **Active & Cleared Backlogs.**
  11. **Revaluation / Photocopy / Challenge Requests.**
  12. **Achievements & Co-Curriculars.**
  13. **Academic Projects.**
  14. **Internships.**
  15. **Campus Placement Applications.**
  16. **Leave Requests, Library Books, Hostel Room & Bus Transport Allocations.**
  17. **Alumni Profile & Activity Audit Trail.**

### 4.3 Academic Structure, Faculty & Cohort Promotion (`AcademicAdminView.tsx`)
- **Departments & Classrooms:** View departments, HODs, and room inventory (capacity, smart-board capability); **Add Department** modal (Super Admin).
- **Subjects & Study Materials:** Filter subjects by department/semester; **Create Subject** modal (Super Admin); **Attach Study Material** (Faculty/Admin) with title, module label, filename, and resource URL.
- **Faculty Directory & Subject Allocations:** View faculty credentials and current semester subject-section allocations; **Add Faculty** modal and **Assign Faculty to Subject & Section** modal (enforces unique `uq_sfa_year_sem_subj_sec` so no two primary faculty overlap the same subject+section+term).
- **Academic Years & Cohort Promotion:** Create new Academic Years non-destructively (auto-creates Odd & Even semesters and optionally marks it active); **Transactional Cohort Promotion** moves an entire enrolled semester cohort into a target year/semester/section while marking prior enrollments `promoted` and auto-assigning matching `fee_structures`.

### 4.4 Timetable & Complete Examination Engine (`TimetableExamsView.tsx` & `ExamsLifecyclePanel.tsx`)
- **Weekly Timetable (Mon–Sat):** Role-filtered grid (Faculty sees own teaching slots; Students/Parents see their section timetable). Admin can **Add Timetable Slot** with backend conflict detection blocking double-booked faculty (`409`) or classrooms (`409`).
- **Examinations & Legacy IA Gradebook:** Schedule exams (IA1, IA2, SEE, Lab) and publish single-exam results + formatted **Academic Grade Sheet PDF**.
- **Assessment Schemes & Grade Scales (VTU-2022):** View 50:50 CIE+SEE schemes (`assessment_schemes` + `assessment_components` IA1/IA2/ASSIGN/SEE) and 10-point letter grade thresholds (`O` through `F`).
- **Component Marks Entry & CoE Publication Workflow:**
  - Faculty/Admin enter component marks (`draft` or `submitted`).
  - Once a Super Admin clicks **Approve & Publish Marks**, marks become **locked/immutable** (`409` on batch edits).
  - Subsequent edits require submitting an audited **Mark Change Request** (`mark_change_requests`), which a Super Admin approves or rejects (automatically updating marks and recomputing SGPA/CGPA on approval).
- **SGPA/CGPA Computation Engine (`POST /api/academics/results/compute`):** Calculates weighted 50:50 CIE+SEE score, applies VTU passing rules (min 40% CIE, 35% SEE, 40% overall), auto-logs failed subjects into `student_backlogs`, computes SGPA and cumulative CGPA, and generates **Official Marksheet PDF** per student/semester.
- **Backlogs & Revaluation Pipelines:** Faculty/Admin update backlog makeup exam dates, marks, and clearance status (`active` / `cleared`). Students apply for Photocopy (`₹300`), Revaluation (`₹500`), or Challenge Valuation (`₹1,500`); Faculty/Admin review and resolve, automatically updating SEE marks and recalculating SGPA/CGPA when revised marks are entered.

### 4.5 AI-Assisted & Dynamic QR Attendance (`AttendanceConsoleView.tsx` & `StudentAttendanceView.tsx`)
- **Staff Console (`AttendanceConsoleView.tsx`):**
  - **Start Session:** Select Subject, Section, Classroom, and Mode (`dynamic_qr`, `manual`, or `ai_face`). Enforces that Faculty can only start sessions for their assigned subjects/sections (`403` otherwise) and sends live notifications to all enrolled students.
  - **Cryptographic Dynamic QR & Rotating 6-Char Short Code:** Generates HMAC-SHA256 signed QR payload (`IC-QR.<sessionId>.<expiresAtMs>.<nonce>.<sig>`) + matching 6-character window code refreshing every ~25 seconds (configurable in `attendance_policies`). Includes automatic countdown bar and manual refresh.
  - **Live Roster & Audited Corrections:** Mark students `Present` or `Absent`. Editing an existing record triggers a **Mandatory Audit Reason Modal** (min 5 characters), writing a permanent before/after diff to `attendance_corrections` and `audit_logs`.
  - **Close Session:** Atomically marks all remaining unmarked enrolled students as `Absent` and locks the session.
  - **Logs & Exports:** View `attendance_verification_logs` (confidence score, liveness flag, outcome), `attendance_corrections` (faculty edits & student appeals), low-attendance `<75%` risk list, and **CSV / Print PDF Attendance Report** export.
- **Student & Parent Portal (`StudentAttendanceView.tsx`):**
  - **Live QR Camera Scanner (`jsqr`) + Manual Token / 6-Char Code Input:** Rate-limited (`15/min`), enrollment-checked, expiry-validated, and duplicate-blocked (`409`).
  - **Biometric Informed Consent & Liveness Capture:** Students can explicitly **Grant** or **Withdraw & Purge** (`consent_records`) biometric consent at any time. Camera snapshot capture passes image + liveness frame count to `POST /api/attendance/verify-face`.
  - **Honest External Biometric Provider Integration (`src/services/biometric.ts`):** When `BIOMETRIC_PROVIDER_ENDPOINT` and `BIOMETRIC_PROVIDER_API_KEY` are configured, external confidence scores flow through the policy engine (`>=0.85` auto-verify, `0.65–0.84` route to `pending_review`, `<0.65` reject). When unset, the UI and API explicitly report **503 External Provider Unconfigured**—never faking facial recognition.
  - **Student Attendance Appeals:** Students can submit an appeal (`POST /api/attendance/appeals`) against any recorded attendance status without directly altering the record.

### 4.6 Campus Lifecycle & Student Services (`CampusLifecycleView.tsx`)
Unified 10-tab lifecycle workspace (`GET /api/lifecycle/overview`):
- **Leave Requests:** Students submit Medical/OD/Personal leave; Faculty/Admin Approve or Reject with remarks (auto-notifies student & logs audit event).
- **Achievements:** Add co-curricular/hackathon/sports achievements with level and certificate reference.
- **Academic Projects:** Track Mini/Major/Capstone projects, domain, tech stack, repository link, and status.
- **Internships:** Track summer/semester/industrial internships, stipend, duration, and certificate ref.
- **Placements:** Log campus placement drives, role, CTC (LPA), round stage, and offer status.
- **Document Verification Desk:** Student uploads document metadata; Super Admin Verifies or Rejects with remarks.
- **Campus Library:** Super Admin Issues books by USN/ISBN/accession number and marks books Returned.
- **Hostel & Bus Transport:** Role-scoped view of hostel block/room/bed/mess allocations and bus route/stop/pass allocations.
- **Alumni Directory:** Network of graduated students (company, role, higher studies, city, mentorship availability).

### 4.7 Financial Management & Fee Ledgers (`FinanceView.tsx`)
- **Multi-Year Fee Assignments:** Displays gross fee, scholarship discount, net payable, paid amount, balance due, due date, and status (`pending`, `partial`, `paid`) across all academic years.
- **Record Payment Modal (Super Admin):** Records UPI, NEFT, DD, Challan, or NetBanking transactions transactionally (zero card numbers/CVV stored), generates a unique receipt number (`RCPT-YYYY-XXXXX`), updates balance due, notifies the student, and records an audit log.
- **Official Printable PDF Fee Receipt:** Renders and prints a clean institutional receipt per payment.
- **Scholarships & Fee Structures Reference:** Lists active merit/government scholarships and program-wise fee breakdowns.

### 4.8 Announcements & Notifications (`CommunicationView.tsx`)
- **Targeted Announcements:** Faculty/Admin publish notices scoped by `college`, `department`, `semester`, or `section` with priority (`normal`, `high`, `urgent`), automatically fanning out notifications to active profiles.
- **Owner-Isolated Notification Inbox:** Filterable personal feed with individual and bulk read state updates.

### 4.9 Governance, Security & Diagnostics (`GovernanceView.tsx`)
- **Account Provisioning Allowlist (`account_provisions`):** Super Admin invites emails with pre-assigned role, reference USN/employee code, department, or linked student ID, and can revoke/re-invite entries before or after sign-in.
- **User Accounts & Permissions Matrix:** Activate/suspend profiles, adjust roles, and inspect `role_permissions` per table.
- **System Audit Logs:** Chronological IST ledger of creates, edits, attendance overrides, mark publications, backups, and document verifications with JSON before/after state diffs.
- **Institutional Settings:** Live editing of institution branding, attendance minimum %, QR TTL, and AI confidence thresholds.
- **Database Backup Snapshot & SHA-256 Restore Dry-Run:** Downloads a full JSON snapshot across 13 core tables with a SHA-256 checksum, and lets Admin upload/paste a snapshot to run a non-mutating checksum + schema + live-FK integrity verification (`POST /api/system/restore-verify`).
- **Interactive 60-Table ER Schema & RLS Explorer:** Filter all 60 tables across 9 domains (columns, primary keys, unique constraints, foreign keys) plus copyable PostgreSQL Row-Level Security (`CREATE POLICY`) SQL.
- **20-Workflow Live Verification Suite (`POST /api/system/run-verification-suite`):** Executes 20 live database, constraint, RBAC, SGPA, AI policy, and checksum checks in Cloud SQL and cleans up its synthetic test records automatically.

---

## 5. What You Might Want to Change, Wire Up, or Add Next

This section highlights areas where **backend endpoints exist without UI modals**, **integrations are intentionally extensible**, or **workflows can be upgraded** depending on your college's needs:

### A. Ready Backend Endpoints That Don't Have UI Creation Modals Yet
1. **Edit Student Profile UI (`PATCH /api/students/:id`):** Backend edit + audit logging works, but `StudentsView.tsx` currently only has "Add Student" and "Bulk CSV Import" modals—not an "Edit Student" modal.
2. **Create Classroom / Program / Section Modals:** `POST /api/classrooms` exists in `src/routes/core.ts`, and `programs`/`sections` exist in the DB schema, but `AcademicAdminView.tsx` currently only has a modal for adding Departments (not Classrooms, Programs, or Sections).
3. **Create Fee Structure & Add Scholarship UI:** `POST /api/finance/structures` exists in `src/routes/finance.ts`, while `FinanceView.tsx` currently displays Fee Structures and Scholarships as read-only tables (only Record Payment has a modal).
4. **Create Hostel Allocation, Bus Transport Pass & Alumni Profile Modals:** `POST /api/lifecycle/hostel`, `POST /api/lifecycle/transport`, and `POST /api/lifecycle/alumni` are all implemented in `src/routes/lifecycle.ts`, whereas `CampusLifecycleView.tsx` currently displays those three tabs as read-only tables.
5. **Verify Achievement & Update Placement Stage Buttons:** `PATCH /api/lifecycle/achievements/:id/verify` exists in the backend; placement round/offer status updates (`shortlisted`, `offered`, `accepted`) and achievement verification buttons are not yet rendered on the cards in `CampusLifecycleView.tsx`.

### B. External Integrations & File Storage Upgrades
1. **External Biometric Face & Liveness Provider:** Set `BIOMETRIC_PROVIDER_ENDPOINT` and `BIOMETRIC_PROVIDER_API_KEY` (e.g., AWS Rekognition, Azure Face API, or a Python FastAPI/InsightFace microservice) in your environment secrets to turn on live face matching; right now it safely returns `503` unconfigured status while QR and Manual attendance work out of the box.
2. **Real Binary File Uploads (Cloud Storage / S3):** Study materials, student photos, admission documents, and achievement/internship certificates currently store text metadata, reference numbers, and URLs (`fileUrl`, `certificateRef`). If you want direct PDF/JPG file uploads from the browser, add a Google Cloud Storage / S3 signed-upload route.
3. **Online Fee Payment Gateway:** Currently `FinanceView.tsx` records already-settled UPI/NEFT/DD/Challan payments from the Accounts Desk. To let students pay fees directly online, integrate Razorpay/Cashfree/PayU checkout + webhook verification.
4. **Email / SMS / Push Notifications:** Notifications are currently in-app (`notifications` table). You can wire `dispatchNotification` in `src/services/audit.ts` to SendGrid/SMTP, WhatsApp/SMS, or Web Push (FCM) when needed.

### C. UX & Workflow Enhancements to Consider
1. **Multi-Student Spreadsheet Matrix for Marks Entry:** `ExamsLifecyclePanel.tsx` currently enters marks one student + component per modal submission; an inline class-wide tabular grid (e.g., all 60 students of Section 5A for `IA1` at once) would speed up faculty grading.
2. **One-Click Attendance Appeal & AI Pending Review Queue Actions:** `AttendanceConsoleView.tsx` displays `student_appeal_pending` appeals and `pending_review` AI records, and faculty can resolve them by clicking `Present`/`Absent` in the Roster tab (with an audit reason); adding dedicated "Approve Appeal / Confirm AI Match" buttons directly in the Appeals & Verification Logs tabs would make triage faster.
3. **Parent-to-Student Linking UI & Student Qualifications/Emergency Contact Forms:** Parent-student links (`student_parent_links`), previous qualifications (`student_qualifications`), and emergency contacts (`student_emergency_contacts`) are currently populated via DB seed or `account_provisions`; adding dedicated Admin forms for linking additional parents or editing qualifications would complete self-service data entry.
4. **Full Database Restore Execution vs. Dry-Run:** The Backup tab performs full JSON export + SHA-256 restore dry-run verification; destructive live table overwrite is intentionally omitted for safety.
5. **Production Lockdown:** Set `ALLOW_DEMO_ROLE_SWITCHER=false` in production deployment secrets to hide/disable the Demo Role Switcher and require strictly provisioned Google SSO accounts.
