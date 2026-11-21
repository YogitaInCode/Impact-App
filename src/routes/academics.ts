import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  academicYears,
  assessmentComponents,
  assessmentSchemes,
  departments,
  faculty,
  gradeScales,
  markChangeRequests,
  profiles,
  programs,
  revaluationRequests,
  semesterResultSummaries,
  semesters,
  studentAssessmentMarks,
  studentBacklogs,
  studentEnrollments,
  students,
  subjects,
} from '../db/schema.ts';
import { getActiveInstitutionId } from '../db/seed.ts';
import {
  AuthRequest,
  assertStudentAccess,
  inArray,
  requireAuth,
  requireRole,
} from '../middleware/auth.ts';
import { dispatchNotification, recordAuditLog } from '../services/audit.ts';

export const academicsRouter = Router();
academicsRouter.use(requireAuth);

function resolveGradeFromScale(
  percentage: number,
  scales: (typeof gradeScales.$inferSelect)[]
): { gradeLetter: string; gradePoints: number; isPass: boolean } {
  const sorted = [...scales].sort(
    (a, b) => Number(b.minPercentage) - Number(a.minPercentage)
  );
  for (const sc of sorted) {
    if (percentage >= Number(sc.minPercentage) && percentage <= Number(sc.maxPercentage)) {
      return {
        gradeLetter: sc.gradeLetter,
        gradePoints: Number(sc.gradePoints),
        isPass: sc.isPass,
      };
    }
  }
  if (percentage >= 90) return { gradeLetter: 'O', gradePoints: 10, isPass: true };
  if (percentage >= 80) return { gradeLetter: 'A+', gradePoints: 9, isPass: true };
  if (percentage >= 70) return { gradeLetter: 'A', gradePoints: 8, isPass: true };
  if (percentage >= 60) return { gradeLetter: 'B+', gradePoints: 7, isPass: true };
  if (percentage >= 55) return { gradeLetter: 'B', gradePoints: 6, isPass: true };
  if (percentage >= 50) return { gradeLetter: 'C', gradePoints: 5, isPass: true };
  if (percentage >= 40) return { gradeLetter: 'P', gradePoints: 4, isPass: true };
  return { gradeLetter: 'F', gradePoints: 0, isPass: false };
}

