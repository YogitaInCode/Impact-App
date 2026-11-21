import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Lock,
  Play,
  QrCode,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV, downloadTablePDF, formatIST } from '../../lib/utils';
import {
  Button,
  FieldLabel,
  Input,
  Modal,
  Select,
  StatusText,
  Surface,
  Textarea,
} from '../ui/primitives';

interface SessionItem {
  id: number;
  subjectId: number;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  sectionId: number;
  sectionName: string;
  roomCode: string | null;
  sessionDate: string;
  mode: string;
  status: string;
  qrIntervalSeconds: number;
  startedAt: string;
  closedAt: string | null;
  totalEnrolled: number;
  presentCount: number;
  absentCount: number;
  pendingReviewCount: number;
}

interface RosterStudent {
  studentId: number;
  usn: string;
  fullName: string;
  rollNumber: string | null;
  biometricEnrolled: boolean;
  record: {
    id: number;
    status: string;
    verificationMethod: string;
    confidenceScore: string | null;
    remarks: string | null;
    markedAt: string;
  } | null;
}

export const AttendanceConsoleView: React.FC = () => {
  const { effectiveProfile, selectedAcademicYearId, apiFetch } = useAuth();
  const isStaff =
    effectiveProfile?.role === 'super_admin' || effectiveProfile?.role === 'faculty';

  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [verifLogs, setVerifLogs] = useState<
    { id: number; usn: string; studentName: string; verificationMethod: string; outcome: string; failureReason: string | null; createdAt: string }[]
  >([]);
  const [corrections, setCorrections] = useState<
    { id: number; usn: string; studentName: string; previousStatus: string; newStatus: string; reason: string; appealStatus: string; createdAt: string }[]
  >([]);
  const [analytics, setAnalytics] = useState<{
    overallPercentage: number;
    subjectSummary: { subjectId: number; code: string; name: string; total: number; present: number; percentage: number }[];
    studentSummary: { studentId: number; usn: string; fullName: string; total: number; present: number; percentage: number }[];
    lowAttendanceStudents: { studentId: number; usn: string; fullName: string; percentage: number }[];
    dailyTrend: { date: string; total: number; present: number }[];
  } | null>(null);

  const [qrState, setQrState] = useState<{
    token: string;
    shortCode: string;
    qrDataUrl: string;
    ttlSeconds: number;
    secondsLeft: number;
  } | null>(null);

  const [refData, setRefData] = useState<{
    semesters: { id: number; academicYearId: number; name: string }[];
    subjects: { id: number; code: string; name: string }[];
    sections: { id: number; name: string; semesterId: number }[];
    classrooms: { id: number; roomCode: string }[];
    faculty: { id: number; fullName: string }[];
  } | null>(null);

  const [startModal, setStartModal] = useState(false);
  const [startForm, setStartForm] = useState({
    semesterId: '',
    subjectId: '',
    sectionId: '',
    classroomId: '',
    facultyId: '',
    mode: 'dynamic_qr',
    notes: '',
  });

  const [editModal, setEditModal] = useState<{
    studentId: number;
    studentName: string;
    currentStatus: string;
  } | null>(null);
  const [editStatus, setEditStatus] = useState<'present' | 'absent' | 'late' | 'excused'>('present');
  const [editReason, setEditReason] = useState('');

  const loadSessionsAndAnalytics = useCallback(async () => {
    try {
      const yq = selectedAcademicYearId ? `?academicYearId=${selectedAcademicYearId}` : '';
      const [sessRes, anaRes, refRes] = await Promise.all([
        apiFetch<{ sessions: SessionItem[] }>(`/api/attendance/sessions${yq}`),
        apiFetch<NonNullable<typeof analytics>>(`/api/attendance/analytics${yq}`),
        apiFetch<NonNullable<typeof refData>>('/api/reference-data'),
      ]);
      setSessions(sessRes.sessions);
      setAnalytics(anaRes);
      setRefData(refRes);

      if (!selectedSessionId && sessRes.sessions.length > 0) {
        const live = sessRes.sessions.find((s) => s.status === 'active') || sessRes.sessions[0];
        setSelectedSessionId(live.id);
      }

      if (!startForm.subjectId && refRes.subjects.length > 0) {
        const activeSem =
          refRes.semesters.find((s) => s.academicYearId === selectedAcademicYearId) ||
          refRes.semesters[0];
        setStartForm((p) => ({
          ...p,
          semesterId: String(activeSem?.id || ''),
          subjectId: String(refRes.subjects[0].id),
          sectionId: String(refRes.sections.find((sec) => sec.semesterId === activeSem?.id)?.id || refRes.sections[0]?.id || ''),
          classroomId: String(refRes.classrooms[0]?.id || ''),
          facultyId: String(effectiveProfile?.facultyId || refRes.faculty[0]?.id || ''),
        }));
      }
    } catch (err) {
      console.error('Failed to load attendance console:', err);
    }
  }, [apiFetch, effectiveProfile?.facultyId, selectedAcademicYearId, selectedSessionId, startForm.subjectId]);

  useEffect(() => {
    loadSessionsAndAnalytics();
  }, [loadSessionsAndAnalytics]);

  const loadRoster = useCallback(async () => {
    if (!selectedSessionId || !isStaff) return;
    try {
      const data = await apiFetch<{
        roster: RosterStudent[];
        verificationLogs: typeof verifLogs;
        corrections: typeof corrections;
      }>(`/api/attendance/sessions/${selectedSessionId}/roster`);
      setRoster(data.roster);
      setVerifLogs(data.verificationLogs);
      setCorrections(data.corrections);
    } catch (err) {
      console.error('Failed loading session roster:', err);
    }
  }, [apiFetch, isStaff, selectedSessionId]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const activeSession = sessions.find((s) => s.id === selectedSessionId) || null;

  const refreshQR = useCallback(async () => {
    if (!activeSession || activeSession.status !== 'active') {
      setQrState(null);
      return;
    }
    try {
      const qr = await apiFetch<{
        token: string;
        shortCode: string;
        qrDataUrl: string;
        ttlSeconds: number;
      }>(`/api/attendance/sessions/${activeSession.id}/qr`);
      setQrState({ ...qr, secondsLeft: qr.ttlSeconds });
    } catch (err) {
      console.error('QR refresh failed:', err);
    }
  }, [activeSession, apiFetch]);

  useEffect(() => {
    if (activeSession?.status === 'active' && activeSession.mode === 'dynamic_qr') {
      refreshQR();
    } else {
      setQrState(null);
    }
  }, [activeSession?.id, activeSession?.status, activeSession?.mode, refreshQR]);

  useEffect(() => {
    if (!qrState) return;
    const timer = setInterval(() => {
      setQrState((prev) => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) {
          refreshQR();
          return prev;
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [qrState !== null, refreshQR]);

  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await apiFetch<{ id: number }>('/api/attendance/sessions', {
        method: 'POST',
        body: JSON.stringify({
          ...startForm,
          academicYearId: selectedAcademicYearId,
        }),
      });
      toast.success('Attendance session started & students notified');
      setStartModal(false);
      setSelectedSessionId(created.id);
      await loadSessionsAndAnalytics();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const handleQuickMark = async (
    stu: RosterStudent,
    status: 'present' | 'absent' | 'late'
  ) => {
    if (!selectedSessionId) return;
    if (stu.record) {
      setEditModal({
        studentId: stu.studentId,
        studentName: stu.fullName,
        currentStatus: stu.record.status,
      });
      setEditStatus(status);
      setEditReason('');
      return;
    }

    try {
      await apiFetch(`/api/attendance/sessions/${selectedSessionId}/manual`, {
        method: 'POST',
        body: JSON.stringify({ studentId: stu.studentId, status }),
      });
      toast.success(`Marked ${stu.usn} as ${status}`);
      await Promise.all([loadRoster(), loadSessionsAndAnalytics()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to mark attendance');
    }
  };

  const handleSubmitEditReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal || !selectedSessionId) return;
    try {
      await apiFetch(`/api/attendance/sessions/${selectedSessionId}/manual`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: editModal.studentId,
          status: editStatus,
          reason: editReason,
        }),
      });
      toast.success('Attendance updated with audit reason logged');
      setEditModal(null);
      await Promise.all([loadRoster(), loadSessionsAndAnalytics()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Correction failed');
    }
  };

  const handleCloseSession = async () => {
    if (!selectedSessionId) return;
    try {
      const res = await apiFetch<{ autoAbsent: number }>(
        `/api/attendance/sessions/${selectedSessionId}/close`,
        { method: 'POST' }
      );
      toast.success(`Session closed (${res.autoAbsent} unmarked students recorded absent)`);
      await Promise.all([loadRoster(), loadSessionsAndAnalytics()]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to close session');
    }
  };

  const handleExportAnalyticsCSV = () => {
    if (!analytics) return;
    downloadCSV(
      'impact_campus_attendance_report.csv',
      ['USN', 'Student Name', 'Present Classes', 'Total Classes', 'Attendance %', 'VTU Status'],
      analytics.studentSummary.map((s) => [
        s.usn,
        s.fullName,
        s.present,
        s.total,
        `${s.percentage}%`,
        s.percentage >= 75 ? 'Eligible' : 'Shortage (<75%)',
      ])
    );
  };

  const handleExportAnalyticsPDF = () => {
    if (!analytics) return;
    downloadTablePDF({
      title: 'Institutional Attendance Report',
      subtitle: `Overall Attendance: ${analytics.overallPercentage}% · Students Below 75%: ${analytics.lowAttendanceStudents.length}`,
      headers: ['USN', 'Student Name', 'Present', 'Total', 'Percentage', 'Policy'],
      rows: analytics.studentSummary.map((s) => [
        s.usn,
        s.fullName,
        s.present,
        s.total,
        `${s.percentage}%`,
        s.percentage >= 75 ? 'Compliant' : 'Shortage',
      ]),
      filename: 'impact_campus_attendance_report.pdf',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
            Smart Attendance Console
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            Dynamic rotating QR verification, manual roll call with mandatory audit reasons, and analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportAnalyticsCSV}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportAnalyticsPDF}>
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </Button>
          {isStaff && (
            <Button size="sm" onClick={() => setStartModal(true)}>
              <Play className="w-3.5 h-3.5" />
              Start Session
            </Button>
          )}
        </div>
      </div>

      {/* Session Selector & Live Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Session History Sidebar List */}
        <Surface className="lg:col-span-4 p-4 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-[#B5A5A8]">
            Attendance Sessions ({sessions.length})
          </h2>
          <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] max-h-[520px] overflow-y-auto">
            {sessions.map((sess) => (
              <button
                key={sess.id}
                type="button"
                onClick={() => setSelectedSessionId(sess.id)}
                className={`w-full text-left py-3 px-3 rounded-xl transition-colors cursor-pointer ${
                  selectedSessionId === sess.id
                    ? 'bg-[#F7F3EE] dark:bg-[#2E1A1E]'
                    : 'hover:bg-[#FCFAF8] dark:hover:bg-[#221618]'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-semibold text-[#722F37] dark:text-[#D48A94]">
                    {sess.subjectCode} · Sec {sess.sectionName}
                  </span>
                  <StatusText tone={sess.status === 'active' ? 'success' : 'neutral'}>
                    {sess.status === 'active' ? 'Live' : 'Closed'}
                  </StatusText>
                </div>
                <p className="text-sm font-medium text-[#1F2937] dark:text-[#FAF6F5] mt-1 truncate">
                  {sess.subjectName}
                </p>
                <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5 font-mono tabular-nums">
                  {sess.sessionDate} · {sess.mode.replace('_', ' ')} · {sess.presentCount}/{sess.totalEnrolled} Present
                </p>
              </button>
            ))}
          </div>
        </Surface>

        {/* Active Session Details + Rotating QR + Roster */}
        <div className="lg:col-span-8 space-y-6">
          {activeSession ? (
            <>
              <Surface className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                      <span className="font-mono font-semibold text-[#722F37] dark:text-[#D48A94]">
                        Session #{activeSession.id}
                      </span>
                      <span>·</span>
                      <span>{activeSession.subjectCode}</span>
                      <span>·</span>
                      <span>Section {activeSession.sectionName}</span>
                      <span>·</span>
                      <span>{activeSession.roomCode || 'Classroom'}</span>
                    </div>
                    <h2 className="text-lg font-bold text-[#1F2937] dark:text-[#FAF6F5] mt-1">
                      {activeSession.subjectName}
                    </h2>
                    <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
                      Faculty: {activeSession.facultyName} · Mode: {activeSession.mode.replace('_', ' ').toUpperCase()} · Started {formatIST(activeSession.startedAt)}
                    </p>
                  </div>

                  {isStaff && activeSession.status === 'active' && (
                    <Button variant="danger" size="sm" onClick={handleCloseSession}>
                      <Lock className="w-3.5 h-3.5" />
                      Close Session
                    </Button>
                  )}
                </div>

                {/* Live Rotating Dynamic QR Display */}
                {activeSession.status === 'active' &&
                  activeSession.mode === 'dynamic_qr' &&
                  qrState && (
                    <div className="mt-5 pt-5 border-t border-[#E5E7EB] dark:border-[#332326] grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                      <div className="md:col-span-5 flex flex-col items-center p-4 bg-white border border-[#E5E7EB] rounded-2xl shadow-xs">
                        <img
                          src={qrState.qrDataUrl}
                          alt="Rotating Attendance QR"
                          className="w-48 h-48"
                        />
                      </div>
                      <div className="md:col-span-7 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-semibold text-[#722F37] dark:text-[#D48A94]">
                          <QrCode className="w-4 h-4" />
                          <span>Cryptographic HMAC-SHA256 Rotating QR Active</span>
                        </div>
                        <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] leading-relaxed">
                          Students scan this QR code from their Student Attendance portal. Tokens
                          expire strictly server-side every{' '}
                          <span className="font-mono font-semibold">{qrState.ttlSeconds}s</span> to
                          prevent screenshot forwarding.
                        </p>
                        <div className="p-3.5 rounded-2xl bg-[#F7F3EE] dark:bg-[#221618] border border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between">
                          <div>
                            <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8]">Rotating 6-Char Short Code</p>
                            <p className="text-2xl font-mono font-bold tracking-widest text-[#1F2937] dark:text-[#FAF6F5]">
                              {qrState.shortCode}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[11px] text-[#6B7280] dark:text-[#B5A5A8]">Expires in</p>
                            <p className="text-lg font-mono tabular-nums font-bold text-[#722F37] dark:text-[#D4AF37]">
                              {qrState.secondsLeft}s
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={refreshQR}>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Rotate Now
                          </Button>
                          <span className="text-[11px] font-mono text-[#6B7280] truncate">
                            Session ID: {activeSession.id}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
              </Surface>

              {/* Roster Table */}
              <Surface className="overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                    Section Roster ({roster.length} Students)
                  </h3>
                  <span className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                    Editing an existing mark requires a mandatory audit reason
                  </span>
                </div>
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                      <th className="py-2.5 px-4">USN</th>
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4">Method</th>
                      <th className="py-2.5 px-4">Status</th>
                      {isStaff && <th className="py-2.5 px-4 text-right">Mark / Correct</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                    {roster.map((stu) => (
                      <tr key={stu.studentId}>
                        <td className="py-3 px-4 font-mono font-semibold text-[#722F37] dark:text-[#D48A94]">{stu.usn}</td>
                        <td className="py-3 px-4 font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                          {stu.fullName}
                        </td>
                        <td className="py-3 px-4 text-[#6B7280] dark:text-[#B5A5A8]">
                          {stu.record ? stu.record.verificationMethod.replace('_', ' ') : '—'}
                        </td>
                        <td className="py-3 px-4">
                          {stu.record ? (
                            <StatusText
                              tone={
                                stu.record.status === 'present'
                                  ? 'success'
                                  : stu.record.status === 'late' || stu.record.status === 'pending_review'
                                  ? 'warning'
                                  : 'danger'
                              }
                            >
                              {stu.record.status.replace('_', ' ').toUpperCase()}
                            </StatusText>
                          ) : (
                            <StatusText tone="neutral">Pending</StatusText>
                          )}
                        </td>
                        {isStaff && (
                          <td className="py-3 px-4 text-right space-x-1.5">
                            <Button
                              variant={stu.record?.status === 'present' ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => handleQuickMark(stu, 'present')}
                            >
                              Present
                            </Button>
                            <Button
                              variant={stu.record?.status === 'late' ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => handleQuickMark(stu, 'late')}
                            >
                              Late
                            </Button>
                            <Button
                              variant={stu.record?.status === 'absent' ? 'danger' : 'outline'}
                              size="sm"
                              onClick={() => handleQuickMark(stu, 'absent')}
                            >
                              Absent
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Surface>

              {/* Verification Logs & Correction Audit Trail */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Surface className="p-4">
                  <h4 className="text-xs font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-3 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D] dark:text-[#4ADE80]" />
                    Verification Logs ({verifLogs.length})
                  </h4>
                  {verifLogs.length === 0 ? (
                    <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">No verification attempts logged for this session yet.</p>
                  ) : (
                    <div className="divide-y divide-[#F7F3EE] dark:divide-[#2D1E21] text-xs">
                      {verifLogs.map((l) => (
                        <div key={l.id} className="py-2">
                          <div className="flex justify-between">
                            <span className="font-mono font-semibold">{l.usn}</span>
                            <StatusText tone={l.outcome === 'verified' ? 'success' : 'warning'}>
                              {l.outcome}
                            </StatusText>
                          </div>
                          {l.failureReason && <p className="text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">{l.failureReason}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>

                <Surface className="p-4">
                  <h4 className="text-xs font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-[#8A6D0B] dark:text-[#D4AF37]" />
                    Corrections &amp; Appeals ({corrections.length})
                  </h4>
                  {corrections.length === 0 ? (
                    <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">No post-mark edits or appeals recorded for this session.</p>
                  ) : (
                    <div className="divide-y divide-[#F7F3EE] dark:divide-[#2D1E21] text-xs">
                      {corrections.map((c) => (
                        <div key={c.id} className="py-2">
                          <div className="flex justify-between font-medium">
                            <span>{c.usn} · {c.previousStatus} → {c.newStatus}</span>
                            <span className="text-[#6B7280] dark:text-[#B5A5A8]">{c.appealStatus}</span>
                          </div>
                          <p className="text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">{c.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>
              </div>
            </>
          ) : (
            <Surface className="p-10 text-center text-xs text-[#6B7280] dark:text-[#B5A5A8]">
              Select an attendance session or start a new one.
            </Surface>
          )}
        </div>
      </div>

      {/* Start Session Modal */}
      <Modal
        open={startModal}
        onClose={() => setStartModal(false)}
        title="Start Attendance Session"
        subtitle="Students in the selected section receive an immediate notification."
      >
        <form onSubmit={handleStartSession} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Subject</FieldLabel>
              <Select
                value={startForm.subjectId}
                onChange={(e) => setStartForm({ ...startForm, subjectId: e.target.value })}
              >
                {refData?.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel required>Section</FieldLabel>
              <Select
                value={startForm.sectionId}
                onChange={(e) => setStartForm({ ...startForm, sectionId: e.target.value })}
              >
                {refData?.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Section {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel required>Verification Mode</FieldLabel>
              <Select
                value={startForm.mode}
                onChange={(e) => setStartForm({ ...startForm, mode: e.target.value })}
              >
                <option value="dynamic_qr">Dynamic Rotating QR</option>
                <option value="manual">Faculty Manual Roll Call</option>
                <option value="ai_face">AI Biometric Face Verification</option>
              </Select>
            </div>
            <div>
              <FieldLabel required>Classroom</FieldLabel>
              <Select
                value={startForm.classroomId}
                onChange={(e) => setStartForm({ ...startForm, classroomId: e.target.value })}
              >
                {refData?.classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.roomCode}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <FieldLabel>Session Topic / Notes</FieldLabel>
            <Input
              value={startForm.notes}
              onChange={(e) => setStartForm({ ...startForm, notes: e.target.value })}
              placeholder="e.g. Unit 5: PostgreSQL Indexing & Transactions"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStartModal(false)}>
              Cancel
            </Button>
            <Button type="submit">Start Session</Button>
          </div>
        </form>
      </Modal>

      {/* Mandatory Reason Correction Modal */}
      <Modal
        open={editModal !== null}
        onClose={() => setEditModal(null)}
        title="Attendance Correction (Audit Required)"
        subtitle={
          editModal
            ? `Changing ${editModal.studentName} from '${editModal.currentStatus}' to '${editStatus}'`
            : undefined
        }
      >
        <form onSubmit={handleSubmitEditReason} className="space-y-4">
          <div>
            <FieldLabel required>New Status</FieldLabel>
            <Select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as typeof editStatus)}
            >
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="excused">Excused (On Duty / Medical)</option>
              <option value="absent">Absent</option>
            </Select>
          </div>
          <div>
            <FieldLabel required>Mandatory Audit Reason</FieldLabel>
            <Textarea
              rows={3}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="Explain why this attendance record is being modified (recorded permanently in audit_logs)..."
              required
              minLength={5}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditModal(null)}>
              Cancel
            </Button>
            <Button type="submit">Save Correction & Log Audit</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
