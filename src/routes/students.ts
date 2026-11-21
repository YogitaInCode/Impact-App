import { Router } from 'express';
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  academicYears,
  alumniProfiles,
  assessmentComponents,
  attendanceRecords,
  auditLogs,
  consentRecords,
  departments,
  examinationResults,
  examinations,
  faculty,
  feePayments,
  hostelAllocations,
  libraryTransactions,
  parents,
  placementApplications,
  profiles,
  programs,
  revaluationRequests,
  sections,
  semesterResultSummaries,
  semesters,
  studentAchievements,
  studentAddresses,
  studentAdmissionHistory,
  studentAssessmentMarks,
  studentBacklogs,
  studentDocuments,
  studentEmergencyContacts,
  studentEnrollments,
  studentFeeAssignments,
  studentInternships,
  studentLeaveRequests,
  studentParentLinks,
  studentProjects,
  studentQualifications,
  students,
  subjects,
  transportAllocations,
} from '../db/schema.ts';
import { getActiveInstitutionId } from '../db/seed.ts';
import {
  AuthRequest,
  assertStudentAccess,
  inArray,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';
import { recordAuditLog } from '../services/audit.ts';

export const studentsRouter = Router();

studentsRouter.use(requireAuth);

// List Students (Strictly role-scoped!)
studentsRouter.get('/', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const q = (req.query.q as string | undefined)?.trim();
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const academicYearId = req.query.academicYearId ? Number(req.query.academicYearId) : undefined;
    const semesterId = req.query.semesterId ? Number(req.query.semesterId) : undefined;

    if (eff.role === 'student' && !eff.studentId) {
      return res.json({ students: [] });
    }
    if (eff.role === 'parent' && eff.linkedStudentIds.length === 0) {
      return res.json({ students: [] });
    }

    const baseRows = await db
      .select({
        id: students.id,
        profileId: students.profileId,
        usn: students.usn,
        admissionNumber: students.admissionNumber,
        admissionYear: students.admissionYear,
        fullName: profiles.fullName,
        email: students.email,
        phone: students.phone,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        address: students.address,
        departmentId: students.departmentId,
        departmentCode: departments.code,
        departmentName: departments.name,
        programId: students.programId,
        programCode: programs.code,
        programName: programs.name,
        academicStatus: students.academicStatus,
        biometricEnrolled: students.biometricEnrolled,
        profilePhotoUrl: students.profilePhotoUrl,
        emergencyContactName: students.emergencyContactName,
        emergencyContactPhone: students.emergencyContactPhone,
      })
      .from(students)
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(departments, eq(students.departmentId, departments.id))
      .innerJoin(programs, eq(students.programId, programs.id))
      .where(
        and(
          isNull(students.deletedAt),
          departmentId ? eq(students.departmentId, departmentId) : undefined,
          eff.role === 'student' ? eq(students.id, eff.studentId!) : undefined,
          eff.role === 'parent' ? inArray(students.id, eff.linkedStudentIds) : undefined,
          q
            ? or(
                ilike(students.usn, `%${q}%`),
                ilike(profiles.fullName, `%${q}%`),
                ilike(students.admissionNumber, `%${q}%`),
                ilike(students.email, `%${q}%`)
              )
            : undefined
        )
      )
      .orderBy(students.usn);

    // Fetch enrollments to enrich with current semester & section
    const enrollmentRows = await db
      .select({
        studentId: studentEnrollments.studentId,
        academicYearId: studentEnrollments.academicYearId,
        academicYearCode: academicYears.code,
        semesterId: studentEnrollments.semesterId,
        semesterNumber: semesters.number,
        semesterName: semesters.name,
        sectionId: studentEnrollments.sectionId,
        sectionName: sections.name,
        rollNumber: studentEnrollments.rollNumber,
        enrollmentStatus: studentEnrollments.enrollmentStatus,
      })
      .from(studentEnrollments)
      .innerJoin(academicYears, eq(studentEnrollments.academicYearId, academicYears.id))
      .innerJoin(semesters, eq(studentEnrollments.semesterId, semesters.id))
      .innerJoin(sections, eq(studentEnrollments.sectionId, sections.id));

    const enriched = baseRows
      .map((stu) => {
        const stuEnrolls = enrollmentRows.filter((e) => e.studentId === stu.id);
        const matchingYearEnroll = academicYearId
          ? stuEnrolls.find((e) => e.academicYearId === academicYearId)
          : stuEnrolls.find((e) => e.enrollmentStatus === 'enrolled') || stuEnrolls[0];

        return {
          ...stu,
          currentEnrollment: matchingYearEnroll || null,
          enrollments: stuEnrolls,
        };
      })
      .filter((stu) => {
        if (semesterId && stu.currentEnrollment?.semesterId !== semesterId) {
          return false;
        }
        return true;
      });

    res.json({ students: enriched });
  } catch (error) {
    console.error('Error listing students:', error);
    res.status(500).json({ error: 'Failed to load students' });
  }
});