// Recomputes SGPA & CGPA inside DB for a given student + academicYear + semester
export async function recomputeStudentSemesterSummary(
  studentId: number,
  academicYearId: number,
  semesterId: number,
  publishResults = false
) {
  const [scales, marksRows, allSubjs] = await Promise.all([
    db.select().from(gradeScales).where(eq(gradeScales.schemeCode, 'VTU-2022')),
    db
      .select({
        id: studentAssessmentMarks.id,
        subjectId: studentAssessmentMarks.subjectId,
        componentId: studentAssessmentMarks.componentId,
        marksObtained: studentAssessmentMarks.marksObtained,
        maxMarks: studentAssessmentMarks.maxMarks,
        workflowStatus: studentAssessmentMarks.workflowStatus,
        category: assessmentComponents.category,
        code: assessmentComponents.code,
        weightagePct: assessmentComponents.weightagePct,
      })
      .from(studentAssessmentMarks)
      .innerJoin(
        assessmentComponents,
        eq(studentAssessmentMarks.componentId, assessmentComponents.id)
      )
      .where(
        and(
          eq(studentAssessmentMarks.studentId, studentId),
          eq(studentAssessmentMarks.academicYearId, academicYearId),
          eq(studentAssessmentMarks.semesterId, semesterId)
        )
      ),
    db.select().from(subjects),
  ]);

  if (marksRows.length === 0) return null;

  const subjectMap = new Map(allSubjs.map((s) => [s.id, s]));
  const bySubject = new Map<number, typeof marksRows>();
  for (const m of marksRows) {
    const arr = bySubject.get(m.subjectId) || [];
    arr.push(m);
    bySubject.set(m.subjectId, arr);
  }

  let totalCreditsRegistered = 0;
  let totalCreditsEarned = 0;
  let weightedPoints = 0;
  let totalPctSum = 0;
  let subjectCount = 0;
  let backlogCount = 0;

  for (const [subjectId, rows] of bySubject.entries()) {
    const subj = subjectMap.get(subjectId);
    const credits = subj?.credits ?? 4;

    const cieRows = rows.filter((r) => r.category !== 'see');
    const seeRows = rows.filter((r) => r.category === 'see');

    // Compute CIE scaled to 50 and SEE scaled to 50
    let cieWeightedSum = 0;
    let cieWeightTotal = 0;
    for (const r of cieRows) {
      const w = Number(r.weightagePct) || r.maxMarks;
      cieWeightedSum += (Number(r.marksObtained) / Math.max(1, r.maxMarks)) * w;
      cieWeightTotal += w;
    }
    const cieOutOf50 =
      cieWeightTotal > 0 ? (cieWeightedSum / cieWeightTotal) * 50 : 0;

    let seeOutOf50 = 0;
    if (seeRows.length > 0) {
      const seeObt = seeRows.reduce((s, r) => s + Number(r.marksObtained), 0);
      const seeMax = seeRows.reduce((s, r) => s + r.maxMarks, 0);
      seeOutOf50 = seeMax > 0 ? (seeObt / seeMax) * 50 : 0;
    }

    const combinedPct = Number((cieOutOf50 + seeOutOf50).toFixed(2));
    const hasSee = seeRows.length > 0;
    const seePassed = !hasSee || seeOutOf50 >= 17.5; // VTU 35% of 50
    const ciePassed = cieOutOf50 >= 20; // VTU 40% of 50
    const gradeInfo = resolveGradeFromScale(combinedPct, scales);
    const passed = gradeInfo.isPass && seePassed && ciePassed;

    totalCreditsRegistered += credits;
    if (passed) {
      totalCreditsEarned += credits;
      weightedPoints += credits * gradeInfo.gradePoints;
    } else {
      backlogCount++;
      const existingBacklog = await db
        .select()
        .from(studentBacklogs)
        .where(
          and(
            eq(studentBacklogs.studentId, studentId),
            eq(studentBacklogs.subjectId, subjectId),
            eq(studentBacklogs.academicYearId, academicYearId),
            eq(studentBacklogs.semesterId, semesterId)
          )
        );
      if (existingBacklog.length === 0) {
        await db.insert(studentBacklogs).values({
          studentId,
          subjectId,
          academicYearId,
          semesterId,
          originalMarks: combinedPct.toFixed(2),
          attemptNumber: 1,
          status: 'active',
          remarks: !seePassed
            ? 'Below 35% SEE threshold'
            : !ciePassed
              ? 'Below 40% CIE threshold'
              : 'Below overall 40% pass threshold',
        });
      }
    }

    totalPctSum += combinedPct;
    subjectCount++;
  }

  const sgpa =
    totalCreditsRegistered > 0
      ? Number((weightedPoints / totalCreditsRegistered).toFixed(2))
      : 0;
  const avgPct = subjectCount > 0 ? Number((totalPctSum / subjectCount).toFixed(2)) : 0;

  // Compute cumulative CGPA across all other semester summaries for this student
  const priorSummaries = await db
    .select()
    .from(semesterResultSummaries)
    .where(eq(semesterResultSummaries.studentId, studentId));

  let cumWeight = sgpa * totalCreditsRegistered;
  let cumCredits = totalCreditsRegistered;
  for (const p of priorSummaries) {
    if (p.academicYearId === academicYearId && p.semesterId === semesterId) continue;
    cumWeight += Number(p.sgpa) * p.totalCreditsRegistered;
    cumCredits += p.totalCreditsRegistered;
  }
  const cgpa = cumCredits > 0 ? Number((cumWeight / cumCredits).toFixed(2)) : sgpa;

  const now = new Date();
  const [summary] = await db
    .insert(semesterResultSummaries)
    .values({
      studentId,
      academicYearId,
      semesterId,
      totalCreditsRegistered,
      totalCreditsEarned,
      sgpa: sgpa.toFixed(2),
      cgpa: cgpa.toFixed(2),
      percentage: avgPct.toFixed(2),
      resultStatus: backlogCount === 0 ? 'pass' : 'fail',
      backlogCount,
      isPublished: publishResults,
      computedAt: now,
      publishedAt: publishResults ? now : null,
    })
    .onConflictDoUpdate({
      target: [
        semesterResultSummaries.studentId,
        semesterResultSummaries.academicYearId,
        semesterResultSummaries.semesterId,
      ],
      set: {
        totalCreditsRegistered,
        totalCreditsEarned,
        sgpa: sgpa.toFixed(2),
        cgpa: cgpa.toFixed(2),
        percentage: avgPct.toFixed(2),
        resultStatus: backlogCount === 0 ? 'pass' : 'fail',
        backlogCount,
        ...(publishResults ? { isPublished: true, publishedAt: now } : {}),
        computedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  return summary;
}

// 1. Assessment Schemes, Components & Grade Scales
academicsRouter.get('/schemes', async (_req: AuthRequest, res) => {
  try {
    const [schemes, components, scales] = await Promise.all([
      db
        .select({
          id: assessmentSchemes.id,
          academicYearId: assessmentSchemes.academicYearId,
          academicYearCode: academicYears.code,
          programId: assessmentSchemes.programId,
          programCode: programs.code,
          programName: programs.name,
          schemeCode: assessmentSchemes.schemeCode,
          name: assessmentSchemes.name,
          cieMaxMarks: assessmentSchemes.cieMaxMarks,
          seeMaxMarks: assessmentSchemes.seeMaxMarks,
          totalMaxMarks: assessmentSchemes.totalMaxMarks,
          minCiePercentage: assessmentSchemes.minCiePercentage,
          minSeePercentage: assessmentSchemes.minSeePercentage,
          minTotalPercentage: assessmentSchemes.minTotalPercentage,
          isActive: assessmentSchemes.isActive,
        })
        .from(assessmentSchemes)
        .innerJoin(academicYears, eq(assessmentSchemes.academicYearId, academicYears.id))
        .innerJoin(programs, eq(assessmentSchemes.programId, programs.id)),
      db.select().from(assessmentComponents).orderBy(assessmentComponents.displayOrder),
      db.select().from(gradeScales).orderBy(desc(gradeScales.minPercentage)),
    ]);

    res.json({ schemes, components, gradeScales: scales });
  } catch (error) {
    console.error('Failed to fetch schemes:', error);
    res.status(500).json({ error: 'Failed to load assessment schemes' });
  }
});

academicsRouter.post(
  '/schemes',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const {
        academicYearId,
        programId,
        schemeCode,
        name,
        cieMaxMarks,
        seeMaxMarks,
        components,
      } = req.body;
      if (!academicYearId || !programId || !schemeCode || !name) {
        return res.status(400).json({ error: 'Academic year, program, scheme code & name required' });
      }
      const instId = await getActiveInstitutionId();
      const created = await db.transaction(async (tx) => {
        const [scheme] = await tx
          .insert(assessmentSchemes)
          .values({
            institutionId: instId,
            academicYearId: Number(academicYearId),
            programId: Number(programId),
            schemeCode: String(schemeCode).trim().toUpperCase(),
            name: String(name).trim(),
            cieMaxMarks: Number(cieMaxMarks || 50),
            seeMaxMarks: Number(seeMaxMarks || 50),
            totalMaxMarks: Number(cieMaxMarks || 50) + Number(seeMaxMarks || 50),
            isActive: true,
          })
          .returning();

        const compRows = Array.isArray(components) && components.length > 0
          ? components
          : [
              { code: 'IA1', name: 'Internal Assessment 1', category: 'cie', maxMarks: 25, weightagePct: '15.00', passingMarks: 10 },
              { code: 'IA2', name: 'Internal Assessment 2', category: 'cie', maxMarks: 25, weightagePct: '15.00', passingMarks: 10 },
              { code: 'ASSIGN', name: 'Assignments & Quiz', category: 'cie', maxMarks: 20, weightagePct: '20.00', passingMarks: 8 },
              { code: 'SEE', name: 'Semester End Examination', category: 'see', maxMarks: 50, weightagePct: '50.00', passingMarks: 18 },
            ];

        await tx.insert(assessmentComponents).values(
          compRows.map((c: Record<string, unknown>, idx: number) => ({
            schemeId: scheme.id,
            code: String(c.code || `C${idx + 1}`).toUpperCase(),
            name: String(c.name || 'Component'),
            category: String(c.category || 'cie'),
            maxMarks: Number(c.maxMarks || 25),
            weightagePct: String(c.weightagePct || '10.00'),
            passingMarks: Number(c.passingMarks || 0),
            displayOrder: idx + 1,
          }))
        );
        return scheme;
      });

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'ASSESSMENT_SCHEME_CREATE',
        entityType: 'assessment_schemes',
        entityId: created.id,
        afterState: created,
      });

      res.status(201).json(created);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('unique')) {
        return res.status(409).json({ error: 'Assessment scheme code already exists for this program and year' });
      }
      res.status(500).json({ error: 'Failed to create assessment scheme' });
    }
  }
);

