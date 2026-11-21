import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { db } from '../db/index.ts';
import {
  academicYears,
  alumniProfiles,
  faculty,
  hostelAllocations,
  libraryTransactions,
  placementApplications,
  profiles,
  semesters,
  studentAchievements,
  studentDocuments,
  studentInternships,
  studentLeaveRequests,
  studentProjects,
  students,
  transportAllocations,
} from '../db/schema.ts';
import {
  AuthRequest,
  assertStudentAccess,
  inArray,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';
import { dispatchNotification, recordAuditLog } from '../services/audit.ts';

export const lifecycleRouter = Router();
lifecycleRouter.use(requireAuth);

function scopeStudentFilter(eff: NonNullable<AuthRequest['effectiveProfile']>, col: AnyPgColumn) {
  if (eff.role === 'student') {
    return eff.studentId ? eq(col, eff.studentId) : eq(col, -1);
  }
  if (eff.role === 'parent') {
    return eff.linkedStudentIds.length > 0 ? inArray(col, eff.linkedStudentIds) : eq(col, -1);
  }
  return undefined;
}

// Aggregated Campus Lifecycle Overview (Role-Scoped)
lifecycleRouter.get('/overview', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const [
      achievements,
      projects,
      internships,
      placements,
      leaves,
      library,
      transport,
      hostel,
      alumni,
      documents,
    ] = await Promise.all([
      db
        .select({
          id: studentAchievements.id,
          studentId: studentAchievements.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          title: studentAchievements.title,
          category: studentAchievements.category,
          issuer: studentAchievements.issuer,
          achievedOn: studentAchievements.achievedOn,
          level: studentAchievements.level,
          description: studentAchievements.description,
          certificateRef: studentAchievements.certificateRef,
          verified: studentAchievements.verified,
        })
        .from(studentAchievements)
        .innerJoin(students, eq(studentAchievements.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(scopeStudentFilter(eff, studentAchievements.studentId))
        .orderBy(desc(studentAchievements.achievedOn)),
      db
        .select({
          id: studentProjects.id,
          studentId: studentProjects.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          academicYearCode: academicYears.code,
          semesterNumber: semesters.number,
          title: studentProjects.title,
          projectType: studentProjects.projectType,
          domain: studentProjects.domain,
          techStack: studentProjects.techStack,
          repositoryUrl: studentProjects.repositoryUrl,
          status: studentProjects.status,
          gradeOrRemarks: studentProjects.gradeOrRemarks,
        })
        .from(studentProjects)
        .innerJoin(students, eq(studentProjects.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .innerJoin(academicYears, eq(studentProjects.academicYearId, academicYears.id))
        .innerJoin(semesters, eq(studentProjects.semesterId, semesters.id))
        .where(scopeStudentFilter(eff, studentProjects.studentId))
        .orderBy(desc(studentProjects.createdAt)),
      db
        .select({
          id: studentInternships.id,
          studentId: studentInternships.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          companyName: studentInternships.companyName,
          roleTitle: studentInternships.roleTitle,
          internshipType: studentInternships.internshipType,
          startDate: studentInternships.startDate,
          endDate: studentInternships.endDate,
          stipendInr: studentInternships.stipendInr,
          location: studentInternships.location,
          completionStatus: studentInternships.completionStatus,
          certificateRef: studentInternships.certificateRef,
        })
        .from(studentInternships)
        .innerJoin(students, eq(studentInternships.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(scopeStudentFilter(eff, studentInternships.studentId))
        .orderBy(desc(studentInternships.startDate)),
      db
        .select({
          id: placementApplications.id,
          studentId: placementApplications.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          academicYearCode: academicYears.code,
          companyName: placementApplications.companyName,
          jobRole: placementApplications.jobRole,
          ctcLpa: placementApplications.ctcLpa,
          driveDate: placementApplications.driveDate,
          roundStage: placementApplications.roundStage,
          offerStatus: placementApplications.offerStatus,
          offerLetterRef: placementApplications.offerLetterRef,
          remarks: placementApplications.remarks,
        })
        .from(placementApplications)
        .innerJoin(students, eq(placementApplications.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .innerJoin(academicYears, eq(placementApplications.academicYearId, academicYears.id))
        .where(scopeStudentFilter(eff, placementApplications.studentId))
        .orderBy(desc(placementApplications.driveDate)),
      db
        .select({
          id: studentLeaveRequests.id,
          studentId: studentLeaveRequests.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          academicYearCode: academicYears.code,
          semesterNumber: semesters.number,
          leaveType: studentLeaveRequests.leaveType,
          fromDate: studentLeaveRequests.fromDate,
          toDate: studentLeaveRequests.toDate,
          daysCount: studentLeaveRequests.daysCount,
          reason: studentLeaveRequests.reason,
          supportingDocRef: studentLeaveRequests.supportingDocRef,
          status: studentLeaveRequests.status,
          reviewRemarks: studentLeaveRequests.reviewRemarks,
        })
        .from(studentLeaveRequests)
        .innerJoin(students, eq(studentLeaveRequests.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .innerJoin(academicYears, eq(studentLeaveRequests.academicYearId, academicYears.id))
        .innerJoin(semesters, eq(studentLeaveRequests.semesterId, semesters.id))
        .where(scopeStudentFilter(eff, studentLeaveRequests.studentId))
        .orderBy(desc(studentLeaveRequests.createdAt)),
      db
        .select({
          id: libraryTransactions.id,
          studentId: libraryTransactions.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          bookIsbn: libraryTransactions.bookIsbn,
          bookTitle: libraryTransactions.bookTitle,
          author: libraryTransactions.author,
          accessionNumber: libraryTransactions.accessionNumber,
          issuedDate: libraryTransactions.issuedDate,
          dueDate: libraryTransactions.dueDate,
          returnedDate: libraryTransactions.returnedDate,
          fineInr: libraryTransactions.fineInr,
          status: libraryTransactions.status,
        })
        .from(libraryTransactions)
        .innerJoin(students, eq(libraryTransactions.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(scopeStudentFilter(eff, libraryTransactions.studentId))
        .orderBy(desc(libraryTransactions.issuedDate)),
      db
        .select({
          id: transportAllocations.id,
          studentId: transportAllocations.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          routeCode: transportAllocations.routeCode,
          routeName: transportAllocations.routeName,
          boardingStop: transportAllocations.boardingStop,
          busNumber: transportAllocations.busNumber,
          passNumber: transportAllocations.passNumber,
          annualFeeInr: transportAllocations.annualFeeInr,
          status: transportAllocations.status,
        })
        .from(transportAllocations)
        .innerJoin(students, eq(transportAllocations.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(scopeStudentFilter(eff, transportAllocations.studentId)),
      db
        .select({
          id: hostelAllocations.id,
          studentId: hostelAllocations.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          hostelBlock: hostelAllocations.hostelBlock,
          roomNumber: hostelAllocations.roomNumber,
          bedCode: hostelAllocations.bedCode,
          roomType: hostelAllocations.roomType,
          messPlan: hostelAllocations.messPlan,
          annualFeeInr: hostelAllocations.annualFeeInr,
          status: hostelAllocations.status,
        })
        .from(hostelAllocations)
        .innerJoin(students, eq(hostelAllocations.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(scopeStudentFilter(eff, hostelAllocations.studentId)),
      db
        .select({
          id: alumniProfiles.id,
          studentId: alumniProfiles.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          graduationYear: alumniProfiles.graduationYear,
          degreeAwarded: alumniProfiles.degreeAwarded,
          finalCgpa: alumniProfiles.finalCgpa,
          currentCompany: alumniProfiles.currentCompany,
          currentRole: alumniProfiles.currentRole,
          higherStudiesInstitution: alumniProfiles.higherStudiesInstitution,
          city: alumniProfiles.city,
          linkedinUrl: alumniProfiles.linkedinUrl,
          mentorshipAvailable: alumniProfiles.mentorshipAvailable,
          verified: alumniProfiles.verified,
        })
        .from(alumniProfiles)
        .innerJoin(students, eq(alumniProfiles.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .orderBy(desc(alumniProfiles.graduationYear)),
      db
        .select({
          id: studentDocuments.id,
          studentId: studentDocuments.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          documentType: studentDocuments.documentType,
          title: studentDocuments.title,
          referenceNumber: studentDocuments.referenceNumber,
          verificationStatus: studentDocuments.verificationStatus,
          remarks: studentDocuments.remarks,
          createdAt: studentDocuments.createdAt,
        })
        .from(studentDocuments)
        .innerJoin(students, eq(studentDocuments.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(scopeStudentFilter(eff, studentDocuments.studentId))
        .orderBy(desc(studentDocuments.createdAt)),
    ]);

    res.json({
      achievements,
      projects,
      internships,
      placements,
      leaves,
      library,
      transport,
      hostel,
      alumni,
      documents,
    });
  } catch (error) {
    console.error('Failed to load lifecycle overview:', error);
    res.status(500).json({ error: 'Failed to load campus lifecycle modules' });
  }
});

// Leave Requests (Student apply -> Faculty/Admin approve/reject)
lifecycleRouter.post(
  '/leaves',
  requireRole('student', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const targetStudentId = eff.role === 'student' ? eff.studentId : Number(req.body.studentId);
      const { academicYearId, semesterId, leaveType, fromDate, toDate, daysCount, reason, supportingDocRef } =
        req.body;
      if (!targetStudentId || !academicYearId || !semesterId || !fromDate || !toDate || !reason) {
        return res.status(400).json({ error: 'Leave dates, semester, and reason are required' });
      }
      const [created] = await db
        .insert(studentLeaveRequests)
        .values({
          studentId: targetStudentId,
          academicYearId: Number(academicYearId),
          semesterId: Number(semesterId),
          leaveType: leaveType || 'medical',
          fromDate,
          toDate,
          daysCount: Number(daysCount || 1),
          reason: String(reason).trim(),
          supportingDocRef: supportingDocRef || null,
          status: 'pending',
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit leave request' });
    }
  }
);

lifecycleRouter.patch(
  '/leaves/:id',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const leaveId = Number(req.params.id);
      const { status, reviewRemarks } = req.body as {
        status: 'approved' | 'rejected';
        reviewRemarks?: string;
      };
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const [updated] = await db
        .update(studentLeaveRequests)
        .set({
          status,
          reviewRemarks: reviewRemarks || null,
          reviewedByProfileId: req.effectiveProfile!.id,
          reviewedAt: new Date(),
        })
        .where(eq(studentLeaveRequests.id, leaveId))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Leave request not found' });

      const [stu] = await db
        .select({ profileId: students.profileId })
        .from(students)
        .where(eq(students.id, updated.studentId));
      if (stu) {
        await dispatchNotification({
          recipientProfileId: stu.profileId,
          category: 'attendance',
          title: `Leave Request ${status.toUpperCase()}`,
          message: `Your ${updated.leaveType} leave (${updated.fromDate} to ${updated.toDate}) was ${status}.`,
        });
      }

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: `LEAVE_REQUEST_${status.toUpperCase()}`,
        entityType: 'student_leave_requests',
        entityId: leaveId,
        afterState: updated,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to review leave request' });
    }
  }
);

// Achievements
lifecycleRouter.post(
  '/achievements',
  requireRole('student', 'super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const targetStudentId = eff.role === 'student' ? eff.studentId : Number(req.body.studentId);
      const { title, category, issuer, achievedOn, level, description, certificateRef } = req.body;
      if (!targetStudentId || !title || !category || !issuer || !achievedOn) {
        return res.status(400).json({ error: 'Achievement title, category, issuer & date required' });
      }
      const [created] = await db
        .insert(studentAchievements)
        .values({
          studentId: targetStudentId,
          title: String(title).trim(),
          category,
          issuer: String(issuer).trim(),
          achievedOn,
          level: level || 'college',
          description: description || null,
          certificateRef: certificateRef || null,
          verified: eff.role === 'super_admin' || eff.role === 'faculty',
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create achievement' });
    }
  }
);

lifecycleRouter.patch(
  '/achievements/:id/verify',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const [updated] = await db
        .update(studentAchievements)
        .set({ verified: Boolean(req.body.verified ?? true) })
        .where(eq(studentAchievements.id, Number(req.params.id)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Not found' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to verify achievement' });
    }
  }
);

// Projects
lifecycleRouter.post(
  '/projects',
  requireRole('student', 'super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const targetStudentId = eff.role === 'student' ? eff.studentId : Number(req.body.studentId);
      const { academicYearId, semesterId, title, projectType, domain, techStack, repositoryUrl } =
        req.body;
      if (!targetStudentId || !academicYearId || !semesterId || !title || !domain || !techStack) {
        return res.status(400).json({ error: 'Project title, domain, tech stack & term required' });
      }
      const [defaultFac] = await db.select({ id: faculty.id }).from(faculty).limit(1);
      const [created] = await db
        .insert(studentProjects)
        .values({
          studentId: targetStudentId,
          academicYearId: Number(academicYearId),
          semesterId: Number(semesterId),
          title: String(title).trim(),
          projectType: projectType || 'mini',
          domain: String(domain).trim(),
          techStack: String(techStack).trim(),
          guideFacultyId: defaultFac?.id ?? null,
          repositoryUrl: repositoryUrl || null,
          status: 'in_progress',
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to save project' });
    }
  }
);

// Internships
lifecycleRouter.post(
  '/internships',
  requireRole('student', 'super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const targetStudentId = eff.role === 'student' ? eff.studentId : Number(req.body.studentId);
      const { companyName, roleTitle, internshipType, startDate, endDate, stipendInr, location, certificateRef } =
        req.body;
      if (!targetStudentId || !companyName || !roleTitle || !startDate || !endDate) {
        return res.status(400).json({ error: 'Company, role & dates required' });
      }
      const [created] = await db
        .insert(studentInternships)
        .values({
          studentId: targetStudentId,
          companyName: String(companyName).trim(),
          roleTitle: String(roleTitle).trim(),
          internshipType: internshipType || 'summer',
          startDate,
          endDate,
          stipendInr: Number(stipendInr || 0),
          location: String(location || 'Bengaluru').trim(),
          completionStatus: eff.role === 'student' ? 'ongoing' : 'verified',
          certificateRef: certificateRef || null,
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add internship' });
    }
  }
);

// Placements
lifecycleRouter.post(
  '/placements',
  requireRole('student', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const targetStudentId = eff.role === 'student' ? eff.studentId : Number(req.body.studentId);
      const { academicYearId, companyName, jobRole, ctcLpa, driveDate, roundStage, offerStatus } =
        req.body;
      if (!targetStudentId || !academicYearId || !companyName || !jobRole || !driveDate) {
        return res.status(400).json({ error: 'Company, role, academic year & drive date required' });
      }
      const [created] = await db
        .insert(placementApplications)
        .values({
          studentId: targetStudentId,
          academicYearId: Number(academicYearId),
          companyName: String(companyName).trim(),
          jobRole: String(jobRole).trim(),
          ctcLpa: Number(ctcLpa || 8).toFixed(2),
          driveDate,
          roundStage: eff.role === 'super_admin' && roundStage ? roundStage : 'applied',
          offerStatus: eff.role === 'super_admin' && offerStatus ? offerStatus : 'none',
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to record placement application' });
    }
  }
);

// Document Upload & Admin Verification
lifecycleRouter.post(
  '/documents',
  requireRole('student', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const targetStudentId = eff.role === 'student' ? eff.studentId : Number(req.body.studentId);
      const { documentType, title, referenceNumber, fileUrl } = req.body;
      if (!targetStudentId || !documentType || !title || !referenceNumber) {
        return res.status(400).json({ error: 'Document type, title & reference number required' });
      }
      const [created] = await db
        .insert(studentDocuments)
        .values({
          studentId: targetStudentId,
          documentType,
          title: String(title).trim(),
          referenceNumber: String(referenceNumber).trim(),
          fileUrl: fileUrl || null,
          verificationStatus: eff.role === 'super_admin' ? 'verified' : 'pending',
          verifiedByProfileId: eff.role === 'super_admin' ? eff.id : null,
          verifiedAt: eff.role === 'super_admin' ? new Date() : null,
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add student document' });
    }
  }
);

lifecycleRouter.patch(
  '/documents/:id/verify',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { verificationStatus, remarks } = req.body as {
        verificationStatus: 'verified' | 'rejected' | 'pending';
        remarks?: string;
      };
      const [updated] = await db
        .update(studentDocuments)
        .set({
          verificationStatus,
          remarks: remarks || null,
          verifiedByProfileId: req.effectiveProfile!.id,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(studentDocuments.id, Number(req.params.id)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Document not found' });

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: `DOCUMENT_${verificationStatus.toUpperCase()}`,
        entityType: 'student_documents',
        entityId: updated.id,
        afterState: updated,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update document status' });
    }
  }
);

// Library Issue / Return (Super Admin)
lifecycleRouter.post(
  '/library',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { studentId, bookIsbn, bookTitle, author, accessionNumber, dueDate } = req.body;
      if (!studentId || !bookTitle || !accessionNumber || !dueDate) {
        return res.status(400).json({ error: 'Student, book title, accession number & due date required' });
      }
      const [created] = await db
        .insert(libraryTransactions)
        .values({
          studentId: Number(studentId),
          bookIsbn: bookIsbn || '978-0000000000',
          bookTitle: String(bookTitle).trim(),
          author: String(author || 'ICEAS Library').trim(),
          accessionNumber: String(accessionNumber).trim().toUpperCase(),
          issuedDate: new Date().toISOString().slice(0, 10),
          dueDate,
          status: 'issued',
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to issue library book' });
    }
  }
);

lifecycleRouter.patch(
  '/library/:id/return',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const [updated] = await db
        .update(libraryTransactions)
        .set({
          status: 'returned',
          returnedDate: new Date().toISOString().slice(0, 10),
        })
        .where(eq(libraryTransactions.id, Number(req.params.id)))
        .returning();
      if (!updated) return res.status(404).json({ error: 'Transaction not found' });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to return book' });
    }
  }
);

// Transport & Hostel Allocations (Super Admin)
lifecycleRouter.post(
  '/transport',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { studentId, academicYearId, routeCode, routeName, boardingStop, busNumber, passNumber, annualFeeInr } =
        req.body;
      if (!studentId || !academicYearId || !routeCode || !routeName || !boardingStop) {
        return res.status(400).json({ error: 'Missing required transport allocation fields' });
      }
      const [created] = await db
        .insert(transportAllocations)
        .values({
          studentId: Number(studentId),
          academicYearId: Number(academicYearId),
          routeCode: String(routeCode).toUpperCase(),
          routeName: String(routeName).trim(),
          boardingStop: String(boardingStop).trim(),
          busNumber: String(busNumber || 'KA-04-AD-7710').toUpperCase(),
          passNumber: String(passNumber || `BUS-${Date.now().toString().slice(-5)}`).toUpperCase(),
          annualFeeInr: Number(annualFeeInr || 18500),
          status: 'active',
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to allocate transport' });
    }
  }
);

lifecycleRouter.post(
  '/hostel',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { studentId, academicYearId, hostelBlock, roomNumber, bedCode, roomType, messPlan, annualFeeInr } =
        req.body;
      if (!studentId || !academicYearId || !hostelBlock || !roomNumber || !bedCode) {
        return res.status(400).json({ error: 'Missing required hostel allocation fields' });
      }
      const [created] = await db
        .insert(hostelAllocations)
        .values({
          studentId: Number(studentId),
          academicYearId: Number(academicYearId),
          hostelBlock: String(hostelBlock).trim(),
          roomNumber: String(roomNumber).trim(),
          bedCode: String(bedCode).trim().toUpperCase(),
          roomType: roomType || '2-Sharing Attached',
          messPlan: messPlan || 'South & North Indian Veg',
          annualFeeInr: Number(annualFeeInr || 78000),
          status: 'active',
        })
        .returning();
      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to allocate hostel room' });
    }
  }
);

// Alumni Profiles (Admin or Student self-record)
lifecycleRouter.post(
  '/alumni',
  requireRole('super_admin', 'student'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const targetStudentId = eff.role === 'student' ? eff.studentId : Number(req.body.studentId);
      const { graduationYear, degreeAwarded, finalCgpa, currentCompany, currentRole, higherStudiesInstitution, city, linkedinUrl } =
        req.body;
      if (!targetStudentId || !graduationYear || !degreeAwarded || !city) {
        return res.status(400).json({ error: 'Student, graduation year, degree & city required' });
      }
      const allowed = await assertStudentAccess(req, targetStudentId);
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });

      const [created] = await db
        .insert(alumniProfiles)
        .values({
          studentId: targetStudentId,
          graduationYear: Number(graduationYear),
          degreeAwarded: String(degreeAwarded).trim(),
          finalCgpa: Number(finalCgpa || 8.0).toFixed(2),
          currentCompany: currentCompany || null,
          currentRole: currentRole || null,
          higherStudiesInstitution: higherStudiesInstitution || null,
          city: String(city).trim(),
          linkedinUrl: linkedinUrl || null,
          verified: eff.role === 'super_admin',
        })
        .onConflictDoUpdate({
          target: alumniProfiles.studentId,
          set: {
            currentCompany: currentCompany || null,
            currentRole: currentRole || null,
            higherStudiesInstitution: higherStudiesInstitution || null,
            city: String(city).trim(),
            linkedinUrl: linkedinUrl || null,
            updatedAt: new Date(),
          },
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to save alumni profile' });
    }
  }
);