// Unified 17-Section Student 360° Profile & Complete Lifecycle History
studentsRouter.get('/:id', async (req: AuthRequest, res) => {
  try {
    const studentId = Number(req.params.id);
    if (!Number.isFinite(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const allowed = await assertStudentAccess(req, studentId);
    if (!allowed) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to view this student record.',
      });
    }

    const [stu] = await db
      .select({
        id: students.id,
        profileId: students.profileId,
        usn: students.usn,
        admissionNumber: students.admissionNumber,
        admissionYear: students.admissionYear,
        fullName: profiles.fullName,
        email: students.email,
        phone: students.phone,
        gender: students.gender,
        dateOfBirth: students.dateOfBirth,
        address: students.address,
        departmentId: students.departmentId,
        departmentCode: departments.code,
        departmentName: departments.name,
        programId: students.programId,
        programCode: programs.code,
        programName: programs.name,
        academicStatus: students.academicStatus,
        biometricEnrolled: students.biometricEnrolled,
        profilePhotoUrl: students.profilePhotoUrl,
        admissionDocsJson: students.admissionDocsJson,
        previousAcademicRecordsJson: students.previousAcademicRecordsJson,
        emergencyContactName: students.emergencyContactName,
        emergencyContactPhone: students.emergencyContactPhone,
        createdAt: students.createdAt,
      })
      .from(students)
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(departments, eq(students.departmentId, departments.id))
      .innerJoin(programs, eq(students.programId, programs.id))
      .where(and(eq(students.id, studentId), isNull(students.deletedAt)));

    if (!stu) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const eff = req.effectiveProfile!;
    const onlyPublishedMarks = eff.role === 'student' || eff.role === 'parent';

    const [
      enrollments,
      attRows,
      examRows,
      feeRows,
      paymentRows,
      consents,
      addresses,
      emergencyContacts,
      qualifications,
      documents,
      admissionHistoryRows,
      assessmentMarks,
      semesterSummaries,
      backlogs,
      revaluations,
      achievements,
      projects,
      internships,
      placements,
      leaveRequests,
      libraryRows,
      transportRows,
      hostelRows,
      alumniRows,
      parentLinks,
      activityLogs,
    ] = await Promise.all([
      db
        .select({
          id: studentEnrollments.id,
          academicYearId: studentEnrollments.academicYearId,
          academicYearCode: academicYears.code,
          semesterId: studentEnrollments.semesterId,
          semesterNumber: semesters.number,
          semesterName: semesters.name,
          sectionId: studentEnrollments.sectionId,
          sectionName: sections.name,
          rollNumber: studentEnrollments.rollNumber,
          enrollmentStatus: studentEnrollments.enrollmentStatus,
          enrolledAt: studentEnrollments.enrolledAt,
        })
        .from(studentEnrollments)
        .innerJoin(academicYears, eq(studentEnrollments.academicYearId, academicYears.id))
        .innerJoin(semesters, eq(studentEnrollments.semesterId, semesters.id))
        .innerJoin(sections, eq(studentEnrollments.sectionId, sections.id))
        .where(eq(studentEnrollments.studentId, studentId))
        .orderBy(desc(academicYears.code)),
      db
        .select({
          id: attendanceRecords.id,
          subjectId: attendanceRecords.subjectId,
          subjectCode: subjects.code,
          subjectName: subjects.name,
          academicYearId: attendanceRecords.academicYearId,
          status: attendanceRecords.status,
          verificationMethod: attendanceRecords.verificationMethod,
          markedAt: attendanceRecords.markedAt,
        })
        .from(attendanceRecords)
        .innerJoin(subjects, eq(attendanceRecords.subjectId, subjects.id))
        .where(eq(attendanceRecords.studentId, studentId)),
      db
        .select({
          id: examinationResults.id,
          examName: examinations.examName,
          examType: examinations.examType,
          subjectCode: subjects.code,
          subjectName: subjects.name,
          academicYearCode: academicYears.code,
          marksObtained: examinationResults.marksObtained,
          maxMarks: examinations.maxMarks,
          grade: examinationResults.grade,
          gradePoints: examinationResults.gradePoints,
          status: examinationResults.status,
        })
        .from(examinationResults)
        .innerJoin(examinations, eq(examinationResults.examinationId, examinations.id))
        .innerJoin(subjects, eq(examinations.subjectId, subjects.id))
        .innerJoin(academicYears, eq(examinationResults.academicYearId, academicYears.id))
        .where(eq(examinationResults.studentId, studentId)),
      db
        .select({
          id: studentFeeAssignments.id,
          academicYearCode: academicYears.code,
          grossAmount: studentFeeAssignments.grossAmount,
          scholarshipDiscount: studentFeeAssignments.scholarshipDiscount,
          netPayable: studentFeeAssignments.netPayable,
          paidAmount: studentFeeAssignments.paidAmount,
          balanceDue: studentFeeAssignments.balanceDue,
          status: studentFeeAssignments.status,
          dueDate: studentFeeAssignments.dueDate,
        })
        .from(studentFeeAssignments)
        .innerJoin(academicYears, eq(studentFeeAssignments.academicYearId, academicYears.id))
        .where(eq(studentFeeAssignments.studentId, studentId))
        .orderBy(desc(academicYears.code)),
      db
        .select({
          id: feePayments.id,
          receiptNumber: feePayments.receiptNumber,
          amountPaid: feePayments.amountPaid,
          paymentDate: feePayments.paymentDate,
          paymentMode: feePayments.paymentMode,
          academicYearCode: academicYears.code,
        })
        .from(feePayments)
        .innerJoin(academicYears, eq(feePayments.academicYearId, academicYears.id))
        .where(eq(feePayments.studentId, studentId))
        .orderBy(desc(feePayments.paymentDate)),
      db
        .select()
        .from(consentRecords)
        .where(eq(consentRecords.studentId, studentId))
        .orderBy(desc(consentRecords.createdAt)),
      db.select().from(studentAddresses).where(eq(studentAddresses.studentId, studentId)),
      db
        .select()
        .from(studentEmergencyContacts)
        .where(eq(studentEmergencyContacts.studentId, studentId)),
      db
        .select()
        .from(studentQualifications)
        .where(eq(studentQualifications.studentId, studentId))
        .orderBy(desc(studentQualifications.passingYear)),
      db
        .select()
        .from(studentDocuments)
        .where(eq(studentDocuments.studentId, studentId))
        .orderBy(desc(studentDocuments.createdAt)),
      db
        .select()
        .from(studentAdmissionHistory)
        .where(eq(studentAdmissionHistory.studentId, studentId)),
      db
        .select({
          id: studentAssessmentMarks.id,
          subjectCode: subjects.code,
          subjectName: subjects.name,
          academicYearCode: academicYears.code,
          semesterNumber: semesters.number,
          componentCode: assessmentComponents.code,
          componentName: assessmentComponents.name,
          componentCategory: assessmentComponents.category,
          marksObtained: studentAssessmentMarks.marksObtained,
          maxMarks: studentAssessmentMarks.maxMarks,
          workflowStatus: studentAssessmentMarks.workflowStatus,
        })
        .from(studentAssessmentMarks)
        .innerJoin(subjects, eq(studentAssessmentMarks.subjectId, subjects.id))
        .innerJoin(academicYears, eq(studentAssessmentMarks.academicYearId, academicYears.id))
        .innerJoin(semesters, eq(studentAssessmentMarks.semesterId, semesters.id))
        .innerJoin(assessmentComponents, eq(studentAssessmentMarks.componentId, assessmentComponents.id))
        .where(
          and(
            eq(studentAssessmentMarks.studentId, studentId),
            onlyPublishedMarks ? eq(studentAssessmentMarks.workflowStatus, 'published') : undefined
          )
        ),
      db
        .select({
          id: semesterResultSummaries.id,
          academicYearCode: academicYears.code,
          semesterNumber: semesters.number,
          semesterName: semesters.name,
          totalCreditsRegistered: semesterResultSummaries.totalCreditsRegistered,
          totalCreditsEarned: semesterResultSummaries.totalCreditsEarned,
          sgpa: semesterResultSummaries.sgpa,
          cgpa: semesterResultSummaries.cgpa,
          percentage: semesterResultSummaries.percentage,
          resultStatus: semesterResultSummaries.resultStatus,
          backlogCount: semesterResultSummaries.backlogCount,
          isPublished: semesterResultSummaries.isPublished,
        })
        .from(semesterResultSummaries)
        .innerJoin(academicYears, eq(semesterResultSummaries.academicYearId, academicYears.id))
        .innerJoin(semesters, eq(semesterResultSummaries.semesterId, semesters.id))
        .where(
          and(
            eq(semesterResultSummaries.studentId, studentId),
            onlyPublishedMarks ? eq(semesterResultSummaries.isPublished, true) : undefined
          )
        )
        .orderBy(semesters.number),
      db
        .select({
          id: studentBacklogs.id,
          subjectCode: subjects.code,
          subjectName: subjects.name,
          academicYearCode: academicYears.code,
          semesterNumber: semesters.number,
          originalMarks: studentBacklogs.originalMarks,
          attemptNumber: studentBacklogs.attemptNumber,
          makeupExamDate: studentBacklogs.makeupExamDate,
          makeupMarks: studentBacklogs.makeupMarks,
          status: studentBacklogs.status,
          remarks: studentBacklogs.remarks,
        })
        .from(studentBacklogs)
        .innerJoin(subjects, eq(studentBacklogs.subjectId, subjects.id))
        .innerJoin(academicYears, eq(studentBacklogs.academicYearId, academicYears.id))
        .innerJoin(semesters, eq(studentBacklogs.semesterId, semesters.id))
        .where(eq(studentBacklogs.studentId, studentId)),
      db
        .select({
          id: revaluationRequests.id,
          subjectCode: subjects.code,
          subjectName: subjects.name,
          requestType: revaluationRequests.requestType,
          originalMarks: revaluationRequests.originalMarks,
          revisedMarks: revaluationRequests.revisedMarks,
          status: revaluationRequests.status,
          reason: revaluationRequests.reason,
          reviewerNotes: revaluationRequests.reviewerNotes,
        })
        .from(revaluationRequests)
        .innerJoin(subjects, eq(revaluationRequests.subjectId, subjects.id))
        .where(eq(revaluationRequests.studentId, studentId)),
      db.select().from(studentAchievements).where(eq(studentAchievements.studentId, studentId)),
      db.select().from(studentProjects).where(eq(studentProjects.studentId, studentId)),
      db.select().from(studentInternships).where(eq(studentInternships.studentId, studentId)),
      db.select().from(placementApplications).where(eq(placementApplications.studentId, studentId)),
      db
        .select()
        .from(studentLeaveRequests)
        .where(eq(studentLeaveRequests.studentId, studentId))
        .orderBy(desc(studentLeaveRequests.createdAt)),
      db.select().from(libraryTransactions).where(eq(libraryTransactions.studentId, studentId)),
      db.select().from(transportAllocations).where(eq(transportAllocations.studentId, studentId)),
      db.select().from(hostelAllocations).where(eq(hostelAllocations.studentId, studentId)),
      db.select().from(alumniProfiles).where(eq(alumniProfiles.studentId, studentId)),
      db
        .select({
          id: studentParentLinks.id,
          relationship: studentParentLinks.relationship,
          isPrimaryContact: studentParentLinks.isPrimaryContact,
          isVerified: studentParentLinks.isVerified,
          parentName: parents.fullName,
          email: parents.email,
          phone: parents.phone,
          occupation: parents.occupation,
          address: parents.address,
        })
        .from(studentParentLinks)
        .innerJoin(parents, eq(studentParentLinks.parentId, parents.id))
        .where(eq(studentParentLinks.studentId, studentId)),
      db
        .select()
        .from(auditLogs)
        .where(
          or(
            eq(auditLogs.actorProfileId, stu.profileId),
            and(eq(auditLogs.entityType, 'students'), eq(auditLogs.entityId, String(studentId)))
          )
        )
        .orderBy(desc(auditLogs.createdAt))
        .limit(20),
    ]);

    res.json({
      student: stu,
      enrollments,
      attendanceRecords: attRows,
      examinationResults: examRows,
      feeAssignments: feeRows,
      feePayments: paymentRows,
      consentRecords: consents,
      addresses,
      emergencyContacts,
      qualifications,
      documents,
      admissionHistory: admissionHistoryRows[0] || null,
      assessmentMarks,
      semesterSummaries,
      backlogs,
      revaluations,
      achievements,
      projects,
      internships,
      placements,
      leaveRequests,
      libraryTransactions: libraryRows,
      transportAllocations: transportRows,
      hostelAllocations: hostelRows,
      alumniProfile: alumniRows[0] || null,
      parentLinks,
      activityLogs,
    });
  } catch (error) {
    console.error('Error fetching student 360:', error);
    res.status(500).json({ error: 'Failed to load student profile history' });
  }
});