// 2. Internal & SEE Component Marks (strictly role-scoped: Students/Parents ONLY see published)
academicsRouter.get('/marks', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const academicYearId = req.query.academicYearId ? Number(req.query.academicYearId) : undefined;
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
    const studentIdParam = req.query.studentId ? Number(req.query.studentId) : undefined;

    if (studentIdParam) {
      const allowed = await assertStudentAccess(req, studentIdParam);
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    }

    const rows = await db
      .select({
        id: studentAssessmentMarks.id,
        studentId: studentAssessmentMarks.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        subjectId: studentAssessmentMarks.subjectId,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        subjectCredits: subjects.credits,
        academicYearId: studentAssessmentMarks.academicYearId,
        academicYearCode: academicYears.code,
        semesterId: studentAssessmentMarks.semesterId,
        semesterNumber: semesters.number,
        semesterName: semesters.name,
        componentId: studentAssessmentMarks.componentId,
        componentCode: assessmentComponents.code,
        componentName: assessmentComponents.name,
        componentCategory: assessmentComponents.category,
        weightagePct: assessmentComponents.weightagePct,
        marksObtained: studentAssessmentMarks.marksObtained,
        maxMarks: studentAssessmentMarks.maxMarks,
        isAbsent: studentAssessmentMarks.isAbsent,
        workflowStatus: studentAssessmentMarks.workflowStatus,
        remarks: studentAssessmentMarks.remarks,
        updatedAt: studentAssessmentMarks.updatedAt,
      })
      .from(studentAssessmentMarks)
      .innerJoin(students, eq(studentAssessmentMarks.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(subjects, eq(studentAssessmentMarks.subjectId, subjects.id))
      .innerJoin(academicYears, eq(studentAssessmentMarks.academicYearId, academicYears.id))
      .innerJoin(semesters, eq(studentAssessmentMarks.semesterId, semesters.id))
      .innerJoin(assessmentComponents, eq(studentAssessmentMarks.componentId, assessmentComponents.id))
      .where(
        and(
          academicYearId ? eq(studentAssessmentMarks.academicYearId, academicYearId) : undefined,
          subjectId ? eq(studentAssessmentMarks.subjectId, subjectId) : undefined,
          studentIdParam ? eq(studentAssessmentMarks.studentId, studentIdParam) : undefined,
          eff.role === 'student' && eff.studentId
            ? and(
                eq(studentAssessmentMarks.studentId, eff.studentId),
                eq(studentAssessmentMarks.workflowStatus, 'published')
              )
            : undefined,
          eff.role === 'parent'
            ? eff.linkedStudentIds.length > 0
              ? and(
                  inArray(studentAssessmentMarks.studentId, eff.linkedStudentIds),
                  eq(studentAssessmentMarks.workflowStatus, 'published')
                )
              : eq(studentAssessmentMarks.studentId, -1)
            : undefined
        )
      )
      .orderBy(students.usn, assessmentComponents.displayOrder);

    res.json({ marks: rows });
  } catch (error) {
    console.error('Failed to fetch assessment marks:', error);
    res.status(500).json({ error: 'Failed to load assessment marks' });
  }
});

