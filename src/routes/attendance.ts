import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { Router } from 'express';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  attendanceCorrections,
  attendancePolicies,
  attendanceRecords,
  attendanceSessions,
  attendanceVerificationLogs,
  classrooms,
  consentRecords,
  faculty,
  profiles,
  sections,
  studentEnrollments,
  students,
  subjectFacultyAssignments,
  subjects,
} from '../db/schema.ts';
import { AuthRequest, rateLimit, requireAuth, requireRole } from '../middleware/auth.ts';
import { dispatchNotification, recordAuditLog } from '../services/audit.ts';
import {
  getBiometricProviderStatus,
  verifyFaceWithExternalProvider,
} from '../services/biometric.ts';

export const attendanceRouter = Router();

attendanceRouter.use(requireAuth);

function computeQrSignature(
  qrSecret: string,
  sessionId: number,
  expiresAtMs: number,
  nonce: string
): string {
  return crypto
    .createHmac('sha256', qrSecret)
    .update(`${sessionId}:${expiresAtMs}:${nonce}`)
    .digest('hex');
}

function computeShortCode(qrSecret: string, sessionId: number, windowIdx: number): string {
  return crypto
    .createHmac('sha256', qrSecret)
    .update(`${sessionId}:window:${windowIdx}`)
    .digest('hex')
    .slice(0, 6)
    .toUpperCase();
}

// List Attendance Sessions (Role-scoped)
attendanceRouter.get('/sessions', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const academicYearId = req.query.academicYearId
      ? Number(req.query.academicYearId)
      : undefined;

    const allSessions = await db
      .select({
        id: attendanceSessions.id,
        academicYearId: attendanceSessions.academicYearId,
        semesterId: attendanceSessions.semesterId,
        subjectId: attendanceSessions.subjectId,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        facultyId: attendanceSessions.facultyId,
        facultyName: profiles.fullName,
        sectionId: attendanceSessions.sectionId,
        sectionName: sections.name,
        classroomId: attendanceSessions.classroomId,
        roomCode: classrooms.roomCode,
        sessionDate: attendanceSessions.sessionDate,
        mode: attendanceSessions.mode,
        status: attendanceSessions.status,
        qrIntervalSeconds: attendanceSessions.qrIntervalSeconds,
        qrExpiresAt: attendanceSessions.qrExpiresAt,
        confidenceThreshold: attendanceSessions.confidenceThreshold,
        startedAt: attendanceSessions.startedAt,
        closedAt: attendanceSessions.closedAt,
        notes: attendanceSessions.notes,
      })
      .from(attendanceSessions)
      .innerJoin(subjects, eq(attendanceSessions.subjectId, subjects.id))
      .innerJoin(faculty, eq(attendanceSessions.facultyId, faculty.id))
      .innerJoin(profiles, eq(faculty.profileId, profiles.id))
      .innerJoin(sections, eq(attendanceSessions.sectionId, sections.id))
      .leftJoin(classrooms, eq(attendanceSessions.classroomId, classrooms.id))
      .where(
        academicYearId ? eq(attendanceSessions.academicYearId, academicYearId) : undefined
      )
      .orderBy(desc(attendanceSessions.startedAt));

    let scopedSessions = allSessions;
    if (eff.role === 'faculty' && eff.facultyId) {
      scopedSessions = allSessions.filter((s) => s.facultyId === eff.facultyId);
    } else if (eff.role === 'student' && eff.studentId) {
      const enrolls = await db
        .select({ sectionId: studentEnrollments.sectionId })
        .from(studentEnrollments)
        .where(eq(studentEnrollments.studentId, eff.studentId));
      const secIds = new Set(enrolls.map((e) => e.sectionId));
      scopedSessions = allSessions.filter((s) => secIds.has(s.sectionId));
    } else if (eff.role === 'parent') {
      if (eff.linkedStudentIds.length === 0) {
        scopedSessions = [];
      } else {
        const enrolls = await db
          .select({ sectionId: studentEnrollments.sectionId })
          .from(studentEnrollments)
          .where(inArray(studentEnrollments.studentId, eff.linkedStudentIds));
        const secIds = new Set(enrolls.map((e) => e.sectionId));
        scopedSessions = allSessions.filter((s) => secIds.has(s.sectionId));
      }
    }

    // Attach attendance counts per session
    const allRecs = await db.select().from(attendanceRecords);
    const allEnrolls = await db.select().from(studentEnrollments);

    const enriched = scopedSessions.map((sess) => {
      const recs = allRecs.filter((r) => r.sessionId === sess.id);
      const enrolledInSec = allEnrolls.filter(
        (e) =>
          e.sectionId === sess.sectionId &&
          e.academicYearId === sess.academicYearId &&
          e.semesterId === sess.semesterId
      );
      const myRecord =
        eff.role === 'student' && eff.studentId
          ? recs.find((r) => r.studentId === eff.studentId) || null
          : null;

      return {
        ...sess,
        totalEnrolled: enrolledInSec.length,
        presentCount: recs.filter((r) => r.status === 'present' || r.status === 'late').length,
        absentCount: recs.filter((r) => r.status === 'absent').length,
        pendingReviewCount: recs.filter((r) => r.status === 'pending_review').length,
        myRecord,
      };
    });

    res.json({ sessions: enriched });
  } catch (error) {
    console.error('Failed to list attendance sessions:', error);
    res.status(500).json({ error: 'Failed to load attendance sessions' });
  }
});

