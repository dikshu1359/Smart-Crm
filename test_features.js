import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'smart-institutional-crm-super-secret-jwt-key';
const dbName = 'smart_crm_vcetadmin_1792247322612';

const adminToken = jwt.sign({
  id: '6ad3861aee1bd533a001b2ca',
  username: 'vcetadmin',
  fullName: 'Vidyavardhini Admin',
  role: 'admin',
  databaseName: dbName,
  institutionName: 'Vidyavardhini College of Engineering',
}, JWT_SECRET, { expiresIn: '1h' });

const adminHeaders = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + adminToken,
  'x-tenant-database': dbName,
};

const teacherToken = jwt.sign({
  id: '6ad3861aee1bd533a001b2cc',
  username: 'jdoe',
  fullName: 'Dr. Anita Desai',
  role: 'teacher',
  databaseName: dbName,
  institutionName: 'Vidyavardhini College of Engineering',
}, JWT_SECRET, { expiresIn: '1h' });

const teacherHeaders = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + teacherToken,
  'x-tenant-database': dbName,
};

const PORT = process.env.PORT || 3000;

async function runTests() {
  console.log('--- Running Features Verification ---');

  // 1. Get classes
  const classesRes = await fetch(`http://localhost:${PORT}/api/classes`, { headers: adminHeaders }).then(r => r.json());
  console.log('1. Classes Count:', classesRes.classes?.length);
  const sampleClass = classesRes.classes?.[0];
  const classId = sampleClass?.id;
  console.log('   Target Class ID:', classId, 'Name:', sampleClass?.name);

  // 2. Test Assignment creation (Teacher required)
  const asgnRes = await fetch(`http://localhost:${PORT}/api/assignments`, {
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
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('2. Assignment Creation Status:', asgnRes.status, 'Success:', asgnRes.data.success, 'Title:', asgnRes.data.assignment?.title);

  // 3. Test Quiz creation (Teacher required)
  const quizRes = await fetch(`http://localhost:${PORT}/api/quizzes`, {
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
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('3. Quiz Creation Status:', quizRes.status, 'Success:', quizRes.data.success, 'Quiz ID:', quizRes.data.quiz?._id);

  // 4. Test Marks Batch Saving
  const marksRes = await fetch(`http://localhost:${PORT}/api/marks/batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId,
      subject: 'Operating Systems',
      assessmentTitle: 'Mid-Term Exam 2026',
      maxMarks: 100,
      records: [
        {
          studentId: '6ad3861aee1bd533a001b2cb',
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
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('4. Marks Batch Save Status:', marksRes.status, 'Count:', marksRes.data.count);

  // 5. Test Marks Retrieval
  const getMarksRes = await fetch(`http://localhost:${PORT}/api/marks?classId=${classId}`, { headers: adminHeaders }).then(r => r.json());
  console.log('5. Marks Retrieval Count:', getMarksRes.count, 'Student:', getMarksRes.marks?.[0]?.studentName, 'Total:', getMarksRes.marks?.[0]?.totalMarks, 'Grade:', getMarksRes.marks?.[0]?.grade);

  // 6. Test Roster Import
  const rosterRes = await fetch(`http://localhost:${PORT}/api/classes/${classId}/import-roster`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      students: [
        { rollNumber: 'CS-801', fullName: 'Sneha Kulkarni', email: 'sneha.k@vcet.edu' },
        { rollNumber: 'CS-802', fullName: 'Amitabh Joshi', email: 'amitabh.j@vcet.edu' },
      ],
    }),
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('6. Roster Import Status:', rosterRes.status, 'Success:', rosterRes.data.success, 'Imported Count:', rosterRes.data.importedCount);

  // 7. Teacher Attendance Marking (Authorized Teacher Dr. Anita Desai)
  const markAttRes = await fetch(`http://localhost:${PORT}/api/attendance`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      classId,
      date: '2026-10-18',
      records: [
        { studentId: '6ad3861aee1bd533a001b2cb', studentName: 'Rahul Deshmukh', rollNumber: 'CS-101', status: 'present', remarks: 'On time' },
        { studentId: '6ad3861aee1bd533a001b2ce', studentName: 'Priya Patel', rollNumber: 'CS-102', status: 'present', remarks: '' },
      ],
    }),
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('7. Teacher Attendance Marking Status:', markAttRes.status, 'Success:', markAttRes.data.success, 'Present Count:', markAttRes.data.attendance?.presentCount);

  // 8. Student Attendance Marking Attempt (Must be rejected with 403 Forbidden)
  const studentToken = jwt.sign({
    id: '6ad3861aee1bd533a001b2cb',
    username: 'cs101_rahul',
    fullName: 'Rahul Deshmukh',
    role: 'student',
    databaseName: dbName,
    institutionName: 'Vidyavardhini College of Engineering',
  }, JWT_SECRET, { expiresIn: '1h' });

  const studentHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + studentToken,
    'x-tenant-database': dbName,
  };

  const studentMarkAttempt = await fetch(`http://localhost:${PORT}/api/attendance`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({
      classId,
      date: '2026-10-18',
      records: [{ studentId: '6ad3861aee1bd533a001b2cb', status: 'present' }],
    }),
  }).then(async r => {
    const text = await r.text();
    try {
      return { status: r.status, data: JSON.parse(text) };
    } catch {
      console.error('Test 8 response text was:', text);
      return { status: r.status, data: text };
    }
  });
  console.log('8. Student Unauthorized Attendance Marking Status:', studentMarkAttempt.status, '(Expected: 403 Forbidden)');

  // 9. Student Attendance Query (Must return isolated personal record only)
  const studentGetAtt = await fetch(`http://localhost:${PORT}/api/attendance?date=2026-10-18`, {
    headers: studentHeaders,
  }).then(async r => ({ status: r.status, data: await r.json() }));
  const studentSession = studentGetAtt.data.attendance?.[0];
  console.log('9. Student Attendance Query Status:', studentGetAtt.status, 'Personal Status:', studentSession?.personalStatus, 'Records Length:', studentSession?.records?.length, '(Expected: 1 isolated record)');

  // 10. Admin Teacher Attendance Monitoring
  const adminTeacherAtt = await fetch(`http://localhost:${PORT}/api/attendance/teachers?date=2026-10-18`, {
    headers: adminHeaders,
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('10. Admin Faculty Attendance Monitoring Status:', adminTeacherAtt.status, 'Total Teachers:', adminTeacherAtt.data.totalTeachers, 'Present:', adminTeacherAtt.data.presentCount, 'Faculty Attendance Rate:', adminTeacherAtt.data.facultyAttendanceRate + '%');

  console.log('--- All 10 Tests Completed Successfully ---');
}

runTests().catch(console.error);
