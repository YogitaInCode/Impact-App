export interface ErTableMeta {
  name: string;
  domain:
    | 'Institutional'
    | 'User & Identity'
    | 'Academic'
    | 'Examinations & Results'
    | 'Attendance'
    | 'Finance'
    | 'Student Lifecycle'
    | 'Communication'
    | 'System';
  summary: string;
  keyColumns: string[];
  foreignKeys: string[];
  rlsPolicy: string;
}

export const ER_SCHEMA_METADATA: ErTableMeta[] = [
  // Institutional (8)
  {
    name: 'institutions',
    domain: 'Institutional',
    summary: 'Root college configuration (Impact College of Engineering & Applied Sciences, Bengaluru).',
    keyColumns: ['id (PK)', 'code (UQ)', 'name', 'affiliation'],
    foreignKeys: [],
    rlsPolicy: 'Public read for branding; Super Admin write.',
  },
  {
    name: 'academic_years',
    domain: 'Institutional',
    summary: 'Non-destructive multi-year calendar (2025-26, 2026-27, 2027-28).',
    keyColumns: ['id (PK)', 'institution_id (FK)', 'code', 'is_current'],
    foreignKeys: ['institutions.id'],
    rlsPolicy: 'Authenticated read; Super Admin create/update.',
  },
  {
    name: 'semesters',
    domain: 'Institutional',
    summary: 'Odd/even term records scoped to each academic year.',
    keyColumns: ['id (PK)', 'academic_year_id (FK)', 'number', 'is_active'],
    foreignKeys: ['academic_years.id'],
    rlsPolicy: 'Authenticated read; Super Admin write.',
  },
  {
    name: 'departments',
    domain: 'Institutional',
    summary: 'Engineering departments (CSE, ISE, ECE, ME).',
    keyColumns: ['id (PK)', 'institution_id (FK)', 'code (UQ)', 'name'],
    foreignKeys: ['institutions.id'],
    rlsPolicy: 'Authenticated read; Super Admin write.',
  },
  {
    name: 'programs',
    domain: 'Institutional',
    summary: 'Degree programs (B.E. CSE, B.E. ISE, B.E. ECE).',
    keyColumns: ['id (PK)', 'department_id (FK)', 'code (UQ)', 'degree_type'],
    foreignKeys: ['departments.id'],
    rlsPolicy: 'Authenticated read; Super Admin write.',
  },
  {
    name: 'courses',
    domain: 'Institutional',
    summary: 'Curriculum catalog tracks attached to degree programs.',
    keyColumns: ['id (PK)', 'program_id (FK)', 'code (UQ)', 'credits'],
    foreignKeys: ['programs.id'],
    rlsPolicy: 'Authenticated read; Super Admin write.',
  },
  {
    name: 'sections',
    domain: 'Institutional',
    summary: 'Class sections (A, B) scoped to program, year, and semester.',
    keyColumns: ['id (PK)', 'program_id (FK)', 'semester_id (FK)', 'name'],
    foreignKeys: ['departments.id', 'programs.id', 'academic_years.id', 'semesters.id'],
    rlsPolicy: 'Authenticated read; Super Admin write.',
  },
  {
    name: 'classrooms',
    domain: 'Institutional',
    summary: 'Physical lecture halls, labs, and seminar rooms.',
    keyColumns: ['id (PK)', 'institution_id (FK)', 'room_code (UQ)', 'capacity'],
    foreignKeys: ['institutions.id'],
    rlsPolicy: 'Authenticated read; Super Admin write.',
  },
  // User & Identity (7)
  {
    name: 'profiles',
    domain: 'User & Identity',
    summary: 'Identity directory linked to Firebase Auth UID and RBAC role.',
    keyColumns: ['id (PK)', 'uid (UQ)', 'email', 'role'],
    foreignKeys: [],
    rlsPolicy: 'Users read own row; Super Admin full access.',
  },
  {
    name: 'account_provisions',
    domain: 'User & Identity',
    summary: 'Institution-controlled invite & role binding allowlist preventing unauthorized self-elevation.',
    keyColumns: ['id (PK)', 'email (UQ)', 'role', 'status'],
    foreignKeys: ['departments.id', 'students.id', 'faculty.id', 'parents.id', 'profiles.id'],
    rlsPolicy: 'Super Admin full manage; server verifies on Firebase SSO claim.',
  },
  {
    name: 'students',
    domain: 'User & Identity',
    summary: 'Permanent non-duplicable student master record keyed by USN.',
    keyColumns: ['id (PK)', 'profile_id (FK UQ)', 'usn (UQ)', 'admission_number (UQ)'],
    foreignKeys: ['profiles.id', 'institutions.id', 'departments.id', 'programs.id'],
    rlsPolicy: 'Student reads self; Parent reads linked; Faculty/Admin read.',
  },
  {
    name: 'faculty',
    domain: 'User & Identity',
    summary: 'Faculty master profile with employee code and department.',
    keyColumns: ['id (PK)', 'profile_id (FK UQ)', 'employee_code (UQ)', 'department_id (FK)'],
    foreignKeys: ['profiles.id', 'institutions.id', 'departments.id'],
    rlsPolicy: 'Faculty reads self/colleagues; Super Admin writes.',
  },
  {
    name: 'parents',
    domain: 'User & Identity',
    summary: 'Guardian profile for read-only ward monitoring.',
    keyColumns: ['id (PK)', 'profile_id (FK UQ)', 'full_name', 'phone'],
    foreignKeys: ['profiles.id'],
    rlsPolicy: 'Parent reads self; Super Admin manages.',
  },
  {
    name: 'student_parent_links',
    domain: 'User & Identity',
    summary: 'Verified many-to-many association between students and parents.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'parent_id (FK)', 'is_verified'],
    foreignKeys: ['students.id', 'parents.id'],
    rlsPolicy: 'Parent reads only verified own links.',
  },
  {
    name: 'role_permissions',
    domain: 'User & Identity',
    summary: 'Matrix of CRUD permissions per role and institutional resource.',
    keyColumns: ['id (PK)', 'role', 'resource', 'can_create/read/update/delete'],
    foreignKeys: [],
    rlsPolicy: 'Super Admin write; authenticated read.',
  },
  // Academic (7)
  {
    name: 'subjects',
    domain: 'Academic',
    summary: 'Syllabus subjects and attached study material resources.',
    keyColumns: ['id (PK)', 'department_id (FK)', 'code (UQ)', 'semester_number'],
    foreignKeys: ['departments.id', 'programs.id', 'courses.id'],
    rlsPolicy: 'Authenticated read; Assigned Faculty updates materials; Admin write.',
  },
  {
    name: 'subject_faculty_assignments',
    domain: 'Academic',
    summary: 'Unique allocation of faculty to subject, section, and semester.',
    keyColumns: ['id (PK)', 'academic_year_id (FK)', 'subject_id (FK)', 'faculty_id (FK)'],
    foreignKeys: ['academic_years.id', 'semesters.id', 'subjects.id', 'faculty.id', 'sections.id'],
    rlsPolicy: 'Faculty scoped to own assignments; Admin full write.',
  },
  {
    name: 'student_enrollments',
    domain: 'Academic',
    summary: 'Year-by-year semester enrollment preserving historical progression.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'academic_year_id (FK)', 'semester_id (FK)'],
    foreignKeys: ['students.id', 'academic_years.id', 'semesters.id', 'programs.id', 'sections.id'],
    rlsPolicy: 'Student/Parent read own; Faculty/Admin read; Admin transactional promote.',
  },
  {
    name: 'timetables',
    domain: 'Academic',
    summary: 'Published weekly schedule header per section and semester.',
    keyColumns: ['id (PK)', 'academic_year_id (FK)', 'semester_id (FK)', 'section_id (FK)'],
    foreignKeys: ['academic_years.id', 'semesters.id', 'sections.id'],
    rlsPolicy: 'Authenticated read; Admin write.',
  },
  {
    name: 'timetable_slots',
    domain: 'Academic',
    summary: 'Individual period slots with conflict checks on faculty and room.',
    keyColumns: ['id (PK)', 'timetable_id (FK)', 'day_of_week', 'period_number'],
    foreignKeys: ['timetables.id', 'subjects.id', 'faculty.id', 'classrooms.id'],
    rlsPolicy: 'Authenticated read; Admin conflict-checked write.',
  },
  {
    name: 'examinations',
    domain: 'Academic',
    summary: 'IA-1, IA-2, Lab, and Semester End Exam schedules.',
    keyColumns: ['id (PK)', 'academic_year_id (FK)', 'subject_id (FK)', 'exam_date'],
    foreignKeys: ['academic_years.id', 'semesters.id', 'departments.id', 'subjects.id', 'classrooms.id'],
    rlsPolicy: 'Authenticated read; Admin/Faculty manage.',
  },
  {
    name: 'examination_results',
    domain: 'Academic',
    summary: 'Immutable year-scoped marks, grades, and grade points per student.',
    keyColumns: ['id (PK)', 'examination_id (FK)', 'student_id (FK)', 'marks_obtained'],
    foreignKeys: ['examinations.id', 'students.id', 'academic_years.id', 'semesters.id'],
    rlsPolicy: 'Student reads self; Parent reads linked student; Faculty/Admin write.',
  },
  // Examinations & Results (8)
  {
    name: 'grade_scales',
    domain: 'Examinations & Results',
    summary: 'Configurable VTU percentage-to-grade-point mapping per curriculum scheme.',
    keyColumns: ['id (PK)', 'scheme_code', 'grade_letter', 'grade_points'],
    foreignKeys: ['institutions.id'],
    rlsPolicy: 'Authenticated read; Super Admin configure.',
  },
  {
    name: 'assessment_schemes',
    domain: 'Examinations & Results',
    summary: 'CIE/SEE marks distribution & minimum pass thresholds per program & year.',
    keyColumns: ['id (PK)', 'academic_year_id (FK)', 'program_id (FK)', 'scheme_code'],
    foreignKeys: ['institutions.id', 'academic_years.id', 'programs.id'],
    rlsPolicy: 'Authenticated read; Super Admin configure.',
  },
  {
    name: 'assessment_components',
    domain: 'Examinations & Results',
    summary: 'Evaluation components (IA1, IA2, IA3, Assignment, Quiz, Lab, SEE) with weightages.',
    keyColumns: ['id (PK)', 'scheme_id (FK)', 'code', 'max_marks', 'weightage_pct'],
    foreignKeys: ['assessment_schemes.id', 'subjects.id'],
    rlsPolicy: 'Authenticated read; Admin/Faculty configure.',
  },
  {
    name: 'student_assessment_marks',
    domain: 'Examinations & Results',
    summary: 'Component-level marks with Draft -> Submitted -> Approved -> Published state machine.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'subject_id (FK)', 'component_id (FK)', 'workflow_status'],
    foreignKeys: ['students.id', 'subjects.id', 'academic_years.id', 'semesters.id', 'assessment_components.id'],
    rlsPolicy: 'Student/Parent read published only; Faculty enter draft/submit; Admin approve/publish.',
  },
  {
    name: 'mark_change_requests',
    domain: 'Examinations & Results',
    summary: 'Authorized post-submission mark modification requests requiring admin approval & audit.',
    keyColumns: ['id (PK)', 'student_assessment_mark_id (FK)', 'previous_marks', 'requested_marks', 'status'],
    foreignKeys: ['student_assessment_marks.id', 'students.id', 'subjects.id', 'profiles.id'],
    rlsPolicy: 'Faculty request; Super Admin approve/reject with audit trail.',
  },
  {
    name: 'semester_result_summaries',
    domain: 'Examinations & Results',
    summary: 'Transactional SGPA, CGPA, earned credits, and official semester pass/fail transcripts.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'academic_year_id (FK)', 'semester_id (FK)', 'sgpa', 'cgpa'],
    foreignKeys: ['students.id', 'academic_years.id', 'semesters.id'],
    rlsPolicy: 'Student/Parent read published; Admin compute & publish.',
  },
  {
    name: 'student_backlogs',
    domain: 'Examinations & Results',
    summary: 'Active and cleared subject backlog registry with supplementary/makeup tracking.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'subject_id (FK)', 'attempt_number', 'status'],
    foreignKeys: ['students.id', 'subjects.id', 'academic_years.id', 'semesters.id'],
    rlsPolicy: 'Student/Parent read own; Faculty/Admin update on makeup exam clearance.',
  },
  {
    name: 'revaluation_requests',
    domain: 'Examinations & Results',
    summary: 'Student revaluation, photocopy, and challenge valuation workflow with automatic SGPA recalc.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'subject_id (FK)', 'request_type', 'status'],
    foreignKeys: ['students.id', 'subjects.id', 'academic_years.id', 'semesters.id', 'examination_results.id'],
    rlsPolicy: 'Student submit/read own; Faculty/Admin review & resolve.',
  },
  // Attendance (5)
  {
    name: 'attendance_sessions',
    domain: 'Attendance',
    summary: 'Live or closed class sessions with QR secret, expiry, and AI threshold.',
    keyColumns: ['id (PK)', 'subject_id (FK)', 'faculty_id (FK)', 'mode', 'status'],
    foreignKeys: ['academic_years.id', 'semesters.id', 'subjects.id', 'faculty.id', 'sections.id'],
    rlsPolicy: 'Faculty manages own assigned sessions; enrolled students verify active.',
  },
  {
    name: 'attendance_records',
    domain: 'Attendance',
    summary: 'Student attendance rows with unique (session_id, student_id) constraint.',
    keyColumns: ['id (PK)', 'session_id (FK)', 'student_id (FK)', 'status'],
    foreignKeys: ['attendance_sessions.id', 'students.id', 'academic_years.id', 'subjects.id', 'faculty.id'],
    rlsPolicy: 'Student/Parent read-only; never writable by students.',
  },
  {
    name: 'attendance_verification_logs',
    domain: 'Attendance',
    summary: 'Detailed log of QR scans, duplicate blocks, and biometric outcomes.',
    keyColumns: ['id (PK)', 'session_id (FK)', 'student_id (FK)', 'outcome'],
    foreignKeys: ['attendance_sessions.id', 'students.id'],
    rlsPolicy: 'Faculty/Admin audit read.',
  },
  {
    name: 'attendance_corrections',
    domain: 'Attendance',
    summary: 'Mandatory reason log for every faculty edit or student appeal.',
    keyColumns: ['id (PK)', 'attendance_record_id (FK)', 'reason', 'edited_by_profile_id (FK)'],
    foreignKeys: ['attendance_records.id', 'attendance_sessions.id', 'students.id', 'profiles.id'],
    rlsPolicy: 'Append-only audit trail; Admin/Faculty read.',
  },
  {
    name: 'attendance_policies',
    domain: 'Attendance',
    summary: 'Configurable 75% threshold, QR TTL, and AI confidence thresholds.',
    keyColumns: ['id (PK)', 'academic_year_id (FK)', 'min_attendance_percentage', 'qr_token_ttl_seconds'],
    foreignKeys: ['institutions.id', 'academic_years.id', 'departments.id'],
    rlsPolicy: 'Authenticated read; Super Admin write.',
  },
  // Finance (5)
  {
    name: 'fee_structures',
    domain: 'Finance',
    summary: 'Year-wise and program-wise fee breakups (tuition, lab, library, exam).',
    keyColumns: ['id (PK)', 'academic_year_id (FK)', 'program_id (FK)', 'total_amount'],
    foreignKeys: ['institutions.id', 'academic_years.id', 'programs.id'],
    rlsPolicy: 'Authenticated read; Super Admin write.',
  },
  {
    name: 'student_fee_assignments',
    domain: 'Finance',
    summary: 'Independent student fee ledger per academic year with balance due.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'academic_year_id (FK)', 'balance_due'],
    foreignKeys: ['students.id', 'academic_years.id', 'fee_structures.id'],
    rlsPolicy: 'Student/Parent read own; Admin write.',
  },
  {
    name: 'fee_payments',
    domain: 'Finance',
    summary: 'Official fee receipts linked to student fee assignments.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'receipt_number (UQ)', 'amount_paid'],
    foreignKeys: ['students.id', 'academic_years.id', 'student_fee_assignments.id'],
    rlsPolicy: 'Student/Parent read own; Admin records payment.',
  },
  {
    name: 'payment_transactions',
    domain: 'Finance',
    summary: 'Gateway transaction reference ledger (zero card details stored).',
    keyColumns: ['id (PK)', 'fee_payment_id (FK)', 'transaction_reference (UQ)', 'gateway_status'],
    foreignKeys: ['fee_payments.id'],
    rlsPolicy: 'Student/Parent read own; Admin write.',
  },
  {
    name: 'scholarships',
    domain: 'Finance',
    summary: 'Institutional merit and State SSP scholarships per academic year.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'academic_year_id (FK)', 'amount'],
    foreignKeys: ['students.id', 'academic_years.id'],
    rlsPolicy: 'Student/Parent read own; Admin write.',
  },
  // Student Lifecycle (14)
  {
    name: 'student_addresses',
    domain: 'Student Lifecycle',
    summary: 'Normalized current and permanent residential addresses per student.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'address_type', 'city', 'pincode'],
    foreignKeys: ['students.id'],
    rlsPolicy: 'Student/Admin update; Parent/Faculty read.',
  },
  {
    name: 'student_emergency_contacts',
    domain: 'Student Lifecycle',
    summary: 'Normalized guardian and emergency contact directory.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'contact_name', 'phone'],
    foreignKeys: ['students.id'],
    rlsPolicy: 'Student/Admin update; Parent/Faculty read.',
  },
  {
    name: 'student_qualifications',
    domain: 'Student Lifecycle',
    summary: 'Prior Class X, II PUC, and Diploma academic records.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'qualification', 'percentage_or_cgpa'],
    foreignKeys: ['students.id'],
    rlsPolicy: 'Student/Parent read; Admin verify.',
  },
  {
    name: 'student_documents',
    domain: 'Student Lifecycle',
    summary: 'Admission, transfer, marks card, and identity verification documents.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'document_type', 'verification_status'],
    foreignKeys: ['students.id', 'profiles.id'],
    rlsPolicy: 'Student upload/read own; Admin verify/reject.',
  },
  {
    name: 'student_admission_history',
    domain: 'Student Lifecycle',
    summary: 'KCET/COMEDK/Management allotment rank, category, and admission intake audit.',
    keyColumns: ['id (PK)', 'student_id (FK UQ)', 'admission_category', 'verification_status'],
    foreignKeys: ['students.id', 'profiles.id'],
    rlsPolicy: 'Student/Parent read own; Admin write.',
  },
  {
    name: 'student_achievements',
    domain: 'Student Lifecycle',
    summary: 'Hackathons, certifications, publications, sports, and merit awards.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'title', 'category', 'verified'],
    foreignKeys: ['students.id'],
    rlsPolicy: 'Student add/read own; Faculty/Admin verify.',
  },
  {
    name: 'student_projects',
    domain: 'Student Lifecycle',
    summary: 'Mini, capstone, and research projects with faculty guide & status.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'title', 'project_type', 'status'],
    foreignKeys: ['students.id', 'academic_years.id', 'semesters.id', 'faculty.id'],
    rlsPolicy: 'Student manage own; Faculty guide evaluate; Parent read.',
  },
  {
    name: 'student_internships',
    domain: 'Student Lifecycle',
    summary: 'Industry internship logs, stipends, and completion verification.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'company_name', 'completion_status'],
    foreignKeys: ['students.id'],
    rlsPolicy: 'Student manage own; Faculty/Admin verify.',
  },
  {
    name: 'placement_applications',
    domain: 'Student Lifecycle',
    summary: 'Campus placement drive pipeline, CTC packages, and offer acceptances.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'company_name', 'round_stage', 'offer_status'],
    foreignKeys: ['students.id', 'academic_years.id'],
    rlsPolicy: 'Student read/apply own; Admin manage offers.',
  },
  {
    name: 'student_leave_requests',
    domain: 'Student Lifecycle',
    summary: 'Medical, on-duty, and personal leave requests with Faculty/Admin approval.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'leave_type', 'status'],
    foreignKeys: ['students.id', 'academic_years.id', 'semesters.id', 'profiles.id'],
    rlsPolicy: 'Student submit/read own; Faculty/Admin approve/reject.',
  },
  {
    name: 'library_transactions',
    domain: 'Student Lifecycle',
    summary: 'Central library book issues, returns, due dates, and overdue fines.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'accession_number', 'status'],
    foreignKeys: ['students.id'],
    rlsPolicy: 'Student/Parent read own; Admin issue/return.',
  },
  {
    name: 'transport_allocations',
    domain: 'Student Lifecycle',
    summary: 'Bengaluru college bus route allocations and pass tracking.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'route_code', 'pass_number'],
    foreignKeys: ['students.id', 'academic_years.id'],
    rlsPolicy: 'Student/Parent read own; Admin allocate.',
  },
  {
    name: 'hostel_allocations',
    domain: 'Student Lifecycle',
    summary: 'Campus hostel block, room, bed, and mess plan allocations.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'hostel_block', 'room_number'],
    foreignKeys: ['students.id', 'academic_years.id'],
    rlsPolicy: 'Student/Parent read own; Admin allocate.',
  },
  {
    name: 'alumni_profiles',
    domain: 'Student Lifecycle',
    summary: 'Post-graduation alumni career, higher studies, and mentorship directory.',
    keyColumns: ['id (PK)', 'student_id (FK UQ)', 'graduation_year', 'final_cgpa'],
    foreignKeys: ['students.id'],
    rlsPolicy: 'Authenticated read verified; Alumni/Admin update.',
  },
  // Communication (3)
  {
    name: 'announcements',
    domain: 'Communication',
    summary: 'Targeted broadcasts scoped by college, department, semester, or section.',
    keyColumns: ['id (PK)', 'institution_id (FK)', 'target_scope', 'priority'],
    foreignKeys: ['institutions.id', 'profiles.id', 'departments.id', 'semesters.id', 'sections.id'],
    rlsPolicy: 'Scoped read; Faculty/Admin publish.',
  },
  {
    name: 'notifications',
    domain: 'Communication',
    summary: 'Personal alerts for attendance, shortages, timetables, exams, and fees.',
    keyColumns: ['id (PK)', 'recipient_profile_id (FK)', 'category', 'is_read'],
    foreignKeys: ['profiles.id'],
    rlsPolicy: 'Strict recipient_profile_id = auth.uid() isolation.',
  },
  {
    name: 'notification_preferences',
    domain: 'Communication',
    summary: 'Per-user alert thresholds and channel preferences.',
    keyColumns: ['id (PK)', 'profile_id (FK UQ)', 'low_attendance_alert_threshold'],
    foreignKeys: ['profiles.id'],
    rlsPolicy: 'Owner read/update only.',
  },
  // System (3)
  {
    name: 'audit_logs',
    domain: 'System',
    summary: 'Immutable institutional audit log capturing actor, action, and diff JSON.',
    keyColumns: ['id (PK)', 'actor_profile_id (FK)', 'action', 'entity_type'],
    foreignKeys: ['profiles.id'],
    rlsPolicy: 'Super Admin read; append-only server writes.',
  },
  {
    name: 'system_settings',
    domain: 'System',
    summary: 'Global institutional configuration (logo, thresholds, QR expiry).',
    keyColumns: ['id (PK)', 'institution_id (FK)', 'setting_key (UQ)', 'setting_value'],
    foreignKeys: ['institutions.id', 'profiles.id'],
    rlsPolicy: 'Public settings readable; Super Admin write.',
  },
  {
    name: 'consent_records',
    domain: 'System',
    summary: 'Informed biometric consent grant, withdrawal, and data purge timestamps.',
    keyColumns: ['id (PK)', 'student_id (FK)', 'consent_type', 'status'],
    foreignKeys: ['students.id'],
    rlsPolicy: 'Student reads/updates own consent; Admin audits.',
  },
];