// Start Attendance Session (Faculty / Super Admin)
attendanceRouter.post(
  '/sessions',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const {
        academicYearId,
        semesterId,
        subjectId,
        sectionId,
        timetableSlotId,
        classroomId,
        mode,
        notes,
        facultyId: explicitFacultyId,
      } = req.body;

      if (!academicYearId || !semesterId || !subjectId || !sectionId || !mode) {
        return res.status(400).json({ error: 'Missing required session parameters' });
      }

      const resolvedFacultyId =
        eff.role === 'faculty' ? eff.facultyId : Number(explicitFacultyId);

      if (!resolvedFacultyId) {
        return res.status(400).json({ error: 'Valid faculty profile is required' });
      }

      // Enforce faculty can only start sessions for subjects assigned to them
      if (eff.role === 'faculty') {
        const assigned = await db
          .select({ id: subjectFacultyAssignments.id })
          .from(subjectFacultyAssignments)
          .where(
            and(
              eq(subjectFacultyAssignments.facultyId, resolvedFacultyId),
              eq(subjectFacultyAssignments.subjectId, Number(subjectId)),
              eq(subjectFacultyAssignments.sectionId, Number(sectionId)),
              isNull(subjectFacultyAssignments.deletedAt)
            )
          );
        if (assigned.length === 0) {
          return res.status(403).json({
            error: 'Forbidden: You are not assigned to teach this subject and section.',
          });
        }
      }

      const [policy] = await db
        .select()
        .from(attendancePolicies)
        .where(eq(attendancePolicies.academicYearId, Number(academicYearId)))
        .limit(1);

      const qrIntervalSeconds = policy?.qrTokenTtlSeconds ?? 25;
      const confidenceThreshold = policy?.aiAutoApproveThreshold ?? '0.85';
      const qrSecret = crypto.randomBytes(24).toString('hex');
      const todayIst = new Date().toLocaleDateString('en-CA', {
        timeZone: 'Asia/Kolkata',
      });

      const [created] = await db
        .insert(attendanceSessions)
        .values({
          academicYearId: Number(academicYearId),
          semesterId: Number(semesterId),
          subjectId: Number(subjectId),
          facultyId: resolvedFacultyId,
          sectionId: Number(sectionId),
          timetableSlotId: timetableSlotId ? Number(timetableSlotId) : null,
          classroomId: classroomId ? Number(classroomId) : null,
          sessionDate: todayIst,
          mode,
          status: 'active',
          qrSecret,
          qrIntervalSeconds,
          qrExpiresAt: new Date(Date.now() + qrIntervalSeconds * 1000),
          confidenceThreshold,
          notes: notes || null,
        })
        .returning();

      // Notify all enrolled students in this section
      const [subj] = await db
        .select()
        .from(subjects)
        .where(eq(subjects.id, Number(subjectId)));
      const enrolledStudents = await db
        .select({ profileId: students.profileId })
        .from(studentEnrollments)
        .innerJoin(students, eq(studentEnrollments.studentId, students.id))
        .where(
          and(
            eq(studentEnrollments.sectionId, Number(sectionId)),
            eq(studentEnrollments.academicYearId, Number(academicYearId)),
            eq(studentEnrollments.semesterId, Number(semesterId))
          )
        );

      for (const stu of enrolledStudents) {
        await dispatchNotification({
          recipientProfileId: stu.profileId,
          category: 'attendance',
          title: `Attendance Active: ${subj?.code || 'Class'} ${subj?.name || ''}`,
          message: `${eff.fullName} started a ${mode.replace('_', ' ').toUpperCase()} attendance session. Complete verification before the session closes.`,
          actionUrl: '/student/attendance',
        });
      }

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: eff.role,
        action: 'ATTENDANCE_SESSION_STARTED',
        entityType: 'attendance_sessions',
        entityId: created.id,
        afterState: { subjectId, sectionId, mode },
      });

      res.status(201).json(created);
    } catch (error) {
      console.error('Failed to start attendance session:', error);
      res.status(500).json({ error: 'Failed to start attendance session' });
    }
  }
);

