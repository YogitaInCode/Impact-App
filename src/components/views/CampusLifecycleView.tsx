import React, { useCallback, useEffect, useState } from 'react';
import {
  Award,
  BookOpen,
  Briefcase,
  Building,
  Bus,
  CalendarOff,
  CheckCircle2,
  FileCheck,
  FolderGit2,
  GraduationCap,
  Plus,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { formatINR } from '../../lib/utils';
import { Button, FieldLabel, Input, Modal, Select, StatusText, Surface, TabBar } from '../ui/primitives';

interface OverviewPayload {
  achievements: {
    id: number;
    studentId: number;
    usn: string;
    studentName: string;
    title: string;
    category: string;
    issuer: string;
    achievedOn: string;
    level: string;
    verified: boolean;
  }[];
  projects: {
    id: number;
    studentId: number;
    usn: string;
    studentName: string;
    academicYearCode: string;
    semesterNumber: number;
    title: string;
    projectType: string;
    domain: string;
    techStack: string;
    status: string;
  }[];
  internships: {
    id: number;
    studentId: number;
    usn: string;
    studentName: string;
    companyName: string;
    roleTitle: string;
    internshipType: string;
    startDate: string;
    endDate: string;
    stipendInr: number | null;
    location: string;
    completionStatus: string;
  }[];
  placements: {
    id: number;
    studentId: number;
    usn: string;
    studentName: string;
    academicYearCode: string;
    companyName: string;
    jobRole: string;
    ctcLpa: string | null;
    driveDate: string;
    roundStage: string;
    offerStatus: string;
  }[];
  leaves: {
    id: number;
    studentId: number;
    usn: string;
    studentName: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    daysCount: number;
    reason: string;
    status: string;
    reviewRemarks: string | null;
  }[];
  library: {
    id: number;
    studentId: number;
    usn: string;
    studentName: string;
    bookTitle: string;
    author: string;
    accessionNumber: string;
    issuedDate: string;
    dueDate: string;
    status: string;
  }[];
  transport: {
    id: number;
    usn: string;
    studentName: string;
    routeCode: string;
    routeName: string;
    boardingStop: string;
    busNumber: string;
    passNumber: string;
    annualFeeInr: number;
    status: string;
  }[];
  hostel: {
    id: number;
    usn: string;
    studentName: string;
    hostelBlock: string;
    roomNumber: string;
    bedCode: string;
    roomType: string;
    messPlan: string;
    annualFeeInr: number;
    status: string;
  }[];
  alumni: {
    id: number;
    usn: string;
    studentName: string;
    graduationYear: number;
    degreeAwarded: string;
    finalCgpa: string;
    currentCompany: string | null;
    currentRole: string | null;
    city: string;
    mentorshipAvailable: boolean;
    verified: boolean;
  }[];
  documents: {
    id: number;
    usn: string;
    studentName: string;
    documentType: string;
    title: string;
    referenceNumber: string;
    verificationStatus: string;
  }[];
}

export const CampusLifecycleView: React.FC<{
  initialTab?: 'leaves' | 'career' | 'documents' | 'campus' | 'alumni';
}> = ({ initialTab = 'leaves' }) => {
  const { effectiveProfile, selectedAcademicYearId, apiFetch } = useAuth();
  const isAdmin = effectiveProfile?.role === 'super_admin';
  const isStaff = isAdmin || effectiveProfile?.role === 'faculty';
  const isStudent = effectiveProfile?.role === 'student';

  const [tab, setTab] = useState<'leaves' | 'career' | 'documents' | 'campus' | 'alumni'>(initialTab);
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<{ id: number; usn: string; fullName: string }[]>([]);
  const [semesters, setSemesters] = useState<{ id: number; academicYearId: number; name: string }[]>([]);

  // Modals
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [achOpen, setAchOpen] = useState(false);
  const [projOpen, setProjOpen] = useState(false);
  const [internOpen, setInternOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [libOpen, setLibOpen] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    studentId: '',
    semesterId: '',
    leaveType: 'medical',
    fromDate: '2026-11-24',
    toDate: '2026-11-25',
    daysCount: '2',
    reason: '',
  });
  const [achForm, setAchForm] = useState({
    studentId: '',
    title: '',
    category: 'hackathon',
    issuer: 'VTU / IEEE Bengaluru',
    achievedOn: '2026-10-18',
    level: 'state',
  });
  const [projForm, setProjForm] = useState({
    studentId: '',
    semesterId: '',
    title: '',
    projectType: 'mini',
    domain: 'AI & Data Engineering',
    techStack: 'React, TypeScript, PostgreSQL',
  });
  const [internForm, setInternForm] = useState({
    studentId: '',
    companyName: '',
    roleTitle: 'Software Engineering Intern',
    startDate: '2026-06-01',
    endDate: '2026-07-31',
    stipendInr: '25000',
    location: 'Bengaluru',
  });
  const [placeForm, setPlaceForm] = useState({
    studentId: '',
    companyName: '',
    jobRole: 'Software Development Engineer',
    ctcLpa: '10.5',
    driveDate: '2026-12-10',
  });
  const [libForm, setLibForm] = useState({
    studentId: '',
    bookTitle: '',
    author: '',
    accessionNumber: '',
    dueDate: '2026-12-15',
  });

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, stuRes, refRes] = await Promise.all([
        apiFetch<OverviewPayload>('/api/lifecycle/overview'),
        apiFetch<{ students: { id: number; usn: string; fullName: string }[] }>('/api/students'),
        apiFetch<{ semesters: { id: number; academicYearId: number; name: string }[] }>('/api/reference-data'),
      ]);
      setData(ovRes);
      setStudents(stuRes.students);
      setSemesters(refRes.semesters);

      const defaultStu = String(effectiveProfile?.studentId || stuRes.students[0]?.id || '');
      const defaultSem = String(
        refRes.semesters.find((s) => s.academicYearId === selectedAcademicYearId)?.id ||
          refRes.semesters[0]?.id ||
          ''
      );

      setLeaveForm((p) => (p.studentId ? p : { ...p, studentId: defaultStu, semesterId: defaultSem }));
      setAchForm((p) => (p.studentId ? p : { ...p, studentId: defaultStu }));
      setProjForm((p) => (p.studentId ? p : { ...p, studentId: defaultStu, semesterId: defaultSem }));
      setInternForm((p) => (p.studentId ? p : { ...p, studentId: defaultStu }));
      setPlaceForm((p) => (p.studentId ? p : { ...p, studentId: defaultStu }));
      setLibForm((p) => (p.studentId ? p : { ...p, studentId: defaultStu }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load lifecycle modules');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, effectiveProfile?.studentId, selectedAcademicYearId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/lifecycle/leaves', {
        method: 'POST',
        body: JSON.stringify({ ...leaveForm, academicYearId: selectedAcademicYearId }),
      });
      toast.success('Leave application submitted');
      setLeaveOpen(false);
      setLeaveForm((p) => ({ ...p, reason: '' }));
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit leave');
    }
  };

  const handleLeaveReview = async (id: number, status: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/lifecycle/leaves/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewRemarks: `Processed via portal` }),
      });
      toast.success(`Leave ${status}`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update leave');
    }
  };

  const handleDocVerify = async (id: number, verificationStatus: 'verified' | 'rejected') => {
    try {
      await apiFetch(`/api/lifecycle/documents/${id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ verificationStatus }),
      });
      toast.success(`Document ${verificationStatus}`);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Verification failed');
    }
  };

  const handleAddAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/lifecycle/achievements', { method: 'POST', body: JSON.stringify(achForm) });
      toast.success('Achievement recorded');
      setAchOpen(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save achievement');
    }
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/lifecycle/projects', {
        method: 'POST',
        body: JSON.stringify({ ...projForm, academicYearId: selectedAcademicYearId }),
      });
      toast.success('Project recorded');
      setProjOpen(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save project');
    }
  };

  const handleAddInternship = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/lifecycle/internships', { method: 'POST', body: JSON.stringify(internForm) });
      toast.success('Internship added');
      setInternOpen(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add internship');
    }
  };

  const handleAddPlacement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/lifecycle/placements', {
        method: 'POST',
        body: JSON.stringify({ ...placeForm, academicYearId: selectedAcademicYearId }),
      });
      toast.success('Placement application saved');
      setPlaceOpen(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add placement');
    }
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/lifecycle/library', { method: 'POST', body: JSON.stringify(libForm) });
      toast.success('Library book issued');
      setLibOpen(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to issue book');
    }
  };

  const handleReturnBook = async (id: number) => {
    try {
      await apiFetch(`/api/lifecycle/library/${id}/return`, { method: 'PATCH' });
      toast.success('Book marked returned');
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to return book');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
            Student Lifecycle &amp; Campus Services
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            Leave approvals, co-curricular achievements, projects, internships, placements, documents, library, hostel, transport &amp; alumni
          </p>
        </div>

        <TabBar
          tabs={[
            { id: 'leaves', label: 'Leave Requests', count: data?.leaves.length },
            { id: 'career', label: 'Achievements, Projects & Placements' },
            { id: 'documents', label: 'Document Vault', count: data?.documents.length },
            { id: 'campus', label: 'Library, Hostel & Transport' },
            { id: 'alumni', label: 'Alumni Network', count: data?.alumni.length },
          ]}
          activeTab={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
      </div>

      {loading || !data ? (
        <Surface className="p-8 text-center text-xs text-[#6B7280] dark:text-[#B5A5A8]">
          Loading normalized PostgreSQL lifecycle records...
        </Surface>
      ) : (
        <>
          {/* 1. Leaves */}
          {tab === 'leaves' && (
            <div className="space-y-4">
              {(isStudent || isAdmin) && (
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => setLeaveOpen(true)}>
                    <CalendarOff className="w-3.5 h-3.5" />
                    Apply for Leave / Duty Leave
                  </Button>
                </div>
              )}

              <Surface className="overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                      <th className="py-2.5 px-4">Student</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Dates</th>
                      <th className="py-2.5 px-4">Reason</th>
                      <th className="py-2.5 px-4">Status</th>
                      {isStaff && <th className="py-2.5 px-4 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                    {data.leaves.map((lv) => (
                      <tr key={lv.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                        <td className="py-2.5 px-4">
                          <span className="font-mono font-semibold mr-2">{lv.usn}</span>
                          {lv.studentName}
                        </td>
                        <td className="py-2.5 px-4 capitalize">{lv.leaveType.replace('_', ' ')}</td>
                        <td className="py-2.5 px-4 font-mono">{lv.fromDate} → {lv.toDate} ({lv.daysCount}d)</td>
                        <td className="py-2.5 px-4 text-[#4B3F42] dark:text-[#D8CCD0]">{lv.reason}</td>
                        <td className="py-2.5 px-4">
                          <StatusText tone={lv.status === 'approved' ? 'success' : lv.status === 'rejected' ? 'danger' : 'warning'}>
                            {lv.status.toUpperCase()}
                          </StatusText>
                        </td>
                        {isStaff && (
                          <td className="py-2.5 px-4 text-right space-x-1.5">
                            {lv.status === 'pending' && (
                              <>
                                <Button size="sm" variant="teal" onClick={() => handleLeaveReview(lv.id, 'approved')}>Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => handleLeaveReview(lv.id, 'rejected')}>Reject</Button>
                              </>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Surface>
            </div>
          )}

          {/* 2. Career: Achievements, Projects, Internships, Placements */}
          {tab === 'career' && (
            <div className="space-y-6">
              {/* Achievements */}
              <Surface className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#8A6D0B] dark:text-[#D4AF37]" />
                    Achievements &amp; Certifications ({data.achievements.length})
                  </h2>
                  {(isStudent || isStaff) && (
                    <Button size="sm" variant="outline" onClick={() => setAchOpen(true)}>
                      <Plus className="w-3.5 h-3.5" /> Add Achievement
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                  {data.achievements.map((a) => (
                    <div key={a.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{a.title}</p>
                        <p className="text-[#6B7280] dark:text-[#B5A5A8]"><span className="font-mono">{a.usn}</span> · {a.studentName} · {a.issuer} ({a.achievedOn})</p>
                      </div>
                      <StatusText tone={a.verified ? 'success' : 'warning'}>{a.verified ? 'Verified' : 'Pending Verification'}</StatusText>
                    </div>
                  ))}
                </div>
              </Surface>

              {/* Projects */}
              <Surface className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FolderGit2 className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                    Academic Projects ({data.projects.length})
                  </h2>
                  {(isStudent || isStaff) && (
                    <Button size="sm" variant="outline" onClick={() => setProjOpen(true)}>
                      <Plus className="w-3.5 h-3.5" /> Register Project
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                  {data.projects.map((p) => (
                    <div key={p.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{p.title}</p>
                        <p className="text-[#6B7280] dark:text-[#B5A5A8]"><span className="font-mono">{p.usn}</span> · {p.domain} · Stack: {p.techStack}</p>
                      </div>
                      <StatusText tone="info">{p.status.toUpperCase()}</StatusText>
                    </div>
                  ))}
                </div>
              </Surface>

              {/* Internships & Placements */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Surface className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                      Internships ({data.internships.length})
                    </h2>
                    {(isStudent || isStaff) && (
                      <Button size="sm" variant="outline" onClick={() => setInternOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Add
                      </Button>
                    )}
                  </div>
                  <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                    {data.internships.map((i) => (
                      <div key={i.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{i.companyName} · {i.roleTitle}</p>
                          <p className="text-[#6B7280] dark:text-[#B5A5A8] font-mono">{i.usn} · {i.startDate} → {i.endDate} · {formatINR(i.stipendInr || 0)}/mo</p>
                        </div>
                        <StatusText tone="success">{i.completionStatus.toUpperCase()}</StatusText>
                      </div>
                    ))}
                  </div>
                </Surface>

                <Surface className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                      Placement Applications ({data.placements.length})
                    </h2>
                    {(isStudent || isAdmin) && (
                      <Button size="sm" variant="outline" onClick={() => setPlaceOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Add
                      </Button>
                    )}
                  </div>
                  <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                    {data.placements.map((pl) => (
                      <div key={pl.id} className="py-2.5 flex items-center justify-between gap-2">
                        <div>
                          <p className="font-medium">{pl.companyName} · {pl.jobRole}</p>
                          <p className="text-[#6B7280] dark:text-[#B5A5A8] font-mono">{pl.usn} · {pl.ctcLpa || '—'} LPA · {pl.roundStage}</p>
                        </div>
                        <StatusText tone={pl.offerStatus === 'offered' || pl.offerStatus === 'accepted' ? 'success' : 'info'}>
                          {pl.offerStatus.toUpperCase()}
                        </StatusText>
                      </div>
                    ))}
                  </div>
                </Surface>
              </div>
            </div>
          )}

          {/* 3. Document Verification Desk */}
          {tab === 'documents' && (
            <Surface className="overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E5E7EB] dark:border-[#332326] flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                  Institutional Document Verification Vault ({data.documents.length})
                </h2>
              </div>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-[#6B7280] dark:text-[#B5A5A8]">
                    <th className="py-2.5 px-4">Student</th>
                    <th className="py-2.5 px-4">Document</th>
                    <th className="py-2.5 px-4">Reference No</th>
                    <th className="py-2.5 px-4">Status</th>
                    {isAdmin && <th className="py-2.5 px-4 text-right">Verify</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                  {data.documents.map((d) => (
                    <tr key={d.id} className="hover:bg-[#FCFAF8] dark:hover:bg-[#241719] transition-colors">
                      <td className="py-2.5 px-4"><span className="font-mono font-semibold mr-2">{d.usn}</span>{d.studentName}</td>
                      <td className="py-2.5 px-4">{d.title} ({d.documentType})</td>
                      <td className="py-2.5 px-4 font-mono">{d.referenceNumber}</td>
                      <td className="py-2.5 px-4">
                        <StatusText tone={d.verificationStatus === 'verified' ? 'success' : d.verificationStatus === 'rejected' ? 'danger' : 'warning'}>
                          {d.verificationStatus.toUpperCase()}
                        </StatusText>
                      </td>
                      {isAdmin && (
                        <td className="py-2.5 px-4 text-right space-x-1.5">
                          {d.verificationStatus === 'pending' && (
                            <>
                              <Button size="sm" variant="teal" onClick={() => handleDocVerify(d.id, 'verified')}>Verify</Button>
                              <Button size="sm" variant="outline" onClick={() => handleDocVerify(d.id, 'rejected')}>Reject</Button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Surface>
          )}

          {/* 4. Library, Hostel & Transport */}
          {tab === 'campus' && (
            <div className="space-y-6">
              <Surface className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                    Central Library Issue &amp; Return Ledger ({data.library.length})
                  </h2>
                  {isAdmin && (
                    <Button size="sm" onClick={() => setLibOpen(true)}>
                      <Plus className="w-3.5 h-3.5" /> Issue Book
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                  {data.library.map((l) => (
                    <div key={l.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{l.bookTitle} ({l.author})</p>
                        <p className="text-[#6B7280] dark:text-[#B5A5A8] font-mono">{l.usn} · Acc {l.accessionNumber} · Due {l.dueDate}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusText tone={l.status === 'returned' ? 'success' : 'info'}>{l.status.toUpperCase()}</StatusText>
                        {isAdmin && l.status === 'issued' && (
                          <Button size="sm" variant="outline" onClick={() => handleReturnBook(l.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Returned
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Surface>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Surface className="p-5 space-y-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                    Hostel Room Allocations ({data.hostel.length})
                  </h2>
                  {data.hostel.map((h) => (
                    <div key={h.id} className="p-3 rounded-xl border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8]/80 dark:bg-[#170F11] text-xs flex items-center justify-between">
                      <div>
                        <p className="font-medium">{h.usn} · {h.studentName}</p>
                        <p className="text-[#6B7280] dark:text-[#B5A5A8]">{h.hostelBlock} · Room {h.roomNumber} ({h.bedCode}) · {h.messPlan}</p>
                      </div>
                      <span className="font-mono font-semibold">{formatINR(h.annualFeeInr)}</span>
                    </div>
                  ))}
                </Surface>

                <Surface className="p-5 space-y-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Bus className="w-4 h-4 text-[#8A6D0B] dark:text-[#D4AF37]" />
                    Campus Bus &amp; Transport Passes ({data.transport.length})
                  </h2>
                  {data.transport.map((t) => (
                    <div key={t.id} className="p-3 rounded-xl border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8]/80 dark:bg-[#170F11] text-xs flex items-center justify-between">
                      <div>
                        <p className="font-medium">{t.usn} · {t.studentName}</p>
                        <p className="text-[#6B7280] dark:text-[#B5A5A8]">{t.routeCode}: {t.routeName} · Stop: {t.boardingStop} · {t.busNumber}</p>
                      </div>
                      <span className="font-mono font-semibold">{formatINR(t.annualFeeInr)}</span>
                    </div>
                  ))}
                </Surface>
              </div>
            </div>
          )}

          {/* 5. Alumni */}
          {tab === 'alumni' && (
            <Surface className="p-5 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                ICEAS Alumni Directory &amp; Mentorship ({data.alumni.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {data.alumni.map((al) => (
                  <div key={al.id} className="p-4 rounded-[20px] border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8]/80 dark:bg-[#170F11] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[#1F2937] dark:text-[#FAF6F5]">{al.studentName}</span>
                      <span className="font-mono text-[#8A6D0B] dark:text-[#D4AF37] font-bold">Class of {al.graduationYear}</span>
                    </div>
                    <p className="text-[#4B3F42] dark:text-[#D8CCD0]">{al.degreeAwarded} · Final CGPA: <strong className="font-mono">{al.finalCgpa}</strong></p>
                    <p className="text-[#6B7280] dark:text-[#B5A5A8]">{al.currentRole || 'Graduate'} at {al.currentCompany || '—'} · {al.city}</p>
                    {al.mentorshipAvailable && <StatusText tone="success">Open for Student Mentorship</StatusText>}
                  </div>
                ))}
              </div>
            </Surface>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={leaveOpen} onClose={() => setLeaveOpen(false)} title="Apply for Student Leave / On-Duty">
        <form onSubmit={handleLeaveSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {isAdmin && (
              <div className="col-span-2">
                <FieldLabel required>Student</FieldLabel>
                <Select value={leaveForm.studentId} onChange={(e) => setLeaveForm({ ...leaveForm, studentId: e.target.value })}>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.usn} · {s.fullName}</option>)}
                </Select>
              </div>
            )}
            <div>
              <FieldLabel required>Leave Type</FieldLabel>
              <Select value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}>
                <option value="medical">Medical Leave</option>
                <option value="duty_leave">Academic / Hackathon Duty Leave</option>
                <option value="personal">Personal Leave</option>
              </Select>
            </div>
            <div>
              <FieldLabel required>Semester</FieldLabel>
              <Select value={leaveForm.semesterId} onChange={(e) => setLeaveForm({ ...leaveForm, semesterId: e.target.value })}>
                {semesters.map((sm) => <option key={sm.id} value={sm.id}>{sm.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>From Date</FieldLabel>
              <Input type="date" value={leaveForm.fromDate} onChange={(e) => setLeaveForm({ ...leaveForm, fromDate: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>To Date</FieldLabel>
              <Input type="date" value={leaveForm.toDate} onChange={(e) => setLeaveForm({ ...leaveForm, toDate: e.target.value })} required />
            </div>
            <div className="col-span-2">
              <FieldLabel required>Reason</FieldLabel>
              <Input value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>Cancel</Button>
            <Button type="submit">Submit Leave</Button>
          </div>
        </form>
      </Modal>

      <Modal open={achOpen} onClose={() => setAchOpen(false)} title="Record Student Achievement">
        <form onSubmit={handleAddAchievement} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {isStaff && (
              <div className="col-span-2">
                <FieldLabel required>Student</FieldLabel>
                <Select value={achForm.studentId} onChange={(e) => setAchForm({ ...achForm, studentId: e.target.value })}>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.usn} · {s.fullName}</option>)}
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <FieldLabel required>Achievement Title</FieldLabel>
              <Input value={achForm.title} onChange={(e) => setAchForm({ ...achForm, title: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Category</FieldLabel>
              <Select value={achForm.category} onChange={(e) => setAchForm({ ...achForm, category: e.target.value })}>
                <option value="hackathon">Hackathon</option>
                <option value="certification">Certification</option>
                <option value="publication">Research Publication</option>
                <option value="sports">Sports / Cultural</option>
              </Select>
            </div>
            <div>
              <FieldLabel required>Issuer</FieldLabel>
              <Input value={achForm.issuer} onChange={(e) => setAchForm({ ...achForm, issuer: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAchOpen(false)}>Cancel</Button>
            <Button type="submit">Save Achievement</Button>
          </div>
        </form>
      </Modal>

      <Modal open={projOpen} onClose={() => setProjOpen(false)} title="Register Academic Project">
        <form onSubmit={handleAddProject} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {isStaff && (
              <div className="col-span-2">
                <FieldLabel required>Student</FieldLabel>
                <Select value={projForm.studentId} onChange={(e) => setProjForm({ ...projForm, studentId: e.target.value })}>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.usn} · {s.fullName}</option>)}
                </Select>
              </div>
            )}
            <div className="col-span-2">
              <FieldLabel required>Project Title</FieldLabel>
              <Input value={projForm.title} onChange={(e) => setProjForm({ ...projForm, title: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Domain</FieldLabel>
              <Input value={projForm.domain} onChange={(e) => setProjForm({ ...projForm, domain: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Tech Stack</FieldLabel>
              <Input value={projForm.techStack} onChange={(e) => setProjForm({ ...projForm, techStack: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setProjOpen(false)}>Cancel</Button>
            <Button type="submit">Save Project</Button>
          </div>
        </form>
      </Modal>

      <Modal open={internOpen} onClose={() => setInternOpen(false)} title="Log Industry Internship">
        <form onSubmit={handleAddInternship} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {isStaff && (
              <div className="col-span-2">
                <FieldLabel required>Student</FieldLabel>
                <Select value={internForm.studentId} onChange={(e) => setInternForm({ ...internForm, studentId: e.target.value })}>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.usn} · {s.fullName}</option>)}
                </Select>
              </div>
            )}
            <div>
              <FieldLabel required>Company</FieldLabel>
              <Input value={internForm.companyName} onChange={(e) => setInternForm({ ...internForm, companyName: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Role</FieldLabel>
              <Input value={internForm.roleTitle} onChange={(e) => setInternForm({ ...internForm, roleTitle: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Start Date</FieldLabel>
              <Input type="date" value={internForm.startDate} onChange={(e) => setInternForm({ ...internForm, startDate: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>End Date</FieldLabel>
              <Input type="date" value={internForm.endDate} onChange={(e) => setInternForm({ ...internForm, endDate: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setInternOpen(false)}>Cancel</Button>
            <Button type="submit">Save Internship</Button>
          </div>
        </form>
      </Modal>

      <Modal open={placeOpen} onClose={() => setPlaceOpen(false)} title="Add Placement Drive Application">
        <form onSubmit={handleAddPlacement} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {isAdmin && (
              <div className="col-span-2">
                <FieldLabel required>Student</FieldLabel>
                <Select value={placeForm.studentId} onChange={(e) => setPlaceForm({ ...placeForm, studentId: e.target.value })}>
                  {students.map((s) => <option key={s.id} value={s.id}>{s.usn} · {s.fullName}</option>)}
                </Select>
              </div>
            )}
            <div>
              <FieldLabel required>Company</FieldLabel>
              <Input value={placeForm.companyName} onChange={(e) => setPlaceForm({ ...placeForm, companyName: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Job Role</FieldLabel>
              <Input value={placeForm.jobRole} onChange={(e) => setPlaceForm({ ...placeForm, jobRole: e.target.value })} required />
            </div>
            <div>
              <FieldLabel>CTC (LPA)</FieldLabel>
              <Input type="number" step="0.5" value={placeForm.ctcLpa} onChange={(e) => setPlaceForm({ ...placeForm, ctcLpa: e.target.value })} />
            </div>
            <div>
              <FieldLabel required>Drive Date</FieldLabel>
              <Input type="date" value={placeForm.driveDate} onChange={(e) => setPlaceForm({ ...placeForm, driveDate: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPlaceOpen(false)}>Cancel</Button>
            <Button type="submit">Save Application</Button>
          </div>
        </form>
      </Modal>

      <Modal open={libOpen} onClose={() => setLibOpen(false)} title="Issue Library Book">
        <form onSubmit={handleIssueBook} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <FieldLabel required>Student</FieldLabel>
              <Select value={libForm.studentId} onChange={(e) => setLibForm({ ...libForm, studentId: e.target.value })}>
                {students.map((s) => <option key={s.id} value={s.id}>{s.usn} · {s.fullName}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <FieldLabel required>Book Title</FieldLabel>
              <Input value={libForm.bookTitle} onChange={(e) => setLibForm({ ...libForm, bookTitle: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Accession No</FieldLabel>
              <Input value={libForm.accessionNumber} onChange={(e) => setLibForm({ ...libForm, accessionNumber: e.target.value })} placeholder="LIB-CS-902" required />
            </div>
            <div>
              <FieldLabel required>Due Date</FieldLabel>
              <Input type="date" value={libForm.dueDate} onChange={(e) => setLibForm({ ...libForm, dueDate: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setLibOpen(false)}>Cancel</Button>
            <Button type="submit">Issue Book</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