export const POSTGRES_RLS_SQL = `-- IMPACT CAMPUS — PostgreSQL Row Level Security (RLS) Policy Migration (60-Table ERP)
-- Target: Impact College of Engineering and Applied Sciences, Bengaluru

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_assessment_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_result_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE revaluation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE examination_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;

-- 1. Students: Self read, verified parent read, faculty & super_admin institutional read
CREATE POLICY students_select_policy ON students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = students.profile_id AND p.uid = current_setting('app.current_uid', true))
    OR EXISTS (
      SELECT 1 FROM student_parent_links spl
      JOIN parents par ON par.id = spl.parent_id
      JOIN profiles p ON p.id = par.profile_id
      WHERE spl.student_id = students.id AND spl.is_verified = true AND p.uid = current_setting('app.current_uid', true)
    )
    OR current_setting('app.current_role', true) IN ('super_admin', 'faculty')
  );

-- 2. Assessment Marks & Semester Summaries: Students/Parents read PUBLISHED rows only
CREATE POLICY student_marks_published_read ON student_assessment_marks
  FOR SELECT USING (
    (workflow_status = 'published' AND (
      EXISTS (SELECT 1 FROM students s JOIN profiles p ON p.id = s.profile_id WHERE s.id = student_assessment_marks.student_id AND p.uid = current_setting('app.current_uid', true))
      OR EXISTS (SELECT 1 FROM student_parent_links spl JOIN parents par ON par.id = spl.parent_id JOIN profiles p ON p.id = par.profile_id WHERE spl.student_id = student_assessment_marks.student_id AND spl.is_verified = true AND p.uid = current_setting('app.current_uid', true))
    ))
    OR current_setting('app.current_role', true) IN ('super_admin', 'faculty')
  );

-- 3. Attendance Records: Students CANNOT insert/update/delete their own attendance
CREATE POLICY attendance_records_student_read ON attendance_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s JOIN profiles p ON p.id = s.profile_id
      WHERE s.id = attendance_records.student_id AND p.uid = current_setting('app.current_uid', true)
    )
    OR EXISTS (
      SELECT 1 FROM student_parent_links spl
      JOIN parents par ON par.id = spl.parent_id
      JOIN profiles p ON p.id = par.profile_id
      WHERE spl.student_id = attendance_records.student_id AND spl.is_verified = true AND p.uid = current_setting('app.current_uid', true)
    )
    OR current_setting('app.current_role', true) IN ('super_admin', 'faculty')
  );

CREATE POLICY attendance_records_faculty_write ON attendance_records
  FOR ALL USING (current_setting('app.current_role', true) IN ('super_admin', 'faculty'));

-- 4. Notifications: Strict recipient isolation
CREATE POLICY notifications_owner_only ON notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = notifications.recipient_profile_id AND p.uid = current_setting('app.current_uid', true))
  );

-- 5. Fee Assignments & Payments: Student self, verified parent, and Super Admin only
CREATE POLICY fee_assignments_scoped_read ON student_fee_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s JOIN profiles p ON p.id = s.profile_id
      WHERE s.id = student_fee_assignments.student_id AND p.uid = current_setting('app.current_uid', true)
    )
    OR EXISTS (
      SELECT 1 FROM student_parent_links spl
      JOIN parents par ON par.id = spl.parent_id
      JOIN profiles p ON p.id = par.profile_id
      WHERE spl.student_id = student_fee_assignments.student_id AND spl.is_verified = true AND p.uid = current_setting('app.current_uid', true)
    )
    OR current_setting('app.current_role', true) = 'super_admin'
  );
`;