// Generate Rotating Dynamic QR Token (Faculty / Super Admin)
attendanceRouter.get(
  '/sessions/:id/qr',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      const eff = req.effectiveProfile!;

      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, sessionId));

      if (!session) {
        return res.status(404).json({ error: 'Attendance session not found' });
      }
      if (eff.role === 'faculty' && session.facultyId !== eff.facultyId) {
        return res.status(403).json({ error: 'Forbidden: Not your session' });
      }
      if (session.status !== 'active') {
        return res.status(400).json({ error: 'Session is already closed' });
      }

      const ttl = session.qrIntervalSeconds || 25;
      const now = Date.now();
      const expiresAtMs = now + ttl * 1000;
      const nonce = crypto.randomBytes(6).toString('hex');
      const sig = computeQrSignature(session.qrSecret, session.id, expiresAtMs, nonce);
      const token = `IC-QR.${session.id}.${expiresAtMs}.${nonce}.${sig.slice(0, 16)}`;

      const windowIdx = Math.floor(now / (ttl * 1000));
      const shortCode = computeShortCode(session.qrSecret, session.id, windowIdx);

      await db
        .update(attendanceSessions)
        .set({ qrExpiresAt: new Date(expiresAtMs) })
        .where(eq(attendanceSessions.id, session.id));

      const qrDataUrl = await QRCode.toDataURL(token, {
        width: 260,
        margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });

      res.json({
        sessionId: session.id,
        token,
        shortCode,
        qrDataUrl,
        expiresAt: new Date(expiresAtMs).toISOString(),
        ttlSeconds: ttl,
      });
    } catch (error) {
      console.error('QR generation error:', error);
      res.status(500).json({ error: 'Failed to generate rotating QR token' });
    }
  }
);

// Get Session Roster + Verification Logs + Corrections
attendanceRouter.get(
  '/sessions/:id/roster',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      const eff = req.effectiveProfile!;
      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, sessionId));

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      if (eff.role === 'faculty' && session.facultyId !== eff.facultyId) {
        return res.status(403).json({ error: 'Forbidden: Not assigned to this session' });
      }

      const enrolled = await db
        .select({
          studentId: students.id,
          usn: students.usn,
          fullName: profiles.fullName,
          rollNumber: studentEnrollments.rollNumber,
          biometricEnrolled: students.biometricEnrolled,
        })
        .from(studentEnrollments)
        .innerJoin(students, eq(studentEnrollments.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(
          and(
            eq(studentEnrollments.sectionId, session.sectionId),
            eq(studentEnrollments.academicYearId, session.academicYearId),
            eq(studentEnrollments.semesterId, session.semesterId)
          )
        )
        .orderBy(students.usn);

      const records = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.sessionId, sessionId));

      const logs = await db
        .select({
          id: attendanceVerificationLogs.id,
          studentId: attendanceVerificationLogs.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          verificationMethod: attendanceVerificationLogs.verificationMethod,
          providerName: attendanceVerificationLogs.providerName,
          outcome: attendanceVerificationLogs.outcome,
          confidenceScore: attendanceVerificationLogs.confidenceScore,
          livenessPassed: attendanceVerificationLogs.livenessPassed,
          failureReason: attendanceVerificationLogs.failureReason,
          createdAt: attendanceVerificationLogs.createdAt,
        })
        .from(attendanceVerificationLogs)
        .innerJoin(students, eq(attendanceVerificationLogs.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(eq(attendanceVerificationLogs.sessionId, sessionId))
        .orderBy(desc(attendanceVerificationLogs.createdAt));

      const corrections = await db
        .select({
          id: attendanceCorrections.id,
          studentId: attendanceCorrections.studentId,
          usn: students.usn,
          studentName: profiles.fullName,
          previousStatus: attendanceCorrections.previousStatus,
          newStatus: attendanceCorrections.newStatus,
          reason: attendanceCorrections.reason,
          appealStatus: attendanceCorrections.appealStatus,
          createdAt: attendanceCorrections.createdAt,
        })
        .from(attendanceCorrections)
        .innerJoin(students, eq(attendanceCorrections.studentId, students.id))
        .innerJoin(profiles, eq(students.profileId, profiles.id))
        .where(eq(attendanceCorrections.sessionId, sessionId))
        .orderBy(desc(attendanceCorrections.createdAt));

      const roster = enrolled.map((stu) => ({
        ...stu,
        record: records.find((r) => r.studentId === stu.studentId) || null,
      }));

      res.json({ session, roster, verificationLogs: logs, corrections });
    } catch (error) {
      console.error('Failed to load session roster:', error);
      res.status(500).json({ error: 'Failed to load session roster' });
    }
  }
);

