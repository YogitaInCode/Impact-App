import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Download,
  FileCheck,
  FolderGit2,
  GraduationCap,
  History,
  MapPin,
  Plus,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { formatINR, formatIST } from '../../lib/utils';
import { Button, FieldLabel, Input, Select, StatusText, Surface } from '../ui/primitives';

export interface Student360Data {
  student: {
    id: number;
    usn: string;
    admissionNumber: string;
    admissionYear: number;
    fullName: string;
    email: string;
    phone: string;
    gender: string | null;
    dateOfBirth: string;
    address: string;
    departmentCode: string;
    departmentName: string;
    programCode: string;
    programName: string;
    academicStatus: string;
    biometricEnrolled: boolean;
    emergencyContactName: string;
    emergencyContactPhone: string;
    admissionDocsJson?: { title: string; refNo: string; verified: boolean }[];
    previousAcademicRecordsJson?: { qualification: string; board: string; year: number; percentage: string }[];
  };
  enrollments: {
    id: number;
    academicYearCode: string;
    semesterNumber: number;
    semesterName: string;
    sectionName: string;
    rollNumber: string | null;
    enrollmentStatus: string;
  }[];
  attendanceRecords: {
    id: number;
    subjectCode: string;
    subjectName: string;
    status: string;
    verificationMethod: string;
    markedAt: string;
  }[];
  examinationResults: {
    id: number;
    examName: string;
    examType: string;
    subjectCode: string;
    subjectName: string;
    academicYearCode: string;
    marksObtained: string;
    maxMarks: number;
    grade: string;
    status: string;
  }[];
  feeAssignments: {
    id: number;
    academicYearCode: string;
    grossAmount: number;
    scholarshipDiscount: number;
    netPayable: number;
    paidAmount: number;
    balanceDue: number;
    status: string;
    dueDate: string;
  }[];
  feePayments: {
    id: number;
    receiptNumber: string;
    amountPaid: number;
    paymentDate: string;
    paymentMode: string;
    academicYearCode: string;
  }[];
  consentRecords: {
    id: number;
    consentType: string;
    status: string;
    grantedAt: string | null;
    withdrawnAt: string | null;
  }[];
  addresses: {
    id: number;
    addressType: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    pincode: string;
    isPrimary: boolean;
  }[];
  emergencyContacts: {
    id: number;
    contactName: string;
    relationship: string;
    phone: string;
    alternatePhone: string | null;
    isPrimary: boolean;
  }[];
  qualifications: {
    id: number;
    qualificationLevel: string;
    boardOrUniversity: string;
    institutionName: string;
    passingYear: number;
    percentageOrCgpa: string;
    verified: boolean;
  }[];
  documents: {
    id: number;
    documentType: string;
    title: string;
    referenceNumber: string;
    verificationStatus: string;
    remarks: string | null;
  }[];
  admissionHistory: {
    admissionMode: string;
    entranceExam: string | null;
    entranceRank: string | null;
    allotmentNumber: string | null;
    admissionDate: string;
    seatCategory: string;
    verificationStatus: string;
  } | null;
  assessmentMarks: {
    id: number;
    subjectCode: string;
    subjectName: string;
    academicYearCode: string;
    semesterNumber: number;
    componentCode: string;
    componentName: string;
    componentCategory: string;
    marksObtained: string;
    maxMarks: number;
    workflowStatus: string;
  }[];
  semesterSummaries: {
    id: number;
    academicYearCode: string;
    semesterNumber: number;
    semesterName: string;
    totalCreditsRegistered: number;
    totalCreditsEarned: number;
    sgpa: string;
    cgpa: string;
    percentage: string;
    resultStatus: string;
    backlogCount: number;
    isPublished: boolean;
  }[];
  backlogs: {
    id: number;
    subjectCode: string;
    subjectName: string;
    academicYearCode: string;
    semesterNumber: number;
    originalMarks: string;
    attemptNumber: number;
    makeupExamDate: string | null;
    makeupMarks: string | null;
    status: string;
    remarks: string | null;
  }[];
  revaluations: {
    id: number;
    subjectCode: string;
    subjectName: string;
    requestType: string;
    originalMarks: string;
    revisedMarks: string | null;
    status: string;
    reason: string;
  }[];
  achievements: {
    id: number;
    title: string;
    category: string;
    issuer: string;
    achievedOn: string;
    level: string;
    verified: boolean;
  }[];
  projects: {
    id: number;
    title: string;
    projectType: string;
    domain: string;
    techStack: string;
    status: string;
    gradeOrRemarks: string | null;
  }[];
  internships: {
    id: number;
    companyName: string;
    roleTitle: string;
    internshipType: string;
    startDate: string;
    endDate: string;
    stipendInr: number | null;
    completionStatus: string;
  }[];
  placements: {
    id: number;
    companyName: string;
    jobRole: string;
    ctcLpa: string | null;
    driveDate: string;
    roundStage: string;
    offerStatus: string;
  }[];
  leaveRequests: {
    id: number;
    leaveType: string;
    fromDate: string;
    toDate: string;
    daysCount: number;
    reason: string;
    status: string;
  }[];
  libraryTransactions: {
    id: number;
    bookTitle: string;
    accessionNumber: string;
    dueDate: string;
    status: string;
  }[];
  transportAllocations: {
    id: number;
    routeCode: string;
    routeName: string;
    boardingStop: string;
    busNumber: string;
    status: string;
  }[];
  hostelAllocations: {
    id: number;
    hostelBlock: string;
    roomNumber: string;
    bedCode: string;
    messPlan: string;
    status: string;
  }[];
  alumniProfile: {
    graduationYear: number;
    degreeAwarded: string;
    finalCgpa: string;
    currentCompany: string | null;
    currentRole: string | null;
    city: string;
  } | null;
  parentLinks: {
    id: number;
    relationship: string;
    isPrimaryContact: boolean;
    isVerified: boolean;
    parentName: string;
    email: string;
    phone: string;
    occupation: string | null;
  }[];
  activityLogs: {
    id: number;
    action: string;
    entityType: string;
    reason: string | null;
    createdAt: string;
  }[];
}

