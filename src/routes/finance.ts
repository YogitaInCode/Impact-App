import { Router } from 'express';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  academicYears,
  feePayments,
  feeStructures,
  paymentTransactions,
  profiles,
  programs,
  scholarships,
  studentFeeAssignments,
  students,
} from '../db/schema.ts';
import { getActiveInstitutionId } from '../db/seed.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { dispatchNotification, recordAuditLog } from '../services/audit.ts';

export const financeRouter = Router();

financeRouter.use(requireAuth);

// Role-scoped Finance Overview across ALL Academic Years
financeRouter.get('/overview', async (req: AuthRequest, res) => {
  try {
    const eff = req.effectiveProfile!;
    if (eff.role === 'faculty') {
      return res.status(403).json({
        error: 'Forbidden: Faculty accounts do not have access to student fee ledgers.',
      });
    }

    const structures = await db
      .select({
        id: feeStructures.id,
        academicYearId: feeStructures.academicYearId,
        academicYearCode: academicYears.code,
        programId: feeStructures.programId,
        programCode: programs.code,
        programName: programs.name,
        semesterNumber: feeStructures.semesterNumber,
        categoryName: feeStructures.categoryName,
        tuitionFee: feeStructures.tuitionFee,
        labFee: feeStructures.labFee,
        libraryFee: feeStructures.libraryFee,
        examFee: feeStructures.examFee,
        miscFee: feeStructures.miscFee,
        totalAmount: feeStructures.totalAmount,
        dueDate: feeStructures.dueDate,
      })
      .from(feeStructures)
      .innerJoin(academicYears, eq(feeStructures.academicYearId, academicYears.id))
      .innerJoin(programs, eq(feeStructures.programId, programs.id))
      .orderBy(desc(academicYears.code));

    const allAssignments = await db
      .select({
        id: studentFeeAssignments.id,
        studentId: studentFeeAssignments.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        academicYearId: studentFeeAssignments.academicYearId,
        academicYearCode: academicYears.code,
        feeStructureId: studentFeeAssignments.feeStructureId,
        categoryName: feeStructures.categoryName,
        grossAmount: studentFeeAssignments.grossAmount,
        scholarshipDiscount: studentFeeAssignments.scholarshipDiscount,
        netPayable: studentFeeAssignments.netPayable,
        paidAmount: studentFeeAssignments.paidAmount,
        balanceDue: studentFeeAssignments.balanceDue,
        status: studentFeeAssignments.status,
        dueDate: studentFeeAssignments.dueDate,
      })
      .from(studentFeeAssignments)
      .innerJoin(students, eq(studentFeeAssignments.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(academicYears, eq(studentFeeAssignments.academicYearId, academicYears.id))
      .innerJoin(feeStructures, eq(studentFeeAssignments.feeStructureId, feeStructures.id))
      .orderBy(desc(academicYears.code));

    const allPayments = await db
      .select({
        id: feePayments.id,
        studentId: feePayments.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        academicYearId: feePayments.academicYearId,
        academicYearCode: academicYears.code,
        studentFeeAssignmentId: feePayments.studentFeeAssignmentId,
        receiptNumber: feePayments.receiptNumber,
        amountPaid: feePayments.amountPaid,
        paymentDate: feePayments.paymentDate,
        paymentMode: feePayments.paymentMode,
        remarks: feePayments.remarks,
        transactionReference: paymentTransactions.transactionReference,
        gatewayName: paymentTransactions.gatewayName,
        gatewayStatus: paymentTransactions.gatewayStatus,
      })
      .from(feePayments)
      .innerJoin(students, eq(feePayments.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(academicYears, eq(feePayments.academicYearId, academicYears.id))
      .leftJoin(paymentTransactions, eq(paymentTransactions.feePaymentId, feePayments.id))
      .orderBy(desc(feePayments.paymentDate));

    const allScholarships = await db
      .select({
        id: scholarships.id,
        studentId: scholarships.studentId,
        usn: students.usn,
        studentName: profiles.fullName,
        academicYearCode: academicYears.code,
        schemeName: scholarships.schemeName,
        provider: scholarships.provider,
        amount: scholarships.amount,
        status: scholarships.status,
        sanctionRef: scholarships.sanctionRef,
      })
      .from(scholarships)
      .innerJoin(students, eq(scholarships.studentId, students.id))
      .innerJoin(profiles, eq(students.profileId, profiles.id))
      .innerJoin(academicYears, eq(scholarships.academicYearId, academicYears.id));

    const filterFn = <T extends { studentId: number }>(rows: T[]) => {
      if (eff.role === 'super_admin') return rows;
      if (eff.role === 'student') return rows.filter((r) => r.studentId === eff.studentId);
      if (eff.role === 'parent') return rows.filter((r) => eff.linkedStudentIds.includes(r.studentId));
      return [];
    };

    res.json({
      structures,
      assignments: filterFn(allAssignments),
      payments: filterFn(allPayments),
      scholarships: filterFn(allScholarships),
    });
  } catch (error) {
    console.error('Finance overview error:', error);
    res.status(500).json({ error: 'Failed to load finance ledger' });
  }
});

// Create Fee Structure (Super Admin)
financeRouter.post(
  '/structures',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const {
        academicYearId,
        programId,
        semesterNumber,
        categoryName,
        tuitionFee,
        labFee,
        libraryFee,
        examFee,
        miscFee,
        dueDate,
      } = req.body;

      const totalAmount =
        Number(tuitionFee || 0) +
        Number(labFee || 0) +
        Number(libraryFee || 0) +
        Number(examFee || 0) +
        Number(miscFee || 0);

      const instId = await getActiveInstitutionId();
      const [created] = await db
        .insert(feeStructures)
        .values({
          institutionId: instId,
          academicYearId: Number(academicYearId),
          programId: Number(programId),
          semesterNumber: Number(semesterNumber || 5),
          categoryName: String(categoryName).trim(),
          tuitionFee: Number(tuitionFee || 0),
          labFee: Number(labFee || 0),
          libraryFee: Number(libraryFee || 0),
          examFee: Number(examFee || 0),
          miscFee: Number(miscFee || 0),
          totalAmount,
          dueDate: String(dueDate),
        })
        .returning();

      res.status(201).json(created);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create fee structure' });
    }
  }
);

// Record Fee Payment (Super Admin - Transactional, Zero Card Data Stored)
financeRouter.post(
  '/payments',
  requireRole('super_admin'),
  async (req: AuthRequest, res) => {
    try {
      const {
        studentFeeAssignmentId,
        amountPaid,
        paymentMode,
        transactionReference,
        gatewayName,
        remarks,
      } = req.body;

      const amount = Number(amountPaid);
      if (!studentFeeAssignmentId || !Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'Valid fee assignment and positive payment amount required' });
      }

      const [assignment] = await db
        .select()
        .from(studentFeeAssignments)
        .where(eq(studentFeeAssignments.id, Number(studentFeeAssignmentId)));

      if (!assignment) {
        return res.status(404).json({ error: 'Student fee assignment not found' });
      }
      if (amount > assignment.balanceDue) {
        return res.status(400).json({
          error: `Payment amount (₹${amount}) exceeds remaining balance due (₹${assignment.balanceDue}).`,
        });
      }

      const receiptNumber = `RCPT-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      const txRef =
        String(transactionReference || '').trim() ||
        `TXN-${paymentMode?.toUpperCase() || 'UPI'}-${Date.now()}`;

      const result = await db.transaction(async (tx) => {
        const [payment] = await tx
          .insert(feePayments)
          .values({
            studentId: assignment.studentId,
            academicYearId: assignment.academicYearId,
            studentFeeAssignmentId: assignment.id,
            receiptNumber,
            amountPaid: amount,
            paymentMode: paymentMode || 'upi',
            collectedByProfileId: req.effectiveProfile!.id,
            remarks: remarks || null,
          })
          .returning();

        const [txRow] = await tx
          .insert(paymentTransactions)
          .values({
            feePaymentId: payment.id,
            transactionReference: txRef,
            gatewayName: gatewayName || 'Campus Accounts Desk',
            gatewayStatus: 'settled',
            amount,
            currency: 'INR',
          })
          .returning();

        const newPaid = assignment.paidAmount + amount;
        const newBalance = Math.max(0, assignment.netPayable - newPaid);
        const newStatus = newBalance === 0 ? 'paid' : 'partial';

        const [updatedAssignment] = await tx
          .update(studentFeeAssignments)
          .set({
            paidAmount: newPaid,
            balanceDue: newBalance,
            status: newStatus,
            updatedAt: new Date(),
          })
          .where(eq(studentFeeAssignments.id, assignment.id))
          .returning();

        return { payment, transaction: txRow, assignment: updatedAssignment };
      });

      const [stu] = await db
        .select({ profileId: students.profileId })
        .from(students)
        .where(eq(students.id, assignment.studentId));
      if (stu) {
        await dispatchNotification({
          recipientProfileId: stu.profileId,
          category: 'fee',
          title: `Fee Receipt Generated: ${receiptNumber}`,
          message: `Payment of ₹${amount.toLocaleString('en-IN')} received (${txRef}). Remaining balance: ₹${result.assignment.balanceDue.toLocaleString('en-IN')}.`,
          actionUrl: '/student/fees',
        });
      }

      await recordAuditLog({
        actorProfileId: req.actorProfile?.id,
        actorRole: req.effectiveProfile!.role,
        action: 'FEE_PAYMENT_RECORDED',
        entityType: 'fee_payments',
        entityId: result.payment.id,
        afterState: { receiptNumber, amount, txRef },
      });

      res.status(201).json(result);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('unique')) {
        return res.status(409).json({ error: 'Transaction reference already exists' });
      }
      console.error('Payment recording failed:', error);
      res.status(500).json({ error: 'Failed to record fee payment' });
    }
  }
);