// Manual Attendance Mark / Bulk Mark (Faculty / Super Admin)
attendanceRouter.post(
  '/sessions/:id/manual',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      const eff = req.effectiveProfile!;
      const { studentId, status, reason } = req.body as {
        studentId: number;
        status: 'present' | 'absent' | 'late' | 'excused';
        reason?: string;
      };

      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, sessionId));

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (eff.role === 'faculty' && session.facultyId !== eff.facultyId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const [existing] = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sessionId, sessionId),
            eq(attendanceRecords.studentId, Number(studentId))
          )
        );

      if (existing) {
        if (!reason || reason.trim().length < 5) {
          return res.status(400).json({
            error: 'A mandatory audit reason (min 5 characters) is required when editing an existing attendance record.',
          });
        }

        const updated = await db.transaction(async (tx) => {
          const [rec] = await tx
            .update(attendanceRecords)
            .set({
              status,
              markedByProfileId: eff.id,
              remarks: reason.trim(),
              updatedAt: new Date(),
            })
            .where(eq(attendanceRecords.id, existing.id))
            .returning();

          await tx.insert(attendanceCorrections).values({
            attendanceRecordId: existing.id,
            sessionId,
            studentId: Number(studentId),
            editedByProfileId: eff.id,
            previousStatus: existing.status,
            newStatus: status,
            reason: reason.trim(),
            appealStatus: 'faculty_edit',
          });

          return rec;
        });

        await recordAuditLog({
          actorProfileId: req.actorProfile?.id,
          actorRole: eff.role,
          action: 'ATTENDANCE_CORRECTION',
          entityType: 'attendance_records',
          entityId: existing.id,
          beforeState: { status: existing.status },
          afterState: { status },
          reason: reason.trim(),
        });

        return res.json(updated);
      }

      const [created] = await db
        .insert(attendanceRecords)
        .values({
          sessionId,
          studentId: Number(studentId),
          academicYearId: session.academicYearId,
          subjectId: session.subjectId,
          facultyId: session.facultyId,
          status,
          verificationMethod: 'manual',
          markedByProfileId: eff.id,
          remarks: reason || null,
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      console.error('Manual attendance failed:', error);
      res.status(500).json({ error: 'Failed to save attendance mark' });
    }
  }
);

// Close Attendance Session (Auto-marks remaining unmarked enrolled students as absent)
attendanceRouter.post(
  '/sessions/:id/close',
  requireRole('super_admin', 'faculty'),
  async (req: AuthRequest, res) => {
    try {
      const sessionId = Number(req.params.id);
      const eff = req.effectiveProfile!;
      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, sessionId));

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (eff.role === 'faculty' && session.facultyId !== eff.facultyId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const summary = await db.transaction(async (tx) => {
        const enrolled = await tx
          .select({ studentId: studentEnrollments.studentId })
          .from(studentEnrollments)
          .where(
            and(
              eq(studentEnrollments.sectionId, session.sectionId),
              eq(studentEnrollments.academicYearId, session.academicYearId),
              eq(studentEnrollments.semesterId, session.semesterId)
            )
          );

        const existingRecs = await tx
          .select()
          .from(attendanceRecords)
          .where(eq(attendanceRecords.sessionId, sessionId));
        const markedSet = new Set(existingRecs.map((r) => r.studentId));

        let autoAbsent = 0;
        for (const stu of enrolled) {
          if (!markedSet.has(stu.studentId)) {
            await tx
              .insert(attendanceRecords)
              .values({
                sessionId,
                studentId: stu.studentId,
                academicYearId: session.academicYearId,
                subjectId: session.subjectId,
                facultyId: session.facultyId,
                status: 'absent',
                verificationMethod: session.mode,
                markedByProfileId: eff.id,
                remarks: 'Auto-marked absent when session closed',
              })
              .onConflictDoNothing();
            autoAbsent++;
          }
        }

        const [closedSession] = await tx
          .update(attendanceSessions)
          .set({ status: 'closed', closedAt: new Date() })
          .where(eq(attendanceSessions.id, sessionId))
          .returning();

        return { closedSession, autoAbsent };
      });

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: eff.role,
        action: 'ATTENDANCE_SESSION_CLOSED',
        entityType: 'attendance_sessions',
        entityId: sessionId,
        afterState: { autoAbsent: summary.autoAbsent },
      });

      res.json(summary);
    } catch (error) {
      console.error('Close session failed:', error);
      res.status(500).json({ error: 'Failed to close attendance session' });
    }
  }
);

