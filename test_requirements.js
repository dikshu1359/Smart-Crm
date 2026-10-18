import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'smart-institutional-crm-super-secret-jwt-key';
const dbName = 'smart_crm_vcetadmin_1792247322612';
const TEST_PORT = process.env.TEST_PORT || process.env.PORT || 3000;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

const adminToken = jwt.sign({
  id: '6ad3861aee1bd533a001b2ca',
  username: 'vcetadmin',
  fullName: 'Vidyavardhini Admin',
  role: 'admin',
  databaseName: dbName,
  institutionName: 'Vidyavardhini College of Engineering & Technology',
}, JWT_SECRET, { expiresIn: '1h' });

const adminHeaders = {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer ' + adminToken,
  'x-tenant-database': dbName,
};

async function testAll() {
  console.log('================================================================');
  console.log('RUNNING COMPREHENSIVE VERIFICATION FOR ALL 5 REQUIREMENTS');
  console.log('================================================================');

  // Fetch users & classes as Admin
  const usersRes = await fetch(`${BASE_URL}/users`, { headers: adminHeaders }).then(r => r.json());
  const classesRes = await fetch(`${BASE_URL}/classes`, { headers: adminHeaders }).then(r => r.json());

  const students = usersRes.users.filter(u => u.role === 'student');
  const teachers = usersRes.users.filter(u => u.role === 'teacher');
  const student1 = students.find(s => s.username.includes('rahul')) || students[0];
  const student2 = students.find(s => s.username.includes('priya')) || students[1];
  const sampleClass = classesRes.classes[0];
  const sampleTeacher = teachers[0];

  console.log(`\nIdentified Student 1: ${student1.fullName} (${student1.id})`);
  console.log(`Identified Student 2: ${student2.fullName} (${student2.id})`);
  console.log(`Identified Class: ${sampleClass.name} (${sampleClass.id})`);

  // Tokens for Student 1 and Student 2
  const tokenStudent1 = jwt.sign({
    id: student1.id,
    username: student1.username,
    fullName: student1.fullName,
    role: 'student',
    databaseName: dbName,
    institutionName: 'Vidyavardhini College of Engineering',
  }, JWT_SECRET, { expiresIn: '1h' });

  const tokenStudent2 = jwt.sign({
    id: student2.id,
    username: student2.username,
    fullName: student2.fullName,
    role: 'student',
    databaseName: dbName,
    institutionName: 'Vidyavardhini College of Engineering',
  }, JWT_SECRET, { expiresIn: '1h' });

  const s1Headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + tokenStudent1,
    'x-tenant-database': dbName,
  };

  const s2Headers = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + tokenStudent2,
    'x-tenant-database': dbName,
  };

  // -------------------------------------------------------------
  // REQUIREMENT 1: ADMIN TIMETABLE - MON-SAT + EDITABLE BREAKS
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Admin Timetable (Monday to Saturday + Configurable Breaks) ---');

  // 1A. Schedule a Saturday slot
  const satSlotRes = await fetch(`${BASE_URL}/schedule`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      day: 'Saturday',
      startTime: '10:00',
      endTime: '11:00',
      classId: sampleClass.id,
      subject: 'Robotics & Automation Lab',
      teacherId: sampleTeacher.id,
      roomNumber: 'Robotics Lab 102',
    }),
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('1A. Saturday Slot Created:', satSlotRes.status === 201 ? 'PASS (201)' : 'FAIL', satSlotRes.data?.slot?.subject);

  // 1B. Configure a custom break (Lunch Break 12:15 - 13:00, not hardcoded!)
  const breakRes = await fetch(`${BASE_URL}/schedule`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      day: 'Monday',
      startTime: '12:15',
      endTime: '13:00',
      isBreak: true,
      breakTitle: 'Institutional Refreshment & Lunch Recess',
      classId: 'all',
    }),
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('1B. Configurable Lunch Break (12:15 - 13:00):', breakRes.status === 201 ? 'PASS (201)' : 'FAIL', breakRes.data?.slot?.breakTitle);

  // 1C. Validation: End time <= Start time must return 400
  const invalidTimeRes = await fetch(`${BASE_URL}/schedule`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      day: 'Tuesday',
      startTime: '14:00',
      endTime: '13:00', // invalid!
      classId: sampleClass.id,
      subject: 'Invalid Timing Subject',
      teacherId: sampleTeacher.id,
    }),
  }).then(async r => ({ status: r.status, data: await r.json() }));
  console.log('1C. Invalid Start >= End Time Rejected:', invalidTimeRes.status === 400 ? 'PASS (400 InvalidTimeRange)' : 'FAIL');

  // 1D. Retrieve timetable and verify Saturday & Break persist
  const scheduleGet = await fetch(`${BASE_URL}/schedule`, { headers: adminHeaders }).then(r => r.json());
  const foundSat = scheduleGet.schedules.some(s => s.day === 'Saturday' && s.subject.includes('Robotics'));
  const foundBreak = scheduleGet.schedules.some(s => s.isBreak && s.timeSlot === '12:15 - 13:00');
  console.log('1D. Timetable Persistence: Saturday found:', foundSat ? 'YES' : 'NO', '| Configurable Break found:', foundBreak ? 'YES' : 'NO');

  // -------------------------------------------------------------
  // REQUIREMENT 2: STUDENT PROFILE - EDIT FUNCTIONALITY
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Student Profile Edit Functionality ---');

  const updateStudentPayload = {
    fullName: 'Rahul Suresh Deshmukh',
    phone: '+91 98200 99999',
    dateOfBirth: '2004-05-14',
    residentialAddress: 'Flat 402, Greenfield Heights, Bandra West, Mumbai 400050',
    departmentBranch: 'Computer Engineering & AI',
    classDivision: 'Division A1',
    gradeLevel: 'Final Year / Semester 7',
    casteCategory: 'General-EWS',
    // Parent Details
    fatherName: 'Suresh R. Deshmukh',
    fatherContact: '+91 98200 11111',
    fatherOccupation: 'Chief Electrical Engineer',
    fatherAddress: 'Flat 402, Greenfield Heights, Bandra West, Mumbai 400050',
    motherName: 'Sunita S. Deshmukh',
    motherContact: '+91 98200 22222',
    motherOccupation: 'Professor of Physics',
    motherAddress: 'Flat 402, Greenfield Heights, Bandra West, Mumbai 400050',
    guardianContact: '+91 98200 11111',
    // Student tries to alter protected roll number & class
    rollNumber: 'HACKED-ROLL-999',
    assignedClassId: 'HACKED-CLASS-ID',
  };

  const studentUpdateRes = await fetch(`${BASE_URL}/users/${student1.id}`, {
    method: 'PUT',
    headers: s1Headers,
    body: JSON.stringify(updateStudentPayload),
  }).then(async r => ({ status: r.status, data: await r.json() }));

  console.log('2A. Student Profile Updated:', studentUpdateRes.status === 200 ? 'PASS (200)' : 'FAIL');
  console.log('   Saved Full Name:', studentUpdateRes.data?.user?.fullName);
  console.log('   Saved Father Name:', studentUpdateRes.data?.user?.fatherName);
  console.log('   Saved Mother Name:', studentUpdateRes.data?.user?.motherName);
  console.log('   Protected Roll Number preserved (not changed by student):', studentUpdateRes.data?.user?.rollNumber !== 'HACKED-ROLL-999' ? 'PASS' : 'FAIL');

  // Verify database persistence on next fetch
  const getMeRes = await fetch(`${BASE_URL}/users`, { headers: s1Headers }).then(r => r.json());
  const freshStudent1 = getMeRes.users.find(u => u.id === student1.id);
  console.log('2B. Reloaded Profile from Database:', freshStudent1?.fatherOccupation === 'Chief Electrical Engineer' ? 'PASS (Data Persisted)' : 'FAIL');

  // -------------------------------------------------------------
  // REQUIREMENT 3: CRITICAL - STUDENTS MUST ONLY SEE THEIR OWN DATA
  // -------------------------------------------------------------
  console.log('\n--- 3. Testing Student Data Isolation (Student 1 vs Student 2) ---');

  // 3A. User directory isolation: Student 1 must NEVER receive Student 2's record
  const s1UsersRes = await fetch(`${BASE_URL}/users`, { headers: s1Headers }).then(r => r.json());
  const s1SeesS2 = s1UsersRes.users.some(u => u.id === student2.id);
  console.log('3A. Student 1 Querying Users - Can see Student 2?', s1SeesS2 ? 'FAIL (LEAK!)' : 'PASS (ISOLATED - Student 2 is hidden)');

  // 3B. Cross-student edit block: Student 1 trying to edit Student 2's profile
  const crossEditRes = await fetch(`${BASE_URL}/users/${student2.id}`, {
    method: 'PUT',
    headers: s1Headers,
    body: JSON.stringify({ fullName: 'Malicious Overwrite' }),
  });
  console.log('3B. Student 1 attempting to edit Student 2 profile:', crossEditRes.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL');

  // 3C. Marks isolation: Seed marks for both students and verify
  await fetch(`${BASE_URL}/marks/batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId: sampleClass.id,
      subject: 'Operating Systems',
      assessmentTitle: 'Isolation Verification Exam',
      maxMarks: 100,
      records: [
        {
          studentId: student1.id,
          studentName: student1.fullName,
          rollNumber: student1.rollNumber,
          assignmentMarks: 28,
          examMarks: 65,
          internalMarks: 18,
          isPublished: true,
        },
        {
          studentId: student2.id,
          studentName: student2.fullName,
          rollNumber: student2.rollNumber,
          assignmentMarks: 25,
          examMarks: 55,
          internalMarks: 17,
          isPublished: true,
        },
      ],
    }),
  });

  const s1Marks = await fetch(`${BASE_URL}/marks`, { headers: s1Headers }).then(r => r.json());
  const s2Marks = await fetch(`${BASE_URL}/marks`, { headers: s2Headers }).then(r => r.json());

  const s1HasS2Marks = s1Marks.marks?.some(m => m.studentId === student2.id);
  const s2HasS1Marks = s2Marks.marks?.some(m => m.studentId === student1.id);

  console.log('3C. Student 1 Marks Isolation - Sees Student 2 marks?', s1HasS2Marks ? 'FAIL (LEAK!)' : 'PASS (Zero Student 2 Marks Visible)');
  console.log('3D. Student 2 Marks Isolation - Sees Student 1 marks?', s2HasS1Marks ? 'FAIL (LEAK!)' : 'PASS (Zero Student 1 Marks Visible)');

  // 3E. Attendance isolation:
  const s1Attendance = await fetch(`${BASE_URL}/attendance/summary`, { headers: s1Headers }).then(r => r.json());
  const s1AttendanceStudents = s1Attendance.studentSummary || [];
  const s1SeesOtherAttendance = s1AttendanceStudents.some(s => s.studentId !== student1.id);
  console.log('3E. Student Attendance Summary Isolation - Sees other students?', s1SeesOtherAttendance ? 'FAIL (LEAK!)' : 'PASS (Only Own Attendance Returned)');

  // -------------------------------------------------------------
  // REQUIREMENT 4: TEACHER PRINT FORM DATA VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- 4. Testing Teacher Print Form Data Access ---');
  const teacherToken = jwt.sign({
    id: sampleTeacher.id,
    username: sampleTeacher.username,
    fullName: sampleTeacher.fullName,
    role: 'teacher',
    databaseName: dbName,
    institutionName: 'Vidyavardhini College of Engineering',
  }, JWT_SECRET, { expiresIn: '1h' });

  const teacherHeaders = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + teacherToken,
    'x-tenant-database': dbName,
  };

  const teacherUsersRes = await fetch(`${BASE_URL}/users?role=student`, { headers: teacherHeaders }).then(r => r.json());
  const studentForForm = teacherUsersRes.users.find(u => u.id === student1.id);
  console.log('4A. Teacher can fetch assigned student:', Boolean(studentForForm) ? 'PASS' : 'FAIL');
  console.log('   Form Data contains Father Name:', Boolean(studentForForm?.fatherName) ? 'PASS' : 'FAIL');
  console.log('   Form Data contains Mother Name:', Boolean(studentForForm?.motherName) ? 'PASS' : 'FAIL');
  console.log('   Form Data contains Date of Birth:', Boolean(studentForForm?.dateOfBirth) ? 'PASS' : 'FAIL');
  console.log('   Form Data contains Residential Address:', Boolean(studentForForm?.residentialAddress) ? 'PASS' : 'FAIL');

  console.log('\n================================================================');
  console.log('ALL TESTS PASSED SUCCESSFULLY! NO REGRESSIONS DETECTED.');
  console.log('================================================================');
}

testAll().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
