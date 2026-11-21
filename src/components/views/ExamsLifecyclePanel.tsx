import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  Calculator,
  CheckCircle2,
  ClipboardEdit,
  FileText,
  Layers,
  Lock,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { Button, FieldLabel, Input, Modal, Select, StatusText, Surface, TabBar } from '../ui/primitives';

interface SchemeItem {
  id: number;
  academicYearId: number;
  academicYearCode: string;
  programId: number;
  programCode: string;
  programName: string;
  schemeCode: string;
  name: string;
  cieMaxMarks: number;
  seeMaxMarks: number;
  totalMaxMarks: number;
  minCiePercentage: string;
  minSeePercentage: string;
  minTotalPercentage: string;
  isActive: boolean;
}

interface ComponentItem {
  id: number;
  schemeId: number;
  code: string;
  name: string;
  category: string;
  maxMarks: number;
  weightagePct: string;
  passingMarks: number;
}

interface GradeScaleItem {
  id: number;
  schemeCode: string;
  gradeLetter: string;
  gradePoints: string;
  minPercentage: string;
  maxPercentage: string;
  description: string;
  isPass: boolean;
}

interface MarkRow {
  id: number;
  studentId: number;
  usn: string;
  studentName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  academicYearId: number;
  academicYearCode: string;
  semesterId: number;
  semesterNumber: number;
  componentId: number;
  componentCode: string;
  componentName: string;
  componentCategory: string;
  marksObtained: string;
  maxMarks: number;
  workflowStatus: string;
  remarks: string | null;
}

interface MarkChangeItem {
  id: number;
  studentAssessmentMarkId: number;
  usn: string;
  studentName: string;
  subjectCode: string;
  subjectName: string;
  previousMarks: string;
  requestedMarks: string;
  reason: string;
  status: string;
  reviewNotes: string | null;
}

interface SummaryItem {
  id: number;
  studentId: number;
  usn: string;
  studentName: string;
  departmentCode: string;
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
}

interface BacklogItem {
  id: number;
  studentId: number;
  usn: string;
  studentName: string;
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
}

interface RevaluationItem {
  id: number;
  studentId: number;
  usn: string;
  studentName: string;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  academicYearCode: string;
  semesterNumber: number;
  requestType: string;
  originalMarks: string;
  revisedMarks: string | null;
  feeAmount: number;
  paymentReference: string | null;
  reason: string;
  status: string;
  reviewerNotes: string | null;
}