const SECTIONS = [
  { id: 'overview', label: '1. Overview' },
  { id: 'personal', label: '2. Personal' },
  { id: 'admission', label: '3. Admission' },
  { id: 'academic', label: '4. Academics' },
  { id: 'internal', label: '5. CIE Marks' },
  { id: 'see', label: '6. SEE Results' },
  { id: 'sgpa', label: '7. SGPA / CGPA' },
  { id: 'attendance', label: '8. Attendance' },
  { id: 'backlogs', label: '9. Backlogs' },
  { id: 'fees', label: '10. Fees' },
  { id: 'documents', label: '11. Documents' },
  { id: 'achievements', label: '12. Achievements' },
  { id: 'projects', label: '13. Projects' },
  { id: 'internships', label: '14. Internships' },
  { id: 'placements', label: '15. Placements' },
  { id: 'parents', label: '16. Parents' },
  { id: 'activity', label: '17. Activity & Campus' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

export const Student360Panel: React.FC<{
  data: Student360Data;
  onRefresh?: () => Promise<void>;
}> = ({ data, onRefresh }) => {
  const { effectiveProfile, apiFetch } = useAuth();
  const [section, setSection] = useState<SectionId>('overview');

  const isAdmin = effectiveProfile?.role === 'super_admin';
  const canSelfEdit =
    isAdmin ||
    (effectiveProfile?.role === 'student' && effectiveProfile.studentId === data.student.id);

  // Address Form State
  const [addrOpen, setAddrOpen] = useState(false);
  const [addrForm, setAddrForm] = useState({
    addressType: 'current',
    line1: '',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560092',
  });

  // Document Upload State
  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    documentType: 'marks_card',
    title: '',
    referenceNumber: '',
  });
  const [saving, setSaving] = useState(false);

  const attendanceStats = useMemo(() => {
    const total = data.attendanceRecords.length;
    const present = data.attendanceRecords.filter((r) =>
      ['present', 'late', 'excused'].includes(r.status)
    ).length;
    const pct = total > 0 ? Math.round((present / total) * 1000) / 10 : 0;
    return { total, present, pct };
  }, [data.attendanceRecords]);

  const cieMarks = useMemo(
    () => data.assessmentMarks.filter((m) => m.componentCategory !== 'see'),
    [data.assessmentMarks]
  );
  const seeMarks = useMemo(
    () => data.assessmentMarks.filter((m) => m.componentCategory === 'see'),
    [data.assessmentMarks]
  );

  const latestSummary = data.semesterSummaries[data.semesterSummaries.length - 1];
  const totalFeeDue = data.feeAssignments.reduce((s, f) => s + Number(f.balanceDue || 0), 0);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch(`/api/students/${data.student.id}/addresses`, {
        method: 'POST',
        body: JSON.stringify(addrForm),
      });
      toast.success('Address added to student record');
      setAddrOpen(false);
      setAddrForm({ addressType: 'current', line1: '', city: 'Bengaluru', state: 'Karnataka', pincode: '560092' });
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save address');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/lifecycle/documents', {
        method: 'POST',
        body: JSON.stringify({ ...docForm, studentId: data.student.id }),
      });
      toast.success('Document submitted for institutional verification');
      setDocOpen(false);
      setDocForm({ documentType: 'marks_card', title: '', referenceNumber: '' });
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDocument = async (docId: number, verificationStatus: 'verified' | 'rejected') => {
    try {
      await apiFetch(`/api/lifecycle/documents/${docId}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ verificationStatus }),
      });
      toast.success(`Document ${verificationStatus}`);
      if (onRefresh) await onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification update failed');
    }
  };

  const handleDownloadTranscript = async () => {
    try {
      const payload = await apiFetch<{
        student: { usn: string; fullName: string; departmentName: string; programName: string };
        summaries: { academicYearCode: string; semesterName: string; sgpa: string; cgpa: string; resultStatus: string }[];
        marks: { academicYearCode: string; semesterNumber: number; subjectCode: string; subjectName: string; componentCode: string; marksObtained: string; maxMarks: number }[];
      }>(`/api/academics/transcript/${data.student.id}`);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      doc.setFillColor(90, 36, 43);
      doc.rect(0, 0, 595, 82, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text('IMPACT COLLEGE OF ENGINEERING AND APPLIED SCIENCES, BENGALURU', 40, 30);
      doc.setFontSize(10);
      doc.setTextColor(212, 175, 55);
      doc.text('OFFICIAL CONSOLIDATED ACADEMIC TRANSCRIPT & GRADE SHEET', 40, 50);
      doc.setTextColor(252, 250, 248);
      doc.text(`USN: ${payload.student.usn}  |  Name: ${payload.student.fullName}`, 40, 68);

      doc.setTextColor(31, 41, 55);
      doc.setFontSize(10);
      doc.text(`${payload.student.programName} · ${payload.student.departmentName}`, 40, 104);

      autoTable(doc, {
        startY: 118,
        head: [['Academic Year', 'Semester', 'SGPA', 'CGPA', 'Outcome']],
        body: payload.summaries.map((s) => [
          s.academicYearCode,
          s.semesterName,
          s.sgpa,
          s.cgpa,
          s.resultStatus.toUpperCase(),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [114, 47, 55], textColor: [255, 255, 255] },
      });

      const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 220;
      autoTable(doc, {
        startY: finalY + 18,
        head: [['Year', 'Sem', 'Subject Code', 'Subject', 'Component', 'Score']],
        body: payload.marks.map((m) => [
          m.academicYearCode,
          `S${m.semesterNumber}`,
          m.subjectCode,
          m.subjectName,
          m.componentCode,
          `${m.marksObtained}/${m.maxMarks}`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [41, 17, 21], textColor: [255, 255, 255] },
      });

      doc.save(`${payload.student.usn}_Official_Transcript.pdf`);
      toast.success('Downloaded Official Transcript PDF');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Transcript download failed');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Identity Banner */}
      <div className="wine-rose-gradient rounded-[20px] p-5 text-white shadow-sm flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold text-[#D4AF37]">
            {data.student.usn} · ADM {data.student.admissionNumber} · BATCH {data.student.admissionYear}
          </p>
          <h2 className="text-lg font-bold text-white mt-0.5">
            {data.student.fullName}
          </h2>
          <p className="text-xs text-white/85 mt-0.5">
            {data.student.departmentName} · {data.student.programName}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-white/15 text-[#D4AF37] border border-white/20">
            {data.student.academicStatus.toUpperCase()}
          </span>
          <Button size="sm" variant="gold" onClick={handleDownloadTranscript}>
            <Download className="w-3.5 h-3.5" />
            Transcript PDF
          </Button>
        </div>
      </div>

      {/* 17-Section Navigator */}
      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`px-3 py-1.5 text-xs rounded-xl border transition-all cursor-pointer ${
                active
                  ? 'wine-gradient text-white border-[#722F37] font-semibold shadow-sm'
                  : 'bg-white dark:bg-[#1B1214] text-[#4B3F42] dark:text-[#D8CCD0] border-[#E5E7EB] dark:border-[#332326] hover:bg-[#F7F3EE] dark:hover:bg-[#26191B]'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Section 1: Overview */}
      {section === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Surface className="p-3.5">
              <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8]">Current CGPA</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#8A6D0B] dark:text-[#D4AF37] mt-1">
                {latestSummary?.cgpa ?? '—'}
              </p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
                Latest SGPA: {latestSummary?.sgpa ?? '—'}
              </p>
            </Surface>
            <Surface className="p-3.5">
              <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8]">Attendance Rate</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#15803D] dark:text-[#4ADE80] mt-1">
                {attendanceStats.pct}%
              </p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
                {attendanceStats.present}/{attendanceStats.total} classes
              </p>
            </Surface>
            <Surface className="p-3.5">
              <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8]">Active Backlogs</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#722F37] dark:text-[#D48A94] mt-1">
                {data.backlogs.filter((b) => b.status !== 'cleared').length}
              </p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
                {data.backlogs.filter((b) => b.status === 'cleared').length} cleared
              </p>
            </Surface>
            <Surface className="p-3.5">
              <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8]">Fee Balance Due</p>
              <p className="text-xl font-bold font-mono tabular-nums text-[#1F2937] dark:text-[#FAF6F5] mt-1">
                {formatINR(totalFeeDue)}
              </p>
              <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
                {data.feePayments.length} payment receipts
              </p>
            </Surface>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <Surface className="p-4 space-y-2">
              <p className="font-semibold text-[#1F2937] dark:text-[#FAF6F5] flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
                Academic Progression Summary
              </p>
              {data.enrollments.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-1 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0">
                  <span>
                    <strong className="font-mono">{e.academicYearCode}</strong> · {e.semesterName} (Sec {e.sectionName})
                  </span>
                  <StatusText tone={e.enrollmentStatus === 'enrolled' ? 'info' : 'success'}>
                    {e.enrollmentStatus}
                  </StatusText>
                </div>
              ))}
            </Surface>

            <Surface className="p-4 space-y-2">
              <p className="font-semibold text-[#1F2937] dark:text-[#FAF6F5] flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" />
                Co-Curricular &amp; Placement Snapshot
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <div>Achievements: <strong>{data.achievements.length}</strong></div>
                <div>Projects: <strong>{data.projects.length}</strong></div>
                <div>Internships: <strong>{data.internships.length}</strong></div>
                <div>Placements: <strong>{data.placements.length}</strong></div>
                <div>Documents: <strong>{data.documents.length}</strong></div>
                <div>Leaves: <strong>{data.leaveRequests.length}</strong></div>
              </div>
            </Surface>
          </div>
        </div>
      )}

      {/* Section 2: Personal Info */}
      {section === 'personal' && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Surface className="p-4">
              <p className="text-[#6B7280] dark:text-[#B5A5A8]">Institutional Email &amp; Mobile</p>
              <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5] mt-1">{data.student.email}</p>
              <p className="text-[#4B3F42] dark:text-[#D8CCD0] mt-0.5 font-mono">{data.student.phone}</p>
            </Surface>
            <Surface className="p-4">
              <p className="text-[#6B7280] dark:text-[#B5A5A8]">Date of Birth &amp; Gender</p>
              <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5] mt-1 font-mono">{data.student.dateOfBirth}</p>
              <p className="text-[#4B3F42] dark:text-[#D8CCD0] mt-0.5">{data.student.gender || 'Not specified'}</p>
            </Surface>
            <Surface className="p-4">
              <p className="text-[#6B7280] dark:text-[#B5A5A8]">Biometric Consent</p>
              <div className="mt-1">
                <StatusText tone={data.student.biometricEnrolled ? 'success' : 'neutral'}>
                  {data.student.biometricEnrolled ? 'Enrolled & Consented' : 'Not Enrolled'}
                </StatusText>
              </div>
            </Surface>
          </div>

          <Surface className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[#1F2937] dark:text-[#FAF6F5] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
                Registered Residential Addresses ({data.addresses.length})
              </p>
              {canSelfEdit && (
                <Button size="sm" variant="outline" onClick={() => setAddrOpen(!addrOpen)}>
                  <Plus className="w-3.5 h-3.5" />
                  Add Address
                </Button>
              )}
            </div>

            {addrOpen && (
              <form onSubmit={handleAddAddress} className="grid grid-cols-1 sm:grid-cols-5 gap-2 p-3 rounded-xl bg-[#FCFAF8] dark:bg-[#170F11] border border-[#E5E7EB] dark:border-[#332326]">
                <Select value={addrForm.addressType} onChange={(e) => setAddrForm({ ...addrForm, addressType: e.target.value })}>
                  <option value="current">Current</option>
                  <option value="permanent">Permanent</option>
                </Select>
                <Input placeholder="Street / House No" value={addrForm.line1} onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })} required />
                <Input placeholder="City" value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} required />
                <Input placeholder="Pincode" value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} required />
                <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
              </form>
            )}

            <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
              {data.addresses.length === 0 ? (
                <p className="py-2 text-[#6B7280] dark:text-[#B5A5A8]">{data.student.address}</p>
              ) : (
                data.addresses.map((a) => (
                  <div key={a.id} className="py-2 flex items-center justify-between gap-4">
                    <div>
                      <span className="font-mono uppercase text-[11px] font-semibold text-[#722F37] dark:text-[#D48A94] mr-2">
                        {a.addressType}
                      </span>
                      <span className="text-[#1F2937] dark:text-[#FAF6F5]">
                        {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} – {a.pincode}
                      </span>
                    </div>
                    {a.isPrimary && <StatusText tone="success">Primary</StatusText>}
                  </div>
                ))
              )}
            </div>
          </Surface>
        </div>
      )}

      {/* Section 3: Admission Info */}
      {section === 'admission' && (
        <div className="space-y-4 text-xs">
          <Surface className="p-4">
            <h4 className="font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-3">
              Institutional Admission Record
            </h4>
            {data.admissionHistory ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><span className="text-[#6B7280] dark:text-[#B5A5A8] block">Mode / Quota</span><strong>{data.admissionHistory.admissionMode.toUpperCase()} ({data.admissionHistory.seatCategory})</strong></div>
                <div><span className="text-[#6B7280] dark:text-[#B5A5A8] block">Entrance Exam &amp; Rank</span><strong className="font-mono">{data.admissionHistory.entranceExam || '—'} · Rank {data.admissionHistory.entranceRank || '—'}</strong></div>
                <div><span className="text-[#6B7280] dark:text-[#B5A5A8] block">Allotment No</span><strong className="font-mono">{data.admissionHistory.allotmentNumber || '—'}</strong></div>
                <div><span className="text-[#6B7280] dark:text-[#B5A5A8] block">Admission Date</span><strong className="font-mono">{data.admissionHistory.admissionDate}</strong></div>
                <div><span className="text-[#6B7280] dark:text-[#B5A5A8] block">Verification</span><StatusText tone={data.admissionHistory.verificationStatus === 'verified' ? 'success' : 'warning'}>{data.admissionHistory.verificationStatus.toUpperCase()}</StatusText></div>
              </div>
            ) : (
              <p className="text-[#6B7280] dark:text-[#B5A5A8]">Admission Number: {data.student.admissionNumber} (Batch {data.student.admissionYear})</p>
            )}
          </Surface>

          <Surface className="p-4">
            <h4 className="font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-2">
              Previous Academic Qualifications ({data.qualifications.length})
            </h4>
            <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
              {data.qualifications.map((q) => (
                <div key={q.id} className="py-2 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{q.qualificationLevel} · {q.institutionName}</p>
                    <p className="text-[#6B7280] dark:text-[#B5A5A8]">{q.boardOrUniversity} · Passing Year {q.passingYear}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-[#722F37] dark:text-[#D48A94]">{q.percentageOrCgpa}</p>
                    <StatusText tone={q.verified ? 'success' : 'warning'}>{q.verified ? 'Verified' : 'Pending'}</StatusText>
                  </div>
                </div>
              ))}
            </div>
          </Surface>
        </div>
      )}

      {/* Section 4: Academic History */}
      {section === 'academic' && (
        <Surface className="overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                <th className="py-2.5 px-4">Academic Year</th>
                <th className="py-2.5 px-4">Semester</th>
                <th className="py-2.5 px-4">Section</th>
                <th className="py-2.5 px-4">Roll No</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
              {data.enrollments.map((e) => (
                <tr key={e.id}>
                  <td className="py-2.5 px-4 font-mono font-semibold">{e.academicYearCode}</td>
                  <td className="py-2.5 px-4">{e.semesterName}</td>
                  <td className="py-2.5 px-4">Section {e.sectionName}</td>
                  <td className="py-2.5 px-4 font-mono">{e.rollNumber || '—'}</td>
                  <td className="py-2.5 px-4">
                    <StatusText tone={e.enrollmentStatus === 'enrolled' ? 'info' : 'success'}>
                      {e.enrollmentStatus.toUpperCase()}
                    </StatusText>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      )}

      {/* Section 5: Internal CIE Marks */}
      {section === 'internal' && (
        <Surface className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between text-xs">
            <span className="font-semibold">Continuous Internal Evaluation (CIE) Component Marks</span>
            <span className="text-[#6B7280] dark:text-[#B5A5A8]">Students/Parents only view published marks</span>
          </div>
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                <th className="py-2.5 px-4">Year / Sem</th>
                <th className="py-2.5 px-4">Subject</th>
                <th className="py-2.5 px-4">Component</th>
                <th className="py-2.5 px-4 text-right">Marks</th>
                <th className="py-2.5 px-4">Workflow</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
              {cieMarks.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-[#6B7280] dark:text-[#B5A5A8]">No published internal marks yet.</td></tr>
              ) : (
                cieMarks.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 px-4 font-mono">{m.academicYearCode} · S{m.semesterNumber}</td>
                    <td className="py-2.5 px-4"><strong className="font-mono">{m.subjectCode}</strong> · {m.subjectName}</td>
                    <td className="py-2.5 px-4">{m.componentName} ({m.componentCode})</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">{m.marksObtained} / {m.maxMarks}</td>
                    <td className="py-2.5 px-4"><StatusText tone={m.workflowStatus === 'published' ? 'success' : 'warning'}>{m.workflowStatus.toUpperCase()}</StatusText></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Surface>
      )}

      {/* Section 6: SEE Results */}
      {section === 'see' && (
        <div className="space-y-4">
          <Surface className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#332326] text-xs font-semibold">
              Semester End Examination (SEE) Marks
            </div>
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">Year / Sem</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4 text-right">SEE Score</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                {seeMarks.length === 0 ? (
                  <tr><td colSpan={4} className="py-5 text-center text-[#6B7280] dark:text-[#B5A5A8]">No SEE component marks published yet.</td></tr>
                ) : (
                  seeMarks.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2.5 px-4 font-mono">{m.academicYearCode} · S{m.semesterNumber}</td>
                      <td className="py-2.5 px-4"><strong className="font-mono">{m.subjectCode}</strong> · {m.subjectName}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">{m.marksObtained} / {m.maxMarks}</td>
                      <td className="py-2.5 px-4"><StatusText tone={m.workflowStatus === 'published' ? 'success' : 'warning'}>{m.workflowStatus.toUpperCase()}</StatusText></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Surface>

          {data.revaluations.length > 0 && (
            <Surface className="p-4 text-xs space-y-2">
              <p className="font-semibold">Revaluation Requests ({data.revaluations.length})</p>
              {data.revaluations.map((rv) => (
                <div key={rv.id} className="flex items-center justify-between py-1.5 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0">
                  <span><strong className="font-mono">{rv.subjectCode}</strong> · {rv.requestType} (Orig: {rv.originalMarks}{rv.revisedMarks ? ` → Revised: ${rv.revisedMarks}` : ''})</span>
                  <StatusText tone={rv.status === 'completed' ? 'success' : 'info'}>{rv.status.toUpperCase()}</StatusText>
                </div>
              ))}
            </Surface>
          )}
        </div>
      )}

      {/* Section 7: SGPA & CGPA */}
      {section === 'sgpa' && (
        <div className="space-y-4">
          {data.semesterSummaries.length > 0 && (
            <Surface className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
                  SGPA &amp; CGPA Progression
                </p>
                <span className="text-xs font-mono text-[#8A6D0B] dark:text-[#D4AF37] font-bold">
                  Cumulative CGPA: {latestSummary?.cgpa}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {data.semesterSummaries.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8]/80 dark:bg-[#170F11] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">{s.academicYearCode} · Sem {s.semesterNumber}</span>
                      <StatusText tone={s.resultStatus === 'pass' ? 'success' : 'warning'}>{s.resultStatus.toUpperCase()}</StatusText>
                    </div>
                    <div className="flex items-baseline justify-between font-mono tabular-nums">
                      <span>SGPA: <strong className="text-sm text-[#722F37] dark:text-[#D48A94]">{s.sgpa}</strong></span>
                      <span>CGPA: <strong className="text-sm text-[#8A6D0B] dark:text-[#D4AF37]">{s.cgpa}</strong></span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F7F3EE] dark:bg-[#26191B] overflow-hidden">
                      <div
                        className="h-full wine-gradient rounded-full"
                        style={{ width: `${Math.min(100, Number(s.sgpa) * 10)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8] font-mono">
                      Credits: {s.totalCreditsEarned}/{s.totalCreditsRegistered} · {s.percentage}%
                    </p>
                  </div>
                ))}
              </div>
            </Surface>
          )}
        </div>
      )}

      {/* Section 8: Attendance */}
      {section === 'attendance' && (
        <Surface className="overflow-hidden">
          <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between text-xs">
            <span className="font-semibold">Attendance Ledger ({attendanceStats.present}/{attendanceStats.total} · {attendanceStats.pct}%)</span>
            <StatusText tone={attendanceStats.pct >= 75 ? 'success' : 'warning'}>
              {attendanceStats.pct >= 75 ? 'Eligible (>=75%)' : 'Below 75% VTU Norm'}
            </StatusText>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
            {data.attendanceRecords.map((a) => (
              <div key={a.id} className="px-4 py-2.5 flex items-center justify-between">
                <span><strong className="font-mono">{a.subjectCode}</strong> · {a.subjectName}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[#6B7280] dark:text-[#B5A5A8]">{a.verificationMethod}</span>
                  <StatusText tone={a.status === 'absent' ? 'danger' : a.status === 'late' ? 'warning' : 'success'}>
                    {a.status.toUpperCase()}
                  </StatusText>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      )}

      {/* Section 9: Backlogs */}
      {section === 'backlogs' && (
        <Surface className="overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                <th className="py-2.5 px-4">Subject</th>
                <th className="py-2.5 px-4">Term</th>
                <th className="py-2.5 px-4 text-right">Attempt</th>
                <th className="py-2.5 px-4 text-right">Original</th>
                <th className="py-2.5 px-4 text-right">Makeup</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
              {data.backlogs.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-[#6B7280] dark:text-[#B5A5A8]">Zero active or historical backlogs.</td></tr>
              ) : (
                data.backlogs.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5 px-4"><strong className="font-mono">{b.subjectCode}</strong> · {b.subjectName}</td>
                    <td className="py-2.5 px-4 font-mono">{b.academicYearCode} S{b.semesterNumber}</td>
                    <td className="py-2.5 px-4 text-right font-mono">#{b.attemptNumber}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{b.originalMarks}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{b.makeupMarks ?? '—'}</td>
                    <td className="py-2.5 px-4"><StatusText tone={b.status === 'cleared' ? 'success' : 'warning'}>{b.status.toUpperCase()}</StatusText></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Surface>
      )}

      {/* Section 10: Fees */}
      {section === 'fees' && (
        <div className="space-y-4 text-xs">
          <Surface className="overflow-hidden">
            <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#332326] font-semibold flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
              Academic Year Fee Assignments
            </div>
            <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
              {data.feeAssignments.map((f) => (
                <div key={f.id} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 font-mono tabular-nums">
                  <span className="font-semibold">{f.academicYearCode}</span>
                  <span>Net: {formatINR(f.netPayable)} · Paid: {formatINR(f.paidAmount)} · Due: {formatINR(f.balanceDue)}</span>
                  <StatusText tone={f.balanceDue === 0 ? 'success' : 'warning'}>{f.status.toUpperCase()}</StatusText>
                </div>
              ))}
            </div>
          </Surface>
          {data.feePayments.length > 0 && (
            <Surface className="p-4 space-y-2">
              <p className="font-semibold">Payment Receipts ({data.feePayments.length})</p>
              {data.feePayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between font-mono py-1 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0">
                  <span>{p.receiptNumber} · {p.academicYearCode} ({p.paymentMode})</span>
                  <span className="font-semibold text-[#15803D] dark:text-[#4ADE80]">{formatINR(p.amountPaid)}</span>
                </div>
              ))}
            </Surface>
          )}
        </div>
      )}

      {/* Section 11: Documents */}
      {section === 'documents' && (
        <Surface className="p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <p className="font-semibold flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
              Student Document Vault ({data.documents.length})
            </p>
            {canSelfEdit && (
              <Button size="sm" variant="outline" onClick={() => setDocOpen(!docOpen)}>
                <Plus className="w-3.5 h-3.5" />
                Submit Document Ref
              </Button>
            )}
          </div>

          {docOpen && (
            <form onSubmit={handleAddDocument} className="grid grid-cols-1 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-[#FCFAF8] dark:bg-[#170F11] border border-[#E5E7EB] dark:border-[#332326]">
              <Select value={docForm.documentType} onChange={(e) => setDocForm({ ...docForm, documentType: e.target.value })}>
                <option value="marks_card">Marks Card</option>
                <option value="id_proof">Govt ID Proof</option>
                <option value="transfer_certificate">Transfer Certificate</option>
                <option value="bonafide">Bonafide / Study Cert</option>
              </Select>
              <Input placeholder="Document Title" value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} required />
              <Input placeholder="Reference / Reg No" value={docForm.referenceNumber} onChange={(e) => setDocForm({ ...docForm, referenceNumber: e.target.value })} required />
              <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Submit'}</Button>
            </form>
          )}

          <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
            {data.documents.map((d) => (
              <div key={d.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{d.title}</p>
                  <p className="font-mono text-[#6B7280] dark:text-[#B5A5A8]">{d.documentType} · Ref: {d.referenceNumber}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusText tone={d.verificationStatus === 'verified' ? 'success' : d.verificationStatus === 'rejected' ? 'danger' : 'warning'}>
                    {d.verificationStatus.toUpperCase()}
                  </StatusText>
                  {isAdmin && d.verificationStatus === 'pending' && (
                    <>
                      <Button size="sm" variant="teal" onClick={() => handleVerifyDocument(d.id, 'verified')}>Verify</Button>
                      <Button size="sm" variant="outline" onClick={() => handleVerifyDocument(d.id, 'rejected')}>Reject</Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Surface>
      )}

      {/* Section 12: Achievements */}
      {section === 'achievements' && (
        <Surface className="p-4 space-y-2 text-xs">
          <p className="font-semibold flex items-center gap-1.5 mb-2"><Award className="w-3.5 h-3.5 text-[#8A6D0B] dark:text-[#D4AF37]" /> Co-Curricular Achievements ({data.achievements.length})</p>
          {data.achievements.length === 0 ? <p className="text-[#6B7280] dark:text-[#B5A5A8]">No achievements recorded.</p> : data.achievements.map((a) => (
            <div key={a.id} className="py-2 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0 flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{a.title}</p>
                <p className="text-[#6B7280] dark:text-[#B5A5A8]">{a.issuer} · {a.category} · {a.level} · {a.achievedOn}</p>
              </div>
              <StatusText tone={a.verified ? 'success' : 'warning'}>{a.verified ? 'Verified' : 'Pending'}</StatusText>
            </div>
          ))}
        </Surface>
      )}

      {/* Section 13: Projects */}
      {section === 'projects' && (
        <Surface className="p-4 space-y-2 text-xs">
          <p className="font-semibold flex items-center gap-1.5 mb-2"><FolderGit2 className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" /> Academic Projects ({data.projects.length})</p>
          {data.projects.length === 0 ? <p className="text-[#6B7280] dark:text-[#B5A5A8]">No projects recorded.</p> : data.projects.map((p) => (
            <div key={p.id} className="py-2 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0 flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{p.title}</p>
                <p className="text-[#6B7280] dark:text-[#B5A5A8]">{p.domain} · Tech: {p.techStack}</p>
              </div>
              <StatusText tone="info">{p.status.toUpperCase()}</StatusText>
            </div>
          ))}
        </Surface>
      )}

      {/* Section 14: Internships */}
      {section === 'internships' && (
        <Surface className="p-4 space-y-2 text-xs">
          <p className="font-semibold flex items-center gap-1.5 mb-2"><Briefcase className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" /> Industry Internships ({data.internships.length})</p>
          {data.internships.length === 0 ? <p className="text-[#6B7280] dark:text-[#B5A5A8]">No internships logged.</p> : data.internships.map((i) => (
            <div key={i.id} className="py-2 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0 flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{i.roleTitle} at {i.companyName}</p>
                <p className="text-[#6B7280] dark:text-[#B5A5A8] font-mono">{i.startDate} → {i.endDate} · Stipend: {formatINR(i.stipendInr || 0)}/mo</p>
              </div>
              <StatusText tone="success">{i.completionStatus.toUpperCase()}</StatusText>
            </div>
          ))}
        </Surface>
      )}

      {/* Section 15: Placements */}
      {section === 'placements' && (
        <Surface className="p-4 space-y-2 text-xs">
          <p className="font-semibold flex items-center gap-1.5 mb-2"><UserCheck className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" /> Placement Drives &amp; Offers ({data.placements.length})</p>
          {data.placements.length === 0 ? <p className="text-[#6B7280] dark:text-[#B5A5A8]">No placement applications yet.</p> : data.placements.map((pl) => (
            <div key={pl.id} className="py-2 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0 flex items-center justify-between">
              <div>
                <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{pl.companyName} · {pl.jobRole}</p>
                <p className="text-[#6B7280] dark:text-[#B5A5A8] font-mono">Drive: {pl.driveDate} · CTC: {pl.ctcLpa || '—'} LPA · Stage: {pl.roundStage}</p>
              </div>
              <StatusText tone={pl.offerStatus === 'offered' || pl.offerStatus === 'accepted' ? 'success' : 'info'}>
                {pl.offerStatus.toUpperCase()}
              </StatusText>
            </div>
          ))}
        </Surface>
      )}

      {/* Section 16: Parents & Emergency Contacts */}
      {section === 'parents' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <Surface className="p-4 space-y-2">
            <p className="font-semibold flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" /> Linked Parent Portal Accounts ({data.parentLinks.length})</p>
            {data.parentLinks.map((pl) => (
              <div key={pl.id} className="py-2 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0">
                <p className="font-medium">{pl.parentName} ({pl.relationship})</p>
                <p className="text-[#6B7280] dark:text-[#B5A5A8] font-mono">{pl.email} · {pl.phone}</p>
              </div>
            ))}
          </Surface>
          <Surface className="p-4 space-y-2">
            <p className="font-semibold flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-[#8A6D0B] dark:text-[#D4AF37]" /> Emergency Contacts ({data.emergencyContacts.length})</p>
            {data.emergencyContacts.length === 0 ? (
              <p>{data.student.emergencyContactName} ({data.student.emergencyContactPhone})</p>
            ) : data.emergencyContacts.map((ec) => (
              <div key={ec.id} className="py-2 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0">
                <p className="font-medium">{ec.contactName} ({ec.relationship})</p>
                <p className="text-[#6B7280] dark:text-[#B5A5A8] font-mono">{ec.phone}</p>
              </div>
            ))}
          </Surface>
        </div>
      )}

      {/* Section 17: Activity History & Campus Facilities */}
      {section === 'activity' && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Surface className="p-3.5">
              <p className="font-semibold flex items-center gap-1.5 mb-1"><BookOpen className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" /> Library Books ({data.libraryTransactions.length})</p>
              {data.libraryTransactions.map((l) => (
                <p key={l.id} className="text-[#4B3F42] dark:text-[#D8CCD0] truncate">{l.bookTitle} ({l.status})</p>
              ))}
            </Surface>
            <Surface className="p-3.5">
              <p className="font-semibold mb-1">Hostel &amp; Transport</p>
              {data.hostelAllocations.map((h) => <p key={h.id}>{h.hostelBlock} · Room {h.roomNumber} ({h.bedCode})</p>)}
              {data.transportAllocations.map((t) => <p key={t.id}>{t.routeCode} · {t.boardingStop}</p>)}
              {data.hostelAllocations.length === 0 && data.transportAllocations.length === 0 && <p className="text-[#6B7280] dark:text-[#B5A5A8]">Day scholar / self commute</p>}
            </Surface>
            <Surface className="p-3.5">
              <p className="font-semibold mb-1">Biometric Consent &amp; Alumni</p>
              {data.consentRecords.slice(0, 2).map((c) => (
                <p key={c.id} className="font-mono">{c.consentType}: {c.status}</p>
              ))}
              {data.alumniProfile && <p className="mt-1 text-[#15803D] dark:text-[#4ADE80]">Alumni {data.alumniProfile.graduationYear} · {data.alumniProfile.currentCompany}</p>}
            </Surface>
          </div>

          <Surface className="p-4 space-y-2">
            <p className="font-semibold flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#B5A5A8]" /> Recent Audit &amp; Consent Trail</p>
            {data.activityLogs.length === 0 ? <p className="text-[#6B7280] dark:text-[#B5A5A8]">No recent audit actions recorded.</p> : data.activityLogs.map((al) => (
              <div key={al.id} className="flex items-center justify-between py-1.5 border-b border-[#E5E7EB] dark:border-[#332326] last:border-0">
                <span className="font-mono text-[#722F37] dark:text-[#D48A94]">{al.action}</span>
                <span className="text-[#6B7280] dark:text-[#B5A5A8] font-mono">{formatIST(al.createdAt)}</span>
              </div>
            ))}
          </Surface>
        </div>
      )}
    </div>
  );
};
