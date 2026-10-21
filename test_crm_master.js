import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTestSuite() {
  console.log('====================================================');
  console.log('   SMART INSTITUTIONAL CRM MASTER INTEGRATION TEST   ');
  console.log('====================================================\n');

  let passedTests = 0;
  const totalTests = 11;

  // 1. Admin registers new institution
  console.log('[Test 1] Testing Admin Institution Registration with real identity...');
  const uniqueSuffix = Date.now().toString().slice(-5);
  const regPayload = {
    institutionName: `MIT Institute of Technology ${uniqueSuffix}`,
    adminUsername: `mitadmin${uniqueSuffix}`,
    adminName: 'Dean Sarah Jenkins',
    adminEmail: `admin${uniqueSuffix}@mit.edu`,
    password: 'SecureAdminPassword123!',
    campusCode: 'MIT-TECH',
  };

  const regRes = await fetch(`${BASE_URL}/auth/register-institution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload),
  }).then((r) => r.json());

  if (regRes.success && regRes.token && regRes.databaseName) {
    console.log('  -> PASS: Registered institution with database:', regRes.databaseName);
    passedTests++;
  } else {
    console.error('  -> FAIL: Registration failed:', regRes);
    process.exit(1);
  }

  const adminToken = regRes.token;
  const dbName = regRes.databaseName;
  const adminHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${adminToken}`,
    'x-tenant-database': dbName,
  };

  // 2. Verify authenticated admin profile matches real name (no hardcoded "Prof. Rajesh Sharma")
  console.log('\n[Test 2] Verifying Real Admin Profile Loading from Database (no "Prof. Rajesh Sharma")...');
  const meRes = await fetch(`${BASE_URL}/auth/me`, { headers: adminHeaders }).then((r) => r.json());
  if (meRes.user?.fullName === 'Dean Sarah Jenkins') {
    console.log('  -> PASS: Authenticated profile accurately reflects real administrator:', meRes.user.fullName);
    passedTests++;
  } else {
    console.error('  -> FAIL: Incorrect identity loaded:', meRes.user);
  }

  // 3. Admin creates individual Teacher account first
  console.log('\n[Test 3] Admin creates Teacher account...');
  const teacherUser = `profturing${uniqueSuffix}`;
  const teacherPwd = 'TeacherPassword123!';
  const createTeacherRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Prof. Alan Turing',
      username: teacherUser,
      email: `alan${uniqueSuffix}@mit.edu`,
      role: 'teacher',
      password: teacherPwd,
      specialization: 'Theoretical Computer Science',
      qualification: 'Ph.D. in Mathematics & Computation',
    }),
  }).then((r) => r.json());

  const createdTeacherId = createTeacherRes.user?.id;
  if (createTeacherRes.success && createdTeacherId) {
    console.log('  -> PASS: Created teacher account:', createTeacherRes.user.fullName, `(username: ${teacherUser})`);
    passedTests++;
  } else {
    console.error('  -> FAIL: Teacher creation failed:', createTeacherRes);
  }

  // 4. Admin creates class cohort with teacher
  console.log('\n[Test 4] Admin creates class cohort allocated to teacher...');
  const classRes = await fetch(`${BASE_URL}/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Computer Science & AI - Year 3',
      gradeLevel: 'Year 3 / Semester 5',
      section: 'A',
      roomNumber: 'Hall 401',
      capacity: 60,
      primaryTeacherId: createdTeacherId,
      subjects: ['Data Structures', 'Operating Systems', 'Artificial Intelligence'],
    }),
  }).then((r) => r.json());

  const createdClassId = classRes.class?.id || classRes.class?._id;
  if (classRes.success && createdClassId) {
    console.log('  -> PASS: Created class cohort:', classRes.class.name, `(ID: ${createdClassId})`);
    passedTests++;
  } else {
    console.error('  -> FAIL: Failed to create class:', classRes);
  }

  // 5. Admin creates individual Student account
  console.log('\n[Test 5] Admin creates Student account...');
  const studentUser = `adalovelace${uniqueSuffix}`;
  const studentPwd = 'StudentPassword123!';
  const createStudentRes = await fetch(`${BASE_URL}/users`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      fullName: 'Ada Lovelace',
      username: studentUser,
      email: `ada${uniqueSuffix}@mit.edu`,
      role: 'student',
      password: studentPwd,
      rollNumber: 'CS-2026-001',
      gradeLevel: 'Year 3',
      departmentBranch: 'Computer Science',
      assignedClassId: createdClassId,
    }),
  }).then((r) => r.json());

  const createdStudentId = createStudentRes.user?.id;
  if (createStudentRes.success && createdStudentId) {
    console.log('  -> PASS: Created student account:', createStudentRes.user.fullName, `(username: ${studentUser})`);
    passedTests++;
  } else {
    console.error('  -> FAIL: Student creation failed:', createStudentRes);
  }

  // 6. Teacher logs in with issued credentials
  console.log('\n[Test 6] Teacher Login using Admin-issued credentials...');
  const teacherLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: teacherUser,
      password: teacherPwd,
      databaseName: dbName,
    }),
  }).then((r) => r.json());

  const teacherToken = teacherLoginRes.token;
  if (teacherLoginRes.success && teacherLoginRes.user?.role === 'teacher') {
    console.log('  -> PASS: Teacher authenticated successfully with role:', teacherLoginRes.user.role);
    passedTests++;
  } else {
    console.error('  -> FAIL: Teacher login failed:', teacherLoginRes);
  }

  const teacherHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`,
    'x-tenant-database': dbName,
  };

  // 7. Student logs in with issued credentials
  console.log('\n[Test 7] Student Login using Admin-issued credentials...');
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: studentUser,
      password: studentPwd,
      databaseName: dbName,
    }),
  }).then((r) => r.json());

  const studentToken = studentLoginRes.token;
  if (studentLoginRes.success && studentLoginRes.user?.role === 'student') {
    console.log('  -> PASS: Student authenticated successfully with role:', studentLoginRes.user.role);
    passedTests++;
  } else {
    console.error('  -> FAIL: Student login failed:', studentLoginRes);
  }

  const studentHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${studentToken}`,
    'x-tenant-database': dbName,
  };

  // 8. Admin Bulk Import via POST /api/users/batch
  console.log('\n[Test 8] Admin Bulk User Import via POST /api/users/batch...');
  const batchRes = await fetch(`${BASE_URL}/users/batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      users: [
        {
          fullName: 'Claude Shannon',
          username: `cshannon${uniqueSuffix}`,
          email: `shannon${uniqueSuffix}@mit.edu`,
          role: 'student',
          rollNumber: 'CS-2026-002',
          assignedClassId: createdClassId,
        },
        {
          fullName: 'Grace Hopper',
          username: `ghopper${uniqueSuffix}`,
          email: `hopper${uniqueSuffix}@mit.edu`,
          role: 'teacher',
          specialization: 'Compiler Systems',
          assignedClassIds: [createdClassId],
        },
        {
          fullName: 'Duplicate Test Account',
          username: `cshannon${uniqueSuffix}`, // Duplicate username
          email: `duplicate${uniqueSuffix}@mit.edu`,
          role: 'student',
        },
      ],
    }),
  }).then((r) => r.json());

  if (batchRes.success && batchRes.createdCount === 2 && batchRes.failedCount === 1) {
    console.log(`  -> PASS: Bulk import succeeded. Created: ${batchRes.createdCount}, Rejected duplicate: ${batchRes.failedCount}`);
    passedTests++;
  } else {
    console.error('  -> FAIL: Bulk import unexpected result:', batchRes);
  }

  // 9. Marks Entry RBAC Enforcement
  console.log('\n[Test 9] Marks Entry RBAC (Teacher permitted, Admin forbidden)...');
  // 9a. Teacher enters marks
  const teacherMarksRes = await fetch(`${BASE_URL}/marks/batch`, {
    method: 'POST',
    headers: teacherHeaders,
    body: JSON.stringify({
      classId: createdClassId,
      subject: 'Operating Systems',
      assessmentTitle: 'Mid-Term Examination 2026',
      maxMarks: 100,
      records: [
        {
          studentId: createdStudentId,
          studentName: 'Ada Lovelace',
          rollNumber: 'CS-2026-001',
          assignmentMarks: 28,
          examMarks: 48,
          internalMarks: 19,
          teacherFeedback: 'Exemplary algorithmic comprehension.',
        },
      ],
    }),
  });

  // 9b. Admin attempts to enter marks (MUST return 403 Forbidden)
  const adminMarksRes = await fetch(`${BASE_URL}/marks/batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      classId: createdClassId,
      subject: 'Operating Systems',
      assessmentTitle: 'Mid-Term Examination 2026',
      records: [{ studentId: createdStudentId }],
    }),
  });

  if (teacherMarksRes.status === 200 && adminMarksRes.status === 403) {
    console.log('  -> PASS: Teacher marks entry permitted (200 OK); Admin marks editing rejected (403 Forbidden).');
    passedTests++;
  } else {
    console.error('  -> FAIL: RBAC mismatch. Teacher status:', teacherMarksRes.status, 'Admin status:', adminMarksRes.status);
  }

  // 10. Study AI Role Restriction & Execution
  console.log('\n[Test 10] Study AI Endpoint Access & RBAC...');
  // 10a. Admin attempts to call Study AI (MUST be 403 Forbidden)
  const adminAiRes = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ prompt: 'Explain Dijkstra algorithm' }),
  });

  // 10b. Student calls Study AI (Allowed - 200 or 503 if API key missing)
  const studentAiRes = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: studentHeaders,
    body: JSON.stringify({ prompt: 'Explain Banker algorithm in OS' }),
  });

  if (adminAiRes.status === 403 && (studentAiRes.status === 200 || studentAiRes.status === 503)) {
    console.log(`  -> PASS: Admin Study AI access denied (403 Forbidden); Student access accepted (Status: ${studentAiRes.status}).`);
    passedTests++;
  } else {
    console.error('  -> FAIL: Study AI unexpected status. Admin:', adminAiRes.status, 'Student:', studentAiRes.status);
  }

  // 11. Multi-Tenant Data Isolation
  console.log('\n[Test 11] Multi-Tenant Data Isolation between institutions...');
  // Attempt to access newly created database using mismatched tenant header
  const foreignHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${teacherToken}`,
    'x-tenant-database': 'smart_crm_fake_tenant_999999',
  };
  const foreignRes = await fetch(`${BASE_URL}/classes`, { headers: foreignHeaders });
  if (foreignRes.status === 403) {
    console.log('  -> PASS: Cross-tenant unauthorized access strictly rejected with 403 Forbidden.');
    passedTests++;
  } else {
    console.error('  -> FAIL: Cross-tenant unauthorized access not rejected:', foreignRes.status);
  }

  console.log('\n====================================================');
  console.log(`   TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
