import { Router } from 'express';
import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  academicYears,
  announcements,
  classrooms,
  courses,
  departments,
  examinationResults,
  examinations,
  faculty,
  feeStructures,
  institutions,
  notifications,
  profiles,
  programs,
  sections,
  semesters,
  studentEnrollments,
  studentFeeAssignments,
  students,
  subjectFacultyAssignments,
  subjects,
  systemSettings,
  timetableSlots,
  timetables,
} from '../db/schema.ts';
import { ER_SCHEMA_METADATA, POSTGRES_RLS_SQL } from '../db/migrationSql.ts';
import { ensureSeedData, getActiveInstitutionId } from '../db/seed.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { recordAuditLog } from '../services/audit.ts';

export const coreRouter = Router();

coreRouter.use(requireAuth);

coreRouter.get('/me', async (req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const eff = req.effectiveProfile!;
    const [inst] = await db.select().from(institutions).limit(1);
    const [unread] = await db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientProfileId, eff.id),
          eq(notifications.isRead, false)
        )
      );

    const years = await db
      .select()
      .from(academicYears)
      .where(isNull(academicYears.deletedAt))
      .orderBy(desc(academicYears.code));

    const settingsRows = await db.select().from(systemSettings);

    res.json({
      actor: req.actorProfile,
      effectiveProfile: eff,
      pendingApproval: eff.accountStatus === 'pending_approval',
      institution: inst,
      unreadNotifications: Number(unread?.total ?? 0),
      academicYears: years,
      settings: Object.fromEntries(
        settingsRows.map((s) => [s.settingKey, s.settingValue])
      ),
    });
  } catch (error) {
    console.error('Error in GET /api/me:', error);
    res.status(500).json({ error: 'Failed to resolve user session context' });
  }
});

