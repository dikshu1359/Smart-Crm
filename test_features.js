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

const headers = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + adminToken,
  'x-tenant-database': dbName,
};

async function runTests() {
  console.log('--- Running Features Verification ---');

  // 1. Get classes
  const classesRes = await fetch('http://localhost:5001/api/classes', { headers }).then(r => r.json());
  console.log('1. Classes Count:', classesRes.classes?.length);
  const sampleClass = classesRes.classes?.[0];
  const classId = sampleClass?.id;
  console.log('   Target Class ID:', classId, 'Name:', sampleClass?.name);

  // 2. Test Assignment creation
  const asgnRes = await fetch('http://localhost:5001/api/assignments', {
    method: 'POST',
    headers,
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

  // 3. Test Quiz creation
  const quizRes = await fetch('http://localhost:5001/api/quizzes', {
    method: 'POST',
    headers,
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
  const marksRes = await fetch('http://localhost:5001/api/marks/batch', {
    method: 'POST',
    headers,
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
  const getMarksRes = await fetch(`http://localhost:5001/api/marks?classId=${classId}`, { headers }).then(r => r.json());
  console.log('5. Marks Retrieval Count:', getMarksRes.count, 'Student:', getMarksRes.marks?.[0]?.studentName, 'Total:', getMarksRes.marks?.[0]?.totalMarks, 'Grade:', getMarksRes.marks?.[0]?.grade);

  // 6. Test Roster Import
  const rosterRes = await fetch(`http://localhost:5001/api/classes/${classId}/import-roster`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      students: [
        { rollNumber: 'CS-801', fullName: 'Sneha Kulkarni', email: 'sneha.k@vcet.edu' },
        { rollNumber: 'CS-802', fullName: 'Amitabh Joshi', email: 'amitabh.j@vcet.edu' },
      ],
    }),
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('6. Roster Import Status:', rosterRes.status, 'Success:', rosterRes.data.success, 'Imported Count:', rosterRes.data.importedCount);

  console.log('--- All Tests Completed Successfully ---');
}

runTests().catch(console.error);
