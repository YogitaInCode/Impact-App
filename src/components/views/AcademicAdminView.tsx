import React, { useCallback, useEffect, useState } from 'react';
import { BookOpen, Building2, CalendarRange, FileText, GraduationCap, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { Button, FieldLabel, Input, Modal, Select, StatusText, Surface, Textarea } from '../ui/primitives';

interface RefPayload {
  academicYears: { id: number; code: string; label: string; startDate: string; endDate: string; isCurrent: boolean; status: string }[];
  semesters: { id: number; academicYearId: number; number: number; name: string; termType: string; isActive: boolean }[];
  departments: { id: number; code: string; name: string; hodName: string | null; building: string | null }[];
  programs: { id: number; departmentId: number; code: string; name: string; degreeType: string }[];
  sections: { id: number; departmentId: number; programId: number; academicYearId: number; semesterId: number; name: string; capacity: number }[];
  classrooms: { id: number; roomCode: string; building: string; floor: string; capacity: number; roomType: string }[];
  subjects: {
    id: number;
    departmentId: number;
    programId: number;
    semesterNumber: number;
    code: string;
    name: string;
    credits: number;
    subjectType: string;
    syllabusSummary: string | null;
    studyMaterialsJson?: { id: string; title: string; moduleLabel: string; fileName: string; uploadedBy: string; uploadedAt: string }[];
  }[];
  faculty: {
    id: number;
    employeeCode: string;
    fullName: string;
    designation: string;
    qualification: string;
    departmentId: number;
    email: string;
    officeRoom: string | null;
    status: string;
  }[];
  subjectFacultyAssignments: {
    id: number;
    academicYearId: number;
    semesterId: number;
    subjectId: number;
    facultyId: number;
    sectionId: number;
  }[];
}

export const AcademicAdminView: React.FC<{ initialTab?: 'departments' | 'subjects' | 'faculty' | 'years' }> = ({
  initialTab = 'departments',
}) => {
  const { effectiveProfile, refreshSession, apiFetch } = useAuth();
  const isAdmin = effectiveProfile?.role === 'super_admin';
  const isFaculty = effectiveProfile?.role === 'faculty';

  const [tab, setTab] = useState<'departments' | 'subjects' | 'faculty' | 'years'>(initialTab);
  const [data, setData] = useState<RefPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [deptModal, setDeptModal] = useState(false);
  const [subjectModal, setSubjectModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [facultyModal, setFacultyModal] = useState(false);
  const [yearModal, setYearModal] = useState(false);
  const [promoteModal, setPromoteModal] = useState(false);
  const [materialSubjectId, setMaterialSubjectId] = useState<number | null>(null);

  // Forms
  const [deptForm, setDeptForm] = useState({ code: '', name: '', hodName: '', building: '' });
  const [subjForm, setSubjForm] = useState({
    departmentId: '',
    programId: '',
    semesterNumber: '5',
    code: '',
    name: '',
    credits: '4',
    subjectType: 'theory',
    syllabusSummary: '',
  });
  const [assignForm, setAssignForm] = useState({
    academicYearId: '',
    semesterId: '',
    subjectId: '',
    facultyId: '',
    sectionId: '',
  });
  const [facForm, setFacForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    departmentId: '',
    employeeCode: '',
    designation: 'Assistant Professor',
    qualification: 'M.Tech',
    officeRoom: '',
  });
  const [yearForm, setYearForm] = useState({
    code: '2028-29',
    label: 'Academic Year 2028–29',
    startDate: '2028-08-01',
    endDate: '2029-06-30',
    setAsCurrent: false,
  });
  const [promoteForm, setPromoteForm] = useState({
    fromAcademicYearId: '',
    fromSemesterId: '',
    toAcademicYearId: '',
    toSemesterId: '',
    toSectionId: '',
  });
  const [matForm, setMatForm] = useState({ title: '', moduleLabel: 'Module 1', fileName: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<RefPayload>('/api/reference-data');
      setData(res);
      if (res.departments.length > 0 && !subjForm.departmentId) {
        setSubjForm((p) => ({
          ...p,
          departmentId: String(res.departments[0].id),
          programId: String(res.programs[0]?.id || ''),
        }));
        setFacForm((p) => ({ ...p, departmentId: String(res.departments[0].id) }));
      }
      if (res.academicYears.length > 0 && !assignForm.academicYearId) {
        const currYear = res.academicYears.find((y) => y.isCurrent) || res.academicYears[0];
        const currSem = res.semesters.find((s) => s.academicYearId === currYear.id) || res.semesters[0];
        setAssignForm({
          academicYearId: String(currYear.id),
          semesterId: String(currSem?.id || ''),
          subjectId: String(res.subjects[0]?.id || ''),
          facultyId: String(res.faculty[0]?.id || ''),
          sectionId: String(res.sections[0]?.id || ''),
        });
        setPromoteForm({
          fromAcademicYearId: String(currYear.id),
          fromSemesterId: String(currSem?.id || ''),
          toAcademicYearId: String(res.academicYears[0].id),
          toSemesterId: String(res.semesters[0]?.id || ''),
          toSectionId: String(res.sections[0]?.id || ''),
        });
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load academic setup');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, assignForm.academicYearId, subjForm.departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/departments', { method: 'POST', body: JSON.stringify(deptForm) });
      toast.success('Department created');
      setDeptModal(false);
      setDeptForm({ code: '', name: '', hodName: '', building: '' });
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create department');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/subjects', { method: 'POST', body: JSON.stringify(subjForm) });
      toast.success('Subject added');
      setSubjectModal(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create subject');
    }
  };

  const handleAssignFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/subject-assignments', {
        method: 'POST',
        body: JSON.stringify(assignForm),
      });
      toast.success('Faculty assigned to subject');
      setAssignModal(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Assignment conflict');
    }
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/students/faculty', {
        method: 'POST',
        body: JSON.stringify(facForm),
      });
      toast.success('Faculty profile created');
      setFacultyModal(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create faculty');
    }
  };

  const handleCreateYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/academic-years', { method: 'POST', body: JSON.stringify(yearForm) });
      toast.success(`Academic Year ${yearForm.code} created without modifying history`);
      setYearModal(false);
      await refreshSession();
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create academic year');
    }
  };

  const handlePromoteCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ promotedCount: number }>('/api/academic-years/promote', {
        method: 'POST',
        body: JSON.stringify({
          fromAcademicYearId: Number(promoteForm.fromAcademicYearId),
          fromSemesterId: Number(promoteForm.fromSemesterId),
          toAcademicYearId: Number(promoteForm.toAcademicYearId),
          toSemesterId: Number(promoteForm.toSemesterId),
          toSectionId: Number(promoteForm.toSectionId),
        }),
      });
      toast.success(`Promoted ${res.promotedCount} students in transaction`);
      setPromoteModal(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Promotion failed');
    }
  };

  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialSubjectId) return;
    try {
      await apiFetch(`/api/subjects/${materialSubjectId}/materials`, {
        method: 'POST',
        body: JSON.stringify(matForm),
      });
      toast.success('Study material attached to subject');
      setMaterialSubjectId(null);
      setMatForm({ title: '', moduleLabel: 'Module 1', fileName: '' });
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to attach study material');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
            Academic &amp; Institutional Structure
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            Departments, programs, subjects, study materials, faculty allocations, and multi-year progression
          </p>
        </div>

        {/* Segmented Control */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F7F3EE] dark:bg-[#221618] rounded-2xl border border-[#E5E7EB] dark:border-[#332326]">
          {[
            { id: 'departments', label: 'Departments & Rooms' },
            { id: 'subjects', label: 'Subjects & Materials' },
            { id: 'faculty', label: 'Faculty & Allocations' },
            { id: 'years', label: 'Academic Years' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as typeof tab)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? 'bg-white dark:bg-[#120B0D] text-[#722F37] dark:text-[#D48A94] shadow-sm font-semibold'
                  : 'text-[#6B7280] dark:text-[#B5A5A8] hover:text-[#1F2937] dark:hover:text-[#FAF6F5]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {loading || !data ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-[20px] bg-[#F7F3EE] dark:bg-[#26191B] animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {tab === 'departments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                  Engineering Departments ({data.departments.length})
                </h2>
                {isAdmin && (
                  <Button size="sm" onClick={() => setDeptModal(true)}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Department
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.departments.map((d) => {
                  const deptPrograms = data.programs.filter((p) => p.departmentId === d.id);
                  return (
                    <Surface key={d.id} className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-xs font-semibold text-[#722F37] dark:text-[#D48A94]">{d.code}</p>
                          <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5] mt-0.5">
                            {d.name}
                          </h3>
                        </div>
                        <Building2 className="w-4 h-4 text-[#722F37] dark:text-[#D48A94]" />
                      </div>
                      <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-2">
                        HOD: {d.hodName || 'Assigned'} · {d.building || 'Main Academic Block'}
                      </p>
                      <div className="mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#332326] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                        Programs: {deptPrograms.map((p) => p.code).join(' · ') || 'None'}
                      </div>
                    </Surface>
                  );
                })}
              </div>

              <div>
                <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-3">
                  Classrooms &amp; Laboratories ({data.classrooms.length})
                </h2>
                <Surface className="overflow-hidden">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                        <th className="py-2.5 px-4">Room Code</th>
                        <th className="py-2.5 px-4">Building · Floor</th>
                        <th className="py-2.5 px-4">Type</th>
                        <th className="py-2.5 px-4 text-right">Capacity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                      {data.classrooms.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2.5 px-4 font-mono text-xs font-semibold">{c.roomCode}</td>
                          <td className="py-2.5 px-4 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                            {c.building} · {c.floor}
                          </td>
                          <td className="py-2.5 px-4 text-xs capitalize">{c.roomType.replace('_', ' ')}</td>
                          <td className="py-2.5 px-4 text-right font-mono tabular-nums text-xs">
                            {c.capacity} seats
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Surface>
              </div>
            </div>
          )}

          {tab === 'subjects' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                  Curriculum Subjects &amp; Study Materials ({data.subjects.length})
                </h2>
                {isAdmin && (
                  <Button size="sm" onClick={() => setSubjectModal(true)}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Subject
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {data.subjects.map((sub) => {
                  const dept = data.departments.find((d) => d.id === sub.departmentId);
                  const materials = sub.studyMaterialsJson || [];
                  return (
                    <Surface key={sub.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                            <span className="font-mono font-semibold text-[#722F37] dark:text-[#D48A94]">{sub.code}</span>
                            <span>·</span>
                            <span>{dept?.code}</span>
                            <span>·</span>
                            <span>Semester {sub.semesterNumber}</span>
                            <span>·</span>
                            <span className="font-mono tabular-nums">{sub.credits} Credits</span>
                          </div>
                          <h3 className="text-base font-semibold text-[#1F2937] dark:text-[#FAF6F5] mt-1">
                            {sub.name}
                          </h3>
                          {sub.syllabusSummary && (
                            <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-1 max-w-2xl">
                              {sub.syllabusSummary}
                            </p>
                          )}
                        </div>
                        {(isAdmin || isFaculty) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMaterialSubjectId(sub.id)}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Upload Material
                          </Button>
                        )}
                      </div>

                      {materials.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-[#E5E7EB] dark:border-[#332326] space-y-2">
                          <p className="text-xs font-medium text-[#6B7280] dark:text-[#B5A5A8]">Study Materials</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {materials.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8] dark:bg-[#170F11] text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <FileText className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94] shrink-0" />
                                  <div className="truncate">
                                    <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5] truncate">
                                      {m.title}
                                    </p>
                                    <p className="text-[#6B7280] dark:text-[#B5A5A8]">
                                      {m.moduleLabel} · {m.fileName} · {m.uploadedBy}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </Surface>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'faculty' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                  Faculty Directory ({data.faculty.length})
                </h2>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setAssignModal(true)}>
                      Assign Subject
                    </Button>
                    <Button size="sm" onClick={() => setFacultyModal(true)}>
                      <Plus className="w-3.5 h-3.5" />
                      Add Faculty
                    </Button>
                  </div>
                )}
              </div>

              <Surface className="overflow-hidden">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                      <th className="py-3 px-4">Code</th>
                      <th className="py-3 px-4">Faculty Member</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Designation</th>
                      <th className="py-3 px-4">Office</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326]">
                    {data.faculty.map((f) => {
                      const dept = data.departments.find((d) => d.id === f.departmentId);
                      return (
                        <tr key={f.id}>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-[#722F37] dark:text-[#D48A94]">{f.employeeCode}</td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{f.fullName}</p>
                            <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">{f.qualification}</p>
                          </td>
                          <td className="py-3 px-4 text-xs">{dept?.code}</td>
                          <td className="py-3 px-4 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                            {f.designation}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs">{f.officeRoom || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Surface>

              <div>
                <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-3">
                  Active Subject–Faculty Allocations ({data.subjectFacultyAssignments.length})
                </h2>
                <Surface className="overflow-hidden">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                        <th className="py-2.5 px-4">Subject</th>
                        <th className="py-2.5 px-4">Assigned Faculty</th>
                        <th className="py-2.5 px-4">Semester · Section</th>
                        <th className="py-2.5 px-4">Academic Year</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                      {data.subjectFacultyAssignments.map((a) => {
                        const subj = data.subjects.find((s) => s.id === a.subjectId);
                        const fac = data.faculty.find((f) => f.id === a.facultyId);
                        const sem = data.semesters.find((s) => s.id === a.semesterId);
                        const sec = data.sections.find((s) => s.id === a.sectionId);
                        const ay = data.academicYears.find((y) => y.id === a.academicYearId);
                        return (
                          <tr key={a.id}>
                            <td className="py-2.5 px-4 font-medium">
                              <span className="font-mono text-[#722F37] dark:text-[#D48A94] mr-2">{subj?.code}</span>
                              {subj?.name}
                            </td>
                            <td className="py-2.5 px-4">{fac?.fullName}</td>
                            <td className="py-2.5 px-4">
                              {sem?.name} · Section {sec?.name}
                            </td>
                            <td className="py-2.5 px-4 font-mono">{ay?.code}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Surface>
              </div>
            </div>
          )}

          {tab === 'years' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                    Multi-Year Academic Calendar &amp; Cohort Progression
                  </h2>
                  <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                    Historical academic years are never deleted or overwritten when creating new years.
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPromoteModal(true)}>
                      <GraduationCap className="w-3.5 h-3.5" />
                      Promote Cohort
                    </Button>
                    <Button size="sm" onClick={() => setYearModal(true)}>
                      <CalendarRange className="w-3.5 h-3.5" />
                      New Academic Year
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.academicYears.map((y) => {
                  const ySems = data.semesters.filter((s) => s.academicYearId === y.id);
                  return (
                    <Surface key={y.id} className="p-5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-base font-bold text-[#1F2937] dark:text-[#FAF6F5]">
                          {y.code}
                        </span>
                        <StatusText
                          tone={y.isCurrent ? 'success' : y.status === 'archived' ? 'neutral' : 'info'}
                        >
                          {y.isCurrent ? 'Current Active' : y.status}
                        </StatusText>
                      </div>
                      <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-1">
                        {y.startDate} to {y.endDate}
                      </p>
                      <div className="mt-4 pt-3 border-t border-[#E5E7EB] dark:border-[#332326] space-y-1">
                        {ySems.map((s) => (
                          <div key={s.id} className="flex items-center justify-between text-xs">
                            <span>{s.name}</span>
                            <span className="text-[#6B7280] dark:text-[#B5A5A8]">{s.isActive ? 'Active' : 'Closed/Planned'}</span>
                          </div>
                        ))}
                      </div>
                    </Surface>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <Modal open={deptModal} onClose={() => setDeptModal(false)} title="Create Department">
        <form onSubmit={handleCreateDept} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Code</FieldLabel>
              <Input value={deptForm.code} onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })} placeholder="AI-DS" required />
            </div>
            <div>
              <FieldLabel required>Name</FieldLabel>
              <Input value={deptForm.name} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} placeholder="Artificial Intelligence & Data Science" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>HOD Name</FieldLabel>
              <Input value={deptForm.hodName} onChange={(e) => setDeptForm({ ...deptForm, hodName: e.target.value })} />
            </div>
            <div>
              <FieldLabel>Building / Wing</FieldLabel>
              <Input value={deptForm.building} onChange={(e) => setDeptForm({ ...deptForm, building: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeptModal(false)}>Cancel</Button>
            <Button type="submit">Create Department</Button>
          </div>
        </form>
      </Modal>

      <Modal open={subjectModal} onClose={() => setSubjectModal(false)} title="Create Subject">
        <form onSubmit={handleCreateSubject} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Subject Code</FieldLabel>
              <Input value={subjForm.code} onChange={(e) => setSubjForm({ ...subjForm, code: e.target.value })} placeholder="21CS55" required />
            </div>
            <div>
              <FieldLabel required>Subject Name</FieldLabel>
              <Input value={subjForm.name} onChange={(e) => setSubjForm({ ...subjForm, name: e.target.value })} placeholder="Cloud Computing" required />
            </div>
            <div>
              <FieldLabel required>Department</FieldLabel>
              <Select value={subjForm.departmentId} onChange={(e) => setSubjForm({ ...subjForm, departmentId: e.target.value })}>
                {data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Semester Number</FieldLabel>
              <Input type="number" min={1} max={8} value={subjForm.semesterNumber} onChange={(e) => setSubjForm({ ...subjForm, semesterNumber: e.target.value })} required />
            </div>
          </div>
          <div>
            <FieldLabel>Syllabus Summary</FieldLabel>
            <Textarea rows={2} value={subjForm.syllabusSummary} onChange={(e) => setSubjForm({ ...subjForm, syllabusSummary: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSubjectModal(false)}>Cancel</Button>
            <Button type="submit">Create Subject</Button>
          </div>
        </form>
      </Modal>

      <Modal open={assignModal} onClose={() => setAssignModal(false)} title="Assign Faculty to Subject">
        <form onSubmit={handleAssignFaculty} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Subject</FieldLabel>
              <Select value={assignForm.subjectId} onChange={(e) => setAssignForm({ ...assignForm, subjectId: e.target.value })}>
                {data?.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Faculty</FieldLabel>
              <Select value={assignForm.facultyId} onChange={(e) => setAssignForm({ ...assignForm, facultyId: e.target.value })}>
                {data?.faculty.map((f) => <option key={f.id} value={f.id}>{f.fullName} ({f.employeeCode})</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Academic Year</FieldLabel>
              <Select value={assignForm.academicYearId} onChange={(e) => setAssignForm({ ...assignForm, academicYearId: e.target.value })}>
                {data?.academicYears.map((y) => <option key={y.id} value={y.id}>{y.code}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Semester</FieldLabel>
              <Select value={assignForm.semesterId} onChange={(e) => setAssignForm({ ...assignForm, semesterId: e.target.value })}>
                {data?.semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel required>Section</FieldLabel>
              <Select value={assignForm.sectionId} onChange={(e) => setAssignForm({ ...assignForm, sectionId: e.target.value })}>
                {data?.sections.map((s) => <option key={s.id} value={s.id}>Section {s.name} (Sem ID {s.semesterId})</option>)}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setAssignModal(false)}>Cancel</Button>
            <Button type="submit">Assign Subject</Button>
          </div>
        </form>
      </Modal>

      <Modal open={facultyModal} onClose={() => setFacultyModal(false)} title="Add Faculty Member">
        <form onSubmit={handleCreateFaculty} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Full Name</FieldLabel>
              <Input value={facForm.fullName} onChange={(e) => setFacForm({ ...facForm, fullName: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Employee Code</FieldLabel>
              <Input value={facForm.employeeCode} onChange={(e) => setFacForm({ ...facForm, employeeCode: e.target.value })} placeholder="FAC-CSE-030" required />
            </div>
            <div>
              <FieldLabel required>Email</FieldLabel>
              <Input type="email" value={facForm.email} onChange={(e) => setFacForm({ ...facForm, email: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Department</FieldLabel>
              <Select value={facForm.departmentId} onChange={(e) => setFacForm({ ...facForm, departmentId: e.target.value })}>
                {data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Designation</FieldLabel>
              <Input value={facForm.designation} onChange={(e) => setFacForm({ ...facForm, designation: e.target.value })} required />
            </div>
            <div>
              <FieldLabel>Office Room</FieldLabel>
              <Input value={facForm.officeRoom} onChange={(e) => setFacForm({ ...facForm, officeRoom: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFacultyModal(false)}>Cancel</Button>
            <Button type="submit">Create Faculty</Button>
          </div>
        </form>
      </Modal>

      <Modal open={yearModal} onClose={() => setYearModal(false)} title="Create Academic Year" subtitle="Preserves all previous-year enrollments, attendance, exam marks, and fee ledgers.">
        <form onSubmit={handleCreateYear} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Year Code</FieldLabel>
              <Input value={yearForm.code} onChange={(e) => setYearForm({ ...yearForm, code: e.target.value })} placeholder="2028-29" required />
            </div>
            <div>
              <FieldLabel required>Label</FieldLabel>
              <Input value={yearForm.label} onChange={(e) => setYearForm({ ...yearForm, label: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Start Date</FieldLabel>
              <Input type="date" value={yearForm.startDate} onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>End Date</FieldLabel>
              <Input type="date" value={yearForm.endDate} onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setYearModal(false)}>Cancel</Button>
            <Button type="submit">Create Academic Year</Button>
          </div>
        </form>
      </Modal>

      <Modal open={promoteModal} onClose={() => setPromoteModal(false)} title="Transactional Cohort Promotion" subtitle="Promotes enrolled students to the next semester/academic year without overwriting historical records.">
        <form onSubmit={handlePromoteCohort} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>From Academic Year</FieldLabel>
              <Select value={promoteForm.fromAcademicYearId} onChange={(e) => setPromoteForm({ ...promoteForm, fromAcademicYearId: e.target.value })}>
                {data?.academicYears.map((y) => <option key={y.id} value={y.id}>{y.code}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>From Semester</FieldLabel>
              <Select value={promoteForm.fromSemesterId} onChange={(e) => setPromoteForm({ ...promoteForm, fromSemesterId: e.target.value })}>
                {data?.semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>To Academic Year</FieldLabel>
              <Select value={promoteForm.toAcademicYearId} onChange={(e) => setPromoteForm({ ...promoteForm, toAcademicYearId: e.target.value })}>
                {data?.academicYears.map((y) => <option key={y.id} value={y.id}>{y.code}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>To Semester</FieldLabel>
              <Select value={promoteForm.toSemesterId} onChange={(e) => setPromoteForm({ ...promoteForm, toSemesterId: e.target.value })}>
                {data?.semesters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="col-span-2">
              <FieldLabel required>Target Section</FieldLabel>
              <Select value={promoteForm.toSectionId} onChange={(e) => setPromoteForm({ ...promoteForm, toSectionId: e.target.value })}>
                {data?.sections.map((s) => <option key={s.id} value={s.id}>Section {s.name} (Sem ID {s.semesterId})</option>)}
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPromoteModal(false)}>Cancel</Button>
            <Button type="submit">Execute Promotion</Button>
          </div>
        </form>
      </Modal>

      <Modal open={materialSubjectId !== null} onClose={() => setMaterialSubjectId(null)} title="Upload Study Material">
        <form onSubmit={handleAddMaterial} className="space-y-4">
          <div>
            <FieldLabel required>Document Title</FieldLabel>
            <Input value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} placeholder="e.g. Module 3: Query Optimization Slides" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Module Label</FieldLabel>
              <Input value={matForm.moduleLabel} onChange={(e) => setMatForm({ ...matForm, moduleLabel: e.target.value })} />
            </div>
            <div>
              <FieldLabel required>File Name</FieldLabel>
              <Input value={matForm.fileName} onChange={(e) => setMatForm({ ...matForm, fileName: e.target.value })} placeholder="DBMS_Module3.pdf" required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setMaterialSubjectId(null)}>Cancel</Button>
            <Button type="submit">Publish Material</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
