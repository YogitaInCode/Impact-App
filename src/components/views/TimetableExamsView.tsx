import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Download, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { downloadTablePDF } from '../../lib/utils';
import { Button, FieldLabel, Input, Modal, Select, StatusText, Surface } from '../ui/primitives';

import { ExamsLifecyclePanel } from './ExamsLifecyclePanel';

const DAYS = [
  { id: 1, label: 'Monday' },
  { id: 2, label: 'Tuesday' },
  { id: 3, label: 'Wednesday' },
  { id: 4, label: 'Thursday' },
  { id: 5, label: 'Friday' },
  { id: 6, label: 'Saturday' },
];

export const TimetableExamsView: React.FC<{ initialTab?: 'timetable' | 'exams' }> = ({
  initialTab = 'timetable',
}) => {
  const { effectiveProfile, selectedAcademicYearId, apiFetch } = useAuth();
  const isAdmin = effectiveProfile?.role === 'super_admin';
  const isStaff = isAdmin || effectiveProfile?.role === 'faculty';

  const [tab, setTab] = useState<'timetable' | 'exams'>(initialTab);
  const [timetables, setTimetables] = useState<{ id: number; title: string; effectiveFrom: string }[]>([]);
  const [slots, setSlots] = useState<
    {
      id: number;
      timetableId: number;
      subjectCode: string;
      subjectName: string;
      facultyId: number;
      facultyName: string;
      roomCode: string;
      dayOfWeek: number;
      periodNumber: number;
      startTime: string;
      endTime: string;
      slotType: string;
    }[]
  >([]);
  const [exams, setExams] = useState<
    {
      id: number;
      examName: string;
      examType: string;
      subjectCode: string;
      subjectName: string;
      examDate: string;
      startTime: string;
      endTime: string;
      maxMarks: number;
      passingMarks: number;
      roomCode: string | null;
      academicYearCode: string;
    }[]
  >([]);
  const [results, setResults] = useState<
    {
      id: number;
      examinationId: number;
      examName: string;
      subjectCode: string;
      subjectName: string;
      academicYearCode: string;
      semesterName: string;
      usn: string;
      studentName: string;
      marksObtained: string;
      maxMarks: number;
      grade: string;
      gradePoints: string;
      status: string;
      remarks: string | null;
    }[]
  >([]);
  const [refData, setRefData] = useState<{
    departments: { id: number; name: string }[];
    programs: { id: number; code: string; name: string }[];
    semesters: { id: number; academicYearId: number; number: number; name: string }[];
    subjects: { id: number; code: string; name: string }[];
    faculty: { id: number; fullName: string }[];
    classrooms: { id: number; roomCode: string }[];
    students: { id: number; usn: string; fullName: string }[];
  } | null>(null);

  const [slotModal, setSlotModal] = useState(false);
  const [examModal, setExamModal] = useState(false);
  const [resultModal, setResultModal] = useState(false);

  const [slotForm, setSlotForm] = useState({
    timetableId: '',
    subjectId: '',
    facultyId: '',
    classroomId: '',
    dayOfWeek: '1',
    periodNumber: '4',
    startTime: '12:15',
    endTime: '13:15',
    slotType: 'lecture',
  });

  const [examForm, setExamForm] = useState({
    departmentId: '',
    semesterId: '',
    subjectId: '',
    examName: '',
    examType: 'ia_2',
    examDate: '2026-12-02',
    startTime: '09:30',
    endTime: '11:00',
    maxMarks: '50',
    passingMarks: '20',
    classroomId: '',
  });

  const [resultForm, setResultForm] = useState({
    examinationId: '',
    studentId: '',
    marksObtained: '42',
    remarks: '',
  });

  const load = useCallback(async () => {
    try {
      const yq = selectedAcademicYearId ? `?academicYearId=${selectedAcademicYearId}` : '';
      const [ttRes, exRes, refRes, stuRes] = await Promise.all([
        apiFetch<{ timetables: typeof timetables; slots: typeof slots }>(`/api/timetables${yq}`),
        apiFetch<{ examinations: typeof exams; results: typeof results }>('/api/examinations'),
        apiFetch<{
          departments: { id: number; name: string }[];
          programs: { id: number; code: string; name: string }[];
          semesters: { id: number; academicYearId: number; number: number; name: string }[];
          subjects: { id: number; code: string; name: string }[];
          faculty: { id: number; fullName: string }[];
          classrooms: { id: number; roomCode: string }[];
        }>('/api/reference-data'),
        apiFetch<{ students: { id: number; usn: string; fullName: string }[] }>('/api/students'),
      ]);

      setTimetables(ttRes.timetables);
      setSlots(ttRes.slots);
      setExams(exRes.examinations);
      setResults(exRes.results);
      setRefData({ ...refRes, students: stuRes.students });

      if (ttRes.timetables.length > 0 && !slotForm.timetableId) {
        setSlotForm((p) => ({
          ...p,
          timetableId: String(ttRes.timetables[0].id),
          subjectId: String(refRes.subjects[0]?.id || ''),
          facultyId: String(refRes.faculty[0]?.id || ''),
          classroomId: String(refRes.classrooms[0]?.id || ''),
        }));
      }
      if (!examForm.departmentId && refRes.departments.length > 0) {
        setExamForm((p) => ({
          ...p,
          departmentId: String(refRes.departments[0].id),
          semesterId: String(refRes.semesters.find((s) => s.name.includes('5'))?.id || refRes.semesters[0]?.id || ''),
          subjectId: String(refRes.subjects[0]?.id || ''),
          classroomId: String(refRes.classrooms[0]?.id || ''),
        }));
      }
      if (!resultForm.examinationId && exRes.examinations.length > 0) {
        setResultForm((p) => ({
          ...p,
          examinationId: String(exRes.examinations[0].id),
          studentId: String(stuRes.students[0]?.id || ''),
        }));
      }
    } catch (err) {
      console.error('Failed loading timetables/exams:', err);
    }
  }, [apiFetch, examForm.departmentId, resultForm.examinationId, selectedAcademicYearId, slotForm.timetableId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/timetables/slots', {
        method: 'POST',
        body: JSON.stringify(slotForm),
      });
      toast.success('Timetable slot added without conflicts');
      setSlotModal(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Timetable conflict detected');
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/examinations', {
        method: 'POST',
        body: JSON.stringify({ ...examForm, academicYearId: selectedAcademicYearId }),
      });
      toast.success('Examination scheduled');
      setExamModal(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule exam');
    }
  };

  const handlePublishResult = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/examination-results', {
        method: 'POST',
        body: JSON.stringify(resultForm),
      });
      toast.success('Examination result published');
      setResultModal(false);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish result');
    }
  };

  const visibleSlots =
    effectiveProfile?.role === 'faculty' && effectiveProfile.facultyId
      ? slots.filter((s) => s.facultyId === effectiveProfile.facultyId)
      : slots;

  const handleDownloadTranscript = () => {
    downloadTablePDF({
      title: 'Academic Examination Grade Sheet',
      subtitle: `${effectiveProfile?.fullName} · ${results.length} Recorded Assessments`,
      headers: ['Year', 'Subject', 'Examination', 'Marks', 'Grade', 'Status'],
      rows: results.map((r) => [
        r.academicYearCode,
        `${r.subjectCode} ${r.subjectName}`,
        r.examName,
        `${r.marksObtained}/${r.maxMarks}`,
        r.grade,
        r.status.toUpperCase(),
      ]),
      filename: 'impact_campus_academic_records.pdf',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#1F2937] dark:text-[#FAF6F5]">
            Timetable &amp; Examination Records
          </h1>
          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
            Conflict-checked weekly schedule (offline cached) and multi-year examination gradebooks
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 bg-[#F7F3EE] dark:bg-[#221618] rounded-2xl border border-[#E5E7EB] dark:border-[#332326]">
          <button
            type="button"
            onClick={() => setTab('timetable')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl cursor-pointer transition-all ${
              tab === 'timetable'
                ? 'bg-white dark:bg-[#120B0D] text-[#722F37] dark:text-[#D48A94] shadow-sm font-semibold'
                : 'text-[#6B7280] dark:text-[#B5A5A8]'
            }`}
          >
            Weekly Timetable
          </button>
          <button
            type="button"
            onClick={() => setTab('exams')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-xl cursor-pointer transition-all ${
              tab === 'exams'
                ? 'bg-white dark:bg-[#120B0D] text-[#722F37] dark:text-[#D48A94] shadow-sm font-semibold'
                : 'text-[#6B7280] dark:text-[#B5A5A8]'
            }`}
          >
            Examinations &amp; Results
          </button>
        </div>
      </div>

      {tab === 'timetable' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8]">
              {timetables[0]?.title || 'Class Weekly Timetable'} · {visibleSlots.length} scheduled periods
            </p>
            {isAdmin && (
              <Button size="sm" onClick={() => setSlotModal(true)}>
                <Plus className="w-3.5 h-3.5" />
                Add Conflict-Checked Slot
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DAYS.map((day) => {
              const daySlots = visibleSlots
                .filter((s) => s.dayOfWeek === day.id)
                .sort((a, b) => a.periodNumber - b.periodNumber);

              return (
                <Surface key={day.id} className="p-4">
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-[#E5E7EB] dark:border-[#332326]">
                    <span className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
                      {day.label}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-[#722F37] dark:text-[#D48A94]" />
                  </div>
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] py-4">No scheduled lectures</p>
                  ) : (
                    <div className="space-y-2.5">
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="p-3 rounded-2xl border border-[#E5E7EB] dark:border-[#332326] bg-[#FCFAF8] dark:bg-[#170F11]"
                        >
                          <div className="flex items-center justify-between text-xs font-mono">
                            <span className="text-[#722F37] dark:text-[#D48A94] font-semibold">
                              P{slot.periodNumber} · {slot.startTime}–{slot.endTime}
                            </span>
                            <span className="text-[#6B7280] dark:text-[#B5A5A8]">{slot.roomCode}</span>
                          </div>
                          <p className="text-sm font-medium text-[#1F2937] dark:text-[#FAF6F5] mt-1">
                            {slot.subjectCode} · {slot.subjectName}
                          </p>
                          <p className="text-xs text-[#6B7280] dark:text-[#B5A5A8] mt-0.5">
                            {slot.facultyName} · {slot.slotType}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'exams' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5]">
              Examination Schedule ({exams.length})
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleDownloadTranscript}>
                <Download className="w-3.5 h-3.5" />
                Download Academic Records PDF
              </Button>
              {isStaff && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setExamModal(true)}>
                    Schedule Exam
                  </Button>
                  <Button size="sm" onClick={() => setResultModal(true)}>
                    Publish Marks
                  </Button>
                </>
              )}
            </div>
          </div>

          <Surface className="overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                  <th className="py-2.5 px-4">Date &amp; Time</th>
                  <th className="py-2.5 px-4">Examination</th>
                  <th className="py-2.5 px-4">Subject</th>
                  <th className="py-2.5 px-4">Room</th>
                  <th className="py-2.5 px-4 text-right">Max / Pass</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                {exams.map((ex) => (
                  <tr key={ex.id}>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      {ex.examDate} · {ex.startTime}–{ex.endTime}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#1F2937] dark:text-[#FAF6F5]">
                      {ex.examName} ({ex.academicYearCode})
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[#722F37] dark:text-[#D48A94] mr-1.5">{ex.subjectCode}</span>
                      {ex.subjectName}
                    </td>
                    <td className="py-3 px-4 font-mono">{ex.roomCode || 'TBA'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {ex.maxMarks} / {ex.passingMarks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>

          <div>
            <h2 className="text-sm font-semibold text-[#1F2937] dark:text-[#FAF6F5] mb-3">
              Published Examination Results ({results.length})
            </h2>
            <Surface className="overflow-hidden">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#E5E7EB] dark:border-[#332326] bg-[#F7F3EE] dark:bg-[#221618] text-xs text-[#6B7280] dark:text-[#B5A5A8]">
                    <th className="py-2.5 px-4">USN · Student</th>
                    <th className="py-2.5 px-4">Year · Exam</th>
                    <th className="py-2.5 px-4">Subject</th>
                    <th className="py-2.5 px-4 text-right">Marks</th>
                    <th className="py-2.5 px-4 text-right">Grade</th>
                    <th className="py-2.5 px-4">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] dark:divide-[#332326] text-xs">
                  {results.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 px-4">
                        <span className="font-mono font-semibold mr-2 text-[#722F37] dark:text-[#D48A94]">{r.usn}</span>
                        <span>{r.studentName}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono mr-1.5">{r.academicYearCode}</span>· {r.examName}
                      </td>
                      <td className="py-3 px-4">
                        {r.subjectCode} · {r.subjectName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {r.marksObtained} / {r.maxMarks}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold">{r.grade}</td>
                      <td className="py-3 px-4">
                        <StatusText tone={r.status === 'pass' ? 'success' : 'danger'}>
                          {r.status.toUpperCase()}
                        </StatusText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Surface>
          </div>

          <ExamsLifecyclePanel refData={refData} />
        </div>
      )}

      {/* Add Timetable Slot Modal */}
      <Modal open={slotModal} onClose={() => setSlotModal(false)} title="Add Timetable Slot" subtitle="Automatically blocks faculty or classroom double-booking.">
        <form onSubmit={handleAddSlot} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Subject</FieldLabel>
              <Select value={slotForm.subjectId} onChange={(e) => setSlotForm({ ...slotForm, subjectId: e.target.value })}>
                {refData?.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Faculty</FieldLabel>
              <Select value={slotForm.facultyId} onChange={(e) => setSlotForm({ ...slotForm, facultyId: e.target.value })}>
                {refData?.faculty.map((f) => <option key={f.id} value={f.id}>{f.fullName}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Day of Week</FieldLabel>
              <Select value={slotForm.dayOfWeek} onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: e.target.value })}>
                {DAYS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Period Number</FieldLabel>
              <Input type="number" min={1} max={7} value={slotForm.periodNumber} onChange={(e) => setSlotForm({ ...slotForm, periodNumber: e.target.value })} required />
            </div>
            <div>
              <FieldLabel required>Classroom</FieldLabel>
              <Select value={slotForm.classroomId} onChange={(e) => setSlotForm({ ...slotForm, classroomId: e.target.value })}>
                {refData?.classrooms.map((c) => <option key={c.id} value={c.id}>{c.roomCode}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Timing</FieldLabel>
              <div className="flex gap-2">
                <Input value={slotForm.startTime} onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })} />
                <Input value={slotForm.endTime} onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSlotModal(false)}>Cancel</Button>
            <Button type="submit">Add Slot</Button>
          </div>
        </form>
      </Modal>

      <Modal open={examModal} onClose={() => setExamModal(false)} title="Schedule Examination">
        <form onSubmit={handleCreateExam} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FieldLabel required>Examination Name</FieldLabel>
              <Input value={examForm.examName} onChange={(e) => setExamForm({ ...examForm, examName: e.target.value })} placeholder="Internal Assessment 2 (21CS53)" required />
            </div>
            <div>
              <FieldLabel required>Subject</FieldLabel>
              <Select value={examForm.subjectId} onChange={(e) => setExamForm({ ...examForm, subjectId: e.target.value })}>
                {refData?.subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Date</FieldLabel>
              <Input type="date" value={examForm.examDate} onChange={(e) => setExamForm({ ...examForm, examDate: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setExamModal(false)}>Cancel</Button>
            <Button type="submit">Schedule Exam</Button>
          </div>
        </form>
      </Modal>

      <Modal open={resultModal} onClose={() => setResultModal(false)} title="Publish Examination Marks">
        <form onSubmit={handlePublishResult} className="space-y-4">
          <div>
            <FieldLabel required>Examination</FieldLabel>
            <Select value={resultForm.examinationId} onChange={(e) => setResultForm({ ...resultForm, examinationId: e.target.value })}>
              {exams.map((ex) => <option key={ex.id} value={ex.id}>{ex.examName} ({ex.subjectCode})</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel required>Student</FieldLabel>
              <Select value={resultForm.studentId} onChange={(e) => setResultForm({ ...resultForm, studentId: e.target.value })}>
                {refData?.students.map((s) => <option key={s.id} value={s.id}>{s.usn} · {s.fullName}</option>)}
              </Select>
            </div>
            <div>
              <FieldLabel required>Marks Obtained</FieldLabel>
              <Input type="number" step="0.5" value={resultForm.marksObtained} onChange={(e) => setResultForm({ ...resultForm, marksObtained: e.target.value })} required />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setResultModal(false)}>Cancel</Button>
            <Button type="submit">Save Result</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