// Batch Marks Entry (Faculty/Admin: draft | submitted; blocks direct edit of published marks)
academicsRouter.post(
  '/marks/batch',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const { entries, submitForApproval } = req.body as {
        entries: {
          studentId: number;
          subjectId: number;
          academicYearId: number;
          semesterId: number;
          componentId: number;
          marksObtained: number;
          isAbsent?: boolean;
          remarks?: string;
        }[];
        submitForApproval?: boolean;
      };

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({ error: 'No mark entries provided' });
      }

      const targetStatus = submitForApproval ? 'submitted' : 'draft';
      const now = new Date();
      let savedCount = 0;
      const blockedPublished: number[] = [];

      for (const item of entries) {
        const [comp] = await db
          .select()
          .from(assessmentComponents)
          .where(eq(assessmentComponents.id, Number(item.componentId)));
        if (!comp) continue;

        const val = Math.max(0, Math.min(comp.maxMarks, Number(item.marksObtained || 0)));

        const [existing] = await db
          .select()
          .from(studentAssessmentMarks)
          .where(
            and(
              eq(studentAssessmentMarks.studentId, Number(item.studentId)),
              eq(studentAssessmentMarks.academicYearId, Number(item.academicYearId)),
              eq(studentAssessmentMarks.semesterId, Number(item.semesterId)),
              eq(studentAssessmentMarks.subjectId, Number(item.subjectId)),
              eq(studentAssessmentMarks.componentId, Number(item.componentId))
            )
          );

        if (existing && existing.workflowStatus === 'published') {
          blockedPublished.push(existing.id);
          continue;
        }

        await db
          .insert(studentAssessmentMarks)
          .values({
            studentId: Number(item.studentId),
            subjectId: Number(item.subjectId),
            academicYearId: Number(item.academicYearId),
            semesterId: Number(item.semesterId),
            componentId: Number(item.componentId),
            marksObtained: val.toFixed(2),
            maxMarks: comp.maxMarks,
            isAbsent: Boolean(item.isAbsent),
            workflowStatus: targetStatus,
            enteredByProfileId: req.effectiveProfile!.id,
            submittedAt: submitForApproval ? now : null,
            remarks: item.remarks || null,
          })
          .onConflictDoUpdate({
            target: [
              studentAssessmentMarks.studentId,
              studentAssessmentMarks.academicYearId,
              studentAssessmentMarks.semesterId,
              studentAssessmentMarks.subjectId,
              studentAssessmentMarks.componentId,
            ],
            set: {
              marksObtained: val.toFixed(2),
              isAbsent: Boolean(item.isAbsent),
              workflowStatus: targetStatus,
              enteredByProfileId: req.effectiveProfile!.id,
              ...(submitForApproval ? { submittedAt: now } : {}),
              remarks: item.remarks || null,
              updatedAt: now,
            },
          });
        savedCount++;
      }

      if (blockedPublished.length > 0 && savedCount === 0) {
        return res.status(409).json({
          error:
            'Published marks are locked and immutable. Submit a Mark Change Request for Controller of Examinations approval.',
        });
      }

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: submitForApproval ? 'ASSESSMENT_MARKS_SUBMITTED' : 'ASSESSMENT_MARKS_DRAFT_SAVED',
        entityType: 'student_assessment_marks',
        entityId: `batch-${savedCount}`,
        afterState: { savedCount, targetStatus, blockedPublishedCount: blockedPublished.length },
      });

      res.json({ savedCount, status: targetStatus, blockedPublishedCount: blockedPublished.length });
    } catch (error) {
      console.error('Batch mark entry error:', error);
      res.status(500).json({ error: 'Failed to save assessment marks' });
    }
  }
);

