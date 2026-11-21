import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, QrCode, ShieldAlert, ShieldCheck, StopCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { formatIST } from '../../lib/utils';
import {
  Button,
  FieldLabel,
  Input,
  Modal,
  StatusText,
  Surface,
  Textarea,
} from '../ui/primitives';

interface LiveSession {
  id: number;
  subjectCode: string;
  subjectName: string;
  facultyName: string;
  roomCode: string | null;
  mode: string;
  status: string;
  sessionDate: string;
  myRecord: { id: number; status: string; verificationMethod: string; markedAt: string } | null;
}

export const StudentAttendanceView: React.FC = () => {
  const { effectiveProfile, selectedAcademicYearId, apiFetch } = useAuth();
  const isStudent = effectiveProfile?.role === 'student';

  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [analytics, setAnalytics] = useState<{
    overallPercentage: number;
    totalClasses: number;
    totalPresent: number;
    subjectSummary: { subjectId: number; code: string; name: string; total: number; present: number; percentage: number }[];
  } | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<
    { id: number; subjectCode: string; subjectName: string; status: string; verificationMethod: string; markedAt: string }[]
  >([]);
  const [biometricStatus, setBiometricStatus] = useState<{
    provider: {
      configured: boolean;
      providerName: string;
      requiredEnvVars: string[];
      supportedProviders: string[];
      diagnosticMessage: string;
    };
    consent: { status: string; grantedAt: string | null; withdrawnAt: string | null; purgedBiometricDataAt: string | null } | null;
  } | null>(null);

  const [verifySessionId, setVerifySessionId] = useState<number | null>(null);
  const [shortCode, setShortCode] = useState('');
  const [qrTokenInput, setQrTokenInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Camera Scanner / Biometric Capture
  const [cameraMode, setCameraMode] = useState<'qr' | 'face' | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Appeal Modal
  const [appealRecordId, setAppealRecordId] = useState<number | null>(null);
  const [appealReason, setAppealReason] = useState('');

  const load = useCallback(async () => {
    try {
      const yq = selectedAcademicYearId ? `?academicYearId=${selectedAcademicYearId}` : '';
      const [sessRes, anaRes, bioRes] = await Promise.all([
        apiFetch<{ sessions: LiveSession[] }>(`/api/attendance/sessions${yq}`),
        apiFetch<NonNullable<typeof analytics>>(`/api/attendance/analytics${yq}`),
        apiFetch<NonNullable<typeof biometricStatus>>('/api/attendance/biometric/status'),
      ]);
      setSessions(sessRes.sessions);
      setAnalytics(anaRes);
      setBiometricStatus(bioRes);

      const active = sessRes.sessions.find((s) => s.status === 'active' && !s.myRecord);
      if (active && !verifySessionId) setVerifySessionId(active.id);

      const targetStudentId =
        effectiveProfile?.studentId || effectiveProfile?.linkedStudentIds[0];
      if (targetStudentId) {
        const stuRes = await apiFetch<{ attendanceRecords: typeof attendanceHistory }>(
          `/api/students/${targetStudentId}`
        );
        setAttendanceHistory(stuRes.attendanceRecords);
      }
    } catch (err) {
      console.error('Failed loading student attendance:', err);
    }
  }, [apiFetch, effectiveProfile?.linkedStudentIds, effectiveProfile?.studentId, selectedAcademicYearId, verifySessionId]);

  useEffect(() => {
    load();
  }, [load]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraMode(null);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const submitQrToken = useCallback(
    async (tokenStr: string) => {
      setSubmitting(true);
      try {
        await apiFetch('/api/attendance/verify-qr', {
          method: 'POST',
          body: JSON.stringify({ token: tokenStr }),
        });
        toast.success('QR verified! Your attendance is recorded.');
        stopCamera();
        setQrTokenInput('');
        await load();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'QR verification failed');
      } finally {
        setSubmitting(false);
      }
    },
    [apiFetch, load, stopCamera]
  );

  const startCamera = async (mode: 'qr' | 'face') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode === 'qr' ? 'environment' : 'user' },
      });
      streamRef.current = stream;
      setCameraMode(mode);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 80);
    } catch {
      toast.error('Camera access unavailable or denied. Use the 6-char rotating code below.');
    }
  };

  // Continuous QR frame scan loop when cameraMode === 'qr'
  useEffect(() => {
    if (cameraMode !== 'qr') return;
    const interval = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data && code.data.startsWith('IC-QR.')) {
        submitQrToken(code.data);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [cameraMode, submitQrToken]);

  const handleShortCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qrTokenInput.trim().startsWith('IC-QR.')) {
      return submitQrToken(qrTokenInput.trim());
    }
    if (!verifySessionId || !shortCode.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/api/attendance/verify-qr', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: verifySessionId,
          shortCode: shortCode.trim(),
        }),
      });
      toast.success('Rotating code verified! Attendance marked present.');
      setShortCode('');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification rejected');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConsentAction = async (action: 'grant' | 'withdraw') => {
    try {
      await apiFetch('/api/attendance/biometric/consent', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      toast.success(
        action === 'grant'
          ? 'Informed biometric consent granted.'
          : 'Consent withdrawn and biometric enrollment purged.'
      );
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Consent update failed');
    }
  };

  const handleFaceVerifyAttempt = async () => {
    const targetSessionId = verifySessionId || sessions.find((s) => s.status === 'active')?.id;
    if (!targetSessionId) {
      toast.error('No active attendance session selected.');
      return;
    }

    let imageBase64 = '';
    if (videoRef.current && canvasRef.current && videoRef.current.readyState >= 2) {
      const c = canvasRef.current;
      c.width = 320;
      c.height = 240;
      const ctx = c.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0, 320, 240);
      imageBase64 = c.toDataURL('image/jpeg', 0.7);
    }

    setSubmitting(true);
    try {
      const res = await apiFetch<{ outcome: string }>('/api/attendance/verify-face', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: targetSessionId,
          imageBase64,
          livenessFramesCount: 3,
        }),
      });
      toast.success(`Biometric verification result: ${res.outcome}`);
      stopCamera();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Biometric verification unavailable');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appealRecordId) return;
    try {
      await apiFetch('/api/attendance/appeals', {
        method: 'POST',
        body: JSON.stringify({
          attendanceRecordId: appealRecordId,
          reason: appealReason,
        }),
      });
      toast.success('Appeal submitted to faculty for review.');
      setAppealRecordId(null);
      setAppealReason('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Appeal submission failed');
    }
  };

  const liveSessions = sessions.filter((s) => s.status === 'active');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
            {isStudent ? 'My Attendance & Smart Verification' : 'Ward Attendance Summary'}
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            Read-only official attendance ledger · Minimum 75% VTU eligibility threshold
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">Overall Percentage</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#722F37] dark:text-[#D4AF37]">
            {analytics?.overallPercentage ?? 0}%
          </p>
        </div>
      </div>

      {/* Live Attendance Verification Controls (Students Only) */}
      {isStudent && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Dynamic QR Verification */}
          <Surface className="lg:col-span-7 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                  Dynamic QR Attendance Verification
                </h2>
              </div>
              <span className="text-xs font-mono text-[#6B7280] dark:text-[#B5A5A8]">
                {liveSessions.length} Live Session(s)
              </span>
            </div>

            {liveSessions.length === 0 ? (
              <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] py-3">
                No active sessions right now. When your faculty opens a session, it will appear here.
              </p>
            ) : (
              <div className="space-y-2">
                {liveSessions.map((ls) => (
                  <div
                    key={ls.id}
                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-colors ${
                      verifySessionId === ls.id
                        ? 'border-[#722F37] bg-[#F7F3EE] dark:bg-[#2E1A1E]/70'
                        : 'border-[#E5E7EB] dark:border-[#332326]'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                        {ls.subjectCode} · {ls.subjectName}
                      </p>
                      <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                        {ls.facultyName} · {ls.roomCode || 'Classroom'} · Session #{ls.id}
                      </p>
                    </div>
                    {ls.myRecord ? (
                      <StatusText tone="success">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified ({ls.myRecord.status})
                      </StatusText>
                    ) : (
                      <Button
                        size="sm"
                        variant={verifySessionId === ls.id ? 'primary' : 'outline'}
                        onClick={() => setVerifySessionId(ls.id)}
                      >
                        {verifySessionId === ls.id ? 'Selected' : 'Select Session'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Camera Scanner or Short Code Entry */}
            <div className="pt-2 space-y-4">
              <div className="flex flex-wrap gap-2">
                {cameraMode !== 'qr' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => startCamera('qr')}
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Open Camera QR Scanner
                  </Button>
                ) : (
                  <Button type="button" variant="danger" size="sm" onClick={stopCamera}>
                    <StopCircle className="w-3.5 h-3.5" />
                    Stop Camera
                  </Button>
                )}
              </div>

              {cameraMode && (
                <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#332326] bg-[#160B0D] max-w-sm">
                  <video ref={videoRef} className="w-full h-52 object-cover" muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              <form onSubmit={handleShortCodeSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5">
                  <FieldLabel>6-Char Rotating Short Code</FieldLabel>
                  <Input
                    value={shortCode}
                    onChange={(e) => setShortCode(e.target.value)}
                    placeholder="e.g. A9F3C2"
                    className="font-mono uppercase"
                  />
                </div>
                <div className="sm:col-span-4">
                  <FieldLabel>Or Paste QR Token</FieldLabel>
                  <Input
                    value={qrTokenInput}
                    onChange={(e) => setQrTokenInput(e.target.value)}
                    placeholder="IC-QR...."
                    className="font-mono text-xs"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? 'Verifying...' : 'Verify QR'}
                  </Button>
                </div>
              </form>
            </div>
          </Surface>

          {/* AI Face Verification & Informed Consent Panel */}
          <Surface className="lg:col-span-5 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                  AI Face Verification &amp; Consent
                </h2>
              </div>
              <StatusText tone={biometricStatus?.provider.configured ? 'success' : 'warning'}>
                {biometricStatus?.provider.configured ? 'Provider Active' : 'Not Configured'}
              </StatusText>
            </div>

            {!biometricStatus?.provider.configured && (
              <div className="p-3.5 rounded-2xl border border-[#D4AF37]/60 bg-[#F7F3EE] dark:bg-[#291F0B]/50 dark:border-[#D4AF37]/35 text-xs text-[#8A6D0B] dark:text-[#D4AF37] space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  External Biometric Provider Not Configured
                </p>
                <p className="leading-relaxed">
                  {biometricStatus?.provider.diagnosticMessage}
                </p>
                <p className="font-mono text-[11px]">
                  Required server env: {biometricStatus?.provider.requiredEnvVars.join(', ')}
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-2xl border border-[#E5E7EB] dark:border-[#332326] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                  Informed Biometric Consent
                </span>
                <StatusText
                  tone={biometricStatus?.consent?.status === 'granted' ? 'success' : 'neutral'}
                >
                  {biometricStatus?.consent?.status === 'granted' ? 'Granted' : 'Withdrawn / None'}
                </StatusText>
              </div>
              <p className="text-[#6B7280] dark:text-[#B5A5A8]">
                Biometric verification is optional. You may withdraw consent and purge your
                enrollment template at any time and use Dynamic QR instead.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {biometricStatus?.consent?.status !== 'granted' ? (
                  <Button size="sm" variant="outline" onClick={() => handleConsentAction('grant')}>
                    Grant Informed Consent
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => handleConsentAction('withdraw')}>
                    Withdraw Consent & Purge Data
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {cameraMode !== 'face' ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startCamera('face')}
                  disabled={biometricStatus?.consent?.status !== 'granted'}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Open Liveness Camera
                </Button>
              ) : (
                <Button size="sm" variant="danger" onClick={stopCamera}>
                  Stop Camera
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleFaceVerifyAttempt}
                disabled={submitting || biometricStatus?.consent?.status !== 'granted'}
              >
                Submit Face Verification
              </Button>
            </div>
          </Surface>
        </div>
      )}

      {/* Subject-wise Breakdown */}
      <Surface className="p-6">
        <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-4">
          Subject-wise Attendance Breakdown
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analytics?.subjectSummary.map((s) => (
            <div
              key={s.subjectId}
              className="p-4 rounded-[20px] border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8] dark:bg-[#170F11] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-[#722F37] dark:text-[#D48A94]">{s.code}</span>
                <StatusText tone={s.percentage >= 75 ? 'success' : 'danger'}>
                  {s.percentage}% ({s.present}/{s.total})
                </StatusText>
              </div>
              <p className="text-sm font-medium text-[#1F2937] dark:text-[#FAF6F5]">{s.name}</p>
              <div className="h-2 rounded-full bg-[#F7F3EE] dark:bg-[#26191B] overflow-hidden">
                <div
                  className={`h-full rounded-full ${s.percentage >= 75 ? 'bg-[#16A34A]' : 'bg-[#722F37]'}`}
                  style={{ width: `${Math.min(100, s.percentage)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Surface>

      {/* Detailed Session Attendance History + Appeal Action */}
      <Surface className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
            Session Attendance Ledger ({attendanceHistory.length})
          </h2>
          <span className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
            Students cannot alter records directly; submit an appeal for faculty review.
          </span>
        </div>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
              <th className="py-2.5 px-4">Subject</th>
              <th className="py-2.5 px-4">Timestamp (IST)</th>
              <th className="py-2.5 px-4">Method</th>
              <th className="py-2.5 px-4">Status</th>
              {isStudent && <th className="py-2.5 px-4 text-right">Appeal</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
            {attendanceHistory.map((rec) => (
              <tr key={rec.id}>
                <td className="py-3 px-4 font-medium">
                  <span className="font-mono text-[#722F37] dark:text-[#D48A94] mr-2">{rec.subjectCode}</span>
                  {rec.subjectName}
                </td>
                <td className="py-3 px-4 font-mono tabular-nums text-[#6B7280] dark:text-[#B5A5A8]">
                  {formatIST(rec.markedAt)}
                </td>
                <td className="py-3 px-4">{rec.verificationMethod.replace('_', ' ')}</td>
                <td className="py-3 px-4">
                  <StatusText
                    tone={
                      rec.status === 'present'
                        ? 'success'
                        : rec.status === 'late'
                        ? 'warning'
                        : 'danger'
                    }
                  >
                    {rec.status.toUpperCase()}
                  </StatusText>
                </td>
                {isStudent && (
                  <td className="py-3 px-4 text-right">
                    {rec.status === 'absent' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setAppealRecordId(rec.id)}
                      >
                        Request Appeal
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      <Modal
        open={appealRecordId !== null}
        onClose={() => setAppealRecordId(null)}
        title="Submit Attendance Correction Appeal"
        subtitle="Creates a pending appeal log for your subject faculty. Attendance status remains unchanged until faculty approval."
      >
        <form onSubmit={handleAppealSubmit} className="space-y-4">
          <div>
            <FieldLabel required>Reason / Supporting Details</FieldLabel>
            <Textarea
              rows={3}
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder="e.g. Attended hackathon / biometric camera timeout; faculty confirmed presence in LH-301."
              required
              minLength={8}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAppealRecordId(null)}>
              Cancel
            </Button>
            <Button type="submit">Submit Appeal</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