// Add Student Address (Student self or Super Admin)
studentsRouter.post('/:id/addresses', async (req: AuthRequest, res) => {
  try {
    const studentId = Number(req.params.id);
    const eff = req.effectiveProfile!;
    if (!(eff.role === 'super_admin' || (eff.role === 'student' && eff.studentId === studentId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { addressType, line1, line2, city, state, pincode } = req.body;
    if (!line1 || !city || !state || !pincode) {
      return res.status(400).json({ error: 'Address line 1, city, state & pincode required' });
    }
    const [created] = await db
      .insert(studentAddresses)
      .values({
        studentId,
        addressType: addressType || 'current',
        line1: String(line1).trim(),
        line2: line2 || null,
        city: String(city).trim(),
        state: String(state).trim(),
        pincode: String(pincode).trim(),
        country: 'India',
        isPrimary: addressType === 'current',
      })
      .returning();
    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add address' });
  }
});

// Create Student (Super Admin Only - Transactional)
studentsRouter.post(
  '/',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        dateOfBirth,
        gender,
        address,
        emergencyContactName,
        emergencyContactPhone,
        usn,
        admissionNumber,
        admissionYear,
        departmentId,
        programId,
        academicYearId,
        semesterId,
        sectionId,
      } = req.body;

      if (
        !fullName ||
        !email ||
        !phone ||
        !dateOfBirth ||
        !usn ||
        !admissionNumber ||
        !departmentId ||
        !programId ||
        !academicYearId ||
        !semesterId ||
        !sectionId
      ) {
        return res.status(400).json({ error: 'All mandatory student fields are required' });
      }

      const instId = await getActiveInstitutionId();
      const normalizedUsn = String(usn).trim().toUpperCase();
      const normalizedAdm = String(admissionNumber).trim().toUpperCase();

      const created = await db.transaction(async (tx) => {
        const [profile] = await tx
          .insert(profiles)
          .values({
            uid: `stu-${normalizedUsn.toLowerCase()}-${Date.now()}`,
            email: String(email).trim().toLowerCase(),
            fullName: String(fullName).trim(),
            role: 'student',
            phone: String(phone).trim(),
            isDemoAccount: false,
            accountStatus: 'active',
          })
          .returning();

        const [student] = await tx
          .insert(students)
          .values({
            profileId: profile.id,
            institutionId: instId,
            departmentId: Number(departmentId),
            programId: Number(programId),
            usn: normalizedUsn,
            admissionNumber: normalizedAdm,
            admissionYear: Number(admissionYear || new Date().getFullYear()),
            dateOfBirth: String(dateOfBirth),
            gender: gender || null,
            email: String(email).trim().toLowerCase(),
            phone: String(phone).trim(),
            address: String(address || 'Bengaluru, Karnataka').trim(),
            emergencyContactName: String(emergencyContactName || 'Parent / Guardian').trim(),
            emergencyContactPhone: String(emergencyContactPhone || phone).trim(),
            academicStatus: 'active',
            biometricEnrolled: false,
          })
          .returning();

        await tx.insert(studentEnrollments).values({
          studentId: student.id,
          academicYearId: Number(academicYearId),
          semesterId: Number(semesterId),
          programId: Number(programId),
          sectionId: Number(sectionId),
          rollNumber: normalizedUsn.slice(-3),
          enrollmentStatus: 'enrolled',
        });

        return { profile, student };
      });

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'STUDENT_CREATE',
        entityType: 'students',
        entityId: created.student.id,
        afterState: { usn: normalizedUsn, fullName },
      });

      res.status(201).json(created.student);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('unique') || msg.includes('students_usn_unique')) {
        return res.status(409).json({
          error: 'Duplicate student blocked: USN or Admission Number already exists.',
        });
      }
      console.error('Failed to create student:', error);
      res.status(500).json({ error: 'Failed to create student record' });
    }
  }
);