// Role-Scoped Global Search
coreRouter.get('/search', async (req: AuthRequest, res) => {
  try {
    const q = (req.query.q as string | undefined)?.trim();
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }
    const eff = req.effectiveProfile!;
    const pattern = `%${q}%`;

    const [subjRows, facRows, examRows, annRows, stuRows] = await Promise.all([
      db
        .select({ id: subjects.id, code: subjects.code, name: subjects.name })
        .from(subjects)
        .where(and(isNull(subjects.deletedAt), or(ilike(subjects.code, pattern), ilike(subjects.name, pattern))))
        .limit(5),
      db
        .select({ id: faculty.id, code: faculty.employeeCode, name: profiles.fullName, designation: faculty.designation })
        .from(faculty)
        .innerJoin(profiles, eq(faculty.profileId, profiles.id))
        .where(or(ilike(profiles.fullName, pattern), ilike(faculty.employeeCode, pattern)))
        .limit(5),
      db
        .select({ id: examinations.id, name: examinations.examName, date: examinations.examDate })
        .from(examinations)
        .where(and(isNull(examinations.deletedAt), ilike(examinations.examName, pattern)))
        .limit(5),
      db
        .select({ id: announcements.id, title: announcements.title, priority: announcements.priority })
        .from(announcements)
        .where(and(isNull(announcements.deletedAt), ilike(announcements.title, pattern)))
        .limit(5),
      eff.role === 'super_admin' || eff.role === 'faculty'
        ? db
            .select({ id: students.id, usn: students.usn, name: profiles.fullName })
            .from(students)
            .innerJoin(profiles, eq(students.profileId, profiles.id))
            .where(and(isNull(students.deletedAt), or(ilike(students.usn, pattern), ilike(profiles.fullName, pattern))))
            .limit(6)
        : Promise.resolve([]),
    ]);

    const results = [
      ...stuRows.map((s) => ({ type: 'student', id: s.id, title: s.name, subtitle: `USN ${s.usn}`, tab: 'students' })),
      ...subjRows.map((s) => ({ type: 'subject', id: s.id, title: s.name, subtitle: s.code, tab: 'courses' })),
      ...facRows.map((f) => ({ type: 'faculty', id: f.id, title: f.name, subtitle: `${f.code} · ${f.designation}`, tab: 'faculty' })),
      ...examRows.map((e) => ({ type: 'exam', id: e.id, title: e.name, subtitle: `Scheduled ${e.date}`, tab: 'exams' })),
      ...annRows.map((a) => ({ type: 'announcement', id: a.id, title: a.title, subtitle: `Priority: ${a.priority}`, tab: 'announcements' })),
    ];

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

coreRouter.get('/reference-data', async (_req: AuthRequest, res) => {
  try {
    await ensureSeedData();
    const [
      years,
      sems,
      depts,
      progs,
      courseRows,
      secs,
      rooms,
      subjs,
      facList,
      assignments,
    ] = await Promise.all([
      db
        .select()
        .from(academicYears)
        .where(isNull(academicYears.deletedAt))
        .orderBy(desc(academicYears.code)),
      db.select().from(semesters).where(isNull(semesters.deletedAt)),
      db.select().from(departments).where(isNull(departments.deletedAt)),
      db.select().from(programs).where(isNull(programs.deletedAt)),
      db.select().from(courses).where(isNull(courses.deletedAt)),
      db.select().from(sections).where(isNull(sections.deletedAt)),
      db.select().from(classrooms).where(isNull(classrooms.deletedAt)),
      db.select().from(subjects).where(isNull(subjects.deletedAt)),
      db
        .select({
          id: faculty.id,
          profileId: faculty.profileId,
          employeeCode: faculty.employeeCode,
          designation: faculty.designation,
          qualification: faculty.qualification,
          specialization: faculty.specialization,
          departmentId: faculty.departmentId,
          email: faculty.email,
          phone: faculty.phone,
          officeRoom: faculty.officeRoom,
          joiningDate: faculty.joiningDate,
          status: faculty.status,
          fullName: profiles.fullName,
          avatarUrl: profiles.avatarUrl,
        })
        .from(faculty)
        .innerJoin(profiles, eq(faculty.profileId, profiles.id))
        .where(isNull(faculty.deletedAt)),
      db
        .select()
        .from(subjectFacultyAssignments)
        .where(isNull(subjectFacultyAssignments.deletedAt)),
    ]);

    res.json({
      academicYears: years,
      semesters: sems,
      departments: depts,
      programs: progs,
      courses: courseRows,
      sections: secs,
      classrooms: rooms,
      subjects: subjs,
      faculty: facList,
      subjectFacultyAssignments: assignments,
    });
  } catch (error) {
    console.error('Failed to fetch reference data:', error);
    res.status(500).json({ error: 'Failed to load academic reference data' });
  }
});

// Create Academic Year (Non-destructive)
coreRouter.post(
  '/academic-years',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { code, label, startDate, endDate, setAsCurrent } = req.body as {
        code: string;
        label: string;
        startDate: string;
        endDate: string;
        setAsCurrent?: boolean;
      };
      if (!code || !label || !startDate || !endDate) {
        return res.status(400).json({ error: 'All academic year fields are required' });
      }
      const instId = await getActiveInstitutionId();

      const created = await db.transaction(async (tx) => {
        if (setAsCurrent) {
          await tx
            .update(academicYears)
            .set({ isCurrent: false })
            .where(eq(academicYears.institutionId, instId));
        }

        const [ay] = await tx
          .insert(academicYears)
          .values({
            institutionId: instId,
            code: code.trim(),
            label: label.trim(),
            startDate,
            endDate,
            isCurrent: Boolean(setAsCurrent),
            status: setAsCurrent ? 'active' : 'upcoming',
          })
          .returning();

        // Auto-create odd & even semesters for the new academic year
        await tx.insert(semesters).values([
          {
            academicYearId: ay.id,
            number: 1,
            name: `Odd Term (${code.trim()})`,
            termType: 'odd',
            startDate,
            endDate,
            isActive: Boolean(setAsCurrent),
          },
          {
            academicYearId: ay.id,
            number: 2,
            name: `Even Term (${code.trim()})`,
            termType: 'even',
            startDate,
            endDate,
            isActive: false,
          },
        ]);
        return ay;
      });

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'ACADEMIC_YEAR_CREATE',
        entityType: 'academic_years',
        entityId: created.id,
        afterState: created,
        reason: `Created academic year ${created.code} without overwriting prior records.`,
      });

      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to create academic year';
      if (msg.includes('uq_academic_years_inst_code') || msg.includes('unique')) {
        return res.status(409).json({ error: 'Academic year code already exists' });
      }
      res.status(500).json({ error: 'Failed to create academic year' });
    }
  }
);

