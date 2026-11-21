import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  academicYears,
  accountProvisions,
  alumniProfiles,
  assessmentComponents,
  assessmentSchemes,
  faculty,
  gradeScales,
  hostelAllocations,
  institutions,
  libraryTransactions,
  markChangeRequests,
  placementApplications,
  profiles,
  programs,
  revaluationRequests,
  semesterResultSummaries,
  semesters,
  studentAchievements,
  studentAddresses,
  studentAdmissionHistory,
  studentAssessmentMarks,
  studentBacklogs,
  studentDocuments,
  studentEmergencyContacts,
  studentInternships,
  studentLeaveRequests,
  studentProjects,
  studentQualifications,
  students,
  subjects,
  transportAllocations,
} from './schema.ts';

let extendedPromise: Promise<void> | null = null;

export async function ensureExtendedSeedData(): Promise<void> {
  if (!extendedPromise) {
    extendedPromise = runExtendedSeedIfEmpty().catch((err) => {
      extendedPromise = null;
      throw err;
    });
  }
  return extendedPromise;
}

async function runExtendedSeedIfEmpty(): Promise<void> {
  const [gsCheck, stuList, instList, ayList, semList, progList, subjList, facList, profList] =
    await Promise.all([
      db.select({ total: count() }).from(gradeScales),
      db.select().from(students),
      db.select().from(institutions).limit(1),
      db.select().from(academicYears),
      db.select().from(semesters),
      db.select().from(programs),
      db.select().from(subjects),
      db.select().from(faculty),
      db.select().from(profiles),
    ]);

  if (instList.length === 0 || stuList.length === 0) return;

  const inst = instList[0];
  const ay2526 = ayList.find((y) => y.code === '2025-26') || ayList[0];
  const ay2627 = ayList.find((y) => y.code === '2026-27') || ayList[0];
  const sem4 = semList.find((s) => s.number === 4) || semList[0];
  const sem5 = semList.find((s) => s.number === 5) || semList[0];
  const progCse = progList.find((p) => p.code === 'BE-CSE') || progList[0];

  const stuAarav = stuList.find((s) => s.usn === '1IC23CS001') || stuList[0];
  const stuPriya = stuList.find((s) => s.usn === '1IC23CS002') || stuList[0];
  const stuRohan = stuList.find((s) => s.usn === '1IC23CS003') || stuList[0];
  const stuAnanya = stuList.find((s) => s.usn === '1IC23CS004') || stuList[0];
  const stuKarthik = stuList.find((s) => s.usn === '1IC23CS005') || stuList[0];
  const stuSneha = stuList.find((s) => s.usn === '1IC23CS006') || stuList[0];

  const subDbms = subjList.find((s) => s.code === '21CS53') || subjList[0];
  const subCn = subjList.find((s) => s.code === '21CS52') || subjList[0];
  const subAiml = subjList.find((s) => s.code === '21CS54') || subjList[0];
  const subSe = subjList.find((s) => s.code === '21CS51') || subjList[0];
  const subDbmsLab = subjList.find((s) => s.code === '21CSL55') || subjList[0];
  const subHistDaa = subjList.find((s) => s.code === '21CS42') || subjList[0];

  const facRao = facList.find((f) => f.employeeCode === 'FAC-CSE-014') || facList[0];
  const adminProf =
    profList.find((p) => p.uid === 'demo-uid-super-admin') ||
    profList.find((p) => p.role === 'super_admin') ||
    profList[0];
  const facRaoProf =
    profList.find((p) => p.uid === 'demo-uid-faculty-rao') || adminProf;

  // 1. Account Provisions (seed pre-approved institutional allowlist entries if empty)
  const [apCount] = await db.select({ total: count() }).from(accountProvisions);
  if ((apCount?.total ?? 0) === 0) {
    const realAdmins = profList.filter((p) => !p.isDemoAccount && p.role === 'super_admin');
    const entries: (typeof accountProvisions.$inferInsert)[] = [
      {
        email: 'dean.academics@impactcampus.edu.in',
        role: 'super_admin',
        fullName: 'Dr. Anand Deshpande (Dean Academics)',
        referenceCode: 'ADM-DEAN-01',
        status: 'invited',
        invitedByProfileId: adminProf.id,
        notes: 'Pre-provisioned Dean Google SSO invite.',
      },
      {
        email: 'sridhar.murthy@impactcampus.edu.in',
        role: 'faculty',
        fullName: 'Dr. Sridhar Murthy (HOD ISE)',
        referenceCode: 'FAC-ISE-005',
        status: 'invited',
        invitedByProfileId: adminProf.id,
        notes: 'Pre-provisioned ISE HOD Google SSO invite.',
      },
      {
        email: 'aarav.sharma.official@impactcampus.edu.in',
        role: 'student',
        fullName: 'Aarav Sharma',
        referenceCode: stuAarav.usn,
        linkedStudentId: stuAarav.id,
        status: 'invited',
        invitedByProfileId: adminProf.id,
        notes: 'Bound to permanent USN 1IC23CS001.',
      },
    ];
    for (const adm of realAdmins) {
      entries.push({
        email: adm.email.toLowerCase(),
        role: adm.role,
        fullName: adm.fullName,
        referenceCode: 'ICEAS-OWNER',
        status: 'claimed',
        claimedProfileId: adm.id,
        claimedAt: new Date(),
        notes: 'Primary institutional owner profile.',
      });
    }
    await db.insert(accountProvisions).values(entries).onConflictDoNothing();
  }

  // 2. Grade Scales (VTU-2022)
  if ((gsCheck[0]?.total ?? 0) === 0) {
    await db.insert(gradeScales).values([
      { institutionId: inst.id, schemeCode: 'VTU-2022', minPercentage: '90.00', maxPercentage: '100.00', gradeLetter: 'O', gradePoints: '10.00', statusLabel: 'Outstanding', isPass: true },
      { institutionId: inst.id, schemeCode: 'VTU-2022', minPercentage: '80.00', maxPercentage: '89.99', gradeLetter: 'A+', gradePoints: '9.00', statusLabel: 'Excellent', isPass: true },
      { institutionId: inst.id, schemeCode: 'VTU-2022', minPercentage: '70.00', maxPercentage: '79.99', gradeLetter: 'A', gradePoints: '8.00', statusLabel: 'Very Good', isPass: true },
      { institutionId: inst.id, schemeCode: 'VTU-2022', minPercentage: '60.00', maxPercentage: '69.99', gradeLetter: 'B+', gradePoints: '7.00', statusLabel: 'Good', isPass: true },
      { institutionId: inst.id, schemeCode: 'VTU-2022', minPercentage: '55.00', maxPercentage: '59.99', gradeLetter: 'B', gradePoints: '6.00', statusLabel: 'Above Average', isPass: true },
      { institutionId: inst.id, schemeCode: 'VTU-2022', minPercentage: '50.00', maxPercentage: '54.99', gradeLetter: 'C', gradePoints: '5.00', statusLabel: 'Average', isPass: true },
      { institutionId: inst.id, schemeCode: 'VTU-2022', minPercentage: '40.00', maxPercentage: '49.99', gradeLetter: 'P', gradePoints: '4.00', statusLabel: 'Pass', isPass: true },
      { institutionId: inst.id, schemeCode: 'VTU-2022', minPercentage: '0.00', maxPercentage: '39.99', gradeLetter: 'F', gradePoints: '0.00', statusLabel: 'Fail / Reappear', isPass: false },
    ]);
  }

  // 3. Assessment Schemes, Components, Marks, SGPA/CGPA, Backlogs & Revaluations
  const [schemeCount] = await db.select({ total: count() }).from(assessmentSchemes);
  if ((schemeCount?.total ?? 0) === 0 && ay2526 && ay2627 && progCse) {
    const [scheme25, scheme26] = await db
      .insert(assessmentSchemes)
      .values([
        {
          institutionId: inst.id,
          academicYearId: ay2526.id,
          programId: progCse.id,
          schemeCode: 'VTU-2022-50-50',
          name: 'VTU 2022 Outcome-Based Scheme (50 CIE + 50 SEE)',
          cieMaxMarks: 50,
          seeMaxMarks: 50,
          totalMaxMarks: 100,
          minCiePercentage: 40,
          minSeePercentage: 35,
          minTotalPercentage: 40,
          isActive: true,
        },
        {
          institutionId: inst.id,
          academicYearId: ay2627.id,
          programId: progCse.id,
          schemeCode: 'VTU-2022-50-50',
          name: 'VTU 2022 Outcome-Based Scheme (50 CIE + 50 SEE)',
          cieMaxMarks: 50,
          seeMaxMarks: 50,
          totalMaxMarks: 100,
          minCiePercentage: 40,
          minSeePercentage: 35,
          minTotalPercentage: 40,
          isActive: true,
        },
      ])
      .returning();

    const comps26 = await db
      .insert(assessmentComponents)
      .values([
        { schemeId: scheme26.id, code: 'IA1', name: 'Internal Assessment 1', category: 'cie', maxMarks: 25, weightagePct: '15.00', passingMarks: 10, displayOrder: 1 },
        { schemeId: scheme26.id, code: 'IA2', name: 'Internal Assessment 2', category: 'cie', maxMarks: 25, weightagePct: '15.00', passingMarks: 10, displayOrder: 2 },
        { schemeId: scheme26.id, code: 'IA3', name: 'Internal Assessment 3 / Improvement', category: 'cie', maxMarks: 25, weightagePct: '5.00', passingMarks: 10, displayOrder: 3 },
        { schemeId: scheme26.id, code: 'ASSIGN', name: 'Assignments & Case Studies', category: 'cie', maxMarks: 10, weightagePct: '10.00', passingMarks: 4, displayOrder: 4 },
        { schemeId: scheme26.id, code: 'QUIZ', name: 'Continuous Quiz / Seminar', category: 'cie', maxMarks: 10, weightagePct: '5.00', passingMarks: 4, displayOrder: 5 },
        { schemeId: scheme26.id, code: 'SEE', name: 'Semester End Examination (Scaled to 50)', category: 'see', maxMarks: 50, weightagePct: '50.00', passingMarks: 18, displayOrder: 6 },
      ])
      .returning();

    const comps25 = await db
      .insert(assessmentComponents)
      .values([
        { schemeId: scheme25.id, code: 'IA1', name: 'Internal Assessment 1', category: 'cie', maxMarks: 25, weightagePct: '20.00', passingMarks: 10, displayOrder: 1 },
        { schemeId: scheme25.id, code: 'IA2', name: 'Internal Assessment 2', category: 'cie', maxMarks: 25, weightagePct: '20.00', passingMarks: 10, displayOrder: 2 },
        { schemeId: scheme25.id, code: 'ASSIGN', name: 'Course Assignment', category: 'cie', maxMarks: 10, weightagePct: '10.00', passingMarks: 4, displayOrder: 3 },
        { schemeId: scheme25.id, code: 'SEE', name: 'Semester End Examination', category: 'see', maxMarks: 50, weightagePct: '50.00', passingMarks: 18, displayOrder: 4 },
      ])
      .returning();

    const c26 = Object.fromEntries(comps26.map((c) => [c.code, c]));
    const c25 = Object.fromEntries(comps25.map((c) => [c.code, c]));

    const now = new Date();
    const marksToInsert: (typeof studentAssessmentMarks.$inferInsert)[] = [
      // Sem 4 (2025-26) Historical Published Marks for 21CS42 DAA
      { studentId: stuAarav.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.IA1.id, marksObtained: '23.00', maxMarks: 25, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuAarav.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.IA2.id, marksObtained: '22.00', maxMarks: 25, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuAarav.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.ASSIGN.id, marksObtained: '9.50', maxMarks: 10, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuAarav.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.SEE.id, marksObtained: '44.00', maxMarks: 50, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },

      { studentId: stuPriya.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.IA1.id, marksObtained: '24.00', maxMarks: 25, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuPriya.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.IA2.id, marksObtained: '24.00', maxMarks: 25, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuPriya.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.ASSIGN.id, marksObtained: '10.00', maxMarks: 10, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuPriya.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.SEE.id, marksObtained: '46.00', maxMarks: 50, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },

      { studentId: stuKarthik.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.IA1.id, marksObtained: '11.00', maxMarks: 25, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuKarthik.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.IA2.id, marksObtained: '9.00', maxMarks: 25, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuKarthik.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.ASSIGN.id, marksObtained: '6.00', maxMarks: 10, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now },
      { studentId: stuKarthik.id, subjectId: subHistDaa.id, academicYearId: ay2526.id, semesterId: sem4.id, componentId: c25.SEE.id, marksObtained: '14.00', maxMarks: 50, workflowStatus: 'published', enteredByProfileId: facRaoProf.id, approvedByProfileId: adminProf.id, submittedAt: now, publishedAt: now, remarks: 'Below 35% SEE threshold' },

      // Sem 5 (2026-27) Current Internal & SEE Marks (Aarav, Priya, Rohan, Ananya, Karthik, Sneha)
      ...[
        { stu: stuAarav, subj: subDbms, ia1: 23, ia2: 24, assign: 9.5, quiz: 9, see: 44, wf: 'published' },
        { stu: stuAarav, subj: subCn, ia1: 21, ia2: 22, assign: 9, quiz: 8.5, see: 41, wf: 'published' },
        { stu: stuAarav, subj: subAiml, ia1: 22, ia2: 23, assign: 9.5, quiz: 9, see: 43, wf: 'published' },
        { stu: stuAarav, subj: subSe, ia1: 20, ia2: 21, assign: 9, quiz: 8, see: 39, wf: 'published' },
        { stu: stuAarav, subj: subDbmsLab, ia1: 24, ia2: 24, assign: 10, quiz: 9, see: 47, wf: 'published' },

        { stu: stuPriya, subj: subDbms, ia1: 24, ia2: 25, assign: 10, quiz: 9.5, see: 46, wf: 'published' },
        { stu: stuPriya, subj: subCn, ia1: 23, ia2: 23, assign: 9.5, quiz: 9, see: 44, wf: 'published' },
        { stu: stuPriya, subj: subAiml, ia1: 24, ia2: 24, assign: 10, quiz: 9.5, see: 45, wf: 'published' },

        { stu: stuRohan, subj: subDbms, ia1: 15, ia2: 17, assign: 7, quiz: 6, see: 29, wf: 'published' },
        { stu: stuAnanya, subj: subDbms, ia1: 21, ia2: 20, assign: 8.5, quiz: 8, see: 40, wf: 'submitted' },
        { stu: stuKarthik, subj: subDbms, ia1: 10, ia2: 12, assign: 5, quiz: 4, see: 19, wf: 'published' },
        { stu: stuSneha, subj: subDbms, ia1: 22, ia2: 21, assign: 9, quiz: 8.5, see: 42, wf: 'draft' },
      ].flatMap((row) => [
        { studentId: row.stu.id, subjectId: row.subj.id, academicYearId: ay2627.id, semesterId: sem5.id, componentId: c26.IA1.id, marksObtained: row.ia1.toFixed(2), maxMarks: 25, workflowStatus: row.wf, enteredByProfileId: facRaoProf.id, approvedByProfileId: row.wf === 'published' ? adminProf.id : null, submittedAt: row.wf !== 'draft' ? now : null, publishedAt: row.wf === 'published' ? now : null },
        { studentId: row.stu.id, subjectId: row.subj.id, academicYearId: ay2627.id, semesterId: sem5.id, componentId: c26.IA2.id, marksObtained: row.ia2.toFixed(2), maxMarks: 25, workflowStatus: row.wf, enteredByProfileId: facRaoProf.id, approvedByProfileId: row.wf === 'published' ? adminProf.id : null, submittedAt: row.wf !== 'draft' ? now : null, publishedAt: row.wf === 'published' ? now : null },
        { studentId: row.stu.id, subjectId: row.subj.id, academicYearId: ay2627.id, semesterId: sem5.id, componentId: c26.ASSIGN.id, marksObtained: row.assign.toFixed(2), maxMarks: 10, workflowStatus: row.wf, enteredByProfileId: facRaoProf.id, approvedByProfileId: row.wf === 'published' ? adminProf.id : null, submittedAt: row.wf !== 'draft' ? now : null, publishedAt: row.wf === 'published' ? now : null },
        { studentId: row.stu.id, subjectId: row.subj.id, academicYearId: ay2627.id, semesterId: sem5.id, componentId: c26.QUIZ.id, marksObtained: row.quiz.toFixed(2), maxMarks: 10, workflowStatus: row.wf, enteredByProfileId: facRaoProf.id, approvedByProfileId: row.wf === 'published' ? adminProf.id : null, submittedAt: row.wf !== 'draft' ? now : null, publishedAt: row.wf === 'published' ? now : null },
        { studentId: row.stu.id, subjectId: row.subj.id, academicYearId: ay2627.id, semesterId: sem5.id, componentId: c26.SEE.id, marksObtained: row.see.toFixed(2), maxMarks: 50, workflowStatus: row.wf, enteredByProfileId: facRaoProf.id, approvedByProfileId: row.wf === 'published' ? adminProf.id : null, submittedAt: row.wf !== 'draft' ? now : null, publishedAt: row.wf === 'published' ? now : null },
      ]),
    ];

    const insertedMarks = await db
      .insert(studentAssessmentMarks)
      .values(marksToInsert)
      .onConflictDoNothing()
      .returning();

    if (insertedMarks.length > 0) {
      const targetMark = insertedMarks.find(
        (m) => m.studentId === stuRohan.id && m.subjectId === subDbms.id
      ) || insertedMarks[0];
      await db.insert(markChangeRequests).values({
        studentAssessmentMarkId: targetMark.id,
        studentId: targetMark.studentId,
        subjectId: targetMark.subjectId,
        requestedByProfileId: facRaoProf.id,
        previousMarks: targetMark.marksObtained,
        requestedMarks: String(Math.min(targetMark.maxMarks, Number(targetMark.marksObtained) + 2)),
        reason: 'Re-totalling of Question 4b in DBMS evaluation script.',
        status: 'pending',
      });
    }

    // Semester Result Summaries (Sem 4 + Sem 5)
    await db
      .insert(semesterResultSummaries)
      .values([
        { studentId: stuAarav.id, academicYearId: ay2526.id, semesterId: sem4.id, totalCreditsRegistered: 20, totalCreditsEarned: 20, sgpa: '9.10', cgpa: '9.05', percentage: '85.50', resultStatus: 'pass', backlogCount: 0, isPublished: true, publishedAt: now },
        { studentId: stuAarav.id, academicYearId: ay2627.id, semesterId: sem5.id, totalCreditsRegistered: 17, totalCreditsEarned: 17, sgpa: '9.24', cgpa: '9.14', percentage: '87.40', resultStatus: 'pass', backlogCount: 0, isPublished: true, publishedAt: now },
        { studentId: stuPriya.id, academicYearId: ay2526.id, semesterId: sem4.id, totalCreditsRegistered: 20, totalCreditsEarned: 20, sgpa: '9.60', cgpa: '9.52', percentage: '91.20', resultStatus: 'pass', backlogCount: 0, isPublished: true, publishedAt: now },
        { studentId: stuPriya.id, academicYearId: ay2627.id, semesterId: sem5.id, totalCreditsRegistered: 12, totalCreditsEarned: 12, sgpa: '9.67', cgpa: '9.58', percentage: '91.80', resultStatus: 'pass', backlogCount: 0, isPublished: true, publishedAt: now },
        { studentId: stuRohan.id, academicYearId: ay2627.id, semesterId: sem5.id, totalCreditsRegistered: 4, totalCreditsEarned: 4, sgpa: '6.00', cgpa: '6.85', percentage: '58.00', resultStatus: 'pass', backlogCount: 0, isPublished: true, publishedAt: now },
        { studentId: stuKarthik.id, academicYearId: ay2526.id, semesterId: sem4.id, totalCreditsRegistered: 20, totalCreditsEarned: 16, sgpa: '5.20', cgpa: '5.45', percentage: '48.00', resultStatus: 'fail', backlogCount: 1, isPublished: true, publishedAt: now },
        { studentId: stuKarthik.id, academicYearId: ay2627.id, semesterId: sem5.id, totalCreditsRegistered: 4, totalCreditsEarned: 0, sgpa: '0.00', cgpa: '5.10', percentage: '38.00', resultStatus: 'fail', backlogCount: 2, isPublished: true, publishedAt: now },
      ])
      .onConflictDoNothing();

    // Backlogs
    await db.insert(studentBacklogs).values([
      {
        studentId: stuKarthik.id,
        subjectId: subHistDaa.id,
        academicYearId: ay2526.id,
        semesterId: sem4.id,
        originalMarks: '31.00',
        attemptNumber: 1,
        makeupExamDate: '2026-12-18',
        status: 'registered_makeup',
        remarks: 'Registered for VTU supplementary makeup examination.',
      },
      {
        studentId: stuKarthik.id,
        subjectId: subDbms.id,
        academicYearId: ay2627.id,
        semesterId: sem5.id,
        originalMarks: '34.00',
        attemptNumber: 1,
        status: 'active',
        remarks: 'Shortfall in Semester End Exam component.',
      },
    ]);

    // Revaluation Requests
    await db.insert(revaluationRequests).values([
      {
        studentId: stuRohan.id,
        subjectId: subDbms.id,
        academicYearId: ay2627.id,
        semesterId: sem5.id,
        requestType: 'revaluation',
        originalMarks: '58.00',
        feeAmount: 500,
        paymentReference: 'REV-VTU-2026-441',
        reason: 'Requesting answer script re-evaluation for Section B SQL Indexing question.',
        status: 'under_review',
      },
      {
        studentId: stuAarav.id,
        subjectId: subSe.id,
        academicYearId: ay2627.id,
        semesterId: sem5.id,
        requestType: 'photocopy',
        originalMarks: '79.00',
        revisedMarks: '82.00',
        feeAmount: 300,
        paymentReference: 'REV-VTU-2026-398',
        reason: 'Verified answer script totaling; 3 marks awarded for UML sequence diagram.',
        status: 'completed',
        reviewedByProfileId: adminProf.id,
        reviewerNotes: 'Approved by Controller of Examinations; SGPA recalculated.',
        resolvedAt: now,
      },
    ]);
  }

  // 4. Student Personal Lifecycle Extensions (Addresses, Contacts, Qualifications, Documents, Admission History)
  const [addrCheck] = await db.select({ total: count() }).from(studentAddresses);
  if ((addrCheck?.total ?? 0) === 0) {
    for (const stu of stuList) {
      await db.insert(studentAddresses).values([
        {
          studentId: stu.id,
          addressType: 'current',
          line1: stu.address,
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560092',
          country: 'India',
          isPrimary: true,
        },
        {
          studentId: stu.id,
          addressType: 'permanent',
          line1: stu.address,
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560092',
          country: 'India',
          isPrimary: false,
        },
      ]);
      await db.insert(studentEmergencyContacts).values({
        studentId: stu.id,
        contactName: stu.emergencyContactName,
        relationship: 'Parent / Guardian',
        phone: stu.emergencyContactPhone,
        isPrimary: true,
      });
      const prevQuals = stu.previousAcademicRecordsJson || [
        { qualification: 'Class X (SSLC / CBSE)', board: 'Karnataka / CBSE', year: stu.admissionYear - 2, percentage: '91.4%' },
        { qualification: 'II PUC / Class XII', board: 'Karnataka PU Board', year: stu.admissionYear, percentage: '89.2%' },
      ];
      for (const q of prevQuals) {
        await db.insert(studentQualifications).values({
          studentId: stu.id,
          qualification: q.qualification,
          institutionName: 'Bengaluru Pre-University & High School',
          boardOrUniversity: q.board,
          passingYear: q.year,
          percentageOrCgpa: q.percentage,
          certificateRef: `CERT-${stu.usn}-${q.year}`,
        });
      }
      const docs = stu.admissionDocsJson || [
        { title: 'Allotment Order', refNo: `KEA-${stu.admissionNumber}`, verified: true },
        { title: '10+2 / II PUC Marks Card', refNo: `PUC-${stu.usn}`, verified: true },
        { title: 'Transfer Certificate', refNo: `TC-${stu.usn}`, verified: stu.usn !== '1IC23CS005' },
      ];
      for (const d of docs) {
        await db.insert(studentDocuments).values({
          studentId: stu.id,
          documentType: d.title.toLowerCase().includes('puc') ? 'marks_card' : d.title.toLowerCase().includes('tc') ? 'tc' : 'allotment_order',
          title: d.title,
          referenceNumber: d.refNo,
          verificationStatus: d.verified ? 'verified' : 'pending',
          verifiedByProfileId: d.verified ? adminProf.id : null,
          verifiedAt: d.verified ? new Date() : null,
        });
      }
      await db
        .insert(studentAdmissionHistory)
        .values({
          studentId: stu.id,
          admissionNumber: stu.admissionNumber,
          admissionDate: `${stu.admissionYear}-08-14`,
          admissionCategory: stu.usn.endsWith('003') ? 'COMEDK' : stu.usn.endsWith('005') ? 'Management' : 'KCET',
          seatType: 'Regular',
          allotmentRank: stu.usn === '1IC23CS001' ? 8420 : stu.usn === '1IC23CS002' ? 6115 : 14250,
          allotmentOrderNo: `KEA-${stu.admissionNumber}`,
          previousInstitution: 'National Public School / Deeksha PU College, Bengaluru',
          verificationStatus: 'verified',
          verifiedByProfileId: adminProf.id,
        })
        .onConflictDoNothing();
    }
  }

  // 5. Extended Lifecycle Modules (Achievements, Projects, Internships, Placements, Leaves, Library, Transport, Hostel, Alumni)
  const [achCheck] = await db.select({ total: count() }).from(studentAchievements);
  if ((achCheck?.total ?? 0) === 0 && ay2627 && sem5) {
    await db.insert(studentAchievements).values([
      {
        studentId: stuAarav.id,
        title: 'Smart India Hackathon Finalist — Campus Energy Grid Optimizer',
        category: 'hackathon',
        issuer: 'Ministry of Education Innovation Cell',
        achievedOn: '2026-09-22',
        level: 'national',
        description: 'Built an IoT + PostgreSQL time-series dashboard reducing hostel peak load by 14%.',
        certificateRef: 'SIH-2026-KA-1102',
        verified: true,
      },
      {
        studentId: stuAarav.id,
        title: 'AWS Certified Cloud Practitioner',
        category: 'certification',
        issuer: 'Amazon Web Services',
        achievedOn: '2026-07-10',
        level: 'international',
        certificateRef: 'AWS-CP-884129',
        verified: true,
      },
      {
        studentId: stuPriya.id,
        title: 'IEEE Student Paper Presentation — Privacy-Preserving Attendance Liveness',
        category: 'publication',
        issuer: 'IEEE Bengaluru Section',
        achievedOn: '2026-10-05',
        level: 'state',
        certificateRef: 'IEEE-BLR-2026-044',
        verified: true,
      },
    ]);

    await db.insert(studentProjects).values([
      {
        studentId: stuAarav.id,
        academicYearId: ay2627.id,
        semesterId: sem5.id,
        title: 'Distributed PostgreSQL Query Planner & ERP Ledger',
        projectType: 'mini',
        domain: 'Database Systems',
        techStack: 'PostgreSQL, TypeScript, Drizzle ORM, React',
        guideFacultyId: facRao?.id ?? null,
        repositoryUrl: 'https://git.impactcampus.edu.in/1ic23cs001/dbms-ledger',
        status: 'completed',
        gradeOrRemarks: 'Evaluated 48/50 — Exemplary normalization',
      },
      {
        studentId: stuPriya.id,
        academicYearId: ay2627.id,
        semesterId: sem5.id,
        title: 'On-Device Anti-Spoofing Liveness Classifier',
        projectType: 'research',
        domain: 'Computer Vision',
        techStack: 'Python, ONNX Runtime, FastAPI',
        guideFacultyId: facRao?.id ?? null,
        status: 'in_progress',
      },
    ]);

    await db.insert(studentInternships).values([
      {
        studentId: stuAarav.id,
        companyName: 'Razorpay Software Pvt Ltd',
        roleTitle: 'Backend Engineering Intern',
        internshipType: 'summer',
        startDate: '2026-06-01',
        endDate: '2026-07-31',
        stipendInr: 35000,
        location: 'Koramangala, Bengaluru',
        supervisorName: 'Vikramaditya Rao (Staff Engineer)',
        completionStatus: 'verified',
        certificateRef: 'RZP-INT-2026-091',
      },
      {
        studentId: stuPriya.id,
        companyName: 'IISc Robert Bosch Centre for Cyber-Physical Systems',
        roleTitle: 'Undergraduate Research Intern',
        internshipType: 'research',
        startDate: '2026-05-15',
        endDate: '2026-07-20',
        stipendInr: 20000,
        location: 'Bengaluru',
        completionStatus: 'verified',
        certificateRef: 'IISC-RBCCPS-2026-18',
      },
    ]);

    await db.insert(placementApplications).values([
      {
        studentId: stuAarav.id,
        academicYearId: ay2627.id,
        companyName: 'Atlassian India',
        jobRole: 'Software Engineer Intern (Pre-Placement Track)',
        ctcLpa: '18.50',
        driveDate: '2026-11-28',
        roundStage: 'technical_round',
        offerStatus: 'none',
        remarks: 'Cleared online coding round (top 8%).',
      },
      {
        studentId: stuPriya.id,
        academicYearId: ay2627.id,
        companyName: 'Mercedes-Benz R&D India',
        jobRole: 'Embedded & AI Systems Intern',
        ctcLpa: '14.00',
        driveDate: '2026-11-12',
        roundStage: 'offered',
        offerStatus: 'accepted',
        offerLetterRef: 'MBRDI-OFFER-2026-112',
        remarks: 'Bengaluru Whitefield Campus offer accepted.',
      },
    ]);

    await db.insert(studentLeaveRequests).values([
      {
        studentId: stuAarav.id,
        academicYearId: ay2627.id,
        semesterId: sem5.id,
        leaveType: 'on_duty',
        fromDate: '2026-09-21',
        toDate: '2026-09-23',
        daysCount: 3,
        reason: 'Representing ICEAS at Smart India Hackathon Nodal Finale, Chennai.',
        supportingDocRef: 'OD-DEAN-2026-019',
        status: 'approved',
        reviewedByProfileId: facRaoProf.id,
        reviewRemarks: 'Approved on-duty academic representation.',
        reviewedAt: new Date(),
      },
      {
        studentId: stuRohan.id,
        academicYearId: ay2627.id,
        semesterId: sem5.id,
        leaveType: 'medical',
        fromDate: '2026-11-19',
        toDate: '2026-11-20',
        daysCount: 2,
        reason: 'Viral fever recovery with doctor prescription.',
        supportingDocRef: 'MED-CERT-882',
        status: 'pending',
      },
    ]);

    await db.insert(libraryTransactions).values([
      {
        studentId: stuAarav.id,
        bookIsbn: '978-0078022159',
        bookTitle: 'Database System Concepts (7th Edition)',
        author: 'Silberschatz, Korth & Sudarshan',
        accessionNumber: 'ICEAS-LIB-4421',
        issuedDate: '2026-11-01',
        dueDate: '2026-11-25',
        status: 'issued',
      },
      {
        studentId: stuRohan.id,
        bookIsbn: '978-0132126953',
        bookTitle: 'Computer Networking: A Top-Down Approach',
        author: 'Kurose & Ross',
        accessionNumber: 'ICEAS-LIB-3190',
        issuedDate: '2026-10-15',
        dueDate: '2026-11-05',
        fineInr: 45,
        status: 'overdue',
      },
    ]);

    await db.insert(transportAllocations).values([
      {
        studentId: stuAarav.id,
        academicYearId: ay2627.id,
        routeCode: 'RT-04',
        routeName: 'Yelahanka – Sahakaranagar – Impact Campus',
        boardingStop: 'Sahakaranagar Post Office',
        busNumber: 'KA-04-AD-7712',
        passNumber: 'BUS-2026-0412',
        annualFeeInr: 18500,
        status: 'active',
      },
    ]);

    await db.insert(hostelAllocations).values([
      {
        studentId: stuPriya.id,
        academicYearId: ay2627.id,
        hostelBlock: 'Kalpana Chawla Women Residence',
        roomNumber: 'KC-214',
        bedCode: 'B2',
        roomType: '2-Sharing Attached',
        messPlan: 'South & North Indian Veg',
        annualFeeInr: 78000,
        status: 'active',
      },
    ]);

    await db
      .insert(alumniProfiles)
      .values([
        {
          studentId: stuSneha.id,
          graduationYear: 2026,
          degreeAwarded: 'B.E. Computer Science & Engineering (Demo Alumni Record)',
          finalCgpa: '8.94',
          currentCompany: 'Bosch Global Software Technologies',
          currentRole: 'Associate Software Engineer',
          city: 'Bengaluru',
          linkedinUrl: 'https://linkedin.com/in/sneha-menon-iceas',
          mentorshipAvailable: true,
          verified: true,
        },
      ])
      .onConflictDoNothing();
  }
}