// Update Student (Super Admin)
studentsRouter.patch(
  '/:id',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const studentId = Number(req.params.id);
      const { fullName, phone, address, academicStatus, departmentId, programId } = req.body;

      const [existing] = await db
        .select()
        .from(students)
        .where(eq(students.id, studentId));
      if (!existing) {
        return res.status(404).json({ error: 'Student not found' });
      }

      const updated = await db.transaction(async (tx) => {
        if (fullName || phone) {
          await tx
            .update(profiles)
            .set({
              ...(fullName ? { fullName: String(fullName).trim() } : {}),
              ...(phone ? { phone: String(phone).trim() } : {}),
              updatedAt: new Date(),
            })
            .where(eq(profiles.id, existing.profileId));
        }

        const [stu] = await tx
          .update(students)
          .set({
            ...(phone ? { phone: String(phone).trim() } : {}),
            ...(address ? { address: String(address).trim() } : {}),
            ...(academicStatus ? { academicStatus } : {}),
            ...(departmentId ? { departmentId: Number(departmentId) } : {}),
            ...(programId ? { programId: Number(programId) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(students.id, studentId))
          .returning();

        return stu;
      });

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'STUDENT_UPDATE',
        entityType: 'students',
        entityId: studentId,
        beforeState: existing,
        afterState: updated,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating student:', error);
      res.status(500).json({ error: 'Failed to update student' });
    }
  }
);

// Bulk CSV Import Students (Super Admin)
studentsRouter.post(
  '/bulk-import',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { rows, academicYearId, semesterId, sectionId, departmentId, programId } =
        req.body as {
          rows: {
            usn: string;
            admissionNumber: string;
            fullName: string;
            email: string;
            phone: string;
            dateOfBirth?: string;
            address?: string;
          }[];
          academicYearId: number;
          semesterId: number;
          sectionId: number;
          departmentId: number;
          programId: number;
        };

      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(400).json({ error: 'No CSV rows provided for import' });
      }

      const instId = await getActiveInstitutionId();
      let imported = 0;
      const skipped: { usn: string; reason: string }[] = [];

      for (const row of rows) {
        const usn = String(row.usn || '').trim().toUpperCase();
        const admissionNumber = String(row.admissionNumber || '').trim().toUpperCase();
        if (!usn || !admissionNumber || !row.fullName || !row.email) {
          skipped.push({ usn: usn || 'ROW', reason: 'Missing mandatory columns' });
          continue;
        }
        try {
          await db.transaction(async (tx) => {
            const [prof] = await tx
              .insert(profiles)
              .values({
                uid: `stu-csv-${usn.toLowerCase()}-${Date.now()}`,
                email: String(row.email).trim().toLowerCase(),
                fullName: String(row.fullName).trim(),
                role: 'student',
                phone: String(row.phone || '+91 99000 00000'),
                isDemoAccount: false,
              })
              .returning();

            const [stu] = await tx
              .insert(students)
              .values({
                profileId: prof.id,
                institutionId: instId,
                departmentId: Number(departmentId),
                programId: Number(programId),
                usn,
                admissionNumber,
                admissionYear: 2024,
                dateOfBirth: row.dateOfBirth || '2005-05-15',
                email: String(row.email).trim().toLowerCase(),
                phone: String(row.phone || '+91 99000 00000'),
                address: row.address || 'Bengaluru, Karnataka',
                emergencyContactName: 'Guardian',
                emergencyContactPhone: String(row.phone || '+91 99000 00000'),
              })
              .returning();

            await tx.insert(studentEnrollments).values({
              studentId: stu.id,
              academicYearId: Number(academicYearId),
              semesterId: Number(semesterId),
              programId: Number(programId),
              sectionId: Number(sectionId),
              rollNumber: usn.slice(-3),
              enrollmentStatus: 'enrolled',
            });
          });
          imported++;
        } catch (err: unknown) {
          skipped.push({
            usn,
            reason: err instanceof Error && err.message.includes('unique') ? 'Duplicate USN/Admission No' : 'Insert error',
          });
        }
      }

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'STUDENT_BULK_IMPORT',
        entityType: 'students',
        entityId: `batch-${Date.now()}`,
        afterState: { imported, skippedCount: skipped.length },
      });

      res.json({ imported, skipped });
    } catch (error) {
      console.error('Bulk import error:', error);
      res.status(500).json({ error: 'Bulk CSV import failed' });
    }
  }
);