// Student Dynamic QR Verification (Rate-limited, Duplicate-blocked, Time-validated)
attendanceRouter.post(
  '/verify-qr',
  requireRole('student'),
  rateLimit(15, 60_000),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      if (!eff.studentId) {
        return res.status(400).json({ error: 'Student profile not linked' });
      }

      const { token, sessionId: explicitSessionId, shortCode } = req.body as {
        token?: string;
        sessionId?: number;
        shortCode?: string;
      };

      let targetSessionId = explicitSessionId ? Number(explicitSessionId) : 0;
      let tokenValid = false;
      let failureReason = '';

      if (token && token.startsWith('IC-QR.')) {
        const parts = token.split('.');
        if (parts.length !== 5) {
          return res.status(400).json({ error: 'Malformed QR payload' });
        }
        targetSessionId = Number(parts[1]);
        const expiresAtMs = Number(parts[2]);
        const nonce = parts[3];
        const sigPrefix = parts[4];

        const [session] = await db
          .select()
          .from(attendanceSessions)
          .where(eq(attendanceSessions.id, targetSessionId));

        if (!session) {
          return res.status(404).json({ error: 'Attendance session not found' });
        }

        const expected = computeQrSignature(session.qrSecret, session.id, expiresAtMs, nonce).slice(0, 16);
        if (expected !== sigPrefix) {
          failureReason = 'Invalid cryptographic QR signature';
        } else if (Date.now() > expiresAtMs) {
          failureReason = 'QR token has expired. Please scan the latest rotating QR code.';
        } else {
          tokenValid = true;
        }
      } else if (targetSessionId && shortCode) {
        const [session] = await db
          .select()
          .from(attendanceSessions)
          .where(eq(attendanceSessions.id, targetSessionId));

        if (!session) {
          return res.status(404).json({ error: 'Attendance session not found' });
        }
        const ttl = session.qrIntervalSeconds || 25;
        const currentWindow = Math.floor(Date.now() / (ttl * 1000));
        const validCurrent = computeShortCode(session.qrSecret, session.id, currentWindow);
        const validPrev = computeShortCode(session.qrSecret, session.id, currentWindow - 1);
        const normalizedCode = shortCode.trim().toUpperCase();

        if (normalizedCode === validCurrent || normalizedCode === validPrev) {
          tokenValid = true;
        } else {
          failureReason = 'Rotating 6-character code expired or incorrect.';
        }
      } else {
        return res.status(400).json({ error: 'Provide a scanned QR token or session short code.' });
      }

      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, targetSessionId));

      if (!session || session.status !== 'active') {
        return res.status(400).json({ error: 'Attendance session is no longer active.' });
      }

      // Verify student is enrolled in this section
      const [enrolled] = await db
        .select()
        .from(studentEnrollments)
        .where(
          and(
            eq(studentEnrollments.studentId, eff.studentId),
            eq(studentEnrollments.sectionId, session.sectionId),
            eq(studentEnrollments.academicYearId, session.academicYearId),
            eq(studentEnrollments.semesterId, session.semesterId)
          )
        );
      if (!enrolled) {
        return res.status(403).json({
          error: 'Forbidden: You are not enrolled in the section for this session.',
        });
      }

      if (!tokenValid) {
        await db.insert(attendanceVerificationLogs).values({
          sessionId: session.id,
          studentId: eff.studentId,
          verificationMethod: 'dynamic_qr',
          providerName: 'ImpactCampus-HMAC-QR',
          outcome: 'expired_token',
          qrTokenHash: token ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 16) : null,
          failureReason,
        });
        return res.status(400).json({ error: failureReason });
      }

      // Duplicate prevention
      const [alreadyMarked] = await db
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sessionId, session.id),
            eq(attendanceRecords.studentId, eff.studentId)
          )
        );

      if (alreadyMarked) {
        await db.insert(attendanceVerificationLogs).values({
          sessionId: session.id,
          studentId: eff.studentId,
          verificationMethod: 'dynamic_qr',
          providerName: 'ImpactCampus-HMAC-QR',
          outcome: 'duplicate_blocked',
          failureReason: 'Duplicate attendance submission blocked.',
        });
        return res.status(409).json({
          error: 'Duplicate submission blocked: Your attendance for this session is already recorded.',
        });
      }

      const [record] = await db.transaction(async (tx) => {
        const [rec] = await tx
          .insert(attendanceRecords)
          .values({
            sessionId: session.id,
            studentId: eff.studentId!,
            academicYearId: session.academicYearId,
            subjectId: session.subjectId,
            facultyId: session.facultyId,
            status: 'present',
            verificationMethod: 'dynamic_qr',
            markedByProfileId: eff.id,
            remarks: 'Verified via Dynamic HMAC QR',
          })
          .returning();

        await tx.insert(attendanceVerificationLogs).values({
          sessionId: session.id,
          studentId: eff.studentId!,
          verificationMethod: 'dynamic_qr',
          providerName: 'ImpactCampus-HMAC-QR',
          outcome: 'verified',
          qrTokenHash: token ? crypto.createHash('sha256').update(token).digest('hex').slice(0, 16) : shortCode,
          deviceSummary: req.headers['user-agent']?.slice(0, 80) || 'Browser',
        });

        return [rec];
      });

      res.status(201).json({ record, message: 'Attendance verified and recorded.' });
    } catch (error) {
      console.error('QR verify failed:', error);
      res.status(500).json({ error: 'QR verification failed' });
    }
  }
);

