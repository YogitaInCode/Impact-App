import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================================================
// 1–8. INSTITUTIONAL TABLES
// ============================================================================

// 1. institutions
export const institutions = pgTable('institutions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  affiliation: text('affiliation').notNull(),
  logoUrl: text('logo_url'),
  website: text('website'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// 2. academic_years
export const academicYears = pgTable(
  'academic_years',
  {
    id: serial('id').primaryKey(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    code: text('code').notNull(), // e.g., "2025-26", "2026-27"
    label: text('label').notNull(),
    startDate: text('start_date').notNull(), // YYYY-MM-DD
    endDate: text('end_date').notNull(),
    isCurrent: boolean('is_current').default(false).notNull(),
    status: text('status').default('active').notNull(), // active | archived | upcoming
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_academic_years_inst_code').on(table.institutionId, table.code),
    index('idx_academic_years_current').on(table.isCurrent),
  ]
);

// 3. semesters
export const semesters = pgTable(
  'semesters',
  {
    id: serial('id').primaryKey(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    number: integer('number').notNull(), // 1..8
    name: text('name').notNull(),
    termType: text('term_type').notNull(), // odd | even
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    isActive: boolean('is_active').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_semesters_year_num').on(table.academicYearId, table.number),
    index('idx_semesters_year').on(table.academicYearId),
  ]
);

// 4. departments
export const departments = pgTable(
  'departments',
  {
    id: serial('id').primaryKey(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    code: text('code').notNull().unique(), // CSE, ISE, ECE, ME, AS
    name: text('name').notNull(),
    hodName: text('hod_name'),
    building: text('building'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_departments_inst').on(table.institutionId)]
);

// 5. programs
export const programs = pgTable(
  'programs',
  {
    id: serial('id').primaryKey(),
    departmentId: integer('department_id')
      .references(() => departments.id)
      .notNull(),
    code: text('code').notNull().unique(), // BE-CSE, BE-ECE
    name: text('name').notNull(),
    degreeType: text('degree_type').notNull(), // B.E. | M.Tech | MCA
    durationYears: integer('duration_years').default(4).notNull(),
    totalSemesters: integer('total_semesters').default(8).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_programs_dept').on(table.departmentId)]
);

// 6. courses
export const courses = pgTable(
  'courses',
  {
    id: serial('id').primaryKey(),
    programId: integer('program_id')
      .references(() => programs.id)
      .notNull(),
    code: text('code').notNull().unique(),
    title: text('title').notNull(),
    credits: integer('credits').default(4).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_courses_program').on(table.programId)]
);

// 7. sections
export const sections = pgTable(
  'sections',
  {
    id: serial('id').primaryKey(),
    departmentId: integer('department_id')
      .references(() => departments.id)
      .notNull(),
    programId: integer('program_id')
      .references(() => programs.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    name: text('name').notNull(), // A, B
    capacity: integer('capacity').default(60).notNull(),
    classAdvisorName: text('class_advisor_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_sections_prog_sem_name').on(
      table.programId,
      table.semesterId,
      table.name
    ),
    index('idx_sections_year_sem').on(table.academicYearId, table.semesterId),
  ]
);

// 8. classrooms
export const classrooms = pgTable('classrooms', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id')
    .references(() => institutions.id)
    .notNull(),
  roomCode: text('room_code').notNull().unique(), // e.g. LH-301, CSE-LAB-2
  building: text('building').notNull(),
  floor: text('floor').notNull(),
  capacity: integer('capacity').default(60).notNull(),
  roomType: text('room_type').default('lecture_hall').notNull(), // lecture_hall | lab | seminar_hall
  hasSmartBoard: boolean('has_smart_board').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ============================================================================
// 9–14. USER AND IDENTITY TABLES
// ============================================================================

// 9. profiles
export const profiles = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(), // Firebase Auth UID or demo persona UID
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    role: text('role').default('student').notNull(), // super_admin | faculty | student | parent
    phone: text('phone'),
    avatarUrl: text('avatar_url'),
    isDemoAccount: boolean('is_demo_account').default(false).notNull(),
    accountStatus: text('account_status').default('active').notNull(), // active | suspended
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_profiles_role').on(table.role),
    index('idx_profiles_email').on(table.email),
  ]
);

// 10. students
export const students = pgTable(
  'students',
  {
    id: serial('id').primaryKey(),
    profileId: integer('profile_id')
      .references(() => profiles.id)
      .notNull()
      .unique(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    departmentId: integer('department_id')
      .references(() => departments.id)
      .notNull(),
    programId: integer('program_id')
      .references(() => programs.id)
      .notNull(),
    usn: text('usn').notNull().unique(), // Permanent University Seat Number
    admissionNumber: text('admission_number').notNull().unique(),
    admissionYear: integer('admission_year').notNull(),
    dateOfBirth: text('date_of_birth').notNull(),
    gender: text('gender'),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    address: text('address').notNull(),
    emergencyContactName: text('emergency_contact_name').notNull(),
    emergencyContactPhone: text('emergency_contact_phone').notNull(),
    profilePhotoUrl: text('profile_photo_url'),
    admissionDocsJson: jsonb('admission_docs_json').$type<
      { title: string; refNo: string; verified: boolean }[]
    >(),
    previousAcademicRecordsJson: jsonb('previous_academic_records_json').$type<
      { qualification: string; board: string; year: number; percentage: string }[]
    >(),
    academicStatus: text('academic_status').default('active').notNull(), // active | graduated | on_leave
    biometricEnrolled: boolean('biometric_enrolled').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_students_dept').on(table.departmentId),
    index('idx_students_prog').on(table.programId),
    index('idx_students_usn').on(table.usn),
  ]
);

// 11. faculty
export const faculty = pgTable(
  'faculty',
  {
    id: serial('id').primaryKey(),
    profileId: integer('profile_id')
      .references(() => profiles.id)
      .notNull()
      .unique(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    departmentId: integer('department_id')
      .references(() => departments.id)
      .notNull(),
    employeeCode: text('employee_code').notNull().unique(),
    designation: text('designation').notNull(),
    qualification: text('qualification').notNull(),
    specialization: text('specialization'),
    joiningDate: text('joining_date').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    officeRoom: text('office_room'),
    status: text('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_faculty_dept').on(table.departmentId)]
);

// 12. parents
export const parents = pgTable('parents', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id')
    .references(() => profiles.id)
    .notNull()
    .unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  occupation: text('occupation'),
  address: text('address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// 13. student_parent_links
export const studentParentLinks = pgTable(
  'student_parent_links',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    parentId: integer('parent_id')
      .references(() => parents.id)
      .notNull(),
    relationship: text('relationship').notNull(), // father | mother | guardian
    isPrimaryContact: boolean('is_primary_contact').default(true).notNull(),
    isVerified: boolean('is_verified').default(true).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_student_parent').on(table.studentId, table.parentId),
    index('idx_spl_parent').on(table.parentId),
  ]
);

// 14. role_permissions
export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: serial('id').primaryKey(),
    role: text('role').notNull(), // super_admin | faculty | student | parent
    resource: text('resource').notNull(),
    canCreate: boolean('can_create').default(false).notNull(),
    canRead: boolean('can_read').default(false).notNull(),
    canUpdate: boolean('can_update').default(false).notNull(),
    canDelete: boolean('can_delete').default(false).notNull(),
    description: text('description'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('uq_role_resource').on(table.role, table.resource)]
);

// ============================================================================
// 15–21. ACADEMIC TABLES
// ============================================================================

// 15. subjects
export const subjects = pgTable(
  'subjects',
  {
    id: serial('id').primaryKey(),
    departmentId: integer('department_id')
      .references(() => departments.id)
      .notNull(),
    programId: integer('program_id')
      .references(() => programs.id)
      .notNull(),
    courseId: integer('course_id').references(() => courses.id),
    semesterNumber: integer('semester_number').notNull(),
    code: text('code').notNull().unique(), // e.g., 21CS51
    name: text('name').notNull(),
    credits: integer('credits').default(4).notNull(),
    subjectType: text('subject_type').default('theory').notNull(), // theory | lab | project
    syllabusSummary: text('syllabus_summary'),
    studyMaterialsJson: jsonb('study_materials_json').$type<
      {
        id: string;
        title: string;
        moduleLabel: string;
        fileName: string;
        uploadedBy: string;
        uploadedAt: string;
        url: string;
      }[]
    >(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_subjects_dept_sem').on(table.departmentId, table.semesterNumber),
  ]
);

// 16. subject_faculty_assignments
export const subjectFacultyAssignments = pgTable(
  'subject_faculty_assignments',
  {
    id: serial('id').primaryKey(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    facultyId: integer('faculty_id')
      .references(() => faculty.id)
      .notNull(),
    sectionId: integer('section_id')
      .references(() => sections.id)
      .notNull(),
    isPrimary: boolean('is_primary').default(true).notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_sfa_year_sem_subj_sec').on(
      table.academicYearId,
      table.semesterId,
      table.subjectId,
      table.sectionId
    ),
    index('idx_sfa_faculty').on(table.facultyId),
  ]
);

// 17. student_enrollments (Preserves multi-year academic history)
export const studentEnrollments = pgTable(
  'student_enrollments',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    programId: integer('program_id')
      .references(() => programs.id)
      .notNull(),
    sectionId: integer('section_id')
      .references(() => sections.id)
      .notNull(),
    rollNumber: text('roll_number'),
    enrollmentStatus: text('enrollment_status').default('enrolled').notNull(), // enrolled | promoted | completed | detained
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).defaultNow().notNull(),
    promotedFromEnrollmentId: integer('promoted_from_enrollment_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_enrollment_student_year_sem').on(
      table.studentId,
      table.academicYearId,
      table.semesterId
    ),
    index('idx_enrollments_year_sec').on(table.academicYearId, table.sectionId),
  ]
);

// 18. timetables
export const timetables = pgTable(
  'timetables',
  {
    id: serial('id').primaryKey(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    sectionId: integer('section_id')
      .references(() => sections.id)
      .notNull(),
    title: text('title').notNull(),
    effectiveFrom: text('effective_from').notNull(),
    isPublished: boolean('is_published').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_timetables_year_sem_sec').on(
      table.academicYearId,
      table.semesterId,
      table.sectionId
    ),
  ]
);

// 19. timetable_slots
export const timetableSlots = pgTable(
  'timetable_slots',
  {
    id: serial('id').primaryKey(),
    timetableId: integer('timetable_id')
      .references(() => timetables.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    facultyId: integer('faculty_id')
      .references(() => faculty.id)
      .notNull(),
    classroomId: integer('classroom_id')
      .references(() => classrooms.id)
      .notNull(),
    dayOfWeek: integer('day_of_week').notNull(), // 1=Mon ... 6=Sat
    periodNumber: integer('period_number').notNull(), // 1..7
    startTime: text('start_time').notNull(), // HH:MM
    endTime: text('end_time').notNull(),
    slotType: text('slot_type').default('lecture').notNull(), // lecture | lab | tutorial
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('uq_slot_timetable_day_period').on(
      table.timetableId,
      table.dayOfWeek,
      table.periodNumber
    ),
    index('idx_slots_faculty_day').on(table.facultyId, table.dayOfWeek),
    index('idx_slots_classroom_day').on(table.classroomId, table.dayOfWeek),
  ]
);

// 20. examinations
export const examinations = pgTable(
  'examinations',
  {
    id: serial('id').primaryKey(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    departmentId: integer('department_id')
      .references(() => departments.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    examName: text('exam_name').notNull(),
    examType: text('exam_type').notNull(), // ia_1 | ia_2 | ia_3 | lab | see
    examDate: text('exam_date').notNull(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    maxMarks: integer('max_marks').default(100).notNull(),
    passingMarks: integer('passing_marks').default(40).notNull(),
    classroomId: integer('classroom_id').references(() => classrooms.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_exams_year_sem').on(table.academicYearId, table.semesterId),
  ]
);

// 21. examination_results
export const examinationResults = pgTable(
  'examination_results',
  {
    id: serial('id').primaryKey(),
    examinationId: integer('examination_id')
      .references(() => examinations.id)
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    marksObtained: numeric('marks_obtained', { precision: 5, scale: 2 }).notNull(),
    grade: text('grade').notNull(),
    gradePoints: numeric('grade_points', { precision: 4, scale: 2 }).notNull(),
    status: text('status').default('pass').notNull(), // pass | fail | absent | pending
    remarks: text('remarks'),
    publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_exam_result_exam_student').on(table.examinationId, table.studentId),
    index('idx_exam_results_student_year').on(table.studentId, table.academicYearId),
  ]
);

// ============================================================================
// 22–26. ATTENDANCE TABLES
// ============================================================================

// 22. attendance_sessions
export const attendanceSessions = pgTable(
  'attendance_sessions',
  {
    id: serial('id').primaryKey(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    facultyId: integer('faculty_id')
      .references(() => faculty.id)
      .notNull(),
    sectionId: integer('section_id')
      .references(() => sections.id)
      .notNull(),
    timetableSlotId: integer('timetable_slot_id').references(() => timetableSlots.id),
    classroomId: integer('classroom_id').references(() => classrooms.id),
    sessionDate: text('session_date').notNull(), // YYYY-MM-DD
    mode: text('mode').notNull(), // manual | dynamic_qr | ai_face
    status: text('status').default('active').notNull(), // active | closed | cancelled
    qrSecret: text('qr_secret').notNull(),
    qrIntervalSeconds: integer('qr_interval_seconds').default(25).notNull(),
    qrExpiresAt: timestamp('qr_expires_at', { withTimezone: true }),
    confidenceThreshold: numeric('confidence_threshold', { precision: 4, scale: 2 })
      .default('0.85')
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_att_sessions_faculty_status').on(table.facultyId, table.status),
    index('idx_att_sessions_sec_date').on(table.sectionId, table.sessionDate),
  ]
);

// 23. attendance_records
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => attendanceSessions.id)
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    facultyId: integer('faculty_id')
      .references(() => faculty.id)
      .notNull(),
    status: text('status').notNull(), // present | absent | late | pending_review | excused
    verificationMethod: text('verification_method').notNull(), // manual | dynamic_qr | ai_face
    confidenceScore: numeric('confidence_score', { precision: 4, scale: 3 }),
    markedAt: timestamp('marked_at', { withTimezone: true }).defaultNow().notNull(),
    markedByProfileId: integer('marked_by_profile_id').references(() => profiles.id),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_att_record_session_student').on(table.sessionId, table.studentId),
    index('idx_att_records_student_subj').on(table.studentId, table.subjectId),
    index('idx_att_records_year').on(table.academicYearId),
  ]
);

// 24. attendance_verification_logs
export const attendanceVerificationLogs = pgTable(
  'attendance_verification_logs',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .references(() => attendanceSessions.id)
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    verificationMethod: text('verification_method').notNull(),
    providerName: text('provider_name').notNull(),
    outcome: text('outcome').notNull(), // verified | uncertain_review | rejected | duplicate_blocked | expired_token | provider_unconfigured
    confidenceScore: numeric('confidence_score', { precision: 4, scale: 3 }),
    livenessPassed: boolean('liveness_passed'),
    livenessChecksJson: jsonb('liveness_checks_json').$type<Record<string, unknown>>(),
    qrTokenHash: text('qr_token_hash'),
    ipAddress: text('ip_address'),
    deviceSummary: text('device_summary'),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_verif_logs_session_student').on(table.sessionId, table.studentId),
  ]
);

// 25. attendance_corrections
export const attendanceCorrections = pgTable(
  'attendance_corrections',
  {
    id: serial('id').primaryKey(),
    attendanceRecordId: integer('attendance_record_id')
      .references(() => attendanceRecords.id)
      .notNull(),
    sessionId: integer('session_id')
      .references(() => attendanceSessions.id)
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    editedByProfileId: integer('edited_by_profile_id')
      .references(() => profiles.id)
      .notNull(),
    previousStatus: text('previous_status').notNull(),
    newStatus: text('new_status').notNull(),
    reason: text('reason').notNull(),
    appealStatus: text('appeal_status').default('faculty_edit').notNull(), // faculty_edit | student_appeal_pending | approved | rejected
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_att_corrections_record').on(table.attendanceRecordId)]
);

// 26. attendance_policies
export const attendancePolicies = pgTable(
  'attendance_policies',
  {
    id: serial('id').primaryKey(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    departmentId: integer('department_id').references(() => departments.id),
    minAttendancePercentage: integer('min_attendance_percentage').default(75).notNull(),
    condonationMinimumPercentage: integer('condonation_minimum_percentage')
      .default(65)
      .notNull(),
    qrTokenTtlSeconds: integer('qr_token_ttl_seconds').default(25).notNull(),
    aiAutoApproveThreshold: numeric('ai_auto_approve_threshold', {
      precision: 4,
      scale: 2,
    })
      .default('0.85')
      .notNull(),
    aiManualReviewThreshold: numeric('ai_manual_review_threshold', {
      precision: 4,
      scale: 2,
    })
      .default('0.65')
      .notNull(),
    requireLivenessCheck: boolean('require_liveness_check').default(true).notNull(),
    allowLateWindowMinutes: integer('allow_late_window_minutes').default(10).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_att_policies_year').on(table.academicYearId)]
);

// ============================================================================
// 27–31. FINANCE TABLES
// ============================================================================

// 27. fee_structures
export const feeStructures = pgTable(
  'fee_structures',
  {
    id: serial('id').primaryKey(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    programId: integer('program_id')
      .references(() => programs.id)
      .notNull(),
    semesterNumber: integer('semester_number').notNull(),
    categoryName: text('category_name').notNull(),
    tuitionFee: integer('tuition_fee').notNull(),
    labFee: integer('lab_fee').default(0).notNull(),
    libraryFee: integer('library_fee').default(0).notNull(),
    examFee: integer('exam_fee').default(0).notNull(),
    miscFee: integer('misc_fee').default(0).notNull(),
    totalAmount: integer('total_amount').notNull(),
    dueDate: text('due_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_fee_structures_year_prog').on(table.academicYearId, table.programId),
  ]
);

// 28. student_fee_assignments
export const studentFeeAssignments = pgTable(
  'student_fee_assignments',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    feeStructureId: integer('fee_structure_id')
      .references(() => feeStructures.id)
      .notNull(),
    grossAmount: integer('gross_amount').notNull(),
    scholarshipDiscount: integer('scholarship_discount').default(0).notNull(),
    netPayable: integer('net_payable').notNull(),
    paidAmount: integer('paid_amount').default(0).notNull(),
    balanceDue: integer('balance_due').notNull(),
    status: text('status').default('pending').notNull(), // paid | partial | pending | overdue
    dueDate: text('due_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_sfa_student_year_struct').on(
      table.studentId,
      table.academicYearId,
      table.feeStructureId
    ),
    index('idx_sfa_student').on(table.studentId),
  ]
);

// 29. fee_payments
export const feePayments = pgTable(
  'fee_payments',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    studentFeeAssignmentId: integer('student_fee_assignment_id')
      .references(() => studentFeeAssignments.id)
      .notNull(),
    receiptNumber: text('receipt_number').notNull().unique(),
    amountPaid: integer('amount_paid').notNull(),
    paymentDate: timestamp('payment_date', { withTimezone: true }).defaultNow().notNull(),
    paymentMode: text('payment_mode').notNull(), // upi | neft_rtgs | dd | bank_challan | netbanking
    collectedByProfileId: integer('collected_by_profile_id').references(() => profiles.id),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_fee_payments_student_year').on(table.studentId, table.academicYearId)]
);

// 30. payment_transactions (Never stores card numbers or CVV)
export const paymentTransactions = pgTable(
  'payment_transactions',
  {
    id: serial('id').primaryKey(),
    feePaymentId: integer('fee_payment_id')
      .references(() => feePayments.id)
      .notNull(),
    transactionReference: text('transaction_reference').notNull().unique(),
    gatewayName: text('gateway_name').notNull(),
    gatewayStatus: text('gateway_status').default('settled').notNull(), // settled | pending | failed | reversed
    amount: integer('amount').notNull(),
    currency: text('currency').default('INR').notNull(),
    settledAt: timestamp('settled_at', { withTimezone: true }).defaultNow(),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_payment_tx_payment').on(table.feePaymentId)]
);

// 31. scholarships
export const scholarships = pgTable(
  'scholarships',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    schemeName: text('scheme_name').notNull(),
    provider: text('provider').notNull(),
    amount: integer('amount').notNull(),
    status: text('status').default('approved').notNull(), // approved | disbursed | pending
    sanctionRef: text('sanction_ref').notNull(),
    awardedAt: timestamp('awarded_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_scholarships_student_year').on(table.studentId, table.academicYearId)]
);

// ============================================================================
// 32–34. COMMUNICATION TABLES
// ============================================================================

// 32. announcements
export const announcements = pgTable(
  'announcements',
  {
    id: serial('id').primaryKey(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    authorProfileId: integer('author_profile_id')
      .references(() => profiles.id)
      .notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    targetScope: text('target_scope').default('college').notNull(), // college | department | semester | section
    targetDepartmentId: integer('target_department_id').references(() => departments.id),
    targetSemesterId: integer('target_semester_id').references(() => semesters.id),
    targetSectionId: integer('target_section_id').references(() => sections.id),
    priority: text('priority').default('normal').notNull(), // normal | important | urgent
    publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [index('idx_announcements_scope').on(table.targetScope, table.publishedAt)]
);

// 33. notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    recipientProfileId: integer('recipient_profile_id')
      .references(() => profiles.id)
      .notNull(),
    category: text('category').notNull(), // attendance | low_attendance | timetable | examination | fee | announcement
    title: text('title').notNull(),
    message: text('message').notNull(),
    actionUrl: text('action_url'),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_notifications_recipient_read').on(table.recipientProfileId, table.isRead),
  ]
);

// 34. notification_preferences
export const notificationPreferences = pgTable('notification_preferences', {
  id: serial('id').primaryKey(),
  profileId: integer('profile_id')
    .references(() => profiles.id)
    .notNull()
    .unique(),
  inAppAttendance: boolean('in_app_attendance').default(true).notNull(),
  inAppFees: boolean('in_app_fees').default(true).notNull(),
  inAppExams: boolean('in_app_exams').default(true).notNull(),
  inAppAnnouncements: boolean('in_app_announcements').default(true).notNull(),
  lowAttendanceAlertThreshold: integer('low_attendance_alert_threshold')
    .default(75)
    .notNull(),
  parentSmsOptIn: boolean('parent_sms_opt_in').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================================================
// 35–37. SYSTEM TABLES
// ============================================================================

// 35. audit_logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorProfileId: integer('actor_profile_id').references(() => profiles.id),
    actorRole: text('actor_role').notNull(),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    beforeStateJson: jsonb('before_state_json').$type<Record<string, unknown> | null>(),
    afterStateJson: jsonb('after_state_json').$type<Record<string, unknown> | null>(),
    reason: text('reason'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_audit_logs_entity').on(table.entityType, table.entityId),
    index('idx_audit_logs_created').on(table.createdAt),
  ]
);

// 36. system_settings
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  institutionId: integer('institution_id')
    .references(() => institutions.id)
    .notNull(),
  settingKey: text('setting_key').notNull().unique(),
  settingValue: text('setting_value').notNull(),
  category: text('category').notNull(),
  description: text('description'),
  isPublic: boolean('is_public').default(false).notNull(),
  updatedByProfileId: integer('updated_by_profile_id').references(() => profiles.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 37. consent_records
export const consentRecords = pgTable(
  'consent_records',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    consentType: text('consent_type').notNull(), // biometric_face_verification | parent_data_sharing
    status: text('status').notNull(), // granted | withdrawn
    consentVersion: text('consent_version').default('v1.0-ICEAS-2026').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    ipAddress: text('ip_address'),
    purgedBiometricDataAt: timestamp('purged_biometric_data_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_consent_student_type').on(table.studentId, table.consentType)]
);

// ============================================================================
// 38. INSTITUTION-CONTROLLED ACCOUNT PROVISIONING
// ============================================================================

export const accountProvisions = pgTable(
  'account_provisions',
  {
    id: serial('id').primaryKey(),
    email: text('email').notNull().unique(),
    role: text('role').notNull(), // super_admin | faculty | student | parent
    fullName: text('full_name').notNull(),
    referenceCode: text('reference_code'), // USN or Employee Code or Parent phone ref
    departmentId: integer('department_id').references(() => departments.id),
    linkedStudentId: integer('linked_student_id').references(() => students.id),
    linkedFacultyId: integer('linked_faculty_id').references(() => faculty.id),
    linkedParentId: integer('linked_parent_id').references(() => parents.id),
    status: text('status').default('invited').notNull(), // invited | claimed | revoked
    invitedByProfileId: integer('invited_by_profile_id').references(() => profiles.id),
    claimedProfileId: integer('claimed_profile_id').references(() => profiles.id),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_account_provisions_status').on(table.status)]
);

// ============================================================================
// 39–43. COMPLETE STUDENT LIFECYCLE PERSONAL, ADMISSION & DOCUMENT TABLES
// ============================================================================

// 39. student_addresses
export const studentAddresses = pgTable(
  'student_addresses',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    addressType: text('address_type').default('current').notNull(), // current | permanent
    line1: text('line1').notNull(),
    line2: text('line2'),
    city: text('city').notNull(),
    state: text('state').notNull(),
    pincode: text('pincode').notNull(),
    country: text('country').default('India').notNull(),
    isPrimary: boolean('is_primary').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_student_addresses_student').on(table.studentId)]
);

// 40. student_emergency_contacts
export const studentEmergencyContacts = pgTable(
  'student_emergency_contacts',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    contactName: text('contact_name').notNull(),
    relationship: text('relationship').notNull(),
    phone: text('phone').notNull(),
    email: text('email'),
    isPrimary: boolean('is_primary').default(true).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_student_ec_student').on(table.studentId)]
);

// 41. student_qualifications
export const studentQualifications = pgTable(
  'student_qualifications',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    qualification: text('qualification').notNull(), // Class X | II PUC / Class XII | Diploma
    institutionName: text('institution_name').notNull(),
    boardOrUniversity: text('board_or_university').notNull(),
    passingYear: integer('passing_year').notNull(),
    maxMarks: integer('max_marks'),
    obtainedMarks: integer('obtained_marks'),
    percentageOrCgpa: text('percentage_or_cgpa').notNull(),
    certificateRef: text('certificate_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_student_qual_student').on(table.studentId)]
);

// 42. student_documents
export const studentDocuments = pgTable(
  'student_documents',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    documentType: text('document_type').notNull(), // allotment_order | marks_card | tc | migration | identity | photo
    title: text('title').notNull(),
    referenceNumber: text('reference_number').notNull(),
    fileUrl: text('file_url'),
    verificationStatus: text('verification_status').default('pending').notNull(), // pending | verified | rejected
    verifiedByProfileId: integer('verified_by_profile_id').references(() => profiles.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_student_docs_student').on(table.studentId)]
);

// 43. student_admission_history
export const studentAdmissionHistory = pgTable(
  'student_admission_history',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull()
      .unique(),
    admissionNumber: text('admission_number').notNull(),
    admissionDate: text('admission_date').notNull(),
    admissionCategory: text('admission_category').notNull(), // KCET | COMEDK | Management | Lateral Entry
    seatType: text('seat_type').default('Regular').notNull(),
    allotmentRank: integer('allotment_rank'),
    allotmentOrderNo: text('allotment_order_no'),
    previousInstitution: text('previous_institution').notNull(),
    verificationStatus: text('verification_status').default('verified').notNull(), // pending | verified | provisional
    verifiedByProfileId: integer('verified_by_profile_id').references(() => profiles.id),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_student_adm_student').on(table.studentId)]
);

// ============================================================================
// 44–51. ASSESSMENT SCHEMES, INTERNAL MARKS, SGPA/CGPA, BACKLOGS & REVALUATION
// ============================================================================

// 44. grade_scales
export const gradeScales = pgTable(
  'grade_scales',
  {
    id: serial('id').primaryKey(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    schemeCode: text('scheme_code').notNull(), // VTU-2021 | VTU-2022
    minPercentage: numeric('min_percentage', { precision: 5, scale: 2 }).notNull(),
    maxPercentage: numeric('max_percentage', { precision: 5, scale: 2 }).notNull(),
    gradeLetter: text('grade_letter').notNull(),
    gradePoints: numeric('grade_points', { precision: 4, scale: 2 }).notNull(),
    statusLabel: text('status_label').notNull(),
    isPass: boolean('is_pass').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_grade_scales_scheme').on(table.schemeCode)]
);

// 45. assessment_schemes
export const assessmentSchemes = pgTable(
  'assessment_schemes',
  {
    id: serial('id').primaryKey(),
    institutionId: integer('institution_id')
      .references(() => institutions.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    programId: integer('program_id')
      .references(() => programs.id)
      .notNull(),
    schemeCode: text('scheme_code').notNull(), // VTU-2022-50-50
    name: text('name').notNull(),
    cieMaxMarks: integer('cie_max_marks').default(50).notNull(),
    seeMaxMarks: integer('see_max_marks').default(50).notNull(),
    totalMaxMarks: integer('total_max_marks').default(100).notNull(),
    minCiePercentage: integer('min_cie_percentage').default(40).notNull(),
    minSeePercentage: integer('min_see_percentage').default(35).notNull(),
    minTotalPercentage: integer('min_total_percentage').default(40).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_assess_scheme_year_prog_code').on(
      table.academicYearId,
      table.programId,
      table.schemeCode
    ),
  ]
);

// 46. assessment_components
export const assessmentComponents = pgTable(
  'assessment_components',
  {
    id: serial('id').primaryKey(),
    schemeId: integer('scheme_id')
      .references(() => assessmentSchemes.id)
      .notNull(),
    subjectId: integer('subject_id').references(() => subjects.id), // nullable for scheme-wide defaults
    code: text('code').notNull(), // IA1 | IA2 | IA3 | ASSIGN | QUIZ | LAB | SEE
    name: text('name').notNull(),
    category: text('category').notNull(), // cie | see | lab
    maxMarks: integer('max_marks').notNull(),
    weightagePct: numeric('weightage_pct', { precision: 5, scale: 2 }).notNull(),
    passingMarks: integer('passing_marks').default(0).notNull(),
    displayOrder: integer('display_order').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_assess_comp_scheme').on(table.schemeId)]
);

// 47. student_assessment_marks
export const studentAssessmentMarks = pgTable(
  'student_assessment_marks',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    componentId: integer('component_id')
      .references(() => assessmentComponents.id)
      .notNull(),
    marksObtained: numeric('marks_obtained', { precision: 5, scale: 2 }).notNull(),
    maxMarks: integer('max_marks').notNull(),
    isAbsent: boolean('is_absent').default(false).notNull(),
    workflowStatus: text('workflow_status').default('draft').notNull(), // draft | submitted | approved | published
    enteredByProfileId: integer('entered_by_profile_id').references(() => profiles.id),
    approvedByProfileId: integer('approved_by_profile_id').references(() => profiles.id),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_student_assess_mark').on(
      table.studentId,
      table.academicYearId,
      table.semesterId,
      table.subjectId,
      table.componentId
    ),
    index('idx_sam_student_year').on(table.studentId, table.academicYearId),
  ]
);

// 48. mark_change_requests
export const markChangeRequests = pgTable(
  'mark_change_requests',
  {
    id: serial('id').primaryKey(),
    studentAssessmentMarkId: integer('student_assessment_mark_id')
      .references(() => studentAssessmentMarks.id)
      .notNull(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    requestedByProfileId: integer('requested_by_profile_id')
      .references(() => profiles.id)
      .notNull(),
    previousMarks: numeric('previous_marks', { precision: 5, scale: 2 }).notNull(),
    requestedMarks: numeric('requested_marks', { precision: 5, scale: 2 }).notNull(),
    reason: text('reason').notNull(),
    status: text('status').default('pending').notNull(), // pending | approved | rejected
    reviewedByProfileId: integer('reviewed_by_profile_id').references(() => profiles.id),
    reviewNotes: text('review_notes'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_mark_change_status').on(table.status)]
);

// 49. semester_result_summaries
export const semesterResultSummaries = pgTable(
  'semester_result_summaries',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    totalCreditsRegistered: integer('total_credits_registered').notNull(),
    totalCreditsEarned: integer('total_credits_earned').notNull(),
    sgpa: numeric('sgpa', { precision: 4, scale: 2 }).notNull(),
    cgpa: numeric('cgpa', { precision: 4, scale: 2 }).notNull(),
    percentage: numeric('percentage', { precision: 5, scale: 2 }).notNull(),
    resultStatus: text('result_status').default('pass').notNull(), // pass | fail | withheld | pending
    backlogCount: integer('backlog_count').default(0).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    computedAt: timestamp('computed_at', { withTimezone: true }).defaultNow().notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('uq_sem_summary_student_year_sem').on(
      table.studentId,
      table.academicYearId,
      table.semesterId
    ),
    index('idx_sem_summary_student').on(table.studentId),
  ]
);

// 50. student_backlogs
export const studentBacklogs = pgTable(
  'student_backlogs',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    originalMarks: numeric('original_marks', { precision: 5, scale: 2 }).notNull(),
    attemptNumber: integer('attempt_number').default(1).notNull(),
    makeupExamDate: text('makeup_exam_date'),
    makeupMarks: numeric('makeup_marks', { precision: 5, scale: 2 }),
    status: text('status').default('active').notNull(), // active | registered_makeup | cleared
    clearedInSemesterId: integer('cleared_in_semester_id').references(() => semesters.id),
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_student_backlogs_student').on(table.studentId, table.status)]
);

// 51. revaluation_requests
export const revaluationRequests = pgTable(
  'revaluation_requests',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    subjectId: integer('subject_id')
      .references(() => subjects.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    examinationResultId: integer('examination_result_id').references(() => examinationResults.id),
    requestType: text('request_type').default('revaluation').notNull(), // revaluation | photocopy | challenge_valuation
    originalMarks: numeric('original_marks', { precision: 5, scale: 2 }).notNull(),
    revisedMarks: numeric('revised_marks', { precision: 5, scale: 2 }),
    feeAmount: integer('fee_amount').default(500).notNull(),
    paymentReference: text('payment_reference'),
    reason: text('reason').notNull(),
    status: text('status').default('submitted').notNull(), // submitted | under_review | completed | rejected
    reviewedByProfileId: integer('reviewed_by_profile_id').references(() => profiles.id),
    reviewerNotes: text('reviewer_notes'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_reval_student_status').on(table.studentId, table.status)]
);

// ============================================================================
// 52–60. EXTENDED STUDENT LIFECYCLE, CAMPUS SERVICES & ALUMNI TABLES
// ============================================================================

// 52. student_achievements
export const studentAchievements = pgTable(
  'student_achievements',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    title: text('title').notNull(),
    category: text('category').notNull(), // academic | hackathon | publication | sports | cultural | certification
    issuer: text('issuer').notNull(),
    achievedOn: text('achieved_on').notNull(),
    level: text('level').default('college').notNull(), // college | state | national | international
    description: text('description'),
    certificateRef: text('certificate_ref'),
    verified: boolean('verified').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_achievements_student').on(table.studentId)]
);

// 53. student_projects
export const studentProjects = pgTable(
  'student_projects',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    title: text('title').notNull(),
    projectType: text('project_type').default('mini').notNull(), // mini | capstone | research | opensource
    domain: text('domain').notNull(),
    techStack: text('tech_stack').notNull(),
    guideFacultyId: integer('guide_faculty_id').references(() => faculty.id),
    repositoryUrl: text('repository_url'),
    status: text('status').default('in_progress').notNull(), // in_progress | completed | published
    gradeOrRemarks: text('grade_or_remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_projects_student').on(table.studentId)]
);

// 54. student_internships
export const studentInternships = pgTable(
  'student_internships',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    companyName: text('company_name').notNull(),
    roleTitle: text('role_title').notNull(),
    internshipType: text('internship_type').default('summer').notNull(), // summer | winter | semester_long | research
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    stipendInr: integer('stipend_inr').default(0).notNull(),
    location: text('location').notNull(),
    supervisorName: text('supervisor_name'),
    completionStatus: text('completion_status').default('ongoing').notNull(), // ongoing | completed | verified
    certificateRef: text('certificate_ref'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_internships_student').on(table.studentId)]
);

// 55. placement_applications
export const placementApplications = pgTable(
  'placement_applications',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    companyName: text('company_name').notNull(),
    jobRole: text('job_role').notNull(),
    ctcLpa: numeric('ctc_lpa', { precision: 5, scale: 2 }).notNull(),
    driveDate: text('drive_date').notNull(),
    roundStage: text('round_stage').default('applied').notNull(), // applied | shortlisted | technical_round | hr_round | offered | rejected
    offerStatus: text('offer_status').default('none').notNull(), // pending | accepted | declined | none
    offerLetterRef: text('offer_letter_ref'),
    remarks: text('remarks'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_placements_student').on(table.studentId)]
);

// 56. student_leave_requests
export const studentLeaveRequests = pgTable(
  'student_leave_requests',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    semesterId: integer('semester_id')
      .references(() => semesters.id)
      .notNull(),
    leaveType: text('leave_type').default('medical').notNull(), // medical | on_duty | personal | event
    fromDate: text('from_date').notNull(),
    toDate: text('to_date').notNull(),
    daysCount: integer('days_count').default(1).notNull(),
    reason: text('reason').notNull(),
    supportingDocRef: text('supporting_doc_ref'),
    status: text('status').default('pending').notNull(), // pending | approved | rejected
    reviewedByProfileId: integer('reviewed_by_profile_id').references(() => profiles.id),
    reviewRemarks: text('review_remarks'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_leave_requests_student_status').on(table.studentId, table.status)]
);

// 57. library_transactions
export const libraryTransactions = pgTable(
  'library_transactions',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    bookIsbn: text('book_isbn').notNull(),
    bookTitle: text('book_title').notNull(),
    author: text('author').notNull(),
    accessionNumber: text('accession_number').notNull(),
    issuedDate: text('issued_date').notNull(),
    dueDate: text('due_date').notNull(),
    returnedDate: text('returned_date'),
    fineInr: integer('fine_inr').default(0).notNull(),
    status: text('status').default('issued').notNull(), // issued | returned | overdue
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_library_student_status').on(table.studentId, table.status)]
);

// 58. transport_allocations
export const transportAllocations = pgTable(
  'transport_allocations',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    routeCode: text('route_code').notNull(),
    routeName: text('route_name').notNull(),
    boardingStop: text('boarding_stop').notNull(),
    busNumber: text('bus_number').notNull(),
    passNumber: text('pass_number').notNull(),
    annualFeeInr: integer('annual_fee_inr').default(18000).notNull(),
    status: text('status').default('active').notNull(), // active | cancelled
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_transport_student').on(table.studentId)]
);

// 59. hostel_allocations
export const hostelAllocations = pgTable(
  'hostel_allocations',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull(),
    academicYearId: integer('academic_year_id')
      .references(() => academicYears.id)
      .notNull(),
    hostelBlock: text('hostel_block').notNull(),
    roomNumber: text('room_number').notNull(),
    bedCode: text('bed_code').notNull(),
    roomType: text('room_type').default('2-Sharing').notNull(),
    messPlan: text('mess_plan').default('Veg & South/North Mess').notNull(),
    annualFeeInr: integer('annual_fee_inr').default(72000).notNull(),
    status: text('status').default('active').notNull(), // active | vacated
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_hostel_student').on(table.studentId)]
);

// 60. alumni_profiles
export const alumniProfiles = pgTable(
  'alumni_profiles',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id)
      .notNull()
      .unique(),
    graduationYear: integer('graduation_year').notNull(),
    degreeAwarded: text('degree_awarded').notNull(),
    finalCgpa: numeric('final_cgpa', { precision: 4, scale: 2 }).notNull(),
    currentCompany: text('current_company'),
    currentRole: text('current_role'),
    higherStudiesInstitution: text('higher_studies_institution'),
    city: text('city').notNull(),
    linkedinUrl: text('linkedin_url'),
    mentorshipAvailable: boolean('mentorship_available').default(true).notNull(),
    verified: boolean('verified').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_alumni_grad_year').on(table.graduationYear)]
);

// ============================================================================
// DRIZZLE RELATIONS
// ============================================================================

export const institutionsRelations = relations(institutions, ({ many }) => ({
  academicYears: many(academicYears),
  departments: many(departments),
  classrooms: many(classrooms),
}));

export const academicYearsRelations = relations(academicYears, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [academicYears.institutionId],
    references: [institutions.id],
  }),
  semesters: many(semesters),
  enrollments: many(studentEnrollments),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  institution: one(institutions, {
    fields: [departments.institutionId],
    references: [institutions.id],
  }),
  programs: many(programs),
  students: many(students),
  faculty: many(faculty),
  subjects: many(subjects),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  student: one(students, {
    fields: [profiles.id],
    references: [students.profileId],
  }),
  faculty: one(faculty, {
    fields: [profiles.id],
    references: [faculty.profileId],
  }),
  parent: one(parents, {
    fields: [profiles.id],
    references: [parents.profileId],
  }),
  notifications: many(notifications),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [students.profileId],
    references: [profiles.id],
  }),
  department: one(departments, {
    fields: [students.departmentId],
    references: [departments.id],
  }),
  program: one(programs, {
    fields: [students.programId],
    references: [programs.id],
  }),
  enrollments: many(studentEnrollments),
  attendanceRecords: many(attendanceRecords),
  feeAssignments: many(studentFeeAssignments),
  parentLinks: many(studentParentLinks),
  consentRecords: many(consentRecords),
  addresses: many(studentAddresses),
  emergencyContacts: many(studentEmergencyContacts),
  qualifications: many(studentQualifications),
  documents: many(studentDocuments),
  admissionHistory: one(studentAdmissionHistory, {
    fields: [students.id],
    references: [studentAdmissionHistory.studentId],
  }),
  assessmentMarks: many(studentAssessmentMarks),
  semesterResultSummaries: many(semesterResultSummaries),
  backlogs: many(studentBacklogs),
  revaluationRequests: many(revaluationRequests),
  achievements: many(studentAchievements),
  projects: many(studentProjects),
  internships: many(studentInternships),
  placementApplications: many(placementApplications),
  leaveRequests: many(studentLeaveRequests),
  libraryTransactions: many(libraryTransactions),
  transportAllocations: many(transportAllocations),
  hostelAllocations: many(hostelAllocations),
  alumniProfile: one(alumniProfiles, {
    fields: [students.id],
    references: [alumniProfiles.studentId],
  }),
}));

export const facultyRelations = relations(faculty, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [faculty.profileId],
    references: [profiles.id],
  }),
  department: one(departments, {
    fields: [faculty.departmentId],
    references: [departments.id],
  }),
  assignments: many(subjectFacultyAssignments),
  attendanceSessions: many(attendanceSessions),
}));