// Create Faculty (Super Admin)
studentsRouter.post(
  '/faculty',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        departmentId,
        employeeCode,
        designation,
        qualification,
        specialization,
        officeRoom,
      } = req.body;

      if (!fullName || !email || !departmentId || !employeeCode || !designation) {
        return res.status(400).json({ error: 'Missing required faculty fields' });
      }
      const instId = await getActiveInstitutionId();

      const created = await db.transaction(async (tx) => {
        const [prof] = await tx
          .insert(profiles)
          .values({
            uid: `fac-${String(employeeCode).toLowerCase()}-${Date.now()}`,
            email: String(email).trim().toLowerCase(),
            fullName: String(fullName).trim(),
            role: 'faculty',
            phone: phone || null,
            isDemoAccount: false,
          })
          .returning();

        const [fac] = await tx
          .insert(faculty)
          .values({
            profileId: prof.id,
            institutionId: instId,
            departmentId: Number(departmentId),
            employeeCode: String(employeeCode).trim().toUpperCase(),
            designation: String(designation).trim(),
            qualification: String(qualification || 'M.Tech').trim(),
            specialization: specialization || null,
            joiningDate: new Date().toISOString().slice(0, 10),
            email: String(email).trim().toLowerCase(),
            phone: String(phone || '+91 80 2333 4100'),
            officeRoom: officeRoom || null,
          })
          .returning();

        return fac;
      });

      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('unique')) {
        return res.status(409).json({ error: 'Faculty employee code already exists' });
      }
      res.status(500).json({ error: 'Failed to create faculty profile' });
    }
  }
);