// Biometric Provider Status & Student Consent Management
attendanceRouter.get('/biometric/status', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const provider = getBiometricProviderStatus();
    let consent: typeof consentRecords.$inferSelect | null = null;

    if (eff.studentId) {
      const rows = await db
        .select()
        .from(consentRecords)
        .where(
          and(
            eq(consentRecords.studentId, eff.studentId),
            eq(consentRecords.consentType, 'biometric_face_verification')
          )
        )
        .orderBy(desc(consentRecords.createdAt))
        .limit(1);
      consent = rows[0] || null;
    }

    res.json({ provider, consent });
  } catch (error) {
    res.status(500).json({ error: 'Failed to inspect biometric status' });
  }
});

attendanceRouter.post(
  '/biometric/consent',
  requireRole('student'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      if (!eff.studentId) return res.status(400).json({ error: 'Student not linked' });

      const { action } = req.body as { action: 'grant' | 'withdraw' };
      const now = new Date();

      const [record] = await db.transaction(async (tx) => {
        const [consent] = await tx
          .insert(consentRecords)
          .values({
            studentId: eff.studentId!,
            consentType: 'biometric_face_verification',
            status: action === 'grant' ? 'granted' : 'withdrawn',
            consentVersion: 'v1.0-ICEAS-2026',
            grantedAt: action === 'grant' ? now : null,
            withdrawnAt: action === 'withdraw' ? now : null,
            purgedBiometricDataAt: action === 'withdraw' ? now : null,
            ipAddress: req.ip || null,
          })
          .returning();

        await tx
          .update(students)
          .set({
            biometricEnrolled: action === 'grant',
            updatedAt: now,
          })
          .where(eq(students.id, eff.studentId!));

        return [consent];
      });

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: eff.role,
        action: action === 'grant' ? 'BIOMETRIC_CONSENT_GRANTED' : 'BIOMETRIC_CONSENT_WITHDRAWN_AND_PURGED',
        entityType: 'consent_records',
        entityId: record.id,
        afterState: { studentId: eff.studentId, status: record.status },
      });

      res.json(record);
    } catch (error) {
      console.error('Consent update error:', error);
      res.status(500).json({ error: 'Failed to update biometric consent' });
    }
  }
);

