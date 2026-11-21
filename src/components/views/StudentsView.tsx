import React, { useCallback, useEffect, useState } from 'react';
import { Download, Eye, FileSpreadsheet, Plus, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { downloadCSV, downloadTablePDF } from '../../lib/utils';
import {
  Button,
  EmptyState,
  FieldLabel,
  Input,
  Modal,
  Select,
  StatusText,
  Surface,
  Textarea,
} from '../ui/primitives';
import { Student360Data, Student360Panel } from './Student360Panel';

interface StudentRow {
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
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  programId: number;
  programCode: string;
  academicStatus: string;
  biometricEnrolled: boolean;
  currentEnrollment: {
    academicYearCode: string;
    semesterId: number;
    semesterName: string;
    sectionName: string;
    rollNumber: string | null;
  } | null;
}

interface RefData {
  academicYears: { id: number; code: string; label: string; isCurrent: boolean }[];
  semesters: { id: number; academicYearId: number; number: number; name: string }[];
  departments: { id: number; code: string; name: string }[];
  programs: { id: number; departmentId: number; code: string; name: string }[];
  sections: { id: number; departmentId: number; programId: number; academicYearId: number; semesterId: number; name: string }[];
}

export const StudentsView: React.FC = () => {
  const { effectiveProfile, selectedAcademicYearId, apiFetch } = useAuth();
  const isAdmin = effectiveProfile?.role === 'super_admin';
  const isSelfOrParent =
    effectiveProfile?.role === 'student' || effectiveProfile?.role === 'parent';

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [refData, setRefData] = useState<RefData | null>(null);
  const [loading, setLoading] = useState(true);
  const [inlineDetail, setInlineDetail] = useState<Student360Data | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [semFilter, setSemFilter] = useState('');

  // Modals
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detailStudentId, setDetailStudentId] = useState<number | null>(null);
  const [detailData, setDetailData] = useState<Student360Data | null>(null);

  // Add Form State
  const [form, setForm] = useState({
    fullName: '',
    usn: '',
    admissionNumber: '',
    email: '',
    phone: '',
    dateOfBirth: '2005-06-15',
    gender: 'Female',
    address: 'Bengaluru, Karnataka',
    emergencyContactName: '',
    emergencyContactPhone: '',
    departmentId: '',
    programId: '',
    semesterId: '',
    sectionId: '',
  });
  const [csvText, setCsvText] = useState(
    '1IC23CS091,ADM-2023-091,Meera Krishnan,meera.k@impactcampus.edu.in,+91 99001 88101,2005-03-12\n1IC23CS092,ADM-2023-092,Siddharth Rao,siddharth.r@impactcampus.edu.in,+91 99001 88102,2005-07-24'
  );
  const [submitting, setSubmitting] = useState(false);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (deptFilter) params.set('departmentId', deptFilter);
      if (semFilter) params.set('semesterId', semFilter);
      if (selectedAcademicYearId) params.set('academicYearId', String(selectedAcademicYearId));

      const [stuRes, refRes] = await Promise.all([
        apiFetch<{ students: StudentRow[] }>(`/api/students?${params.toString()}`),
        apiFetch<RefData>('/api/reference-data'),
      ]);
      setStudents(stuRes.students);
      setRefData(refRes);

      if (isSelfOrParent && stuRes.students.length >= 1) {
        const d = await apiFetch<Student360Data>(`/api/students/${stuRes.students[0].id}`);
        setInlineDetail(d);
      } else {
        setInlineDetail(null);
      }

      if (!form.departmentId && refRes.departments.length > 0) {
        const d0 = refRes.departments[0];
        const p0 = refRes.programs.find((p) => p.departmentId === d0.id) || refRes.programs[0];
        const s0 = refRes.semesters.find((s) => s.academicYearId === selectedAcademicYearId) || refRes.semesters[0];
        const sec0 = refRes.sections.find((sec) => sec.semesterId === s0?.id) || refRes.sections[0];
        setForm((prev) => ({
          ...prev,
          departmentId: String(d0.id),
          programId: String(p0?.id || ''),
          semesterId: String(s0?.id || ''),
          sectionId: String(sec0?.id || ''),
        }));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, deptFilter, form.departmentId, isSelfOrParent, searchQuery, selectedAcademicYearId, semFilter]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const openStudentDetail = async (id: number) => {
    setDetailStudentId(id);
    setDetailData(null);
    try {
      const data = await apiFetch<Student360Data>(`/api/students/${id}`);
      setDetailData(data);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch student profile');
      setDetailStudentId(null);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/students', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          academicYearId: selectedAcademicYearId,
          admissionYear: 2026,
        }),
      });
      toast.success(`Created student ${form.usn.toUpperCase()}`);
      setAddOpen(false);
      setForm((p) => ({ ...p, fullName: '', usn: '', admissionNumber: '', email: '', phone: '' }));
      await loadStudents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create student');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const rows = csvText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [usn, admissionNumber, fullName, email, phone, dateOfBirth] = line
            .split(',')
            .map((c) => c.trim());
          return { usn, admissionNumber, fullName, email, phone, dateOfBirth };
        });

      const res = await apiFetch<{ imported: number; skipped: { usn: string; reason: string }[] }>(
        '/api/students/bulk-import',
        {
          method: 'POST',
          body: JSON.stringify({
            rows,
            academicYearId: selectedAcademicYearId,
            semesterId: Number(form.semesterId),
            sectionId: Number(form.sectionId),
            departmentId: Number(form.departmentId),
            programId: Number(form.programId),
          }),
        }
      );

      toast.success(`Imported ${res.imported} students (${res.skipped.length} skipped)`);
      setImportOpen(false);
      await loadStudents();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Bulk import failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    downloadCSV(
      'impact_campus_students.csv',
      ['USN', 'Admission No', 'Full Name', 'Department', 'Program', 'Semester', 'Section', 'Email', 'Phone', 'Status'],
      students.map((s) => [
        s.usn,
        s.admissionNumber,
        s.fullName,
        s.departmentCode,
        s.programCode,
        s.currentEnrollment?.semesterName || '—',
        s.currentEnrollment?.sectionName || '—',
        s.email,
        s.phone,
        s.academicStatus,
      ])
    );
  };

  const handleExportPDF = () => {
    downloadTablePDF({
      title: 'Student Master Roster',
      subtitle: `Total Records: ${students.length}`,
      headers: ['USN', 'Name', 'Dept', 'Semester', 'Email', 'Status'],
      rows: students.map((s) => [
        s.usn,
        s.fullName,
        s.departmentCode,
        s.currentEnrollment?.semesterName || '—',
        s.email,
        s.academicStatus,
      ]),
      filename: 'impact_campus_students.pdf',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
            Student Master Database &amp; 360° Lifecycle
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            Permanent non-duplicable USN records with complete 17-section academic &amp; campus lifecycle history
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </Button>
          {isAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="w-3.5 h-3.5" />
                Bulk CSV Import
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add Student
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters Bar (Hidden for single-student self/parent view) */}
      {!(isSelfOrParent && students.length <= 1) && (
        <Surface className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-[#6B7280] absolute left-3 top-2.5" />
              <Input
                className="pl-9"
                placeholder="Search by USN, Name, Admission Number, or Email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="">All Departments</option>
                {refData?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} · {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-3">
              <Select value={semFilter} onChange={(e) => setSemFilter(e.target.value)}>
                <option value="">All Semesters</option>
                {refData?.semesters
                  .filter((s) => !selectedAcademicYearId || s.academicYearId === selectedAcademicYearId)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </Select>
            </div>
          </div>
        </Surface>
      )}

      {/* Inline 17-Section 360° Profile for Student / Parent */}
      {isSelfOrParent && inlineDetail && (
        <Surface className="p-6">
          <Student360Panel
            data={inlineDetail}
            onRefresh={async () => {
              const refreshed = await apiFetch<Student360Data>(
                `/api/students/${inlineDetail.student.id}`
              );
              setInlineDetail(refreshed);
            }}
          />
        </Surface>
      )}

      {/* Roster Table */}
      {!(isSelfOrParent && students.length <= 1) && (
        <Surface className="overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-[#F7F3EE] dark:bg-[#26191B] animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No matching student records"
                description="Adjust your department, semester, or search filters, or enroll a new student."
                action={
                  isAdmin ? (
                    <Button size="sm" onClick={() => setAddOpen(true)}>
                      Add First Student
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs font-medium text-[#6B7280] dark:text-[#B5A5A8]">
                    <th className="py-3 px-4">USN</th>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Department · Program</th>
                    <th className="py-3 px-4">Enrollment</th>
                    <th className="py-3 px-4">Biometric Consent</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Profile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-sm">
                  {students.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-[#FCFAF8] dark:hover:bg-[#26191B]/60 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-[#722F37] dark:text-[#D48A94]">
                        {s.usn}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-medium text-[#1F2937] dark:text-[#FAF6F5]">{s.fullName}</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">{s.email}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                        {s.departmentCode} · {s.programCode}
                      </td>
                      <td className="py-3 px-4 text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                        {s.currentEnrollment
                          ? `${s.currentEnrollment.semesterName} · Sec ${s.currentEnrollment.sectionName}`
                          : 'Unassigned'}
                      </td>
                      <td className="py-3 px-4">
                        {s.biometricEnrolled ? (
                          <StatusText tone="info">Consented</StatusText>
                        ) : (
                          <StatusText tone="neutral">Not Enrolled</StatusText>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText tone={s.academicStatus === 'active' ? 'success' : 'warning'}>
                          {s.academicStatus === 'active' ? 'Active' : s.academicStatus}
                        </StatusText>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openStudentDetail(s.id)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          360° Record
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      )}

      {/* Add Student Modal */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Enroll New Student"
        subtitle="Creates permanent profile, USN record, and initial academic year enrollment in a single transaction."
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateStudent} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Full Name</FieldLabel>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="e.g. Aditya Deshpande"
                required
              />
            </div>
            <div>
              <FieldLabel required>University Seat Number (USN)</FieldLabel>
              <Input
                value={form.usn}
                onChange={(e) => setForm({ ...form, usn: e.target.value })}
                placeholder="e.g. 1IC24CS012"
                required
              />
            </div>
            <div>
              <FieldLabel required>Admission Number</FieldLabel>
              <Input
                value={form.admissionNumber}
                onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })}
                placeholder="e.g. ADM-2024-088"
                required
              />
            </div>
            <div>
              <FieldLabel required>Email</FieldLabel>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="aditya@impactcampus.edu.in"
                required
              />
            </div>
            <div>
              <FieldLabel required>Phone</FieldLabel>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+91 99001 00000"
                required
              />
            </div>
            <div>
              <FieldLabel required>Date of Birth</FieldLabel>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                required
              />
            </div>
            <div>
              <FieldLabel required>Department</FieldLabel>
              <Select
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
              >
                {refData?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel required>Program</FieldLabel>
              <Select
                value={form.programId}
                onChange={(e) => setForm({ ...form, programId: e.target.value })}
              >
                {refData?.programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel required>Semester</FieldLabel>
              <Select
                value={form.semesterId}
                onChange={(e) => setForm({ ...form, semesterId: e.target.value })}
              >
                {refData?.semesters.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel required>Section</FieldLabel>
              <Select
                value={form.sectionId}
                onChange={(e) => setForm({ ...form, sectionId: e.target.value })}
              >
                {refData?.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    Section {sec.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <FieldLabel>Residential Address</FieldLabel>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Create Student Record'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk CSV Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Bulk CSV Student Import"
        subtitle="Paste comma-separated rows: USN, AdmissionNumber, FullName, Email, Phone, DOB(YYYY-MM-DD)"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleBulkImport} className="space-y-4">
          <Textarea
            rows={6}
            className="font-mono text-xs"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Importing...' : 'Run Transactional Import'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Student 360° Record Modal */}
      <Modal
        open={detailStudentId !== null}
        onClose={() => setDetailStudentId(null)}
        title={detailData ? `${detailData.student.fullName} · ${detailData.student.usn}` : 'Loading Student 360° Record...'}
        subtitle={
          detailData
            ? `${detailData.student.departmentName} · Adm No: ${detailData.student.admissionNumber}`
            : undefined
        }
        maxWidth="max-w-5xl"
      >
        {!detailData ? (
          <div className="py-10 text-center text-xs text-[#6B7280] dark:text-[#B5A5A8]">
            Loading 17-section permanent student lifecycle record...
          </div>
        ) : (
          <Student360Panel
            data={detailData}
            onRefresh={async () => {
              const refreshed = await apiFetch<Student360Data>(
                `/api/students/${detailData.student.id}`
              );
              setDetailData(refreshed);
            }}
          />
        )}
      </Modal>
    </div>
  );
};