// Cohort Promotion across Academic Years (Transactional)
coreRouter.post(
  '/academic-years/promote',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const {
        fromAcademicYearId,
        fromSemesterId,
        toAcademicYearId,
        toSemesterId,
        toSectionId,
      } = req.body as {
        fromAcademicYearId: number;
        fromSemesterId: number;
        toAcademicYearId: number;
        toSemesterId: number;
        toSectionId: number;
      };

      if (
        !fromAcademicYearId ||
        !fromSemesterId ||
        !toAcademicYearId ||
        !toSemesterId ||
        !toSectionId
      ) {
        return res
          .status(400)
          .json({ error: 'Source and target year, semester, and section are required' });
      }

      const result = await db.transaction(async (tx) => {
        const sourceEnrollments = await tx
          .select()
          .from(studentEnrollments)
          .where(
            and(
              eq(studentEnrollments.academicYearId, fromAcademicYearId),
              eq(studentEnrollments.semesterId, fromSemesterId),
              eq(studentEnrollments.enrollmentStatus, 'enrolled')
            )
          );

        if (sourceEnrollments.length === 0) {
          return { promotedCount: 0 };
        }

        const [targetSem] = await tx
          .select()
          .from(semesters)
          .where(eq(semesters.id, toSemesterId));

        let promotedCount = 0;
        for (const enr of sourceEnrollments) {
          await tx
            .update(studentEnrollments)
            .set({ enrollmentStatus: 'promoted', updatedAt: new Date() })
            .where(eq(studentEnrollments.id, enr.id));

          await tx
            .insert(studentEnrollments)
            .values({
              studentId: enr.studentId,
              academicYearId: toAcademicYearId,
              semesterId: toSemesterId,
              programId: enr.programId,
              sectionId: toSectionId,
              rollNumber: enr.rollNumber,
              enrollmentStatus: 'enrolled',
              promotedFromEnrollmentId: enr.id,
            })
            .onConflictDoNothing();

          // Assign matching fee structure for the new academic year if configured
          if (targetSem) {
            const [feeStruct] = await tx
              .select()
              .from(feeStructures)
              .where(
                and(
                  eq(feeStructures.academicYearId, toAcademicYearId),
                  eq(feeStructures.programId, enr.programId)
                )
              )
              .limit(1);

            if (feeStruct) {
              await tx
                .insert(studentFeeAssignments)
                .values({
                  studentId: enr.studentId,
                  academicYearId: toAcademicYearId,
                  feeStructureId: feeStruct.id,
                  grossAmount: feeStruct.totalAmount,
                  scholarshipDiscount: 0,
                  netPayable: feeStruct.totalAmount,
                  paidAmount: 0,
                  balanceDue: feeStruct.totalAmount,
                  status: 'pending',
                  dueDate: feeStruct.dueDate,
                })
                .onConflictDoNothing();
            }
          }
          promotedCount++;
        }

        return { promotedCount };
      });

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'COHORT_PROMOTION',
        entityType: 'student_enrollments',
        entityId: `${fromAcademicYearId}->${toAcademicYearId}`,
        afterState: result,
        reason: 'Promoted cohort to next academic year preserving historical records.',
      });

      res.json(result);
    } catch (error) {
      console.error('Cohort promotion failed:', error);
      res.status(500).json({ error: 'Cohort promotion transaction failed' });
    }
  }
);