// Student AI Face Verification (Honest External Provider Check)
attendanceRouter.post(
  '/verify-face',
  requireRole('student'),
  rateLimit(10, 60_000),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      if (!eff.studentId) return res.status(400).json({ error: 'Student not linked' });

      const { sessionId, imageBase64, livenessFramesCount } = req.body as {
        sessionId: number;
        imageBase64: string;
        livenessFramesCount?: number;
      };

      const [stu] = await db
        .select()
        .from(students)
        .where(eq(students.id, eff.studentId));
      if (!stu?.biometricEnrolled) {
        return res.status(403).json({
          error: 'Informed biometric consent is required before facial verification. Please grant consent or use Dynamic QR.',
        });
      }

      const [session] = await db
        .select()
        .from(attendanceSessions)
        .where(eq(attendanceSessions.id, Number(sessionId)));
      if (!session || session.status !== 'active') {
        return res.status(400).json({ error: 'Session not active' });
      }

      const result = await verifyFaceWithExternalProvider({
        studentId: stu.id,
        usn: stu.usn,
        sessionId: session.id,
        imageBase64: imageBase64 || '',
        livenessFramesCount: Number(livenessFramesCount || 1),
        autoApproveThreshold: Number(session.confidenceThreshold || 0.85),
        manualReviewThreshold: 0.65,
      });

      await db.insert(attendanceVerificationLogs).values({
        sessionId: session.id,
        studentId: stu.id,
        verificationMethod: 'ai_face',
        providerName: result.providerName,
        outcome: result.outcome,
        confidenceScore: result.confidenceScore !== null ? result.confidenceScore.toFixed(3) : null,
        livenessPassed: result.livenessPassed,
        livenessChecksJson: result.livenessChecks,
        failureReason: result.failureReason,
      });

      if (!result.configured) {
        return res.status(503).json({
          error: result.failureReason,
          outcome: 'provider_unconfigured',
          provider: getBiometricProviderStatus(),
        });
      }

      if (result.outcome === 'verified' || result.outcome === 'uncertain_review') {
        const [rec] = await db
          .insert(attendanceRecords)
          .values({
            sessionId: session.id,
            studentId: stu.id,
            academicYearId: session.academicYearId,
            subjectId: session.subjectId,
            facultyId: session.facultyId,
            status: result.outcome === 'verified' ? 'present' : 'pending_review',
            verificationMethod: 'ai_face',
            confidenceScore: result.confidenceScore?.toFixed(3) ?? null,
            markedByProfileId: eff.id,
            remarks:
              result.outcome === 'uncertain_review'
                ? 'Routed to Faculty Manual Review Queue due to intermediate confidence score.'
                : 'Verified via External Biometric Provider',
          })
          .onConflictDoNothing()
          .returning();

        return res.status(201).json({ outcome: result.outcome, record: rec, result });
      }

      return res.status(422).json({
        error: result.failureReason || 'Face verification rejected',
        outcome: result.outcome,
      });
    } catch (error) {
      console.error('Face verification error:', error);
      res.status(500).json({ error: 'Face verification workflow failed' });
    }
  }
);

// Student Appeal Request (Does NOT modify attendance status directly!)
attendanceRouter.post(
  '/appeals',
  requireRole('student'),
  async (req: AuthRequest, res) => {
    try {
      const eff = req.effectiveProfile!;
      const { attendanceRecordId, reason } = req.body as {
        attendanceRecordId: number;
        reason: string;
      };
      if (!attendanceRecordId || !reason || reason.trim().length < 8) {
        return res.status(400).json({ error: 'Please explain your appeal (min 8 characters).' });
      }

      const [rec] = await db
        .select()
        .from(attendanceRecords)
        .where(eq(attendanceRecords.id, Number(attendanceRecordId)));
      if (!rec || rec.studentId !== eff.studentId) {
        return res.status(403).json({ error: 'Forbidden: Record does not belong to you.' });
      }

      const [appeal] = await db
        .insert(attendanceCorrections)
        .values({
          attendanceRecordId: rec.id,
          sessionId: rec.sessionId,
          studentId: eff.studentId!,
          editedByProfileId: eff.id,
          previousStatus: rec.status,
          newStatus: rec.status,
          reason: reason.trim(),
          appealStatus: 'student_appeal_pending',
        })
        .returning();

      res.status(201).json(appeal);
    } catch (error) {
      res.status(500).json({ error: 'Failed to submit attendance appeal' });
    }
  }
);