// Approve & Publish Subject/Semester Marks (Super Admin Only)
academicsRouter.post(
  '/marks/publish',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { academicYearId, semesterId, subjectId } = req.body;
      if (!academicYearId || !semesterId) {
        return res.status(400).json({ error: 'academicYearId and semesterId required' });
      }
      const now = new Date();
      const updated = await db
        .update(studentAssessmentMarks)
        .set({
          workflowStatus: 'published',
          approvedByProfileId: req.effectiveProfile!.id,
          publishedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(studentAssessmentMarks.academicYearId, Number(academicYearId)),
            eq(studentAssessmentMarks.semesterId, Number(semesterId)),
            subjectId ? eq(studentAssessmentMarks.subjectId, Number(subjectId)) : undefined
          )
        )
        .returning();

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'ASSESSMENT_MARKS_PUBLISHED',
        entityType: 'student_assessment_marks',
        entityId: `${academicYearId}-${semesterId}`,
        afterState: { publishedCount: updated.length },
      });

      res.json({ publishedCount: updated.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to publish marks' });
    }
  }
);

// 3. Authorized Mark Change Requests
academicsRouter.get(
  '/mark-change-requests',
  requireRole('super_admin', 'faculty'),
  async (_req: AuthRequest, res) => {
    try {
      const rows = await db
        .select({
          id: markChangeRequests.id,
          studentAssessmentMarkId: markChangeRequests.studentAssessmentMarkId,
          studentId: markChangeRequests.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          subjectId: markChangeRequests.subjectId,
          subjectCode: subjects.code,
          subjectName: subjects.name,
          previousMarks: markChangeRequests.previousMarks,
          requestedMarks: markChangeRequests.requestedMarks,
          reason: markChangeRequests.reason,
          status: markChangeRequests.status,
          reviewNotes: markChangeRequests.reviewNotes,
          createdAt: markChangeRequests.createdAt,
        })
        .from(markChangeRequests)
        .innerJoin(students, eq(markChangeRequests.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .innerJoin(subjects, eq(markChangeRequests.subjectId, subjects.id))
        .orderBy(desc(markChangeRequests.createdAt));

      res.json({ requests: rows });
    } catch (error) {
      res.status(500).json({ error: 'Failed to load mark change requests' });
    }
  }
);

academicsRouter.post(
  '/mark-change-requests',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const { studentAssessmentMarkId, requestedMarks, reason } = req.body;
      if (!studentAssessmentMarkId || requestedMarks === undefined || !reason) {
        return res.status(400).json({ error: 'Mark ID, requested marks, and reason are required' });
      }
      const [mark] = await db
        .select()
        .from(studentAssessmentMarks)
        .where(eq(studentAssessmentMarks.id, Number(studentAssessmentMarkId)));
      if (!mark) return res.status(404).json({ error: 'Assessment mark row not found' });

      const [created] = await db
        .insert(markChangeRequests)
        .values({
          studentAssessmentMarkId: mark.id,
          studentId: mark.studentId,
          subjectId: mark.subjectId,
          requestedByProfileId: req.effectiveProfile!.id,
          previousMarks: mark.marksObtained,
          requestedMarks: Number(requestedMarks).toFixed(2),
          reason: String(reason).trim(),
          status: 'pending',
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit mark change request' });
    }
  }
);

academicsRouter.patch(
  '/mark-change-requests/:id',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const reqId = Number(req.params.id);
      const { status, reviewNotes } = req.body as { status: 'approved' | 'rejected'; reviewNotes?: string };
      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be approved or rejected' });
      }

      const [existing] = await db
        .select()
        .from(markChangeRequests)
        .where(eq(markChangeRequests.id, reqId));
      if (!existing) return res.status(404).json({ error: 'Mark change request not found' });

      const updated = await db.transaction(async (tx) => {
        const [reqRow] = await tx
          .update(markChangeRequests)
          .set({
            status,
            reviewedByProfileId: req.effectiveProfile!.id,
            reviewNotes: reviewNotes || null,
            reviewedAt: new Date(),
          })
          .where(eq(markChangeRequests.id, reqId))
          .returning();

        if (status === 'approved') {
          await tx
            .update(studentAssessmentMarks)
            .set({
              marksObtained: existing.requestedMarks,
              remarks: `Authorized mark revision: ${existing.reason}`,
              updatedAt: new Date(),
            })
            .where(eq(studentAssessmentMarks.id, existing.studentAssessmentMarkId));
        }
        return reqRow;
      });

      if (status === 'approved') {
        const [markRow] = await db
          .select()
          .from(studentAssessmentMarks)
          .where(eq(studentAssessmentMarks.id, existing.studentAssessmentMarkId));
        if (markRow) {
          await recomputeStudentSemesterSummary(
            markRow.studentId,
            markRow.academicYearId,
            markRow.semesterId,
            markRow.workflowStatus === 'published'
          );
        }
      }

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: `MARK_CHANGE_REQUEST_${status.toUpperCase()}`,
        entityType: 'mark_change_requests',
        entityId: reqId,
        beforeState: existing,
        afterState: updated,
        reason: existing.reason,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to review mark change request' });
    }
  }
);