// Create Department
coreRouter.post(
  '/departments',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { code, name, hodName, building } = req.body;
      if (!code || !name) {
        return res.status(400).json({ error: 'Department code and name are required' });
      }
      const instId = await getActiveInstitutionId();
      const [created] = await db
        .insert(departments)
        .values({
          institutionId: instId,
          code: String(code).trim().toUpperCase(),
          name: String(name).trim(),
          hodName: hodName || null,
          building: building || null,
        })
        .returning();

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'DEPARTMENT_CREATE',
        entityType: 'departments',
        entityId: created.id,
        afterState: created,
      });

      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('unique')) {
        return res.status(409).json({ error: 'Department code already exists' });
      }
      res.status(500).json({ error: 'Failed to create department' });
    }
  }
);

// Create Subject
coreRouter.post(
  '/subjects',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { departmentId, programId, semesterNumber, code, name, credits, subjectType, syllabusSummary } =
        req.body;
      if (!departmentId || !programId || !semesterNumber || !code || !name) {
        return res.status(400).json({ error: 'Missing required subject fields' });
      }
      const [created] = await db
        .insert(subjects)
        .values({
          departmentId: Number(departmentId),
          programId: Number(programId),
          semesterNumber: Number(semesterNumber),
          code: String(code).trim().toUpperCase(),
          name: String(name).trim(),
          credits: Number(credits || 4),
          subjectType: subjectType || 'theory',
          syllabusSummary: syllabusSummary || null,
          studyMaterialsJson: [],
        })
        .returning();

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'SUBJECT_CREATE',
        entityType: 'subjects',
        entityId: created.id,
        afterState: created,
      });

      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('unique')) {
        return res.status(409).json({ error: 'Subject code already exists' });
      }
      res.status(500).json({ error: 'Failed to create subject' });
    }
  }
);

// Upload / Attach Study Material (Faculty or Admin)
coreRouter.post(
  '/subjects/:id/materials',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { title, moduleLabel, fileName, url } = req.body;
      if (!title || !fileName) {
        return res.status(400).json({ error: 'Material title and file name are required' });
      }

      const [subj] = await db
        .select()
        .from(subjects)
        .where(eq(subjects.id, subjectId));
      if (!subj) {
        return res.status(404).json({ error: 'Subject not found' });
      }

      const existing = subj.studyMaterialsJson || [];
      const newMat = {
        id: `mat-${Date.now()}`,
        title: String(title).trim(),
        moduleLabel: String(moduleLabel || 'General').trim(),
        fileName: String(fileName).trim(),
        uploadedBy: req.effectiveProfile!.fullName,
        uploadedAt: new Date().toISOString().slice(0, 10),
        url: url ? String(url).trim() : `#material-${Date.now()}`,
      };

      const [updated] = await db
        .update(subjects)
        .set({
          studyMaterialsJson: [...existing, newMat],
          updatedAt: new Date(),
        })
        .where(eq(subjects.id, subjectId))
        .returning();

      res.status(201).json(updated);
    } catch (error) {
      console.error('Failed to add study material:', error);
      res.status(500).json({ error: 'Failed to attach study material' });
    }
  }
);

