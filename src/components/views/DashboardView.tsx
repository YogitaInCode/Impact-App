import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Award,
  Calendar,
  CreditCard,
  GraduationCap,
  QrCode,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatINR, formatIST } from '../../lib/utils';
import { Button, StatCard, StatusText, Surface } from '../ui/primitives';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { effectiveProfile, selectedAcademicYearId, academicYears, apiFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [studentsCount, setStudentsCount] = useState(0);
  const [analytics, setAnalytics] = useState<{
    overallPercentage: number;
    totalClasses: number;
    totalPresent: number;
    subjectSummary: { subjectId: number; code: string; name: string; total: number; present: number; percentage: number }[];
    lowAttendanceStudents: { studentId: number; usn: string; fullName: string; percentage: number }[];
    pendingReviews: unknown[];
  } | null>(null);
  const [sessions, setSessions] = useState<
    { id: number; subjectCode: string; subjectName: string; mode: string; status: string; sessionDate: string; presentCount: number; totalEnrolled: number }[]
  >([]);
  const [announcements, setAnnouncements] = useState<
    { id: number; title: string; body: string; targetScope: string; priority: string; publishedAt: string; authorName: string }[]
  >([]);
  const [feeSummary, setFeeSummary] = useState<{ totalDue: number; totalPaid: number }>({
    totalDue: 0,
    totalPaid: 0,
  });
  const [sgpaSummaries, setSgpaSummaries] = useState<
    { id: number; sgpa: string; cgpa: string; backlogCount: number }[]
  >([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);

  const activeYear = academicYears.find((y) => y.id === selectedAcademicYearId);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const yq = selectedAcademicYearId ? `?academicYearId=${selectedAcademicYearId}` : '';
        const [stuRes, attRes, sessRes, annRes, sumRes, lifeRes] = await Promise.all([
          apiFetch<{ students: unknown[] }>(`/api/students${yq}`),
          apiFetch<NonNullable<typeof analytics>>(`/api/attendance/analytics${yq}`),
          apiFetch<{ sessions: typeof sessions }>(`/api/attendance/sessions${yq}`),
          apiFetch<{ announcements: typeof announcements }>('/api/system/announcements'),
          apiFetch<{ summaries: { id: number; sgpa: string; cgpa: string; backlogCount: number }[] }>('/api/academics/results/summaries'),
          apiFetch<{ leaves: { status: string }[] }>('/api/lifecycle/overview'),
        ]);

        if (!active) return;
        setStudentsCount(stuRes.students.length);
        setAnalytics(attRes);
        setSessions(sessRes.sessions);
        setAnnouncements(annRes.announcements);
        setSgpaSummaries(sumRes.summaries);
        setPendingLeaves(lifeRes.leaves.filter((l) => l.status === 'pending').length);

        if (effectiveProfile?.role !== 'faculty') {
          const fin = await apiFetch<{
            assignments: { balanceDue: number; paidAmount: number }[];
          }>('/api/finance/overview');
          if (!active) return;
          setFeeSummary({
            totalDue: fin.assignments.reduce((a, b) => a + b.balanceDue, 0),
            totalPaid: fin.assignments.reduce((a, b) => a + b.paidAmount, 0),
          });
        }
      } catch (err) {
        console.error('Dashboard load failed:', err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [apiFetch, effectiveProfile?.role, selectedAcademicYearId]);

  const role = effectiveProfile?.role || 'student';
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const avgCgpa =
    sgpaSummaries.length > 0
      ? (sgpaSummaries.reduce((s, r) => s + Number(r.cgpa), 0) / sgpaSummaries.length).toFixed(2)
      : '—';

  return (
    <div className="space-y-6">
      {/* Wine-Rose Gradient Hero Header */}
      <div className="wine-rose-gradient rounded-[24px] p-6 sm:p-7 text-white shadow-[0_14px_34px_-12px_rgba(114,47,55,0.45)] flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-[#D4AF37] tracking-wide uppercase">
            {activeYear?.label || 'Current Academic Year'} · {role.replace('_', ' ')} Workspace
          </p>
          <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-white">
            Welcome back, {effectiveProfile?.fullName}
          </h1>
          <p className="text-xs text-[#FCFAF8]/90">
            Impact College of Engineering and Applied Sciences · Bengaluru
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(role === 'faculty' || role === 'super_admin') && (
            <Button variant="gold" onClick={() => onNavigate('attendance')}>
              <QrCode className="w-4 h-4" />
              Attendance Console
            </Button>
          )}
          {role === 'student' && (
            <Button variant="gold" onClick={() => onNavigate('my-attendance')}>
              <QrCode className="w-4 h-4" />
              Verify Attendance ({activeSessions.length} Live)
            </Button>
          )}
          {role === 'parent' && (
            <Button variant="gold" onClick={() => onNavigate('parent-attendance')}>
              View Ward Attendance
            </Button>
          )}
        </div>
      </div>

      {/* KPI Grid using Wine Red, Gold & Success Tokens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={role === 'parent' ? 'Linked Ward(s)' : role === 'student' ? 'My Academic Profile' : 'Active Students'}
          value={loading ? '—' : studentsCount}
          helper={role === 'student' ? 'Permanent 360° USN linked' : 'Enrolled in selected year'}
          icon={<GraduationCap className="w-4 h-4" />}
          accent="wine"
          onClick={() => onNavigate('students')}
        />

        <StatCard
          label="Overall Attendance"
          value={loading ? '—' : `${analytics?.overallPercentage ?? 0}%`}
          helper={
            (analytics?.overallPercentage ?? 100) >= 75 ? (
              <StatusText tone="success">Above 75% VTU norm</StatusText>
            ) : (
              <StatusText tone="warning">Below 75% requirement</StatusText>
            )
          }
          icon={<Calendar className="w-4 h-4" />}
          accent={(analytics?.overallPercentage ?? 100) >= 75 ? 'success' : 'gold'}
          onClick={() => onNavigate(role === 'student' ? 'my-attendance' : role === 'parent' ? 'parent-attendance' : 'attendance')}
        />

        <StatCard
          label={role === 'student' || role === 'parent' ? 'Cumulative CGPA' : 'Mean Institutional CGPA'}
          value={loading ? '—' : avgCgpa}
          helper={`${sgpaSummaries.length} published term summaries · ${pendingLeaves} pending leaves`}
          icon={<TrendingUp className="w-4 h-4" />}
          accent="gold"
          onClick={() => onNavigate('exams')}
        />

        {role !== 'faculty' ? (
          <StatCard
            label={role === 'super_admin' ? 'Receivable Balance' : 'Fee Balance Due'}
            value={loading ? '—' : formatINR(feeSummary.totalDue)}
            helper={<span className="font-mono tabular-nums">{formatINR(feeSummary.totalPaid)} settled</span>}
            icon={<CreditCard className="w-4 h-4" />}
            accent={feeSummary.totalDue > 0 ? 'gold' : 'success'}
            onClick={() => onNavigate('finance')}
          />
        ) : (
          <StatCard
            label="Pending AI / Leave Review"
            value={loading ? '—' : `${analytics?.pendingReviews.length ?? 0} / ${pendingLeaves}`}
            helper={`${activeSessions.length} active attendance session(s)`}
            icon={<AlertTriangle className="w-4 h-4" />}
            accent="gold"
            onClick={() => onNavigate('lifecycle')}
          />
        )}
      </div>

      {/* Main Split Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Subject-wise Attendance Breakdown */}
        <Surface className="lg:col-span-7 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                Subject-wise Attendance Overview
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                Aggregated from verified PostgreSQL attendance records
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onNavigate(role === 'student' ? 'my-attendance' : role === 'parent' ? 'parent-attendance' : 'attendance')
              }
              className="text-xs font-medium text-[#722F37] dark:text-[#D48A94] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              Details <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-[#F7F3EE] dark:bg-[#26191B] animate-pulse" />
              ))}
            </div>
          ) : analytics && analytics.subjectSummary.length > 0 ? (
            <div className="space-y-4">
              {analytics.subjectSummary.map((sub) => (
                <div key={sub.subjectId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-semibold text-[#722F37] dark:text-[#D48A94]">
                        {sub.code}
                      </span>
                      <span className="font-medium text-[#1F2937] dark:text-[#FAF6F5] truncate">
                        {sub.name}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-xs font-semibold text-[#1F2937] dark:text-[#FAF6F5] shrink-0">
                      {sub.present}/{sub.total} ({sub.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-[#F7F3EE] dark:bg-[#26191B] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        sub.percentage >= 75 ? 'bg-[#16A34A]' : 'bg-[#722F37]'
                      }`}
                      style={{ width: `${Math.min(100, sub.percentage)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6B7280] py-8 text-center">
              No attendance sessions recorded for this academic year yet.
            </p>
          )}

          {(role === 'super_admin' || role === 'faculty') &&
            analytics &&
            analytics.lowAttendanceStudents.length > 0 && (
              <div className="mt-6 pt-5 border-t border-[#E5E7EB] dark:border-[#332326]">
                <p className="text-xs font-semibold text-[#8A6D0B] dark:text-[#D4AF37] mb-2">
                  Students Below 75% Threshold ({analytics.lowAttendanceStudents.length})
                </p>
                <div className="divide-y divide-[#F7F3EE] dark:divide-[#2D1E21]">
                  {analytics.lowAttendanceStudents.map((stu) => (
                    <div
                      key={stu.studentId}
                      className="py-2 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono text-[#6B7280] dark:text-[#B5A5A8] mr-2">{stu.usn}</span>
                        <span className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                          {stu.fullName}
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-semibold text-[#722F37] dark:text-[#D4AF37]">
                        {stu.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </Surface>

        {/* Announcements & Quick Modules */}
        <Surface className="lg:col-span-5 p-6 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                  Campus Announcements
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                  Institutional circulars &amp; updates
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('announcements')}
                className="text-xs font-medium text-[#722F37] dark:text-[#D48A94] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                View all <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
              {announcements.slice(0, 3).map((ann) => (
                <div key={ann.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                    <span className="capitalize">{ann.targetScope}</span>
                    <span>·</span>
                    <span>{formatIST(ann.publishedAt, false)}</span>
                    {ann.priority === 'urgent' && (
                      <>
                        <span>·</span>
                        <span className="text-[#722F37] dark:text-[#D4AF37] font-semibold">Urgent</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm font-medium text-[#1F2937] dark:text-[#FAF6F5] mt-1">
                    {ann.title}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-1 line-clamp-2">
                    {ann.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#E5E7EB] dark:border-[#332326] grid grid-cols-2 gap-2.5">
            <Button variant="secondary" size="sm" onClick={() => onNavigate('exams')}>
              <Award className="w-3.5 h-3.5 text-[#8A6D0B] dark:text-[#D4AF37]" />
              SGPA &amp; Revaluation
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onNavigate('lifecycle')}>
              <Users className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
              Leaves &amp; Placements
            </Button>
          </div>
        </Surface>
      </div>
    </div>
  );
};