// 4. Semester Summaries (SGPA & CGPA) + Transactional Computation Engine
academicsRouter.get('/results/summaries', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const rows = await db
      .select({
        id: semesterResultSummaries.id,
        studentId: semesterResultSummaries.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        departmentCode: departments.code,
        academicYearId: semesterResultSummaries.academicYearId,
        academicYearCode: academicYears.code,
        semesterId: semesterResultSummaries.semesterId,
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
        computedAt: semesterResultSummaries.computedAt,
      })
      .from(semesterResultSummaries)
      .innerJoin(students, eq(semesterResultSummaries.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(departments, eq(students.departmentId, departments.id))
      .innerJoin(academicYears, eq(semesterResultSummaries.academicYearId, academicYears.id))
      .innerJoin(semesters, eq(semesterResultSummaries.semesterId, semesters.id))
      .where(
        and(
          eff.role === 'student' && eff.studentId
            ? and(
                eq(semesterResultSummaries.studentId, eff.studentId),
                eq(semesterResultSummaries.isPublished, true)
              )
            : undefined,
          eff.role === 'parent'
            ? eff.linkedStudentIds.length > 0
              ? and(
                  inArray(semesterResultSummaries.studentId, eff.linkedStudentIds),
                  eq(semesterResultSummaries.isPublished, true)
                )
              : eq(semesterResultSummaries.studentId, -1)
            : undefined
        )
      )
      .orderBy(desc(academicYears.code), desc(semesters.number), students.usn);

    res.json({ summaries: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load semester SGPA/CGPA summaries' });
  }
});

academicsRouter.post(
  '/results/compute',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { academicYearId, semesterId, publishResults } = req.body;
      if (!academicYearId || !semesterId) {
        return res.status(400).json({ error: 'academicYearId and semesterId required' });
      }

      const enrolled = await db
        .select({ studentId: studentEnrollments.studentId })
        .from(studentEnrollments)
        .where(
          and(
            eq(studentEnrollments.academicYearId, Number(academicYearId)),
            eq(studentEnrollments.semesterId, Number(semesterId))
          )
        );

      const computed: unknown[] = [];
      for (const e of enrolled) {
        const resSummary = await recomputeStudentSemesterSummary(
          e.studentId,
          Number(academicYearId),
          Number(semesterId),
          Boolean(publishResults)
        );
        if (resSummary) computed.push(resSummary);
      }

      if (publishResults) {
        await db
          .update(studentAssessmentMarks)
          .set({
            workflowStatus: 'published',
            approvedByProfileId: req.effectiveProfile!.id,
            publishedAt: new Date(),
          })
          .where(
            and(
              eq(studentAssessmentMarks.academicYearId, Number(academicYearId)),
              eq(studentAssessmentMarks.semesterId, Number(semesterId))
            )
          );
      }

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'SGPA_CGPA_COMPUTED',
        entityType: 'semester_result_summaries',
        entityId: `${academicYearId}-${semesterId}`,
        afterState: { computedCount: computed.length, publishResults: Boolean(publishResults) },
      });

      res.json({ computedCount: computed.length, summaries: computed });
    } catch (error) {
      console.error('SGPA computation failed:', error);
      res.status(500).json({ error: 'SGPA & CGPA computation failed' });
    }
  }
);

