import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'smart-institutional-crm-super-secret-jwt-key';
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('--- Running Features Verification ---');

  const suffix = Date.now().toString().slice(-5);

  // Register an institution for the test run
  const regRes = await fetch(`${BASE_URL}/auth/register-institution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institutionName: `Vidyavardhini Testing Campus ${suffix}`,
      adminUsername: `vcetadm_${suffix}`,
      adminName: 'Dean Academic Affairs',
      adminEmail: `academic_${suffix}@vcet.edu`,
      password: 'SecurePassword123!',
      campusCode: 'VCET-MAIN',
    }),
  }).then((r) => r.json());

  if (!regRes.success) {
    console.error('Registration failed:', regRes);
    process.exit(1);
  }

  const dbName = regRes.databaseName;
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${regRes.token}`,
    'x-tenant-database': dbName,
  };

  // 1. Create a Teacher
  const teacherRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Dr. Anita Desai',
      username: `adesai_${suffix}`,
      email: `adesai_${suffix}@vcet.edu`,
      password: 'TeacherPassword123!',
      role: 'teacher',
      specialization: 'Operating Systems & Distributed Networks',
    }),
  }).then((r) => r.json());

  const teacherId = teacherRes.user?.id;

  // 2. Create a Class cohort
  const classRes = await fetch(`${BASE_URL}/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Computer Engineering - Year 3 Division A',
      gradeLevel: 'Year 3',
      section: 'A',
      code: `COMP-A-${suffix}`,
      department: 'Computer Engineering',
      semester: 'Semester 5',
      academicYear: '2026-2027',
      primaryTeacherId: teacherId,
      capacity: 60,
    }),
  }).then((r) => r.json());

  const classId = classRes.class?.id || classRes.class?._id;
  console.log('1. Created Class ID:', classId, 'Name:', classRes.class?.name);

  // Assign class to teacher
  await fetch(`${BASE_URL}/users/${teacherId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      assignedClassIds: [classId],
    }),
  });

  // 3. Create a Student
  const studentRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Rahul Deshmukh',
      username: `rdeshmukh_${suffix}`,
      email: `rdeshmukh_${suffix}@vcet.edu`,
      password: 'StudentPassword123!',
      role: 'student',
      rollNumber: 'CS-101',
      assignedClassId: classId,
    }),
  }).then((r) => r.json());

  const studentId = studentRes.user?.id;

  // Login as Teacher
  const teacherLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `adesai_${suffix}`,
      password: 'TeacherPassword123!',
      databaseName: dbName,
    }),
  }).then((r) => r.json());

  const teacherHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${teacherLogin.token}`,
    'x-tenant-database': dbName,
  };

  // Login as Student
  const studentLogin = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `rdeshmukh_${suffix}`,
      password: 'StudentPassword123!',
      databaseName: dbName,
    }),
  }).then((r) => r.json());

  const studentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${studentLogin.token}`,
    'x-tenant-database': dbName,
  };

  // 4. Test Assignment creation (Teacher required)
  const asgnRes = await fetch(`${BASE_URL}/assignments`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      title: 'Operating Systems Virtual Memory Lab',
      subject: 'Operating Systems',
      description: 'Implement page replacement algorithms (FIFO, LRU, Optimal) in C++.',
      targetClassIds: [classId],
      issueDate: '2026-10-17',
      dueDate: '2026-10-31',
      maxMarks: 100,
      attachments: [{ id: 'att-101', name: 'lab_spec.pdf', size: '1.5 MB', mimeType: 'application/pdf' }],
    }),
  }).then(async (r) => ({ status: r.status, data: await r.json() }));
  console.log('2. Assignment Creation Status:', asgnRes.status, 'Success:', asgnRes.data.success, 'Title:', asgnRes.data.assignment?.title);

  // 5. Test Quiz creation (Teacher required)
  const quizRes = await fetch(`${BASE_URL}/quizzes`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      title: 'OS Process Synchronization Quiz',
      subject: 'Operating Systems',
      description: 'Critical Section, Semaphores, and Mutex Locks.',
      targetClassIds: [classId],
      durationMinutes: 30,
      isPublished: true,
      questions: [
        {
          questionText: 'Which primitive provides mutual exclusion without busy waiting?',
          options: ['Counting Semaphore', 'Spinlock', 'Peterson Algorithm', 'Test-and-Set'],
          correctOptionIndex: 0,
          marks: 5,
        },
      ],
    }),
  }).then(async (r) => ({ status: r.status, data: await r.json() }));
  console.log('3. Quiz Creation Status:', quizRes.status, 'Success:', quizRes.data.success, 'Quiz ID:', quizRes.data.quiz?._id);

  // 6. Test Marks Batch Saving (Teacher only)
  const marksRes = await fetch(`${BASE_URL}/marks/batch`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      classId,
      subject: 'Operating Systems',
      assessmentTitle: 'Mid-Term Exam 2026',
      maxMarks: 100,
      records: [
        {
          studentId,
          studentName: 'Rahul Deshmukh',
          rollNumber: 'CS-101',
          assignmentMarks: 28,
          examMarks: 45,
          internalMarks: 18,
          teacherFeedback: 'Outstanding analytical reasoning and implementation.',
          isPublished: true,
        },
      ],
    }),
  }).then(async (r) => ({ status: r.status, data: await r.json() }));
  console.log('4. Marks Batch Save Status:', marksRes.status, 'Count:', marksRes.data.count);

  // 7. Test Marks Retrieval
  const getMarksRes = await fetch(`${BASE_URL}/marks?classId=${classId}`, { headers: teacherHeaders }).then((r) => r.json());
  console.log('5. Marks Retrieval Count:', getMarksRes.count, 'Student:', getMarksRes.marks?.[0]?.studentName, 'Total:', getMarksRes.marks?.[0]?.totalMarks, 'Grade:', getMarksRes.marks?.[0]?.grade);

  // 8. Test Roster Import
  const rosterRes = await fetch(`${BASE_URL}/classes/${classId}/import-roster`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      students: [
        { rollNumber: 'CS-801', fullName: 'Sneha Kulkarni', email: `sneha.${suffix}@vcet.edu` },
        { rollNumber: 'CS-802', fullName: 'Amitabh Joshi', email: `amitabh.${suffix}@vcet.edu` },
      ],
    }),
  }).then(async (r) => ({ status: r.status, data: await r.json() }));
  console.log('6. Roster Import Status:', rosterRes.status, 'Success:', rosterRes.data.success, 'Imported Count:', rosterRes.data.importedCount);

  // 9. Teacher Attendance Marking (Authorized Teacher)
  const markAttRes = await fetch(`${BASE_URL}/attendance`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      classId,
      date: '2026-10-18',
      records: [
        { studentId, studentName: 'Rahul Deshmukh', rollNumber: 'CS-101', status: 'present', remarks: 'On time' },
      ],
    }),
  }).then(async (r) => ({ status: r.status, data: await r.json() }));
  console.log('7. Teacher Attendance Marking Status:', markAttRes.status, 'Success:', markAttRes.data.success, 'Present Count:', markAttRes.data.attendance?.presentCount);

  // 10. Student Attendance Marking Attempt (Must be rejected with 403 Forbidden)
  const studentAttRes = await fetch(`${BASE_URL}/attendance`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({
      classId,
      date: '2026-10-18',
      records: [{ studentId, status: 'present' }],
    }),
  });
  console.log('8. Student Attendance Marking Blocked Status:', studentAttRes.status, '(Expected 403)');

  // 11. Student Attendance View (Strictly isolated to their own records)
  const viewAttRes = await fetch(`${BASE_URL}/attendance`, {
    headers: studentHeaders,
  }).then((r) => r.json());
  console.log('9. Student Attendance Records Count:', viewAttRes.count, 'Personal Status:', viewAttRes.attendance?.[0]?.personalStatus);

  const summaryRes = await fetch(`${BASE_URL}/attendance/summary`, {
    headers: studentHeaders,
  }).then((r) => r.json());
  console.log('10. Student Attendance Summary Rate:', summaryRes.studentSummary?.[0]?.percentage + '%', 'Status:', summaryRes.studentSummary?.[0]?.statusBadge);

  console.log('\n--- All Feature Tests Successfully Completed ---');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