// Assign Faculty to Subject & Section (prevents duplicates)
coreRouter.post(
  '/subject-assignments',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { academicYearId, semesterId, subjectId, facultyId, sectionId } = req.body;
      if (!academicYearId || !semesterId || !subjectId || !facultyId || !sectionId) {
        return res.status(400).json({ error: 'All assignment fields are required' });
      }

      const [created] = await db
        .insert(subjectFacultyAssignments)
        .values({
          academicYearId: Number(academicYearId),
          semesterId: Number(semesterId),
          subjectId: Number(subjectId),
          facultyId: Number(facultyId),
          sectionId: Number(sectionId),
          isPrimary: true,
        })
        .returning();

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'FACULTY_SUBJECT_ASSIGN',
        entityType: 'subject_faculty_assignments',
        entityId: created.id,
        afterState: created,
      });

      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('uq_sfa_year_sem_subj_sec') || msg.includes('unique')) {
        return res.status(409).json({
          error: 'A faculty member is already assigned to this subject and section for this semester.',
        });
      }
      res.status(500).json({ error: 'Failed to assign faculty to subject' });
    }
  }
);

// Create Classroom
coreRouter.post(
  '/classrooms',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { roomCode, building, floor, capacity, roomType, hasSmartBoard } = req.body;
      if (!roomCode || !building || !floor) {
        return res.status(400).json({ error: 'Room code, building, and floor are required' });
      }
      const instId = await getActiveInstitutionId();
      const [created] = await db
        .insert(classrooms)
        .values({
          institutionId: instId,
          roomCode: String(roomCode).trim().toUpperCase(),
          building: String(building).trim(),
          floor: String(floor).trim(),
          capacity: Number(capacity || 60),
          roomType: roomType || 'lecture_hall',
          hasSmartBoard: hasSmartBoard !== false,
        })
        .returning();
      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('unique')) {
        return res.status(409).json({ error: 'Classroom code already exists' });
      }
      res.status(500).json({ error: 'Failed to create classroom' });
    }
  }
);

// Timetables & Conflict-Checked Slots
coreRouter.get('/timetables', async (req: AuthRequest, res) => {
  try {
    const academicYearId = req.query.academicYearId
      ? Number(req.query.academicYearId)
      : undefined;

    const ttList = academicYearId
      ? await db
          .select()
          .from(timetables)
          .where(
            and(
              eq(timetables.academicYearId, academicYearId),
              isNull(timetables.deletedAt)
            )
          )
      : await db.select().from(timetables).where(isNull(timetables.deletedAt));

    const slotRows = await db
      .select({
        id: timetableSlots.id,
        timetableId: timetableSlots.timetableId,
        subjectId: timetableSlots.subjectId,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        facultyId: timetableSlots.facultyId,
        facultyName: profiles.fullName,
        classroomId: timetableSlots.classroomId,
        roomCode: classrooms.roomCode,
        dayOfWeek: timetableSlots.dayOfWeek,
        periodNumber: timetableSlots.periodNumber,
        startTime: timetableSlots.startTime,
        endTime: timetableSlots.endTime,
        slotType: timetableSlots.slotType,
      })
      .from(timetableSlots)
      .innerJoin(subjects, eq(timetableSlots.subjectId, subjects.id))
      .innerJoin(faculty, eq(timetableSlots.facultyId, faculty.id))
      .innerJoin(profiles, eq(faculty.profileId, profiles.id))
      .innerJoin(classrooms, eq(timetableSlots.classroomId, classrooms.id))
      .where(isNull(timetableSlots.deletedAt));

    res.json({ timetables: ttList, slots: slotRows });
  } catch (error) {
    console.error('Failed to fetch timetables:', error);
    res.status(500).json({ error: 'Failed to load timetables' });
  }
});