// 5. Backlogs & Supplementary/Makeup Clearance
academicsRouter.get('/backlogs', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const rows = await db
      .select({
        id: studentBacklogs.id,
        studentId: studentBacklogs.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        subjectId: studentBacklogs.subjectId,
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
      .innerJoin(students, eq(studentBacklogs.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(subjects, eq(studentBacklogs.subjectId, subjects.id))
      .innerJoin(academicYears, eq(studentBacklogs.academicYearId, academicYears.id))
      .innerJoin(semesters, eq(studentBacklogs.semesterId, semesters.id))
      .where(
        and(
          eff.role === 'student' && eff.studentId
            ? eq(studentBacklogs.studentId, eff.studentId)
            : undefined,
          eff.role === 'parent'
            ? eff.linkedStudentIds.length > 0
              ? inArray(studentBacklogs.studentId, eff.linkedStudentIds)
              : eq(studentBacklogs.studentId, -1)
            : undefined
        )
      )
      .orderBy(desc(studentBacklogs.createdAt));

    res.json({ backlogs: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load student backlogs' });
  }
});

academicsRouter.patch(
  '/backlogs/:id',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const backlogId = Number(req.params.id);
      const { status, makeupExamDate, makeupMarks, remarks } = req.body;
      const [existing] = await db
        .select()
        .from(studentBacklogs)
        .where(eq(studentBacklogs.id, backlogId));
      if (!existing) return res.status(404).json({ error: 'Backlog record not found' });

      const cleared = status === 'cleared';
      const [updated] = await db
        .update(studentBacklogs)
        .set({
          ...(status ? { status } : {}),
          ...(makeupExamDate ? { makeupExamDate } : {}),
          ...(makeupMarks !== undefined ? { makeupMarks: Number(makeupMarks).toFixed(2) } : {}),
          ...(remarks ? { remarks } : {}),
          ...(cleared ? { clearedAt: new Date(), clearedInSemesterId: existing.semesterId } : {}),
          updatedAt: new Date(),
        })
        .where(eq(studentBacklogs.id, backlogId))
        .returning();

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'BACKLOG_STATUS_UPDATED',
        entityType: 'student_backlogs',
        entityId: backlogId,
        beforeState: existing,
        afterState: updated,
      });

      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update backlog' });
    }
  }
);

// 6. Revaluation Requests Workflow (Student submit -> Admin/Faculty review -> Recalculate SGPA)
academicsRouter.get('/revaluations', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const rows = await db
      .select({
        id: revaluationRequests.id,
        studentId: revaluationRequests.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        subjectId: revaluationRequests.subjectId,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        academicYearId: revaluationRequests.academicYearId,
        academicYearCode: academicYears.code,
        semesterId: revaluationRequests.semesterId,
        semesterNumber: semesters.number,
        requestType: revaluationRequests.requestType,
        originalMarks: revaluationRequests.originalMarks,
        revisedMarks: revaluationRequests.revisedMarks,
        feeAmount: revaluationRequests.feeAmount,
        paymentReference: revaluationRequests.paymentReference,
        reason: revaluationRequests.reason,
        status: revaluationRequests.status,
        reviewerNotes: revaluationRequests.reviewerNotes,
        resolvedAt: revaluationRequests.resolvedAt,
        createdAt: revaluationRequests.createdAt,
      })
      .from(revaluationRequests)
      .innerJoin(students, eq(revaluationRequests.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(subjects, eq(revaluationRequests.subjectId, subjects.id))
      .innerJoin(academicYears, eq(revaluationRequests.academicYearId, academicYears.id))
      .innerJoin(semesters, eq(revaluationRequests.semesterId, semesters.id))
      .where(
        and(
          eff.role === 'student' && eff.studentId
            ? eq(revaluationRequests.studentId, eff.studentId)
            : undefined,
          eff.role === 'parent'
            ? eff.linkedStudentIds.length > 0
              ? inArray(revaluationRequests.studentId, eff.linkedStudentIds)
              : eq(revaluationRequests.studentId, -1)
            : undefined
        )
      )
      .orderBy(desc(revaluationRequests.createdAt));

    res.json({ revaluations: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load revaluation requests' });
  }
});

academicsRouter.post(
  '/revaluations',
  requireRole('student', 'super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const { subjectId, academicYearId, semesterId, requestType, originalMarks, reason, paymentReference } =
        req.body;
      const targetStudentId =
        eff.role === 'student' ? eff.studentId : Number(req.body.studentId);

      if (!targetStudentId || !subjectId || !academicYearId || !semesterId || !reason) {
        return res.status(400).json({ error: 'Subject, academic year, semester, and reason required' });
      }

      const [created] = await db
        .insert(revaluationRequests)
        .values({
          studentId: targetStudentId,
          subjectId: Number(subjectId),
          academicYearId: Number(academicYearId),
          semesterId: Number(semesterId),
          requestType: requestType || 'revaluation',
          originalMarks: Number(originalMarks || 0).toFixed(2),
          feeAmount: requestType === 'photocopy' ? 300 : requestType === 'challenge_valuation' ? 1500 : 500,
          paymentReference: paymentReference || `REV-ICEAS-${Date.now().toString().slice(-6)}`,
          reason: String(reason).trim(),
          status: 'submitted',
        })
        .returning();

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: eff.role,
        action: 'REVALUATION_SUBMITTED',
        entityType: 'revaluation_requests',
        entityId: created.id,
        afterState: created,
      });

      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit revaluation request' });
    }
  }
);

