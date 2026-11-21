import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard, Download, Plus, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { downloadTablePDF, formatINR, formatIST } from '../../lib/utils';
import { Button, FieldLabel, Input, Modal, Select, StatusText, Surface } from '../ui/primitives';

interface FeeAssignment {
  id: number;
  studentId: number;
  usn: string;
  studentName: string;
  academicYearCode: string;
  categoryName: string;
  grossAmount: number;
  scholarshipDiscount: number;
  netPayable: number;
  paidAmount: number;
  balanceDue: number;
  status: string;
  dueDate: string;
}

interface FeePayment {
  id: number;
  usn: string;
  studentName: string;
  academicYearCode: string;
  receiptNumber: string;
  amountPaid: number;
  paymentDate: string;
  paymentMode: string;
  transactionReference: string | null;
  gatewayName: string | null;
  gatewayStatus: string | null;
}

export const FinanceView: React.FC = () => {
  const { effectiveProfile, apiFetch } = useAuth();
  const isAdmin = effectiveProfile?.role === 'super_admin';

  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [scholarships, setScholarships] = useState<
    { id: number; usn: string; studentName: string; academicYearCode: string; schemeName: string; provider: string; amount: number; status: string; sanctionRef: string }[]
  >([]);
  const [structures, setStructures] = useState<
    { id: number; academicYearCode: string; programCode: string; categoryName: string; totalAmount: number; dueDate: string }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [payModal, setPayModal] = useState<FeeAssignment | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState('upi');
  const [payRef, setPayRef] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{
        assignments: FeeAssignment[];
        payments: FeePayment[];
        scholarships: typeof scholarships;
        structures: typeof structures;
      }>('/api/finance/overview');
      setAssignments(data.assignments);
      setPayments(data.payments);
      setScholarships(data.scholarships);
      setStructures(data.structures);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load fee ledger');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModal) return;
    try {
      await apiFetch('/api/finance/payments', {
        method: 'POST',
        body: JSON.stringify({
          studentFeeAssignmentId: payModal.id,
          amountPaid: Number(payAmount),
          paymentMode: payMode,
          transactionReference: payRef,
          gatewayName: payMode === 'upi' ? 'Campus UPI Collect' : 'Institutional Bank Desk',
        }),
      });
      toast.success('Fee payment recorded & receipt issued');
      setPayModal(null);
      setPayAmount('');
      setPayRef('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment recording failed');
    }
  };

  const handleDownloadReceipt = (p: FeePayment) => {
    downloadTablePDF({
      title: `Official Fee Receipt · ${p.receiptNumber}`,
      subtitle: `Student: ${p.studentName} (${p.usn}) · Academic Year: ${p.academicYearCode}`,
      headers: ['Receipt No', 'Date (IST)', 'Mode', 'Reference', 'Status', 'Amount (INR)'],
      rows: [
        [
          p.receiptNumber,
          formatIST(p.paymentDate),
          p.paymentMode.toUpperCase(),
          p.transactionReference || '—',
          (p.gatewayStatus || 'settled').toUpperCase(),
          formatINR(p.amountPaid),
        ],
      ],
      filename: `${p.receiptNumber}.pdf`,
    });
  };

  const totalNet = assignments.reduce((a, b) => a + b.netPayable, 0);
  const totalPaid = assignments.reduce((a, b) => a + b.paidAmount, 0);
  const totalDue = assignments.reduce((a, b) => a + b.balanceDue, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
          Multi-Year Fee Ledger &amp; Receipts
        </h1>
        <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
          Independent fee tracking across academic years · Zero payment card details stored
        </p>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Surface className="p-5">
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">Total Net Payable (All Years)</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#1F2937] dark:text-[#FAF6F5]">
            {formatINR(totalNet)}
          </p>
        </Surface>
        <Surface className="p-5">
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">Total Paid &amp; Settled</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#15803D] dark:text-[#4ADE80]">
            {formatINR(totalPaid)}
          </p>
        </Surface>
        <Surface className="p-5">
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">Outstanding Balance Due</p>
          <p className="text-2xl font-bold font-mono tabular-nums mt-1 text-[#8A6D0B] dark:text-[#D4AF37]">
            {formatINR(totalDue)}
          </p>
        </Surface>
      </div>

      {/* Year-wise Student Fee Assignments */}
      <Surface className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
            Academic Year Fee Assignments ({assignments.length})
          </h2>
          <CreditCard className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
        </div>
        {loading ? (
          <div className="p-6 text-xs text-[#6B7280] dark:text-[#B5A5A8]">Loading multi-year fee assignments...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">Year</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Fee Category</th>
                  <th className="py-2.5 px-4 text-right">Gross</th>
                  <th className="py-2.5 px-4 text-right">Concession</th>
                  <th className="py-2.5 px-4 text-right">Paid</th>
                  <th className="py-2.5 px-4 text-right">Balance Due</th>
                  <th className="py-2.5 px-4">Status</th>
                  {isAdmin && <th className="py-2.5 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="py-3 px-4 font-mono font-semibold">{a.academicYearCode}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[#6B7280] dark:text-[#B5A5A8] mr-1.5">{a.usn}</span>
                      <span className="font-medium">{a.studentName}</span>
                    </td>
                    <td className="py-3 px-4 text-[#6B7280] dark:text-[#B5A5A8]">{a.categoryName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(a.grossAmount)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#722F37] dark:text-[#D48A94]">
                      -{formatINR(a.scholarshipDiscount)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatINR(a.paidAmount)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatINR(a.balanceDue)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText tone={a.balanceDue === 0 ? 'success' : a.paidAmount > 0 ? 'warning' : 'danger'}>
                        {a.status.toUpperCase()}
                      </StatusText>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        {a.balanceDue > 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPayModal(a);
                              setPayAmount(String(a.balanceDue));
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Record Payment
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      {/* Payment Receipts & Transactions */}
      <Surface className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
            Payment History &amp; Transaction References ({payments.length})
          </h2>
          <Receipt className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                <th className="py-2.5 px-4">Receipt No</th>
                <th className="py-2.5 px-4">Year · Student</th>
                <th className="py-2.5 px-4">Date (IST)</th>
                <th className="py-2.5 px-4">Mode · Reference</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-3 px-4 font-mono font-semibold text-[#722F37] dark:text-[#D48A94]">{p.receiptNumber}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono mr-1.5">{p.academicYearCode}</span>· {p.usn} ({p.studentName})
                  </td>
                  <td className="py-3 px-4 font-mono tabular-nums text-[#6B7280] dark:text-[#B5A5A8]">
                    {formatIST(p.paymentDate)}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {p.paymentMode.toUpperCase()} · {p.transactionReference || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                    {formatINR(p.amountPaid)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDownloadReceipt(p)}>
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      {/* Scholarships & Fee Structures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Surface className="p-5">
          <h3 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-3">
            Scholarships &amp; Concessions ({scholarships.length})
          </h3>
          {scholarships.length === 0 ? (
            <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">No scholarships recorded.</p>
          ) : (
            <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
              {scholarships.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                      {s.schemeName} ({s.academicYearCode})
                    </p>
                    <p className="text-[#6B7280] dark:text-[#B5A5A8]">
                      {s.usn} · {s.provider} · Ref: {s.sanctionRef}
                    </p>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-[#15803D] dark:text-[#4ADE80]">
                    {formatINR(s.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Surface>

        <Surface className="p-5">
          <h3 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-3">
            Year-wise Fee Structures ({structures.length})
          </h3>
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
            {structures.map((st) => (
              <div key={st.id} className="py-2.5 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                    {st.categoryName}
                  </p>
                  <p className="text-[#6B7280] dark:text-[#B5A5A8]">
                    {st.academicYearCode} · {st.programCode} · Due {st.dueDate}
                  </p>
                </div>
                <span className="font-mono tabular-nums font-semibold">
                  {formatINR(st.totalAmount)}
                </span>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={payModal !== null}
        onClose={() => setPayModal(null)}
        title="Record Fee Payment"
        subtitle={
          payModal
            ? `${payModal.studentName} (${payModal.usn}) · Balance Due: ${formatINR(payModal.balanceDue)}`
            : undefined
        }
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Amount (INR)</FieldLabel>
              <Input
                type="number"
                min={1}
                max={payModal?.balanceDue}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <FieldLabel required>Payment Mode</FieldLabel>
              <Select value={payMode} onChange={(e) => setPayMode(e.target.value)}>
                <option value="upi">UPI</option>
                <option value="neft_rtgs">NEFT / RTGS</option>
                <option value="netbanking">NetBanking</option>
                <option value="bank_challan">Bank Challan</option>
                <option value="dd">Demand Draft</option>
              </Select>
            </div>
          </div>
          <div>
            <FieldLabel>Transaction / UTR Reference</FieldLabel>
            <Input
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="e.g. UPI-623019884199"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPayModal(null)}>
              Cancel
            </Button>
            <Button type="submit">Issue Receipt & Update Ledger</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