coreRouter.post(
  '/timetables/slots',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const {
        timetableId,
        subjectId,
        facultyId,
        classroomId,
        dayOfWeek,
        periodNumber,
        startTime,
        endTime,
        slotType,
      } = req.body;

      if (
        !timetableId ||
        !subjectId ||
        !facultyId ||
        !classroomId ||
        !dayOfWeek ||
        !periodNumber ||
        !startTime ||
        !endTime
      ) {
        return res.status(400).json({ error: 'All timetable slot fields are required' });
      }

      // Conflict Check 1: Faculty already scheduled on same dayOfWeek & periodNumber
      const facultyConflict = await db
        .select({ id: timetableSlots.id })
        .from(timetableSlots)
        .where(
          and(
            eq(timetableSlots.facultyId, Number(facultyId)),
            eq(timetableSlots.dayOfWeek, Number(dayOfWeek)),
            eq(timetableSlots.periodNumber, Number(periodNumber)),
            isNull(timetableSlots.deletedAt)
          )
        );
      if (facultyConflict.length > 0) {
        return res.status(409).json({
          error: 'Schedule conflict: Faculty is already assigned to another class during this day and period.',
        });
      }

      // Conflict Check 2: Classroom already occupied
      const roomConflict = await db
        .select({ id: timetableSlots.id })
        .from(timetableSlots)
        .where(
          and(
            eq(timetableSlots.classroomId, Number(classroomId)),
            eq(timetableSlots.dayOfWeek, Number(dayOfWeek)),
            eq(timetableSlots.periodNumber, Number(periodNumber)),
            isNull(timetableSlots.deletedAt)
          )
        );
      if (roomConflict.length > 0) {
        return res.status(409).json({
          error: 'Schedule conflict: Classroom is already booked for this day and period.',
        });
      }

      const [created] = await db
        .insert(timetableSlots)
        .values({
          timetableId: Number(timetableId),
          subjectId: Number(subjectId),
          facultyId: Number(facultyId),
          classroomId: Number(classroomId),
          dayOfWeek: Number(dayOfWeek),
          periodNumber: Number(periodNumber),
          startTime: String(startTime),
          endTime: String(endTime),
          slotType: slotType || 'lecture',
        })
        .returning();

      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('uq_slot_timetable_day_period') || msg.includes('unique')) {
        return res.status(409).json({
          error: 'This section already has a class scheduled in this day and period.',
        });
      }
      res.status(500).json({ error: 'Failed to create timetable slot' });
    }
  }
);

// Examinations & Results
coreRouter.get('/examinations', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const examList = await db
      .select({
        id: examinations.id,
        academicYearId: examinations.academicYearId,
        academicYearCode: academicYears.code,
        semesterId: examinations.semesterId,
        semesterName: semesters.name,
        departmentId: examinations.departmentId,
        subjectId: examinations.subjectId,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        examName: examinations.examName,
        examType: examinations.examType,
        examDate: examinations.examDate,
        startTime: examinations.startTime,
        endTime: examinations.endTime,
        maxMarks: examinations.maxMarks,
        passingMarks: examinations.passingMarks,
        roomCode: classrooms.roomCode,
      })
      .from(examinations)
      .innerJoin(academicYears, eq(examinations.academicYearId, academicYears.id))
      .innerJoin(semesters, eq(examinations.semesterId, semesters.id))
      .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
      .leftJoin(classrooms, eq(examinations.classroomId, classrooms.id))
      .where(isNull(examinations.deletedAt))
      .orderBy(desc(examinations.examDate));

    let resultsQuery = db
      .select({
        id: examinationResults.id,
        examinationId: examinationResults.examinationId,
        examName: examinations.examName,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        academicYearId: examinationResults.academicYearId,
        academicYearCode: academicYears.code,
        semesterName: semesters.name,
        studentId: examinationResults.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        marksObtained: examinationResults.marksObtained,
        maxMarks: examinations.maxMarks,
        grade: examinationResults.grade,
        gradePoints: examinationResults.gradePoints,
        status: examinationResults.status,
        remarks: examinationResults.remarks,
      })
      .from(examinationResults)
      .innerJoin(examinations, eq(examinationResults.examinationId, examinations.id))
      .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
      .innerJoin(academicYears, eq(examinationResults.academicYearId, academicYears.id))
      .innerJoin(semesters, eq(examinationResults.semesterId, semesters.id))
      .innerJoin(students, eq(examinationResults.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id));

    const allResults = await resultsQuery;
    const filteredResults = allResults.filter((r) => {
      if (eff.role === 'super_admin' || eff.role === 'faculty') return true;
      if (eff.role === 'student') return r.studentId === eff.studentId;
      if (eff.role === 'parent') return eff.linkedStudentIds.includes(r.studentId);
      return false;
    });

    res.json({ examinations: examList, results: filteredResults });
  } catch (error) {
    console.error('Failed to fetch examinations:', error);
    res.status(500).json({ error: 'Failed to load examinations' });
  }
});