academicsRouter.patch(
  '/revaluations/:id',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const { status, revisedMarks, reviewerNotes } = req.body as {
        status: 'under_review' | 'completed' | 'rejected';
        revisedMarks?: number;
        reviewerNotes?: string;
      };
      const [existing] = await db
        .select()
        .from(revaluationRequests)
        .where(eq(revaluationRequests.id, id));
      if (!existing) return res.status(404).json({ error: 'Revaluation request not found' });

      const now = new Date();
      const [updated] = await db
        .update(revaluationRequests)
        .set({
          status,
          ...(revisedMarks !== undefined ? { revisedMarks: Number(revisedMarks).toFixed(2) } : {}),
          reviewerNotes: reviewerNotes || null,
          reviewedByProfileId: req.effectiveProfile!.id,
          ...(status === 'completed' || status === 'rejected' ? { resolvedAt: now } : {}),
          updatedAt: now,
        })
        .where(eq(revaluationRequests.id, id))
        .returning();

      // If completed with revised SEE marks, update SEE component mark and recompute SGPA/CGPA
      if (status === 'completed' && revisedMarks !== undefined) {
        const seeMarks = await db
          .select({
            id: studentAssessmentMarks.id,
            maxMarks: studentAssessmentMarks.maxMarks,
          })
          .from(studentAssessmentMarks)
          .innerJoin(assessmentComponents, eq(studentAssessmentMarks.componentId, assessmentComponents.id))
          .where(
            and(
              eq(studentAssessmentMarks.studentId, existing.studentId),
              eq(studentAssessmentMarks.subjectId, existing.subjectId),
              eq(studentAssessmentMarks.academicYearId, existing.academicYearId),
              eq(studentAssessmentMarks.semesterId, existing.semesterId),
              eq(assessmentComponents.category, 'see')
            )
          );

        if (seeMarks.length > 0) {
          const clamped = Math.min(seeMarks[0].maxMarks, Math.max(0, Number(revisedMarks)));
          await db
            .update(studentAssessmentMarks)
            .set({
              marksObtained: clamped.toFixed(2),
              remarks: `Revaluation resolved: ${reviewerNotes || 'Updated'}`,
              updatedAt: now,
            })
            .where(eq(studentAssessmentMarks.id, seeMarks[0].id));
        }

        await recomputeStudentSemesterSummary(
          existing.studentId,
          existing.academicYearId,
          existing.semesterId,
          true
        );
      }

      const [stu] = await db
        .select({ profileId: students.profileId })
        .from(students)
        .where(eq(students.id, existing.studentId));
      if (stu) {
        await dispatchNotification({
          recipientProfileId: stu.profileId,
          category: 'examination',
          title: `Revaluation Update (${status.replace('_', ' ').toUpperCase()})`,
          message: `Your revaluation request #${existing.id} is now ${status}.`,
        });
      }

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'REVALUATION_REVIEWED',
        entityType: 'revaluation_requests',
        entityId: id,
        beforeState: existing,
        afterState: updated,
      });

      res.json(updated);
    } catch (error) {
      console.error('Revaluation review failed:', error);
      res.status(500).json({ error: 'Failed to update revaluation request' });
    }
  }
);

// 7. Official Printable Marksheet Payload
academicsRouter.get('/transcript/:studentId', async (req: AuthRequest, res) => {
  try {
    const studentId = Number(req.params.studentId);
    const allowed = await assertStudentAccess(req, studentId);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const [stu] = await db
      .select({
        id: students.id,
        usn: students.usn,
        admissionNumber: students.admissionNumber,
        fullName: profiles.fullName,
        departmentName: departments.name,
        programName: programs.name,
      })
      .from(students)
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(departments, eq(students.departmentId, departments.id))
      .innerJoin(programs, eq(students.programId, programs.id))
      .where(eq(students.id, studentId));

    if (!stu) return res.status(404).json({ error: 'Student not found' });

    const eff = req.effectiveProfile!;
    const onlyPublished = eff.role === 'student' || eff.role === 'parent';

    const [summaries, marks] = await Promise.all([
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
            onlyPublished ? eq(semesterResultSummaries.isPublished, true) : undefined
          )
        )
        .orderBy(semesters.number),
      db
        .select({
          subjectCode: subjects.code,
          subjectName: subjects.name,
          credits: subjects.credits,
          semesterNumber: semesters.number,
          academicYearCode: academicYears.code,
          componentCode: assessmentComponents.code,
          componentCategory: assessmentComponents.category,
          marksObtained: studentAssessmentMarks.marksObtained,
          maxMarks: studentAssessmentMarks.maxMarks,
          workflowStatus: studentAssessmentMarks.workflowStatus,
        })
        .from(studentAssessmentMarks)
        .innerJoin(subjects, eq(studentAssessmentMarks.subjectId, subjects.id))
        .innerJoin(semesters, eq(studentAssessmentMarks.semesterId, semesters.id))
        .innerJoin(academicYears, eq(studentAssessmentMarks.academicYearId, academicYears.id))
        .innerJoin(assessmentComponents, eq(studentAssessmentMarks.componentId, assessmentComponents.id))
        .where(
          and(
            eq(studentAssessmentMarks.studentId, studentId),
            onlyPublished ? eq(studentAssessmentMarks.workflowStatus, 'published') : undefined
          )
        ),
    ]);

    res.json({ student: stu, summaries, marks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate transcript' });
  }
});