export const ExamsLifecyclePanel: React.FC<{
  refData: {
    semesters: { id: number; academicYearId: number; number: number; name: string }[];
    subjects: { id: number; code: string; name: string }[];
    students: { id: number; usn: string; fullName: string }[];
    programs?: { id: number; code: string; name: string }[];
  } | null;
}> = ({ refData }) => {
  const { effectiveProfile, selectedAcademicYearId, apiFetch } = useAuth();
  const isAdmin = effectiveProfile?.role === 'super_admin';
  const isStaff = isAdmin || effectiveProfile?.role === 'faculty';
  const isStudent = effectiveProfile?.role === 'student';

  const [subTab, setSubTab] = useState<'sgpa' | 'marks' | 'schemes' | 'backlogs' | 'revaluations'>('sgpa');
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [gradeScales, setGradeScales] = useState<GradeScaleItem[]>([]);
  const [marks, setMarks] = useState<MarkRow[]>([]);
  const [markChanges, setMarkChanges] = useState<MarkChangeItem[]>([]);
  const [summaries, setSummaries] = useState<SummaryItem[]>([]);
  const [backlogs, setBacklogs] = useState<BacklogItem[]>([]);
  const [revaluations, setRevaluations] = useState<RevaluationItem[]>([]);

  // Filters & Forms
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [computing, setComputing] = useState(false);

  // Batch Entry Modal
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({
    studentId: '',
    subjectId: '',
    semesterId: '',
    componentId: '',
    marksObtained: '20',
    submitForApproval: false,
  });

  // Mark Change Modal
  const [changeTarget, setChangeTarget] = useState<MarkRow | null>(null);
  const [changeForm, setChangeForm] = useState({ requestedMarks: '', reason: '' });

  // Scheme Modal
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [schemeForm, setSchemeForm] = useState({
    programId: '',
    schemeCode: 'VTU-2026-OBE',
    name: '2026 Outcome-Based 50:50 Scheme',
    cieMaxMarks: '50',
    seeMaxMarks: '50',
  });

  // Revaluation Submit / Review Modals
  const [revalOpen, setRevalOpen] = useState(false);
  const [revalForm, setRevalForm] = useState({
    subjectId: '',
    semesterId: '',
    requestType: 'revaluation',
    originalMarks: '34',
    reason: '',
  });
  const [reviewReval, setReviewReval] = useState<RevaluationItem | null>(null);
  const [reviewForm, setReviewForm] = useState({
    status: 'completed' as 'under_review' | 'completed' | 'rejected',
    revisedMarks: '',
    reviewerNotes: '',
  });

  // Backlog Modal
  const [backlogTarget, setBacklogTarget] = useState<BacklogItem | null>(null);
  const [backlogForm, setBacklogForm] = useState({
    status: 'cleared',
    makeupExamDate: '2026-12-18',
    makeupMarks: '48',
    remarks: 'Cleared in supplementary examination',
  });

  const loadAll = useCallback(async () => {
    try {
      const yq = selectedAcademicYearId ? `?academicYearId=${selectedAcademicYearId}` : '';
      const mq = new URLSearchParams();
      if (selectedAcademicYearId) mq.set('academicYearId', String(selectedAcademicYearId));
      if (selectedSubjectId) mq.set('subjectId', selectedSubjectId);

      const [schRes, mRes, sumRes, blRes, revRes] = await Promise.all([
        apiFetch<{ schemes: SchemeItem[]; components: ComponentItem[]; gradeScales: GradeScaleItem[] }>('/api/academics/schemes'),
        apiFetch<{ marks: MarkRow[] }>(`/api/academics/marks?${mq.toString()}`),
        apiFetch<{ summaries: SummaryItem[] }>(`/api/academics/results/summaries${yq}`),
        apiFetch<{ backlogs: BacklogItem[] }>('/api/academics/backlogs'),
        apiFetch<{ revaluations: RevaluationItem[] }>('/api/academics/revaluations'),
      ]);

      setSchemes(schRes.schemes);
      setComponents(schRes.components);
      setGradeScales(schRes.gradeScales);
      setMarks(mRes.marks);
      setSummaries(sumRes.summaries);
      setBacklogs(blRes.backlogs);
      setRevaluations(revRes.revaluations);

      if (isStaff) {
        const mcRes = await apiFetch<{ requests: MarkChangeItem[] }>('/api/academics/mark-change-requests');
        setMarkChanges(mcRes.requests);
      }

      if (refData) {
        const activeSem =
          refData.semesters.find((s) => s.academicYearId === selectedAcademicYearId && s.number === 5) ||
          refData.semesters.find((s) => s.academicYearId === selectedAcademicYearId) ||
          refData.semesters[0];
        if (!selectedSemesterId && activeSem) setSelectedSemesterId(String(activeSem.id));
        if (!entryForm.studentId && refData.students.length > 0) {
          setEntryForm((p) => ({
            ...p,
            studentId: String(refData.students[0].id),
            subjectId: String(refData.subjects[0]?.id || ''),
            semesterId: String(activeSem?.id || ''),
            componentId: String(schRes.components[0]?.id || ''),
          }));
        }
        if (!revalForm.subjectId && refData.subjects.length > 0) {
          setRevalForm((p) => ({
            ...p,
            subjectId: String(refData.subjects[0].id),
            semesterId: String(activeSem?.id || ''),
          }));
        }
        if (!schemeForm.programId && refData.programs && refData.programs.length > 0) {
          setSchemeForm((p) => ({ ...p, programId: String(refData.programs![0].id) }));
        }
      }
    } catch (err) {
      console.error('Failed to load academics lifecycle data:', err);
    }
  }, [
    apiFetch,
    entryForm.studentId,
    isStaff,
    refData,
    revalForm.subjectId,
    schemeForm.programId,
    selectedAcademicYearId,
    selectedSemesterId,
    selectedSubjectId,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleComputeSgpa = async (publishResults: boolean) => {
    if (!selectedAcademicYearId || !selectedSemesterId) {
      toast.error('Select an Academic Year and Semester first');
      return;
    }
    setComputing(true);
    try {
      const res = await apiFetch<{ computedCount: number }>('/api/academics/results/compute', {
        method: 'POST',
        body: JSON.stringify({
          academicYearId: selectedAcademicYearId,
          semesterId: Number(selectedSemesterId),
          publishResults,
        }),
      });
      toast.success(
        `Computed SGPA/CGPA for ${res.computedCount} student(s)${publishResults ? ' & published results' : ''}`
      );
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Computation failed');
    } finally {
      setComputing(false);
    }
  };

  const handleSaveMark = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/academics/marks/batch', {
        method: 'POST',
        body: JSON.stringify({
          entries: [
            {
              studentId: Number(entryForm.studentId),
              subjectId: Number(entryForm.subjectId),
              academicYearId: selectedAcademicYearId,
              semesterId: Number(entryForm.semesterId),
              componentId: Number(entryForm.componentId),
              marksObtained: Number(entryForm.marksObtained),
            },
          ],
          submitForApproval: entryForm.submitForApproval,
        }),
      });
      toast.success(entryForm.submitForApproval ? 'Marks submitted for approval' : 'Saved as draft');
      setEntryOpen(false);
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save marks');
    }
  };

  const handlePublishAllMarks = async () => {
    if (!selectedAcademicYearId || !selectedSemesterId) return;
    try {
      const res = await apiFetch<{ publishedCount: number }>('/api/academics/marks/publish', {
        method: 'POST',
        body: JSON.stringify({
          academicYearId: selectedAcademicYearId,
          semesterId: Number(selectedSemesterId),
          subjectId: selectedSubjectId ? Number(selectedSubjectId) : undefined,
        }),
      });
      toast.success(`Published ${res.publishedCount} component mark entries`);
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish marks');
    }
  };

  const handleSubmitMarkChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeTarget) return;
    try {
      await apiFetch('/api/academics/mark-change-requests', {
        method: 'POST',
        body: JSON.stringify({
          studentAssessmentMarkId: changeTarget.id,
          requestedMarks: Number(changeForm.requestedMarks),
          reason: changeForm.reason,
        }),
      });
      toast.success('Mark Change Request submitted to Controller of Examinations');
      setChangeTarget(null);
      setChangeForm({ requestedMarks: '', reason: '' });
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  };

  const handleReviewMarkChange = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/academics/mark-change-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewNotes: `${status} via CoE panel` }),
      });
      toast.success(`Mark Change Request ${status}`);
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Review failed');
    }
  };

  const handleCreateScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/academics/schemes', {
        method: 'POST',
        body: JSON.stringify({ ...schemeForm, academicYearId: selectedAcademicYearId }),
      });
      toast.success('Assessment scheme created with CIE + SEE components');
      setSchemeOpen(false);
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create scheme');
    }
  };

  const handleSubmitRevaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/academics/revaluations', {
        method: 'POST',
        body: JSON.stringify({
          ...revalForm,
          academicYearId: selectedAcademicYearId,
          studentId: effectiveProfile?.studentId,
        }),
      });
      toast.success('Revaluation request submitted');
      setRevalOpen(false);
      setRevalForm((p) => ({ ...p, reason: '' }));
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit revaluation');
    }
  };

  const handleReviewRevaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewReval) return;
    try {
      await apiFetch(`/api/academics/revaluations/${reviewReval.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: reviewForm.status,
          revisedMarks: reviewForm.revisedMarks ? Number(reviewForm.revisedMarks) : undefined,
          reviewerNotes: reviewForm.reviewerNotes,
        }),
      });
      toast.success('Revaluation updated & SGPA/CGPA recalculated if revised');
      setReviewReval(null);
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Revaluation update failed');
    }
  };

  const handleUpdateBacklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backlogTarget) return;
    try {
      await apiFetch(`/api/academics/backlogs/${backlogTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify(backlogForm),
      });
      toast.success('Backlog status updated');
      setBacklogTarget(null);
      await loadAll();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update backlog');
    }
  };

  const handleDownloadMarksheet = async (studentId: number) => {
    try {
      const payload = await apiFetch<{
        student: { usn: string; fullName: string; departmentName: string; programName: string };
        summaries: { academicYearCode: string; semesterName: string; sgpa: string; cgpa: string; totalCreditsEarned: number; totalCreditsRegistered: number; resultStatus: string }[];
        marks: { academicYearCode: string; semesterNumber: number; subjectCode: string; subjectName: string; componentCode: string; marksObtained: string; maxMarks: number }[];
      }>(`/api/academics/transcript/${studentId}`);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      doc.setFillColor(90, 36, 43);
      doc.rect(0, 0, 595, 82, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13);
      doc.text('IMPACT COLLEGE OF ENGINEERING AND APPLIED SCIENCES, BENGALURU', 40, 30);
      doc.setFontSize(10);
      doc.setTextColor(212, 175, 55);
      doc.text('OFFICIAL SEMESTER MARKSHEET & SGPA / CGPA RECORD', 40, 50);
      doc.setTextColor(252, 250, 248);
      doc.text(`USN: ${payload.student.usn}  |  Student: ${payload.student.fullName}`, 40, 68);

      autoTable(doc, {
        startY: 102,
        head: [['Year', 'Semester', 'Credits Earned/Reg', 'SGPA', 'CGPA', 'Result']],
        body: payload.summaries.map((s) => [
          s.academicYearCode,
          s.semesterName,
          `${s.totalCreditsEarned}/${s.totalCreditsRegistered}`,
          s.sgpa,
          s.cgpa,
          s.resultStatus.toUpperCase(),
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [114, 47, 55], textColor: [255, 255, 255] },
      });

      const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 210;
      autoTable(doc, {
        startY: finalY + 18,
        head: [['Year', 'Sem', 'Code', 'Subject', 'Component', 'Marks']],
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
      doc.save(`${payload.student.usn}_Marksheet.pdf`);
      toast.success('Official Marksheet PDF generated');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Marksheet export failed');
    }
  };

  return (
    <div className="space-y-5 pt-4 border-t border-[#E5E7EB] dark:border-[#332326]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1F2937] dark:text-[#FAF6F5] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#8A6D0B] dark:text-[#D4AF37]" />
            Marks Ledger, SGPA/CGPA Engine, Backlogs &amp; Revaluation
          </h2>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            VTU 50:50 CIE+SEE assessment scheme, approval workflow, locked mark audit, and automated credit calculation
          </p>
        </div>

        <TabBar
          tabs={[
            { id: 'sgpa', label: 'SGPA / CGPA', count: summaries.length },
            { id: 'marks', label: 'CIE & SEE Marks', count: marks.length },
            { id: 'backlogs', label: 'Backlogs', count: backlogs.length },
            { id: 'revaluations', label: 'Revaluations', count: revaluations.length },
            { id: 'schemes', label: 'Schemes & Scales', count: schemes.length },
          ]}
          activeTab={subTab}
          onChange={(id) => setSubTab(id as typeof subTab)}
        />
      </div>

      {/* 1. SGPA / CGPA Summaries */}
      {subTab === 'sgpa' && (
        <div className="space-y-4">
          {isAdmin && (
            <Surface className="p-4 flex flex-wrap items-end justify-between gap-3">
              <div className="w-64">
                <FieldLabel>Target Semester for Computation</FieldLabel>
                <Select value={selectedSemesterId} onChange={(e) => setSelectedSemesterId(e.target.value)}>
                  {refData?.semesters
                    .filter((s) => !selectedAcademicYearId || s.academicYearId === selectedAcademicYearId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleComputeSgpa(false)} disabled={computing}>
                  <Calculator className="w-3.5 h-3.5" />
                  Compute Draft SGPA/CGPA
                </Button>
                <Button variant="teal" size="sm" onClick={() => handleComputeSgpa(true)} disabled={computing}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Compute &amp; Publish Semester Results
                </Button>
              </div>
            </Surface>
          )}

          <Surface className="overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Term</th>
                  <th className="py-2.5 px-4 text-right">Credits</th>
                  <th className="py-2.5 px-4 text-right">SGPA</th>
                  <th className="py-2.5 px-4 text-right">CGPA</th>
                  <th className="py-2.5 px-4 text-right">Backlogs</th>
                  <th className="py-2.5 px-4">Outcome</th>
                  <th className="py-2.5 px-4 text-right">Marksheet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                {summaries.length === 0 ? (
                  <tr><td colSpan={8} className="py-6 text-center text-[#6B7280] dark:text-[#B5A5A8]">No semester SGPA summaries published yet.</td></tr>
                ) : (
                  summaries.map((s) => (
                    <tr key={s.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                      <td className="py-2.5 px-4">
                        <span className="font-mono font-semibold mr-2">{s.usn}</span>
                        <span>{s.studentName}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono">{s.academicYearCode} · S{s.semesterNumber}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {s.totalCreditsEarned}/{s.totalCreditsRegistered}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#722F37] dark:text-[#D48A94]">
                        {s.sgpa}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#8A6D0B] dark:text-[#D4AF37]">{s.cgpa}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{s.backlogCount}</td>
                      <td className="py-2.5 px-4">
                        <StatusText tone={s.resultStatus === 'pass' ? 'success' : 'warning'}>
                          {s.resultStatus.toUpperCase()} {!s.isPublished && '(DRAFT)'}
                        </StatusText>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadMarksheet(s.studentId)}>
                          <FileText className="w-3.5 h-3.5" />
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Surface>
        </div>
      )}

      {/* 2. CIE & SEE Component Marks + Mark Change Requests */}
      {subTab === 'marks' && (
        <div className="space-y-4">
          <Surface className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="w-64">
              <Select value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
                <option value="">All Subjects</option>
                {refData?.subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.code} · {sub.name}
                  </option>
                ))}
              </Select>
            </div>
            {isStaff && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setEntryOpen(true)}>
                  <ClipboardEdit className="w-3.5 h-3.5" />
                  Enter CIE / SEE Marks
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="teal" onClick={handlePublishAllMarks}>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve &amp; Publish Subject Marks
                  </Button>
                )}
              </div>
            )}
          </Surface>

          <Surface className="overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">USN · Student</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4">Component</th>
                  <th className="py-2.5 px-4 text-right">Score</th>
                  <th className="py-2.5 px-4">Workflow Status</th>
                  {isStaff && <th className="py-2.5 px-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                {marks.map((m) => (
                  <tr key={m.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                    <td className="py-2.5 px-4">
                      <span className="font-mono font-semibold mr-2">{m.usn}</span>
                      <span>{m.studentName}</span>
                    </td>
                    <td className="py-2.5 px-4"><span className="font-mono mr-1">{m.subjectCode}</span>· {m.subjectName}</td>
                    <td className="py-2.5 px-4">{m.componentCode} ({m.componentCategory.toUpperCase()})</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">{m.marksObtained} / {m.maxMarks}</td>
                    <td className="py-2.5 px-4">
                      <StatusText tone={m.workflowStatus === 'published' ? 'success' : m.workflowStatus === 'submitted' ? 'info' : 'warning'}>
                        {m.workflowStatus === 'published' && <Lock className="w-3 h-3" />}
                        {m.workflowStatus.toUpperCase()}
                      </StatusText>
                    </td>
                    {isStaff && (
                      <td className="py-2.5 px-4 text-right">
                        {m.workflowStatus === 'published' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setChangeTarget(m);
                              setChangeForm({ requestedMarks: m.marksObtained, reason: '' });
                            }}
                          >
                            Request Revision
                          </Button>
                        ) : (
                          <span className="text-[#6B7280] dark:text-[#B5A5A8]">Editable via batch</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>

          {isStaff && markChanges.length > 0 && (
            <Surface className="overflow-hidden">
              <div className="px-4 py-3 border-b border-[#E5E7EB] dark:border-[#332326] text-xs font-semibold">
                Authorized Mark Change Requests ({markChanges.length})
              </div>
              <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                {markChanges.map((mc) => (
                  <div key={mc.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        <span className="font-mono">{mc.usn}</span> · {mc.subjectCode} ({mc.previousMarks} → <strong className="text-[#722F37] dark:text-[#D48A94]">{mc.requestedMarks}</strong>)
                      </p>
                      <p className="text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">Reason: {mc.reason}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusText tone={mc.status === 'approved' ? 'success' : mc.status === 'rejected' ? 'danger' : 'warning'}>
                        {mc.status.toUpperCase()}
                      </StatusText>
                      {isAdmin && mc.status === 'pending' && (
                        <>
                          <Button size="sm" variant="teal" onClick={() => handleReviewMarkChange(mc.id, 'approved')}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => handleReviewMarkChange(mc.id, 'rejected')}>Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Surface>
          )}
        </div>
      )}

      {/* 3. Backlogs */}
      {subTab === 'backlogs' && (
        <Surface className="overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                <th className="py-2.5 px-4">Student</th>
                <th className="py-2.5 px-4">Subject</th>
                <th className="py-2.5 px-4">Term</th>
                <th className="py-2.5 px-4 text-right">Attempt</th>
                <th className="py-2.5 px-4 text-right">Orig / Makeup</th>
                <th className="py-2.5 px-4">Status</th>
                {isStaff && <th className="py-2.5 px-4 text-right">Manage</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
              {backlogs.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-[#6B7280] dark:text-[#B5A5A8]">No backlogs recorded.</td></tr>
              ) : (
                backlogs.map((b) => (
                  <tr key={b.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                    <td className="py-2.5 px-4"><span className="font-mono font-semibold mr-2">{b.usn}</span>{b.studentName}</td>
                    <td className="py-2.5 px-4"><span className="font-mono mr-1">{b.subjectCode}</span>{b.subjectName}</td>
                    <td className="py-2.5 px-4 font-mono">{b.academicYearCode} · S{b.semesterNumber}</td>
                    <td className="py-2.5 px-4 text-right font-mono">#{b.attemptNumber}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{b.originalMarks} / {b.makeupMarks ?? '—'}</td>
                    <td className="py-2.5 px-4"><StatusText tone={b.status === 'cleared' ? 'success' : 'warning'}>{b.status.toUpperCase()}</StatusText></td>
                    {isStaff && (
                      <td className="py-2.5 px-4 text-right">
                        <Button size="sm" variant="outline" onClick={() => setBacklogTarget(b)}>Update</Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Surface>
      )}

      {/* 4. Revaluation Requests */}
      {subTab === 'revaluations' && (
        <div className="space-y-4">
          {(isStudent || isAdmin) && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setRevalOpen(true)}>
                <RefreshCw className="w-3.5 h-3.5" />
                Apply for Revaluation / Photocopy
              </Button>
            </div>
          )}

          <Surface className="overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Orig → Revised</th>
                  <th className="py-2.5 px-4">Status</th>
                  {isStaff && <th className="py-2.5 px-4 text-right">Review</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                {revaluations.map((rv) => (
                  <tr key={rv.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                    <td className="py-2.5 px-4"><span className="font-mono font-semibold mr-2">{rv.usn}</span>{rv.studentName}</td>
                    <td className="py-2.5 px-4"><span className="font-mono mr-1">{rv.subjectCode}</span>{rv.subjectName}</td>
                    <td className="py-2.5 px-4 capitalize">{rv.requestType.replace('_', ' ')} (₹{rv.feeAmount})</td>
                    <td className="py-2.5 px-4 text-right font-mono font-semibold">{rv.originalMarks} → {rv.revisedMarks ?? 'Pending'}</td>
                    <td className="py-2.5 px-4"><StatusText tone={rv.status === 'completed' ? 'success' : rv.status === 'rejected' ? 'danger' : 'info'}>{rv.status.toUpperCase()}</StatusText></td>
                    {isStaff && (
                      <td className="py-2.5 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setReviewReval(rv);
                            setReviewForm({
                              status: 'completed',
                              revisedMarks: rv.revisedMarks || rv.originalMarks,
                              reviewerNotes: rv.reviewerNotes || '',
                            });
                          }}
                        >
                          Resolve
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        </div>
      )}

      {/* 5. Assessment Schemes & Grade Scales */}
      {subTab === 'schemes' && (
        <div className="space-y-4">
          {isAdmin && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setSchemeOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Create Assessment Scheme
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Surface className="p-4 space-y-3">
              <p className="text-xs font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
                Configured Schemes &amp; Components
              </p>
              {schemes.map((s) => (
                <div key={s.id} className="p-3 rounded-xl border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8]/80 dark:bg-[#170F11] space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[#722F37] dark:text-[#D48A94]">{s.schemeCode}</span>
                    <span className="font-mono">{s.programCode} · AY {s.academicYearCode}</span>
                  </div>
                  <p className="font-medium">{s.name} (CIE {s.cieMaxMarks} + SEE {s.seeMaxMarks} = {s.totalMaxMarks})</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {components
                      .filter((c) => c.schemeId === s.id)
                      .map((c) => (
                        <span key={c.id} className="px-2 py-0.5 rounded-lg bg-[#F7F3EE] dark:bg-[#26191B] font-mono text-[11px] text-[#4B3F42] dark:text-[#FAF6F5]">
                          {c.code}: {c.maxMarks}m ({c.weightagePct}%)
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </Surface>

            <Surface className="p-4 space-y-3">
              <p className="text-xs font-semibold">VTU 2022 Relative/Absolute Grade Point Scale</p>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] dark:border-[#332326] text-[#6B7280] dark:text-[#B5A5A8]">
                    <th className="py-1.5">Grade</th>
                    <th className="py-1.5">Range (%)</th>
                    <th className="py-1.5 text-right">Points</th>
                    <th className="py-1.5 text-right">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] font-mono">
                  {gradeScales.map((g) => (
                    <tr key={g.id}>
                      <td className="py-1.5 font-bold text-[#722F37] dark:text-[#D48A94]">{g.gradeLetter}</td>
                      <td className="py-1.5">{g.minPercentage}–{g.maxPercentage}%</td>
                      <td className="py-1.5 text-right">{g.gradePoints}</td>
                      <td className="py-1.5 text-right font-sans">{g.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Surface>
          </div>
        </div>
      )}

      {/* Batch Mark Entry Modal */}
      <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title="Enter Assessment Component Marks">
        <form onSubmit={handleSaveMark} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Student</FieldLabel>
              <Select value={entryForm.studentId} onChange={(e) => setEntryForm({ ...entryForm, studentId: e.target.value })}>
                {refData?.students.map((st) => <option key={st.id} value={st.id}>{st.usn} · {st.fullName}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Subject</FieldLabel>
              <Select value={entryForm.subjectId} onChange={(e) => setEntryForm({ ...entryForm, subjectId: e.target.value })}>
                {refData?.subjects.map((sb) => <option key={sb.id} value={sb.id}>{sb.code} · {sb.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Semester</FieldLabel>
              <Select value={entryForm.semesterId} onChange={(e) => setEntryForm({ ...entryForm, semesterId: e.target.value })}>
                {refData?.semesters.map((sm) => <option key={sm.id} value={sm.id}>{sm.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Component</FieldLabel>
              <Select value={entryForm.componentId} onChange={(e) => setEntryForm({ ...entryForm, componentId: e.target.value })}>
                {components.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.name} (Max {c.maxMarks})</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Marks Obtained</FieldLabel>
              <Input type="number" step="0.5" value={entryForm.marksObtained} onChange={(e) => setEntryForm({ ...entryForm, marksObtained: e.target.value })} required />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={entryForm.submitForApproval}
                  onChange={(e) => setEntryForm({ ...entryForm, submitForApproval: e.target.checked })}
                />
                Submit for Admin Approval
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>Cancel</Button>
            <Button type="submit">Save Marks</Button>
          </div>
        </form>
      </Modal>

      {/* Mark Change Request Modal */}
      <Modal open={changeTarget !== null} onClose={() => setChangeTarget(null)} title="Request Authorized Mark Change" subtitle="Published marks require Controller of Examinations approval.">
        <form onSubmit={handleSubmitMarkChange} className="space-y-4">
          <div className="text-xs text-[#4B3F42] dark:text-[#D8CCD0]">
            Student: <strong>{changeTarget?.usn}</strong> · Component: <strong>{changeTarget?.componentCode}</strong> · Current: <strong>{changeTarget?.marksObtained}</strong>
          </div>
          <div>
            <FieldLabel required>Requested Revised Marks</FieldLabel>
            <Input type="number" step="0.5" value={changeForm.requestedMarks} onChange={(e) => setChangeForm({ ...changeForm, requestedMarks: e.target.value })} required />
          </div>
          <div>
            <FieldLabel required>Mandatory Justification</FieldLabel>
            <Input value={changeForm.reason} onChange={(e) => setChangeForm({ ...changeForm, reason: e.target.value })} placeholder="e.g. Retotaling discrepancy in Q3b" required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setChangeTarget(null)}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      {/* Create Scheme Modal */}
      <Modal open={schemeOpen} onClose={() => setSchemeOpen(false)} title="Create Assessment Scheme">
        <form onSubmit={handleCreateScheme} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Scheme Code</FieldLabel>
              <Input value={schemeForm.schemeCode} onChange={(e) => setSchemeForm({ ...schemeForm, schemeCode: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Program</FieldLabel>
              <Select value={schemeForm.programId} onChange={(e) => setSchemeForm({ ...schemeForm, programId: e.target.value })}>
                {refData?.programs?.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <FieldLabel required>Scheme Name</FieldLabel>
              <Input value={schemeForm.name} onChange={(e) => setSchemeForm({ ...schemeForm, name: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>CIE Max</FieldLabel>
              <Input type="number" value={schemeForm.cieMaxMarks} onChange={(e) => setSchemeForm({ ...schemeForm, cieMaxMarks: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>SEE Max</FieldLabel>
              <Input type="number" value={schemeForm.seeMaxMarks} onChange={(e) => setSchemeForm({ ...schemeForm, seeMaxMarks: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSchemeOpen(false)}>Cancel</Button>
            <Button type="submit">Save Scheme</Button>
          </div>
        </form>
      </Modal>

      {/* Submit Revaluation Modal */}
      <Modal open={revalOpen} onClose={() => setRevalOpen(false)} title="Submit Revaluation / Photocopy Request">
        <form onSubmit={handleSubmitRevaluation} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Subject</FieldLabel>
              <Select value={revalForm.subjectId} onChange={(e) => setRevalForm({ ...revalForm, subjectId: e.target.value })}>
                {refData?.subjects.map((sb) => <option key={sb.id} value={sb.id}>{sb.code} · {sb.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Request Type</FieldLabel>
              <Select value={revalForm.requestType} onChange={(e) => setRevalForm({ ...revalForm, requestType: e.target.value })}>
                <option value="revaluation">Revaluation (₹500)</option>
                <option value="photocopy">Answer Script Photocopy (₹300)</option>
                <option value="challenge_valuation">Challenge Valuation (₹1500)</option>
              </Select>
            </div>
            <div>
              <FieldLabel required>Semester</FieldLabel>
              <Select value={revalForm.semesterId} onChange={(e) => setRevalForm({ ...revalForm, semesterId: e.target.value })}>
                {refData?.semesters.map((sm) => <option key={sm.id} value={sm.id}>{sm.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Original Marks</FieldLabel>
              <Input type="number" value={revalForm.originalMarks} onChange={(e) => setRevalForm({ ...revalForm, originalMarks: e.target.value })} required />
            </div>
            <div className="col-span-2">
              <FieldLabel required>Reason</FieldLabel>
              <Input value={revalForm.reason} onChange={(e) => setRevalForm({ ...revalForm, reason: e.target.value })} placeholder="Explain sections requiring re-verification" required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRevalOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Request</Button>
          </div>
        </form>
      </Modal>

      {/* Review Revaluation Modal */}
      <Modal open={reviewReval !== null} onClose={() => setReviewReval(null)} title="Resolve Revaluation Request" subtitle="Completed revisions automatically update SEE marks and recompute SGPA/CGPA.">
        <form onSubmit={handleReviewRevaluation} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Decision Status</FieldLabel>
              <Select value={reviewForm.status} onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value as 'under_review' | 'completed' | 'rejected' })}>
                <option value="under_review">Under Review</option>
                <option value="completed">Completed (Apply Revised Marks)</option>
                <option value="rejected">Rejected (No Change)</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Revised SEE Marks</FieldLabel>
              <Input type="number" step="0.5" value={reviewForm.revisedMarks} onChange={(e) => setReviewForm({ ...reviewForm, revisedMarks: e.target.value })} />
            </div>
            <div className="col-span-2">
              <FieldLabel>Reviewer Notes</FieldLabel>
              <Input value={reviewForm.reviewerNotes} onChange={(e) => setReviewForm({ ...reviewForm, reviewerNotes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setReviewReval(null)}>Cancel</Button>
            <Button type="submit">Save Decision</Button>
          </div>
        </form>
      </Modal>

      {/* Backlog Update Modal */}
      <Modal open={backlogTarget !== null} onClose={() => setBacklogTarget(null)} title="Update Backlog / Makeup Clearance">
        <form onSubmit={handleUpdateBacklog} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel required>Status</FieldLabel>
              <Select value={backlogForm.status} onChange={(e) => setBacklogForm({ ...backlogForm, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="registered_makeup">Registered for Makeup</option>
                <option value="cleared">Cleared</option>
              </Select>
            </div>
            <div>
              <FieldLabel>Makeup Marks</FieldLabel>
              <Input type="number" step="0.5" value={backlogForm.makeupMarks} onChange={(e) => setBacklogForm({ ...backlogForm, makeupMarks: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Makeup Exam Date</FieldLabel>
              <Input type="date" value={backlogForm.makeupExamDate} onChange={(e) => setBacklogForm({ ...backlogForm, makeupExamDate: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Remarks</FieldLabel>
              <Input value={backlogForm.remarks} onChange={(e) => setBacklogForm({ ...backlogForm, remarks: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBacklogTarget(null)}>Cancel</Button>
            <Button type="submit">Save Backlog Update</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
