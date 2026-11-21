# IMPACT CAMPUS — Project Progress & Technical Handoff

**Institution:** Impact College of Engineering and Applied Sciences, Bengaluru, Karnataka, India  
**Academic Project Theme:** *Building a College Management Database from Scratch with AI-Powered Attendance Management*  
**Last Updated:** 2026-11-21  
**Current Status:** Production-grade **60-table** PostgreSQL ERP & Student Information Management System built on Cloud SQL + Express + Drizzle ORM + Firebase Auth + React/TypeScript/Vite/PWA. Compiled (`vite build`), type-checked (`tsc --noEmit`), and live-verified against Cloud SQL PostgreSQL.

---

## 1. Infrastructure & Environment Provisioned

| Component | Status | Verified Details |
| :--- | :--- | :--- |
| **Cloud SQL (PostgreSQL)** | Provisioned & Live | GCP Project `concise-gamma-2xq1s` · Instance `ai-studio-eaa9d3d3` · Region `asia-south1` |
| **Database Connection** | Active (`pg.Pool`) | Object configuration in `src/db/index.ts` (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`) |
| **ORM & Schema** | Pushed & Verified | Drizzle ORM (`src/db/schema.ts`, `src/db/drizzle.config.ts`) — all **60 normalized tables** confirmed live in `information_schema.columns` |
| **Firebase Auth (Google SSO)** | Provisioned & Hardened | Google OAuth via Firebase Auth verified server-side (`firebase-admin`) + institution-controlled `account_provisions` invite/role allowlist |
| **Runtime Server** | Live on Port `3000` | Express API + Vite SPA middleware (`tsx server.ts`) |
| **PWA Support** | Compiled & Active | `vite-plugin-pwa` generating `/manifest.webmanifest`, Workbox service worker, and custom icons |

---

## 2. Official Brand Design System (`src/index.css`, `src/components/ui/primitives.tsx`)

Centralized CSS custom properties supporting light and dark themes with accessible WCAG AA contrast pairings:
- **Primary Blue:** `#4A90E2` (paired with `#1D5FA8` for light-mode high-contrast button fills and text)
- **Accent Teal:** `#50E3C2` (charts, positive indicators; paired with `#0F766E` for light-mode small text)
- **Warning Amber:** `#F5A623` (alerts, pending workflows; paired with `#B45309` for light-mode text)
- **White / Canvas / Neutral Grey / Deep Navy Sidebar:** `#FFFFFF`, `#F8FAFC`, `#7F8C8D`, `#0F172A`

---

## 3. Database Architecture — 60 Normalized PostgreSQL Tables (`src/db/schema.ts`)

Preserves all original **37 core tables** and extends the schema with **23 normalized lifecycle & academic tables** (`src/db/seedExtended.ts` + `src/db/migrationSql.ts`):

- **Institutional (8):** `institutions`, `academic_years`, `semesters`, `departments`, `programs`, `courses`, `sections`, `classrooms`
- **User & Identity (7):** `profiles`, `account_provisions` *(new)*, `students`, `faculty`, `parents`, `student_parent_links`, `role_permissions`
- **Academic (7):** `subjects`, `subject_faculty_assignments`, `student_enrollments`, `timetables`, `timetable_slots`, `examinations`, `examination_results`
- **Examinations & Results (8, new):** `grade_scales`, `assessment_schemes`, `assessment_components`, `student_assessment_marks`, `mark_change_requests`, `semester_result_summaries`, `student_backlogs`, `revaluation_requests`
- **Attendance (5):** `attendance_sessions`, `attendance_records`, `attendance_verification_logs`, `attendance_corrections`, `attendance_policies`
- **Finance (5):** `fee_structures`, `student_fee_assignments`, `fee_payments`, `payment_transactions`, `scholarships`
- **Student Lifecycle (14, new):** `student_addresses`, `student_emergency_contacts`, `student_qualifications`, `student_documents`, `student_admission_history`, `student_achievements`, `student_projects`, `student_internships`, `placement_applications`, `student_leave_requests`, `library_transactions`, `transport_allocations`, `hostel_allocations`, `alumni_profiles`
- **Communication (3):** `announcements`, `notifications`, `notification_preferences`
- **System Governance (3):** `audit_logs`, `system_settings`, `consent_records`

---

## 4. Hardened Authentication & Controlled Provisioning (`src/middleware/auth.ts`)

- External Google SSO accounts check `account_provisions` (`status = 'invited'`) by normalized email and claim the institution-assigned role and linked student/faculty/parent ID.
- Unprovisioned external accounts receive `accountStatus = 'pending_approval'` and are blocked (`HTTP 403`, `pendingApproval: true`) from all institutional endpoints except `GET /api/me`, rendering a dedicated **Pending Institutional Approval** screen in `src/App.tsx` (with option to evaluate demo portals when `ALLOW_DEMO_ROLE_SWITCHER !== 'false'`).
- Bootstrap `super_admin` is restricted to `INITIAL_ADMIN_EMAIL` (or first non-demo owner when zero non-demo admins exist).

---

## 5. New & Extended Backend Routes (`server.ts`, `src/routes/`)

- **Examinations, Grading, SGPA/CGPA, Backlogs & Revaluation (`src/routes/academics.ts` at `/api/academics`):**
  - `GET / POST /schemes` (Assessment schemes, CIE/SEE components, VTU-2022 grade scales)
  - `GET /marks`, `POST /marks/batch` (`draft`/`submitted`, locks `published` rows), `POST /marks/publish` (Super Admin)
  - `GET / POST / PATCH /mark-change-requests` (CoE approval updates marks, recomputes SGPA/CGPA, writes audit log)
  - `GET /results/summaries`, `POST /results/compute` (computes SGPA/CGPA, earned credits, tracks backlogs, publishes results)
  - `GET /backlogs`, `PATCH /backlogs/:id` (makeup registration & clearance)
  - `GET / POST / PATCH /revaluations` (student submission -> staff review -> automatic SGPA/CGPA recalculation & notification)
  - `GET /transcript/:studentId` (role-scoped consolidated marksheet payload)
- **Extended Student Lifecycle & Campus Services (`src/routes/lifecycle.ts` at `/api/lifecycle`):**
  - `GET /overview` (role-scoped aggregation)
  - `POST / PATCH /leaves`, `POST / PATCH /achievements`, `POST /projects`, `POST /internships`, `POST /placements`, `POST / PATCH /documents/:id/verify`, `POST / PATCH /library/:id/return`, `POST /transport`, `POST /hostel`, `POST /alumni`
- **Student 360° & Global Search (`src/routes/students.ts`, `src/routes/core.ts`):**
  - `GET /api/students/:id` returns all **17 normalized Student 360° sections**; `POST /api/students/:id/addresses`
  - `GET /api/search?q=...` role-scoped global search across students, subjects, faculty, exams, and announcements
- **Governance, Provisioning, Backup & Verification (`src/routes/system.ts` at `/api/system`):**
  - `GET / POST / PATCH /provisions`
  - `GET /backup` (exports core tables + deterministic SHA-256 checksum) & `POST /restore-verify` (non-mutating SHA-256 + schema verification)
  - `POST /run-verification-suite` (executes **20 live Cloud SQL transactional & RBAC workflow tests** and cleans up synthetic rows)

---

## 6. Frontend Portals & Components (`src/components/`)

- **`WorkspaceShell.tsx`:** Deep-navy sidebar (`#0F172A`), `#4A90E2` active indicator, Global Search dropdown, Interactive Notification Centre popover, Profile Menu popover, Light/Dark toggle, Academic Year switcher, and Demo/Live Role switcher.
- **`Student360Panel.tsx` & `StudentsView.tsx`:** Unified **17-section Student 360° view** (Overview, Personal + Addresses, Admission + Qualifications, Academic History, CIE Marks, SEE Results, SGPA/CGPA + Transcript PDF, Attendance, Backlogs, Fees, Documents + Verification, Achievements, Projects, Internships, Placements, Parents + Emergency Contacts, Activity & Campus Services).
- **`ExamsLifecyclePanel.tsx` & `TimetableExamsView.tsx`:** Integrated SGPA/CGPA engine, CIE/SEE batch marks entry & publish, mark change approval queue, backlog clearance, revaluation workflow, VTU grade scales, and PDF marksheet generation.
- **`CampusLifecycleView.tsx`:** Role-scoped workspace for Leave requests, Achievements, Projects, Internships, Placements, Document verification vault, Library issue/return, Hostel/Transport passes, and Alumni directory.
- **`DashboardView.tsx` & `GovernanceView.tsx`:** Brand-colored KPI StatCards, 60-table ER & RLS Explorer, Account Provisioning UI, Backup & Restore SHA-256 Dry-Run Verification UI, and 20-Workflow Verification runner.