coreRouter.post(
  '/examinations',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const {
        academicYearId,
        semesterId,
        departmentId,
        subjectId,
        examName,
        examType,
        examDate,
        startTime,
        endTime,
        maxMarks,
        passingMarks,
        classroomId,
      } = req.body;

      if (!academicYearId || !semesterId || !departmentId || !subjectId || !examName || !examDate) {
        return res.status(400).json({ error: 'Required examination fields missing' });
      }

      const [created] = await db
        .insert(examinations)
        .values({
          academicYearId: Number(academicYearId),
          semesterId: Number(semesterId),
          departmentId: Number(departmentId),
          subjectId: Number(subjectId),
          examName: String(examName).trim(),
          examType: examType || 'ia_2',
          examDate,
          startTime: startTime || '09:30',
          endTime: endTime || '11:00',
          maxMarks: Number(maxMarks || 50),
          passingMarks: Number(passingMarks || 20),
          classroomId: classroomId ? Number(classroomId) : null,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      console.error('Failed to schedule examination:', error);
      res.status(500).json({ error: 'Failed to schedule examination' });
    }
  }
);

coreRouter.post(
  '/examination-results',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const { examinationId, studentId, marksObtained, remarks } = req.body;
      const [exam] = await db
        .select()
        .from(examinations)
        .where(eq(examinations.id, Number(examinationId)));
      if (!exam) {
        return res.status(404).json({ error: 'Examination not found' });
      }

      const marks = Number(marksObtained);
      const pct = (marks / exam.maxMarks) * 100;
      const grade =
        pct >= 90 ? 'O' : pct >= 80 ? 'A+' : pct >= 70 ? 'A' : pct >= 60 ? 'B+' : pct >= 50 ? 'B' : pct >= 40 ? 'C' : 'F';
      const gradePoints =
        pct >= 90 ? '10.00' : pct >= 80 ? '9.00' : pct >= 70 ? '8.00' : pct >= 60 ? '7.00' : pct >= 50 ? '6.00' : pct >= 40 ? '5.00' : '0.00';
      const status = marks >= exam.passingMarks ? 'pass' : 'fail';

      const [result] = await db
        .insert(examinationResults)
        .values({
          examinationId: exam.id,
          studentId: Number(studentId),
          academicYearId: exam.academicYearId,
          semesterId: exam.semesterId,
          marksObtained: marks.toFixed(2),
          grade,
          gradePoints,
          status,
          remarks: remarks || null,
        })
        .onConflictDoUpdate({
          target: [examinationResults.examinationId, examinationResults.studentId],
          set: {
            marksObtained: marks.toFixed(2),
            grade,
            gradePoints,
            status,
            remarks: remarks || null,
            updatedAt: new Date(),
          },
        })
        .returning();

      res.status(201).json(result);
    } catch (error) {
      console.error('Failed to publish exam result:', error);
      res.status(500).json({ error: 'Failed to save examination result' });
    }
  }
);

// Interactive ER Diagram & Schema Metadata
coreRouter.get('/er-schema', async (_req: AuthRequest, res) => {
  try {
    res.json({
      totalTables: ER_SCHEMA_METADATA.length,
      tables: ER_SCHEMA_METADATA,
      rlsSql: POSTGRES_RLS_SQL,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load ER schema metadata' });
  }
});
