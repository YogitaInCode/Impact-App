import crypto from 'node:crypto';
import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  academicYears,
  announcements,
  attendanceCorrections,
  attendancePolicies,
  attendanceRecords,
  attendanceSessions,
  attendanceVerificationLogs,
  auditLogs,
  classrooms,
  consentRecords,
  courses,
  departments,
  examinationResults,
  examinations,
  faculty,
  feePayments,
  feeStructures,
  institutions,
  notificationPreferences,
  notifications,
  parents,
  paymentTransactions,
  profiles,
  programs,
  rolePermissions,
  scholarships,
  sections,
  semesters,
  studentEnrollments,
  studentFeeAssignments,
  studentParentLinks,
  students,
  subjectFacultyAssignments,
  subjects,
  systemSettings,
  timetableSlots,
  timetables,
} from './schema.ts';
import { ensureExtendedSeedData } from './seedExtended.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeedData(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      await runSeedIfEmpty();
      await ensureExtendedSeedData();
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeedIfEmpty(): Promise<void> {
  const existingInst = await db.select({ total: count() }).from(institutions);
  if ((existingInst[0]?.total ?? 0) > 0) {
    return;
  }

  await db.transaction(async (tx) => {
    // Re-check inside transaction
    const check = await tx.select({ total: count() }).from(institutions);
    if ((check[0]?.total ?? 0) > 0) return;

    // 1. Institution
    const [inst] = await tx
      .insert(institutions)
      .values({
        code: 'ICEAS-BLR',
        name: 'Impact College of Engineering and Applied Sciences',
        shortName: 'IMPACT CAMPUS',
        address: 'Impact Campus, Sahakaranagar South, Kodigehalli',
        city: 'Bengaluru',
        state: 'Karnataka',
        affiliation: 'Visvesvaraya Technological University (VTU), Belagavi · AICTE Approved',
        website: 'https://impactcampus.edu.in',
      })
      .returning();

    // 2. Academic Years (2025-26 historical, 2026-27 current, 2027-28 upcoming)
    const [ay2526, ay2627, ay2728] = await tx
      .insert(academicYears)
      .values([
        {
          institutionId: inst.id,
          code: '2025-26',
          label: 'Academic Year 2025–26',
          startDate: '2025-08-01',
          endDate: '2026-06-30',
          isCurrent: false,
          status: 'archived',
        },
        {
          institutionId: inst.id,
          code: '2026-27',
          label: 'Academic Year 2026–27',
          startDate: '2026-08-01',
          endDate: '2027-06-30',
          isCurrent: true,
          status: 'active',
        },
        {
          institutionId: inst.id,
          code: '2027-28',
          label: 'Academic Year 2027–28',
          startDate: '2027-08-01',
          endDate: '2028-06-30',
          isCurrent: false,
          status: 'upcoming',
        },
      ])
      .returning();

    // 3. Semesters
    const [sem3_2526, sem4_2526, sem5_2627, sem6_2627] = await tx
      .insert(semesters)
      .values([
        {
          academicYearId: ay2526.id,
          number: 3,
          name: 'Semester 3 (Odd)',
          termType: 'odd',
          startDate: '2025-08-04',
          endDate: '2025-12-20',
          isActive: false,
        },
        {
          academicYearId: ay2526.id,
          number: 4,
          name: 'Semester 4 (Even)',
          termType: 'even',
          startDate: '2026-01-19',
          endDate: '2026-06-15',
          isActive: false,
        },
        {
          academicYearId: ay2627.id,
          number: 5,
          name: 'Semester 5 (Odd)',
          termType: 'odd',
          startDate: '2026-08-03',
          endDate: '2026-12-22',
          isActive: true,
        },
        {
          academicYearId: ay2627.id,
          number: 6,
          name: 'Semester 6 (Even)',
          termType: 'even',
          startDate: '2027-01-18',
          endDate: '2027-06-14',
          isActive: false,
        },
      ])
      .returning();

    // 4. Departments
    const [deptCse, deptIse, deptEce, deptMe] = await tx
      .insert(departments)
      .values([
        {
          institutionId: inst.id,
          code: 'CSE',
          name: 'Computer Science & Engineering',
          hodName: 'Dr. Kavitha Rao',
          building: 'Sir M.V. Academic Block · Wing A',
        },
        {
          institutionId: inst.id,
          code: 'ISE',
          name: 'Information Science & Engineering',
          hodName: 'Dr. Sridhar Murthy',
          building: 'Sir M.V. Academic Block · Wing B',
        },
        {
          institutionId: inst.id,
          code: 'ECE',
          name: 'Electronics & Communication Engineering',
          hodName: 'Dr. Meenakshi Iyer',
          building: 'Ramanujan Block · Floor 2',
        },
        {
          institutionId: inst.id,
          code: 'ME',
          name: 'Mechanical Engineering',
          hodName: 'Prof. Basavaraj Patil',
          building: 'Visvesvaraya Workshop Wing',
        },
      ])
      .returning();

    // 5. Programs
    const [progCse, progIse, progEce, progMe] = await tx
      .insert(programs)
      .values([
        {
          departmentId: deptCse.id,
          code: 'BE-CSE',
          name: 'B.E. Computer Science & Engineering',
          degreeType: 'B.E.',
          durationYears: 4,
          totalSemesters: 8,
        },
        {
          departmentId: deptIse.id,
          code: 'BE-ISE',
          name: 'B.E. Information Science & Engineering',
          degreeType: 'B.E.',
          durationYears: 4,
          totalSemesters: 8,
        },
        {
          departmentId: deptEce.id,
          code: 'BE-ECE',
          name: 'B.E. Electronics & Communication Engineering',
          degreeType: 'B.E.',
          durationYears: 4,
          totalSemesters: 8,
        },
        {
          departmentId: deptMe.id,
          code: 'BE-ME',
          name: 'B.E. Mechanical Engineering',
          degreeType: 'B.E.',
          durationYears: 4,
          totalSemesters: 8,
        },
      ])
      .returning();

    // 6. Courses
    const [courseCseCore, courseIseCore, courseEceCore] = await tx
      .insert(courses)
      .values([
        {
          programId: progCse.id,
          code: 'VTU-21CS',
          title: 'VTU 2021-22 Scheme · Computer Science Core',
          credits: 160,
          description: 'Systems, Databases, Computer Networks, Machine Learning & Cloud Architecture.',
        },
        {
          programId: progIse.id,
          code: 'VTU-21IS',
          title: 'VTU 2021-22 Scheme · Information Science Core',
          credits: 160,
          description: 'Enterprise Software Engineering, Data Governance & Distributed Web.',
        },
        {
          programId: progEce.id,
          code: 'VTU-21EC',
          title: 'VTU 2021-22 Scheme · Electronics Core',
          credits: 160,
          description: 'VLSI, Embedded Systems, Signal Processing & Communication.',
        },
      ])
      .returning();

    // 7. Classrooms
    const [room301, room302, roomLab1, roomEce2, roomAudi] = await tx
      .insert(classrooms)
      .values([
        {
          institutionId: inst.id,
          roomCode: 'LH-301',
          building: 'Sir M.V. Academic Block',
          floor: '3rd Floor',
          capacity: 64,
          roomType: 'lecture_hall',
          hasSmartBoard: true,
        },
        {
          institutionId: inst.id,
          roomCode: 'LH-302',
          building: 'Sir M.V. Academic Block',
          floor: '3rd Floor',
          capacity: 64,
          roomType: 'lecture_hall',
          hasSmartBoard: true,
        },
        {
          institutionId: inst.id,
          roomCode: 'CSE-LAB-1',
          building: 'Sir M.V. Academic Block',
          floor: '2nd Floor',
          capacity: 36,
          roomType: 'lab',
          hasSmartBoard: true,
        },
        {
          institutionId: inst.id,
          roomCode: 'ECE-204',
          building: 'Ramanujan Block',
          floor: '2nd Floor',
          capacity: 60,
          roomType: 'lecture_hall',
          hasSmartBoard: true,
        },
        {
          institutionId: inst.id,
          roomCode: 'SEM-AUDI',
          building: 'Central Library Wing',
          floor: 'Ground Floor',
          capacity: 180,
          roomType: 'seminar_hall',
          hasSmartBoard: true,
        },
      ])
      .returning();

    // 8. Sections
    const [secCse4A_hist, secCse5A, secCse5B, secIse5A, secEce5A] = await tx
      .insert(sections)
      .values([
        {
          departmentId: deptCse.id,
          programId: progCse.id,
          academicYearId: ay2526.id,
          semesterId: sem4_2526.id,
          name: 'A',
          capacity: 60,
          classAdvisorName: 'Dr. Kavitha Rao',
        },
        {
          departmentId: deptCse.id,
          programId: progCse.id,
          academicYearId: ay2627.id,
          semesterId: sem5_2627.id,
          name: 'A',
          capacity: 60,
          classAdvisorName: 'Dr. Kavitha Rao',
        },
        {
          departmentId: deptCse.id,
          programId: progCse.id,
          academicYearId: ay2627.id,
          semesterId: sem5_2627.id,
          name: 'B',
          capacity: 60,
          classAdvisorName: 'Prof. Arvind Nair',
        },
        {
          departmentId: deptIse.id,
          programId: progIse.id,
          academicYearId: ay2627.id,
          semesterId: sem5_2627.id,
          name: 'A',
          capacity: 60,
          classAdvisorName: 'Dr. Sridhar Murthy',
        },
        {
          departmentId: deptEce.id,
          programId: progEce.id,
          academicYearId: ay2627.id,
          semesterId: sem5_2627.id,
          name: 'A',
          capacity: 60,
          classAdvisorName: 'Dr. Meenakshi Iyer',
        },
      ])
      .returning();

    // 9. Profiles (Clearly marked Demo Accounts)
    const [
      adminProfile,
      facultyRaoProfile,
      facultyNairProfile,
      facultyIyerProfile,
      studentAaravProfile,
      studentPriyaProfile,
      studentRohanProfile,
      studentAnanyaProfile,
      studentKarthikProfile,
      studentSnehaProfile,
      studentVikramProfile,
      studentDivyaProfile,
      parentSharmaProfile,
    ] = await tx
      .insert(profiles)
      .values([
        {
          uid: 'demo-uid-super-admin',
          email: 'registrar.demo@impactcampus.edu.in',
          fullName: 'Dr. Raghavendra Kulkarni (Demo Admin)',
          role: 'super_admin',
          phone: '+91 80 2333 4101',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-faculty-rao',
          email: 'kavitha.rao.demo@impactcampus.edu.in',
          fullName: 'Dr. Kavitha Rao',
          role: 'faculty',
          phone: '+91 98450 21409',
          avatarUrl: '/src/assets/images/avatar_faculty_rao_1795168295919.jpg',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-faculty-nair',
          email: 'arvind.nair.demo@impactcampus.edu.in',
          fullName: 'Prof. Arvind Nair',
          role: 'faculty',
          phone: '+91 98451 67210',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-faculty-iyer',
          email: 'meenakshi.iyer.demo@impactcampus.edu.in',
          fullName: 'Dr. Meenakshi Iyer',
          role: 'faculty',
          phone: '+91 98452 90814',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-student-aarav',
          email: 'aarav.sharma.demo@impactcampus.edu.in',
          fullName: 'Aarav Sharma',
          role: 'student',
          phone: '+91 99001 44512',
          avatarUrl: '/src/assets/images/avatar_student_aarav_1795168295895.jpg',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-student-priya',
          email: 'priya.nair.demo@impactcampus.edu.in',
          fullName: 'Priya Nair',
          role: 'student',
          phone: '+91 99001 44513',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-student-rohan',
          email: 'rohan.deshmukh.demo@impactcampus.edu.in',
          fullName: 'Rohan Deshmukh',
          role: 'student',
          phone: '+91 99001 44514',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-student-ananya',
          email: 'ananya.hegde.demo@impactcampus.edu.in',
          fullName: 'Ananya Hegde',
          role: 'student',
          phone: '+91 99001 44515',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-student-karthik',
          email: 'karthik.gowda.demo@impactcampus.edu.in',
          fullName: 'Karthik Gowda',
          role: 'student',
          phone: '+91 99001 44516',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-student-sneha',
          email: 'sneha.menon.demo@impactcampus.edu.in',
          fullName: 'Sneha Menon',
          role: 'student',
          phone: '+91 99001 44517',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-student-vikram',
          email: 'vikram.joshi.demo@impactcampus.edu.in',
          fullName: 'Vikram Joshi',
          role: 'student',
          phone: '+91 99001 44518',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-student-divya',
          email: 'divya.krishnan.demo@impactcampus.edu.in',
          fullName: 'Divya Krishnan',
          role: 'student',
          phone: '+91 99001 44519',
          isDemoAccount: true,
          accountStatus: 'active',
        },
        {
          uid: 'demo-uid-parent-sharma',
          email: 'rajesh.sharma.demo@impactcampus.edu.in',
          fullName: 'Rajesh Sharma (Demo Parent)',
          role: 'parent',
          phone: '+91 98450 88771',
          isDemoAccount: true,
          accountStatus: 'active',
        },
      ])
      .returning();

    // 10. Faculty
    const [facRao, facNair, facIyer] = await tx
      .insert(faculty)
      .values([
        {
          profileId: facultyRaoProfile.id,
          institutionId: inst.id,
          departmentId: deptCse.id,
          employeeCode: 'FAC-CSE-014',
          designation: 'Associate Professor & HOD (CSE)',
          qualification: 'Ph.D. (IISc Bengaluru), M.Tech CSE',
          specialization: 'Database Systems & Applied Machine Learning',
          joiningDate: '2019-07-15',
          email: facultyRaoProfile.email,
          phone: '+91 98450 21409',
          officeRoom: 'CS-FAC-101',
          status: 'active',
        },
        {
          profileId: facultyNairProfile.id,
          institutionId: inst.id,
          departmentId: deptCse.id,
          employeeCode: 'FAC-CSE-022',
          designation: 'Assistant Professor',
          qualification: 'M.Tech Computer Networks (VTU)',
          specialization: 'Computer Networks & Distributed Systems',
          joiningDate: '2021-08-02',
          email: facultyNairProfile.email,
          phone: '+91 98451 67210',
          officeRoom: 'CS-FAC-104',
          status: 'active',
        },
        {
          profileId: facultyIyerProfile.id,
          institutionId: inst.id,
          departmentId: deptEce.id,
          employeeCode: 'FAC-ECE-009',
          designation: 'Professor & HOD (ECE)',
          qualification: 'Ph.D. VLSI Design (NITK Surathkal)',
          specialization: 'VLSI & Embedded Architectures',
          joiningDate: '2017-06-10',
          email: facultyIyerProfile.email,
          phone: '+91 98452 90814',
          officeRoom: 'EC-FAC-201',
          status: 'active',
        },
      ])
      .returning();

    // 11. Students
    const [
      stuAarav,
      stuPriya,
      stuRohan,
      stuAnanya,
      stuKarthik,
      stuSneha,
      stuVikram,
      stuDivya,
    ] = await tx
      .insert(students)
      .values([
        {
          profileId: studentAaravProfile.id,
          institutionId: inst.id,
          departmentId: deptCse.id,
          programId: progCse.id,
          usn: '1IC23CS001',
          admissionNumber: 'ADM-2023-0041',
          admissionYear: 2023,
          dateOfBirth: '2005-04-18',
          gender: 'Male',
          email: studentAaravProfile.email,
          phone: '+91 99001 44512',
          address: '#42, 4th Cross, Sahakaranagar, Bengaluru 560092',
          emergencyContactName: 'Rajesh Sharma (Father)',
          emergencyContactPhone: '+91 98450 88771',
          profilePhotoUrl: '/src/assets/images/avatar_student_aarav_1795168295895.jpg',
          admissionDocsJson: [
            { title: 'KCET Allotment Order', refNo: 'KEA-2023-88412', verified: true },
            { title: '10+2 / II PUC Marks Card', refNo: 'PUC-KA-441092', verified: true },
            { title: 'Transfer & Conduct Certificate', refNo: 'TC-2023-118', verified: true },
          ],
          previousAcademicRecordsJson: [
            { qualification: 'Class X (CBSE)', board: 'CBSE', year: 2021, percentage: '94.6%' },
            { qualification: 'Class XII / II PUC', board: 'Karnataka PU Board', year: 2023, percentage: '91.8%' },
          ],
          academicStatus: 'active',
          biometricEnrolled: true,
        },
        {
          profileId: studentPriyaProfile.id,
          institutionId: inst.id,
          departmentId: deptCse.id,
          programId: progCse.id,
          usn: '1IC23CS002',
          admissionNumber: 'ADM-2023-0042',
          admissionYear: 2023,
          dateOfBirth: '2005-07-22',
          gender: 'Female',
          email: studentPriyaProfile.email,
          phone: '+91 99001 44513',
          address: '#19, Indiranagar 2nd Stage, Bengaluru 560038',
          emergencyContactName: 'Lakshmi Nair (Mother)',
          emergencyContactPhone: '+91 98451 11902',
          academicStatus: 'active',
          biometricEnrolled: true,
        },
        {
          profileId: studentRohanProfile.id,
          institutionId: inst.id,
          departmentId: deptCse.id,
          programId: progCse.id,
          usn: '1IC23CS003',
          admissionNumber: 'ADM-2023-0043',
          admissionYear: 2023,
          dateOfBirth: '2005-01-11',
          gender: 'Male',
          email: studentRohanProfile.email,
          phone: '+91 99001 44514',
          address: '#108, Yelahanka New Town, Bengaluru 560064',
          emergencyContactName: 'Suresh Deshmukh (Father)',
          emergencyContactPhone: '+91 98452 33219',
          academicStatus: 'active',
          biometricEnrolled: false,
        },
        {
          profileId: studentAnanyaProfile.id,
          institutionId: inst.id,
          departmentId: deptCse.id,
          programId: progCse.id,
          usn: '1IC23CS004',
          admissionNumber: 'ADM-2023-0044',
          admissionYear: 2023,
          dateOfBirth: '2005-09-05',
          gender: 'Female',
          email: studentAnanyaProfile.email,
          phone: '+91 99001 44515',
          address: '#77, Malleshwaram 11th Cross, Bengaluru 560003',
          emergencyContactName: 'Prakash Hegde (Father)',
          emergencyContactPhone: '+91 98453 44120',
          academicStatus: 'active',
          biometricEnrolled: true,
        },
        {
          profileId: studentKarthikProfile.id,
          institutionId: inst.id,
          departmentId: deptCse.id,
          programId: progCse.id,
          usn: '1IC23CS005',
          admissionNumber: 'ADM-2023-0045',
          admissionYear: 2023,
          dateOfBirth: '2005-02-27',
          gender: 'Male',
          email: studentKarthikProfile.email,
          phone: '+91 99001 44516',
          address: '#12, Hebbal Kempapura, Bengaluru 560024',
          emergencyContactName: 'Manjunath Gowda (Father)',
          emergencyContactPhone: '+91 98454 55102',
          academicStatus: 'active',
          biometricEnrolled: false,
        },
        {
          profileId: studentSnehaProfile.id,
          institutionId: inst.id,
          departmentId: deptCse.id,
          programId: progCse.id,
          usn: '1IC23CS006',
          admissionNumber: 'ADM-2023-0046',
          admissionYear: 2023,
          dateOfBirth: '2005-11-14',
          gender: 'Female',
          email: studentSnehaProfile.email,
          phone: '+91 99001 44517',
          address: '#88, RT Nagar Main Road, Bengaluru 560032',
          emergencyContactName: 'Vinod Menon (Father)',
          emergencyContactPhone: '+91 98455 66211',
          academicStatus: 'active',
          biometricEnrolled: true,
        },
        {
          profileId: studentVikramProfile.id,
          institutionId: inst.id,
          departmentId: deptIse.id,
          programId: progIse.id,
          usn: '1IC23IS001',
          admissionNumber: 'ADM-2023-0102',
          admissionYear: 2023,
          dateOfBirth: '2005-06-03',
          gender: 'Male',
          email: studentVikramProfile.email,
          phone: '+91 99001 44518',
          address: '#301, Jakkur Layout, Bengaluru 560064',
          emergencyContactName: 'Nitin Joshi (Father)',
          emergencyContactPhone: '+91 98456 77320',
          academicStatus: 'active',
          biometricEnrolled: false,
        },
        {
          profileId: studentDivyaProfile.id,
          institutionId: inst.id,
          departmentId: deptEce.id,
          programId: progEce.id,
          usn: '1IC23EC001',
          admissionNumber: 'ADM-2023-0205',
          admissionYear: 2023,
          dateOfBirth: '2005-08-30',
          gender: 'Female',
          email: studentDivyaProfile.email,
          phone: '+91 99001 44519',
          address: '#54, Sanjaynagar, Bengaluru 560094',
          emergencyContactName: 'Subramanya Krishnan (Father)',
          emergencyContactPhone: '+91 98457 88412',
          academicStatus: 'active',
          biometricEnrolled: false,
        },
      ])
      .returning();

    // 12. Parents & Verified Links
    const [parentSharma] = await tx
      .insert(parents)
      .values({
        profileId: parentSharmaProfile.id,
        fullName: 'Rajesh Sharma',
        email: parentSharmaProfile.email,
        phone: '+91 98450 88771',
        occupation: 'Senior Principal Systems Engineer, Bengaluru',
        address: '#42, 4th Cross, Sahakaranagar, Bengaluru 560092',
      })
      .returning();

    await tx.insert(studentParentLinks).values({
      studentId: stuAarav.id,
      parentId: parentSharma.id,
      relationship: 'father',
      isPrimaryContact: true,
      isVerified: true,
    });

    // 13. Role Permissions Matrix
    await tx.insert(rolePermissions).values([
      { role: 'super_admin', resource: 'students', canCreate: true, canRead: true, canUpdate: true, canDelete: true, description: 'Full student lifecycle & bulk import' },
      { role: 'super_admin', resource: 'academic_years', canCreate: true, canRead: true, canUpdate: true, canDelete: false, description: 'Create years & execute cohort promotions' },
      { role: 'super_admin', resource: 'fees', canCreate: true, canRead: true, canUpdate: true, canDelete: false, description: 'Manage fee structures, concessions & receipts' },
      { role: 'super_admin', resource: 'audit_logs', canCreate: false, canRead: true, canUpdate: false, canDelete: false, description: 'Read immutable institutional audit logs' },
      { role: 'faculty', resource: 'attendance_sessions', canCreate: true, canRead: true, canUpdate: true, canDelete: false, description: 'Start/close sessions for assigned subjects' },
      { role: 'faculty', resource: 'attendance_records', canCreate: true, canRead: true, canUpdate: true, canDelete: false, description: 'Mark & edit attendance with mandatory audit reason' },
      { role: 'student', resource: 'attendance_records', canCreate: false, canRead: true, canUpdate: false, canDelete: false, description: 'Read-only own attendance; verify active sessions via QR/AI' },
      { role: 'student', resource: 'fees', canCreate: false, canRead: true, canUpdate: false, canDelete: false, description: 'Read own multi-year fee ledger & receipts' },
      { role: 'parent', resource: 'linked_student', canCreate: false, canRead: true, canUpdate: false, canDelete: false, description: 'Strict read-only access to verified ward profile, attendance, grades & fees' },
    ]);

    // 14. Subjects
    const [subDbms, subCn, subAiml, subSe, subDbmsLab, subHistOs, subEceVlsi] =
      await tx
        .insert(subjects)
        .values([
          {
            departmentId: deptCse.id,
            programId: progCse.id,
            courseId: courseCseCore.id,
            semesterNumber: 5,
            code: '21CS53',
            name: 'Database Management Systems',
            credits: 4,
            subjectType: 'theory',
            syllabusSummary: 'ER Modeling, Relational Algebra, Normalization (BCNF/4NF), ACID Transactions & Indexing.',
            studyMaterialsJson: [
              {
                id: 'mat-1',
                title: 'Module 1–2: Relational Model & SQL Normalization Notes',
                moduleLabel: 'Module 1 & 2',
                fileName: '21CS53_DBMS_Normalization_Slides.pdf',
                uploadedBy: 'Dr. Kavitha Rao',
                uploadedAt: '2026-08-14',
                url: '#material-dbms-m1',
              },
              {
                id: 'mat-2',
                title: 'Module 4: Concurrency Control & MVCC in PostgreSQL',
                moduleLabel: 'Module 4',
                fileName: '21CS53_PostgreSQL_MVCC_Guide.pdf',
                uploadedBy: 'Dr. Kavitha Rao',
                uploadedAt: '2026-10-02',
                url: '#material-dbms-m4',
              },
            ],
          },
          {
            departmentId: deptCse.id,
            programId: progCse.id,
            courseId: courseCseCore.id,
            semesterNumber: 5,
            code: '21CS52',
            name: 'Computer Networks & Security',
            credits: 4,
            subjectType: 'theory',
            syllabusSummary: 'TCP/IP Congestion Control, Routing Protocols, TLS 1.3 & Network Security.',
            studyMaterialsJson: [
              {
                id: 'mat-3',
                title: 'Transport Layer & TCP Reno State Machine',
                moduleLabel: 'Module 3',
                fileName: '21CS52_TCP_Congestion_Notes.pdf',
                uploadedBy: 'Prof. Arvind Nair',
                uploadedAt: '2026-09-10',
                url: '#material-cn-m3',
              },
            ],
          },
          {
            departmentId: deptCse.id,
            programId: progCse.id,
            courseId: courseCseCore.id,
            semesterNumber: 5,
            code: '21CS54',
            name: 'Artificial Intelligence & Machine Learning',
            credits: 4,
            subjectType: 'theory',
            syllabusSummary: 'Heuristic Search, Supervised Learning, Computer Vision Embeddings & Ethics.',
            studyMaterialsJson: [
              {
                id: 'mat-4',
                title: 'Facial Embeddings & Liveness Anti-Spoofing Primer',
                moduleLabel: 'Module 5',
                fileName: '21CS54_Biometric_Liveness_Seminar.pdf',
                uploadedBy: 'Dr. Kavitha Rao',
                uploadedAt: '2026-10-18',
                url: '#material-aiml-m5',
              },
            ],
          },
          {
            departmentId: deptCse.id,
            programId: progCse.id,
            courseId: courseCseCore.id,
            semesterNumber: 5,
            code: '21CS51',
            name: 'Software Engineering & Project Management',
            credits: 3,
            subjectType: 'theory',
            syllabusSummary: 'Agile Architecture, System Testing, Verification & Enterprise Governance.',
            studyMaterialsJson: [],
          },
          {
            departmentId: deptCse.id,
            programId: progCse.id,
            courseId: courseCseCore.id,
            semesterNumber: 5,
            code: '21CSL55',
            name: 'DBMS & SQL Schema Lab',
            credits: 2,
            subjectType: 'lab',
            syllabusSummary: 'Hands-on PostgreSQL DDL, Triggers, Transactions & Query Optimization.',
            studyMaterialsJson: [],
          },
          {
            departmentId: deptCse.id,
            programId: progCse.id,
            courseId: courseCseCore.id,
            semesterNumber: 4,
            code: '21CS42',
            name: 'Design & Analysis of Algorithms (2025–26 Sem 4)',
            credits: 4,
            subjectType: 'theory',
            syllabusSummary: 'Divide & Conquer, Dynamic Programming, Graph Algorithms & NP-Completeness.',
            studyMaterialsJson: [],
          },
          {
            departmentId: deptEce.id,
            programId: progEce.id,
            courseId: courseEceCore.id,
            semesterNumber: 5,
            code: '21EC52',
            name: 'Digital Signal Processing & VLSI',
            credits: 4,
            subjectType: 'theory',
            syllabusSummary: 'DFT/FFT Architectures & CMOS Circuit Synthesis.',
            studyMaterialsJson: [],
          },
        ])
        .returning();

    // 15. Subject-Faculty Assignments
    await tx.insert(subjectFacultyAssignments).values([
      {
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        subjectId: subDbms.id,
        facultyId: facRao.id,
        sectionId: secCse5A.id,
        isPrimary: true,
      },
      {
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        subjectId: subAiml.id,
        facultyId: facRao.id,
        sectionId: secCse5A.id,
        isPrimary: true,
      },
      {
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        subjectId: subDbmsLab.id,
        facultyId: facRao.id,
        sectionId: secCse5A.id,
        isPrimary: true,
      },
      {
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        subjectId: subCn.id,
        facultyId: facNair.id,
        sectionId: secCse5A.id,
        isPrimary: true,
      },
      {
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        subjectId: subSe.id,
        facultyId: facNair.id,
        sectionId: secCse5A.id,
        isPrimary: true,
      },
      {
        academicYearId: ay2526.id,
        semesterId: sem4_2526.id,
        subjectId: subHistOs.id,
        facultyId: facRao.id,
        sectionId: secCse4A_hist.id,
        isPrimary: true,
      },
      {
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        subjectId: subEceVlsi.id,
        facultyId: facIyer.id,
        sectionId: secEce5A.id,
        isPrimary: true,
      },
    ]);

    // 16. Student Enrollments (Historical 2025-26 Sem 4 + Current 2026-27 Sem 5)
    const histEnrollments = await tx
      .insert(studentEnrollments)
      .values([
        {
          studentId: stuAarav.id,
          academicYearId: ay2526.id,
          semesterId: sem4_2526.id,
          programId: progCse.id,
          sectionId: secCse4A_hist.id,
          rollNumber: 'CSE-4A-01',
          enrollmentStatus: 'promoted',
        },
        {
          studentId: stuPriya.id,
          academicYearId: ay2526.id,
          semesterId: sem4_2526.id,
          programId: progCse.id,
          sectionId: secCse4A_hist.id,
          rollNumber: 'CSE-4A-02',
          enrollmentStatus: 'promoted',
        },
        {
          studentId: stuRohan.id,
          academicYearId: ay2526.id,
          semesterId: sem4_2526.id,
          programId: progCse.id,
          sectionId: secCse4A_hist.id,
          rollNumber: 'CSE-4A-03',
          enrollmentStatus: 'promoted',
        },
      ])
      .returning();

    await tx.insert(studentEnrollments).values([
      {
        studentId: stuAarav.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        programId: progCse.id,
        sectionId: secCse5A.id,
        rollNumber: 'CSE-5A-01',
        enrollmentStatus: 'enrolled',
        promotedFromEnrollmentId: histEnrollments[0].id,
      },
      {
        studentId: stuPriya.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        programId: progCse.id,
        sectionId: secCse5A.id,
        rollNumber: 'CSE-5A-02',
        enrollmentStatus: 'enrolled',
        promotedFromEnrollmentId: histEnrollments[1].id,
      },
      {
        studentId: stuRohan.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        programId: progCse.id,
        sectionId: secCse5A.id,
        rollNumber: 'CSE-5A-03',
        enrollmentStatus: 'enrolled',
        promotedFromEnrollmentId: histEnrollments[2].id,
      },
      {
        studentId: stuAnanya.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        programId: progCse.id,
        sectionId: secCse5A.id,
        rollNumber: 'CSE-5A-04',
        enrollmentStatus: 'enrolled',
      },
      {
        studentId: stuKarthik.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        programId: progCse.id,
        sectionId: secCse5A.id,
        rollNumber: 'CSE-5A-05',
        enrollmentStatus: 'enrolled',
      },
      {
        studentId: stuSneha.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        programId: progCse.id,
        sectionId: secCse5A.id,
        rollNumber: 'CSE-5A-06',
        enrollmentStatus: 'enrolled',
      },
      {
        studentId: stuVikram.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        programId: progIse.id,
        sectionId: secIse5A.id,
        rollNumber: 'ISE-5A-01',
        enrollmentStatus: 'enrolled',
      },
      {
        studentId: stuDivya.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        programId: progEce.id,
        sectionId: secEce5A.id,
        rollNumber: 'ECE-5A-01',
        enrollmentStatus: 'enrolled',
      },
    ]);

    // 17. Timetables & Slots (CSE 5A)
    const [ttCse5A] = await tx
      .insert(timetables)
      .values({
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        sectionId: secCse5A.id,
        title: 'B.E. CSE · Semester 5 · Section A Timetable',
        effectiveFrom: '2026-08-03',
        isPublished: true,
      })
      .returning();

    const slots = await tx
      .insert(timetableSlots)
      .values([
        { timetableId: ttCse5A.id, subjectId: subDbms.id, facultyId: facRao.id, classroomId: room301.id, dayOfWeek: 1, periodNumber: 1, startTime: '09:00', endTime: '10:00', slotType: 'lecture' },
        { timetableId: ttCse5A.id, subjectId: subCn.id, facultyId: facNair.id, classroomId: room301.id, dayOfWeek: 1, periodNumber: 2, startTime: '10:00', endTime: '11:00', slotType: 'lecture' },
        { timetableId: ttCse5A.id, subjectId: subAiml.id, facultyId: facRao.id, classroomId: room302.id, dayOfWeek: 1, periodNumber: 3, startTime: '11:15', endTime: '12:15', slotType: 'lecture' },
        { timetableId: ttCse5A.id, subjectId: subSe.id, facultyId: facNair.id, classroomId: room301.id, dayOfWeek: 2, periodNumber: 1, startTime: '09:00', endTime: '10:00', slotType: 'lecture' },
        { timetableId: ttCse5A.id, subjectId: subDbmsLab.id, facultyId: facRao.id, classroomId: roomLab1.id, dayOfWeek: 2, periodNumber: 2, startTime: '10:00', endTime: '12:00', slotType: 'lab' },
        { timetableId: ttCse5A.id, subjectId: subDbms.id, facultyId: facRao.id, classroomId: room301.id, dayOfWeek: 3, periodNumber: 1, startTime: '09:00', endTime: '10:00', slotType: 'lecture' },
        { timetableId: ttCse5A.id, subjectId: subAiml.id, facultyId: facRao.id, classroomId: room301.id, dayOfWeek: 4, periodNumber: 2, startTime: '10:00', endTime: '11:00', slotType: 'lecture' },
        { timetableId: ttCse5A.id, subjectId: subCn.id, facultyId: facNair.id, classroomId: room302.id, dayOfWeek: 5, periodNumber: 1, startTime: '09:00', endTime: '10:00', slotType: 'lecture' },
        { timetableId: ttCse5A.id, subjectId: subDbms.id, facultyId: facRao.id, classroomId: room301.id, dayOfWeek: 5, periodNumber: 3, startTime: '11:15', endTime: '12:15', slotType: 'lecture' },
      ])
      .returning();

    // 18. Examinations & Results
    const [examHistDaa, examIa1Dbms, examIa1Aiml, examIa1Cn] = await tx
      .insert(examinations)
      .values([
        {
          academicYearId: ay2526.id,
          semesterId: sem4_2526.id,
          departmentId: deptCse.id,
          subjectId: subHistOs.id,
          examName: 'VTU Semester End Exam (2025–26 Sem 4)',
          examType: 'see',
          examDate: '2026-06-02',
          startTime: '09:30',
          endTime: '12:30',
          maxMarks: 100,
          passingMarks: 40,
          classroomId: room301.id,
        },
        {
          academicYearId: ay2627.id,
          semesterId: sem5_2627.id,
          departmentId: deptCse.id,
          subjectId: subDbms.id,
          examName: 'Internal Assessment 1 (21CS53)',
          examType: 'ia_1',
          examDate: '2026-10-12',
          startTime: '09:30',
          endTime: '11:00',
          maxMarks: 50,
          passingMarks: 20,
          classroomId: room301.id,
        },
        {
          academicYearId: ay2627.id,
          semesterId: sem5_2627.id,
          departmentId: deptCse.id,
          subjectId: subAiml.id,
          examName: 'Internal Assessment 1 (21CS54)',
          examType: 'ia_1',
          examDate: '2026-10-14',
          startTime: '09:30',
          endTime: '11:00',
          maxMarks: 50,
          passingMarks: 20,
          classroomId: room302.id,
        },
        {
          academicYearId: ay2627.id,
          semesterId: sem5_2627.id,
          departmentId: deptCse.id,
          subjectId: subCn.id,
          examName: 'Internal Assessment 2 (21CS52)',
          examType: 'ia_2',
          examDate: '2026-11-28',
          startTime: '09:30',
          endTime: '11:00',
          maxMarks: 50,
          passingMarks: 20,
          classroomId: room301.id,
        },
      ])
      .returning();

    await tx.insert(examinationResults).values([
      {
        examinationId: examHistDaa.id,
        studentId: stuAarav.id,
        academicYearId: ay2526.id,
        semesterId: sem4_2526.id,
        marksObtained: '88.00',
        grade: 'A+',
        gradePoints: '9.00',
        status: 'pass',
        remarks: 'First Class with Distinction',
      },
      {
        examinationId: examIa1Dbms.id,
        studentId: stuAarav.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        marksObtained: '46.00',
        grade: 'O',
        gradePoints: '10.00',
        status: 'pass',
        remarks: 'Top 5% in section',
      },
      {
        examinationId: examIa1Aiml.id,
        studentId: stuAarav.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        marksObtained: '43.50',
        grade: 'A+',
        gradePoints: '9.00',
        status: 'pass',
      },
      {
        examinationId: examIa1Dbms.id,
        studentId: stuPriya.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        marksObtained: '48.00',
        grade: 'O',
        gradePoints: '10.00',
        status: 'pass',
      },
      {
        examinationId: examIa1Dbms.id,
        studentId: stuRohan.id,
        academicYearId: ay2627.id,
        semesterId: sem5_2627.id,
        marksObtained: '29.00',
        grade: 'B',
        gradePoints: '6.00',
        status: 'pass',
        remarks: 'Advised extra DBMS lab practice',
      },
    ]);

    // 19. Attendance Policy
    await tx.insert(attendancePolicies).values({
      institutionId: inst.id,
      academicYearId: ay2627.id,
      departmentId: null,
      minAttendancePercentage: 75,
      condonationMinimumPercentage: 65,
      qrTokenTtlSeconds: 25,
      aiAutoApproveThreshold: '0.85',
      aiManualReviewThreshold: '0.65',
      requireLivenessCheck: true,
      allowLateWindowMinutes: 10,
    });

    // 20. Attendance Sessions & Records (Historical + Current Sem 5)
    const [sessHist, sessDbms1, sessDbms2, sessAiml1, sessCn1, sessActiveQr] =
      await tx
        .insert(attendanceSessions)
        .values([
          {
            academicYearId: ay2526.id,
            semesterId: sem4_2526.id,
            subjectId: subHistOs.id,
            facultyId: facRao.id,
            sectionId: secCse4A_hist.id,
            classroomId: room301.id,
            sessionDate: '2026-04-10',
            mode: 'manual',
            status: 'closed',
            qrSecret: crypto.randomBytes(16).toString('hex'),
            closedAt: new Date('2026-04-10T05:00:00Z'),
            notes: 'Archived 2025-26 Sem 4 session',
          },
          {
            academicYearId: ay2627.id,
            semesterId: sem5_2627.id,
            subjectId: subDbms.id,
            facultyId: facRao.id,
            sectionId: secCse5A.id,
            timetableSlotId: slots[0].id,
            classroomId: room301.id,
            sessionDate: '2026-11-16',
            mode: 'dynamic_qr',
            status: 'closed',
            qrSecret: crypto.randomBytes(16).toString('hex'),
            closedAt: new Date('2026-11-16T04:30:00Z'),
            notes: 'Unit 4: ACID & Two-Phase Locking',
          },
          {
            academicYearId: ay2627.id,
            semesterId: sem5_2627.id,
            subjectId: subDbms.id,
            facultyId: facRao.id,
            sectionId: secCse5A.id,
            timetableSlotId: slots[5].id,
            classroomId: room301.id,
            sessionDate: '2026-11-18',
            mode: 'manual',
            status: 'closed',
            qrSecret: crypto.randomBytes(16).toString('hex'),
            closedAt: new Date('2026-11-18T04:30:00Z'),
            notes: 'Unit 4: B+ Tree Indexing',
          },
          {
            academicYearId: ay2627.id,
            semesterId: sem5_2627.id,
            subjectId: subAiml.id,
            facultyId: facRao.id,
            sectionId: secCse5A.id,
            timetableSlotId: slots[2].id,
            classroomId: room302.id,
            sessionDate: '2026-11-17',
            mode: 'dynamic_qr',
            status: 'closed',
            qrSecret: crypto.randomBytes(16).toString('hex'),
            closedAt: new Date('2026-11-17T06:45:00Z'),
            notes: 'Gradient Descent & Regularization',
          },
          {
            academicYearId: ay2627.id,
            semesterId: sem5_2627.id,
            subjectId: subCn.id,
            facultyId: facNair.id,
            sectionId: secCse5A.id,
            timetableSlotId: slots[1].id,
            classroomId: room301.id,
            sessionDate: '2026-11-19',
            mode: 'dynamic_qr',
            status: 'closed',
            qrSecret: crypto.randomBytes(16).toString('hex'),
            closedAt: new Date('2026-11-19T05:30:00Z'),
            notes: 'TLS 1.3 Handshake Protocol',
          },
          {
            academicYearId: ay2627.id,
            semesterId: sem5_2627.id,
            subjectId: subDbms.id,
            facultyId: facRao.id,
            sectionId: secCse5A.id,
            timetableSlotId: slots[8].id,
            classroomId: room301.id,
            sessionDate: '2026-11-20',
            mode: 'dynamic_qr',
            status: 'active',
            qrSecret: crypto.randomBytes(16).toString('hex'),
            qrIntervalSeconds: 25,
            qrExpiresAt: new Date(Date.now() + 25 * 1000),
            notes: 'Live Lecture: PostgreSQL Row Level Security & Indexing',
          },
        ])
        .returning();

    const cse5aStudents = [stuAarav, stuPriya, stuRohan, stuAnanya, stuKarthik, stuSneha];

    // Seed records for closed sessions
    const recordValues: (typeof attendanceRecords.$inferInsert)[] = [];
    // Historical session
    for (const s of [stuAarav, stuPriya, stuRohan]) {
      recordValues.push({
        sessionId: sessHist.id,
        studentId: s.id,
        academicYearId: ay2526.id,
        subjectId: subHistOs.id,
        facultyId: facRao.id,
        status: 'present',
        verificationMethod: 'manual',
        markedByProfileId: facultyRaoProfile.id,
      });
    }

    // Closed Sem 5 sessions (Karthik marked absent on 3/4 to demonstrate <75% alert!)
    const closedSem5 = [
      { sess: sessDbms1, subj: subDbms.id, fac: facRao.id, method: 'dynamic_qr' },
      { sess: sessDbms2, subj: subDbms.id, fac: facRao.id, method: 'manual' },
      { sess: sessAiml1, subj: subAiml.id, fac: facRao.id, method: 'dynamic_qr' },
      { sess: sessCn1, subj: subCn.id, fac: facNair.id, method: 'dynamic_qr' },
    ];

    let correctionTargetRecordId: number | null = null;
    for (let idx = 0; idx < closedSem5.length; idx++) {
      const item = closedSem5[idx];
      for (const stu of cse5aStudents) {
        let status = 'present';
        if (stu.id === stuKarthik.id && idx < 3) status = 'absent';
        if (stu.id === stuRohan.id && idx === 1) status = 'absent';
        if (stu.id === stuSneha.id && idx === 2) status = 'late';

        recordValues.push({
          sessionId: item.sess.id,
          studentId: stu.id,
          academicYearId: ay2627.id,
          subjectId: item.subj,
          facultyId: item.fac,
          status,
          verificationMethod: item.method,
          markedByProfileId: item.fac === facRao.id ? facultyRaoProfile.id : facultyNairProfile.id,
        });
      }
    }

    const insertedRecords = await tx
      .insert(attendanceRecords)
      .values(recordValues)
      .returning();

    // Mark Priya as already verified in active session so faculty sees mixed live roster; leave Aarav pending so user can test QR verification!
    await tx.insert(attendanceRecords).values({
      sessionId: sessActiveQr.id,
      studentId: stuPriya.id,
      academicYearId: ay2627.id,
      subjectId: subDbms.id,
      facultyId: facRao.id,
      status: 'present',
      verificationMethod: 'dynamic_qr',
      markedByProfileId: studentPriyaProfile.id,
    });

    const rohanAbsentRec = insertedRecords.find(
      (r) => r.sessionId === sessDbms2.id && r.studentId === stuRohan.id
    );
    if (rohanAbsentRec) {
      correctionTargetRecordId = rohanAbsentRec.id;
      await tx.insert(attendanceCorrections).values({
        attendanceRecordId: correctionTargetRecordId,
        sessionId: sessDbms2.id,
        studentId: stuRohan.id,
        editedByProfileId: facultyRaoProfile.id,
        previousStatus: 'absent',
        newStatus: 'absent',
        reason: 'Verified physical roll sheet; student arrived after 15-min cutoff.',
        appealStatus: 'faculty_edit',
      });
    }

    await tx.insert(attendanceVerificationLogs).values([
      {
        sessionId: sessActiveQr.id,
        studentId: stuPriya.id,
        verificationMethod: 'dynamic_qr',
        providerName: 'ImpactCampus-HMAC-QR',
        outcome: 'verified',
        qrTokenHash: crypto.createHash('sha256').update('demo-qr-priya').digest('hex').slice(0, 16),
        deviceSummary: 'PWA Chrome Mobile · Bengaluru',
      },
    ]);

    // 21. Finance: Fee Structures, Assignments, Payments, Transactions, Scholarships
    const [feeStruct2526, feeStruct2627] = await tx
      .insert(feeStructures)
      .values([
        {
          institutionId: inst.id,
          academicYearId: ay2526.id,
          programId: progCse.id,
          semesterNumber: 4,
          categoryName: 'B.E. Annual Tuition & Lab Fee (2025–26)',
          tuitionFee: 85000,
          labFee: 12000,
          libraryFee: 3000,
          examFee: 3500,
          miscFee: 1500,
          totalAmount: 105000,
          dueDate: '2025-09-15',
        },
        {
          institutionId: inst.id,
          academicYearId: ay2627.id,
          programId: progCse.id,
          semesterNumber: 5,
          categoryName: 'B.E. Annual Tuition & Lab Fee (2026–27)',
          tuitionFee: 90000,
          labFee: 14000,
          libraryFee: 3500,
          examFee: 4000,
          miscFee: 1500,
          totalAmount: 113000,
          dueDate: '2026-12-05',
        },
      ])
      .returning();

    // Scholarships
    await tx.insert(scholarships).values([
      {
        studentId: stuAarav.id,
        academicYearId: ay2627.id,
        schemeName: 'ICEAS Academic Excellence Merit Concession',
        provider: 'Institutional Merit',
        amount: 15000,
        status: 'approved',
        sanctionRef: 'ICEAS-SCH-2026-014',
      },
      {
        studentId: stuPriya.id,
        academicYearId: ay2627.id,
        schemeName: 'Karnataka State SSP Post-Matric Scholarship',
        provider: 'State SSP',
        amount: 22000,
        status: 'disbursed',
        sanctionRef: 'SSP-KA-2026-99412',
      },
    ]);

    // Student Fee Assignments (Aarav has full historical 2025-26 PAID + partial 2026-27!)
    const [sfaAarav2526, sfaAarav2627, sfaPriya2627, sfaRohan2627] = await tx
      .insert(studentFeeAssignments)
      .values([
        {
          studentId: stuAarav.id,
          academicYearId: ay2526.id,
          feeStructureId: feeStruct2526.id,
          grossAmount: 105000,
          scholarshipDiscount: 10000,
          netPayable: 95000,
          paidAmount: 95000,
          balanceDue: 0,
          status: 'paid',
          dueDate: '2025-09-15',
        },
        {
          studentId: stuAarav.id,
          academicYearId: ay2627.id,
          feeStructureId: feeStruct2627.id,
          grossAmount: 113000,
          scholarshipDiscount: 15000,
          netPayable: 98000,
          paidAmount: 65000,
          balanceDue: 33000,
          status: 'partial',
          dueDate: '2026-12-05',
        },
        {
          studentId: stuPriya.id,
          academicYearId: ay2627.id,
          feeStructureId: feeStruct2627.id,
          grossAmount: 113000,
          scholarshipDiscount: 22000,
          netPayable: 91000,
          paidAmount: 91000,
          balanceDue: 0,
          status: 'paid',
          dueDate: '2026-12-05',
        },
        {
          studentId: stuRohan.id,
          academicYearId: ay2627.id,
          feeStructureId: feeStruct2627.id,
          grossAmount: 113000,
          scholarshipDiscount: 0,
          netPayable: 113000,
          paidAmount: 0,
          balanceDue: 113000,
          status: 'pending',
          dueDate: '2026-12-05',
        },
      ])
      .returning();

    const [pay2526, pay2627, payPriya] = await tx
      .insert(feePayments)
      .values([
        {
          studentId: stuAarav.id,
          academicYearId: ay2526.id,
          studentFeeAssignmentId: sfaAarav2526.id,
          receiptNumber: 'RCPT-2025-0412',
          amountPaid: 95000,
          paymentDate: new Date('2025-08-22T06:15:00Z'),
          paymentMode: 'neft_rtgs',
          collectedByProfileId: adminProfile.id,
          remarks: '2025–26 Annual Tuition Settled',
        },
        {
          studentId: stuAarav.id,
          academicYearId: ay2627.id,
          studentFeeAssignmentId: sfaAarav2627.id,
          receiptNumber: 'RCPT-2026-0891',
          amountPaid: 65000,
          paymentDate: new Date('2026-08-18T08:40:00Z'),
          paymentMode: 'upi',
          collectedByProfileId: adminProfile.id,
          remarks: 'Installment 1 · Sem 5 Tuition',
        },
        {
          studentId: stuPriya.id,
          academicYearId: ay2627.id,
          studentFeeAssignmentId: sfaPriya2627.id,
          receiptNumber: 'RCPT-2026-0895',
          amountPaid: 91000,
          paymentDate: new Date('2026-08-19T10:12:00Z'),
          paymentMode: 'netbanking',
          collectedByProfileId: adminProfile.id,
          remarks: 'Full Annual Settlement after State SSP Concession',
        },
      ])
      .returning();

    await tx.insert(paymentTransactions).values([
      {
        feePaymentId: pay2526.id,
        transactionReference: 'UTR-HDFC-25082299184',
        gatewayName: 'Institutional NEFT Desk',
        gatewayStatus: 'settled',
        amount: 95000,
        currency: 'INR',
      },
      {
        feePaymentId: pay2627.id,
        transactionReference: 'UPI-623019884120',
        gatewayName: 'Campus UPI Collect',
        gatewayStatus: 'settled',
        amount: 65000,
        currency: 'INR',
      },
      {
        feePaymentId: payPriya.id,
        transactionReference: 'NB-SBI-26081955120',
        gatewayName: 'SBI Collect Portal',
        gatewayStatus: 'settled',
        amount: 91000,
        currency: 'INR',
      },
    ]);

    // 22. Announcements, Notifications & Preferences
    await tx.insert(announcements).values([
      {
        institutionId: inst.id,
        authorProfileId: adminProfile.id,
        title: 'Semester 5 Internal Assessment-2 Schedule Published',
        body: 'IA-2 examinations for all B.E. Semester 5 sections commence on 28 November 2026. Students must maintain a minimum of 75% attendance as per VTU norms.',
        targetScope: 'college',
        priority: 'important',
      },
      {
        institutionId: inst.id,
        authorProfileId: facultyRaoProfile.id,
        title: 'DBMS Lab Project Review & Schema Defense',
        body: 'CSE 5A batches A1 and A2 will present PostgreSQL ER schemas and normalization scripts in CSE-LAB-1 next Tuesday.',
        targetScope: 'department',
        targetDepartmentId: deptCse.id,
        priority: 'normal',
      },
      {
        institutionId: inst.id,
        authorProfileId: adminProfile.id,
        title: 'Academic Year 2026–27 Balance Fee Due Date Reminder',
        body: 'Students with partial fee balances for AY 2026–27 are requested to clear remaining dues before 05 December 2026 via UPI or NEFT.',
        targetScope: 'college',
        priority: 'urgent',
      },
    ]);

    await tx.insert(notifications).values([
      {
        recipientProfileId: studentAaravProfile.id,
        category: 'attendance',
        title: 'Live Attendance Session Active — 21CS53 DBMS',
        message: 'Dr. Kavitha Rao opened a Dynamic QR attendance session in LH-301. Scan the rotating QR code before the session closes.',
        actionUrl: '/student/attendance',
      },
      {
        recipientProfileId: studentAaravProfile.id,
        category: 'fee',
        title: 'Balance Fee Due: ₹33,000 by 05 Dec 2026',
        message: 'Your AY 2026–27 Semester 5 balance after ₹15,000 merit concession is ₹33,000.',
        actionUrl: '/student/fees',
      },
      {
        recipientProfileId: studentKarthikProfile.id,
        category: 'low_attendance',
        title: 'Attendance Shortage Warning (Below 75%)',
        message: 'Your current Semester 5 attendance is 25.0%. Please meet your class advisor Dr. Kavitha Rao immediately.',
        actionUrl: '/student/attendance',
      },
      {
        recipientProfileId: parentSharmaProfile.id,
        category: 'fee',
        title: 'Ward Fee Installment Reminder — Aarav Sharma',
        message: 'Installment 2 of ₹33,000 for AY 2026–27 is due on 05 Dec 2026.',
        actionUrl: '/parent/fees',
      },
    ]);

    await tx.insert(notificationPreferences).values([
      { profileId: studentAaravProfile.id, lowAttendanceAlertThreshold: 75 },
      { profileId: parentSharmaProfile.id, lowAttendanceAlertThreshold: 75 },
    ]);

    // 23. System Settings, Consent Records & Audit Logs
    await tx.insert(systemSettings).values([
      {
        institutionId: inst.id,
        settingKey: 'institution_name',
        settingValue: 'Impact College of Engineering and Applied Sciences',
        category: 'branding',
        description: 'Official institutional display title across headers and PDF reports.',
        isPublic: true,
        updatedByProfileId: adminProfile.id,
      },
      {
        institutionId: inst.id,
        settingKey: 'institution_logo_initials',
        settingValue: 'ICEAS',
        category: 'branding',
        description: 'Configurable institutional monogram displayed in workspace navigation.',
        isPublic: true,
        updatedByProfileId: adminProfile.id,
      },
      {
        institutionId: inst.id,
        settingKey: 'qr_token_ttl_seconds',
        settingValue: '25',
        category: 'attendance',
        description: 'Validity window in seconds for rotating Dynamic QR attendance tokens.',
        isPublic: false,
        updatedByProfileId: adminProfile.id,
      },
      {
        institutionId: inst.id,
        settingKey: 'min_attendance_threshold_pct',
        settingValue: '75',
        category: 'attendance',
        description: 'VTU mandatory minimum attendance percentage.',
        isPublic: true,
        updatedByProfileId: adminProfile.id,
      },
    ]);

    await tx.insert(consentRecords).values([
      {
        studentId: stuAarav.id,
        consentType: 'biometric_face_verification',
        status: 'granted',
        consentVersion: 'v1.0-ICEAS-2026',
        grantedAt: new Date('2026-08-05T05:30:00Z'),
      },
      {
        studentId: stuPriya.id,
        consentType: 'biometric_face_verification',
        status: 'granted',
        consentVersion: 'v1.0-ICEAS-2026',
        grantedAt: new Date('2026-08-05T06:10:00Z'),
      },
      {
        studentId: stuRohan.id,
        consentType: 'biometric_face_verification',
        status: 'withdrawn',
        consentVersion: 'v1.0-ICEAS-2026',
        grantedAt: new Date('2026-08-05T06:20:00Z'),
        withdrawnAt: new Date('2026-09-12T10:00:00Z'),
        purgedBiometricDataAt: new Date('2026-09-12T10:00:01Z'),
      },
    ]);

    await tx.insert(auditLogs).values([
      {
        actorProfileId: adminProfile.id,
        actorRole: 'super_admin',
        action: 'COHORT_PROMOTION',
        entityType: 'academic_years',
        entityId: String(ay2627.id),
        beforeStateJson: { academicYear: '2025-26', semester: 4 },
        afterStateJson: { academicYear: '2026-27', semester: 5, promotedCount: 3 },
        reason: 'Annual academic progression from Sem 4 (2025-26) to Sem 5 (2026-27) preserving historical records.',
      },
      {
        actorProfileId: facultyRaoProfile.id,
        actorRole: 'faculty',
        action: 'ATTENDANCE_SESSION_STARTED',
        entityType: 'attendance_sessions',
        entityId: String(sessActiveQr.id),
        afterStateJson: { subject: '21CS53', mode: 'dynamic_qr', qrIntervalSeconds: 25 },
        reason: 'Scheduled Period 3 DBMS lecture in LH-301.',
      },
    ]);
  });
}

export async function getActiveInstitutionId(): Promise<number> {
  const rows = await db.select({ id: institutions.id }).from(institutions).limit(1);
  if (rows.length === 0) {
    await ensureSeedData();
    const again = await db.select({ id: institutions.id }).from(institutions).limit(1);
    return again[0].id;
  }
  return rows[0].id;
}