// Attendance Analytics (Role-scoped: subject-wise, low-attendance <75%, daily breakdown)
attendanceRouter.get('/analytics', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    const academicYearId = req.query.academicYearId
      ? Number(req.query.academicYearId)
      : undefined;

    const allRecs = await db
      .select({
        id: attendanceRecords.id,
        sessionId: attendanceRecords.sessionId,
        studentId: attendanceRecords.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        academicYearId: attendanceRecords.academicYearId,
        subjectId: attendanceRecords.subjectId,
        subjectCode: subjects.code,
        subjectName: subjects.name,
        status: attendanceRecords.status,
        verificationMethod: attendanceRecords.verificationMethod,
        sessionDate: attendanceSessions.sessionDate,
      })
      .from(attendanceRecords)
      .innerJoin(students, eq(attendanceRecords.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(subjects, eq(attendanceRecords.subjectId, subjects.id))
      .innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(
        academicYearId ? eq(attendanceRecords.academicYearId, academicYearId) : undefined
      );

    let scopedRecs = allRecs;
    if (eff.role === 'student') {
      scopedRecs = allRecs.filter((r) => r.studentId === eff.studentId);
    } else if (eff.role === 'parent') {
      scopedRecs = allRecs.filter((r) => eff.linkedStudentIds.includes(r.studentId));
    }

    // Subject-wise summary
    const subjectMap = new Map<
      number,
      { subjectId: number; code: string; name: string; total: number; present: number }
    >();
    const studentMap = new Map<
      number,
      { studentId: number; usn: string; fullName: string; total: number; present: number }
    >();
    const dateMap = new Map<string, { date: string; total: number; present: number }>();

    for (const r of scopedRecs) {
      if (r.status === 'pending_review') continue;
      const isPresent = r.status === 'present' || r.status === 'late' || r.status === 'excused';

      const sm = subjectMap.get(r.subjectId) || {
        subjectId: r.subjectId,
        code: r.subjectCode,
        name: r.subjectName,
        total: 0,
        present: 0,
      };
      sm.total++;
      if (isPresent) sm.present++;
      subjectMap.set(r.subjectId, sm);

      const st = studentMap.get(r.studentId) || {
        studentId: r.studentId,
        usn: r.usn,
        fullName: r.studentName,
        total: 0,
        present: 0,
      };
      st.total++;
      if (isPresent) st.present++;
      studentMap.set(r.studentId, st);

      const dm = dateMap.get(r.sessionDate) || {
        date: r.sessionDate,
        total: 0,
        present: 0,
      };
      dm.total++;
      if (isPresent) dm.present++;
      dateMap.set(r.sessionDate, dm);
    }

    const subjectSummary = Array.from(subjectMap.values()).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(1)) : 0,
    }));

    const studentSummary = Array.from(studentMap.values()).map((s) => ({
      ...s,
      percentage: s.total > 0 ? Number(((s.present / s.total) * 100).toFixed(1)) : 0,
    }));

    const lowAttendanceStudents = studentSummary.filter((s) => s.percentage < 75);
    const totalMarked = scopedRecs.filter((r) => r.status !== 'pending_review').length;
    const totalPresent = scopedRecs.filter(
      (r) => r.status === 'present' || r.status === 'late' || r.status === 'excused'
    ).length;

    const pendingReviews =
      eff.role === 'super_admin' || eff.role === 'faculty'
        ? allRecs.filter((r) => r.status === 'pending_review')
        : [];

    const recentCorrections = await db
      .select({
        id: attendanceCorrections.id,
        studentId: attendanceCorrections.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        previousStatus: attendanceCorrections.previousStatus,
        newStatus: attendanceCorrections.newStatus,
        reason: attendanceCorrections.reason,
        appealStatus: attendanceCorrections.appealStatus,
        createdAt: attendanceCorrections.createdAt,
      })
      .from(attendanceCorrections)
      .innerJoin(students, eq(attendanceCorrections.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .orderBy(desc(attendanceCorrections.createdAt))
      .limit(20);

    res.json({
      overallPercentage:
        totalMarked > 0 ? Number(((totalPresent / totalMarked) * 100).toFixed(1)) : 0,
      totalClasses: totalMarked,
      totalPresent,
      subjectSummary,
      studentSummary,
      lowAttendanceStudents,
      dailyTrend: Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
      pendingReviews,
      recentCorrections:
        eff.role === 'student'
          ? recentCorrections.filter((c) => c.studentId === eff.studentId)
          : eff.role === 'parent'
          ? recentCorrections.filter((c) => eff.linkedStudentIds.includes(c.studentId))
          : recentCorrections,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to compute attendance analytics' });
  }
});
