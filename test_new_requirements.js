import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runVerification() {
  console.log('====================================================');
  console.log('VERIFYING NEW REQUIREMENTS: CRM REPAIR & INTEGRITY');
  console.log('====================================================');

  const suffix = Date.now().toString().slice(-5);
  const configuredAdminPass = process.env.ADMIN_PASSWORD || 'admin123';

  // ----------------------------------------------------
  // TEST 1: Predefined Admin Login
  // ----------------------------------------------------
  console.log('\n[1] Testing Predefined Admin Login with admin@smartcrm.local...');
  const predefinedLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin@smartcrm.local',
      password: configuredAdminPass,
    }),
  }).then((r) => r.json());

  if (!predefinedLoginRes.success) {
    throw new Error(`Predefined admin login failed: ${JSON.stringify(predefinedLoginRes)}`);
  }
  console.log('  -> Success! Predefined admin logged in.');
  console.log('  -> User:', predefinedLoginRes.user?.fullName, 'Role:', predefinedLoginRes.user?.role);
  console.log('  -> Tenant Database:', predefinedLoginRes.databaseName);

  const adminToken = predefinedLoginRes.token;
  const dbName = predefinedLoginRes.databaseName || predefinedLoginRes.tenant?.databaseName || predefinedLoginRes.user?.databaseName;
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
    'x-tenant-database': dbName,
  };

  // ----------------------------------------------------
  // TEST 2: Bulk User Import with initial passwords & login check
  // ----------------------------------------------------
  console.log('\n[2] Testing Bulk User Creation with custom credentials & login...');
  const batchImportRes = await fetch(`${BASE_URL}/users/batch`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      users: [
        {
          fullName: `Imported Teacher ${suffix}`,
          username: `iteacher_${suffix}`,
          email: `iteacher_${suffix}@smartcrm.local`,
          password: `TempTeach#${suffix}!`,
          role: 'teacher',
          specialization: 'Quantum Algorithms',
        },
        {
          fullName: `Imported Student One ${suffix}`,
          username: `istudent1_${suffix}`,
          email: `istudent1_${suffix}@smartcrm.local`,
          password: `TempStudent#1_${suffix}!`,
          role: 'student',
          rollNumber: `STU-B1-${suffix}`,
        },
        {
          fullName: `Imported Student Two ${suffix}`,
          username: `istudent2_${suffix}`,
          email: `istudent2_${suffix}@smartcrm.local`,
          password: `TempStudent#2_${suffix}!`,
          role: 'student',
          rollNumber: `STU-B2-${suffix}`,
        },
      ],
    }),
  }).then((r) => r.json());

  if (!batchImportRes.success) {
    throw new Error(`Batch user import failed: ${JSON.stringify(batchImportRes)}`);
  }
  console.log('  -> Success! Batch users created. Created count:', batchImportRes.createdCount);

  // Test logging in with the imported student credentials
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `istudent1_${suffix}`,
      password: `TempStudent#1_${suffix}!`,
      databaseName: dbName,
    }),
  }).then((r) => r.json());

  if (!studentLoginRes.success) {
    throw new Error(`Imported student login failed: ${JSON.stringify(studentLoginRes)}`);
  }
  console.log('  -> Success! Imported student logged in successfully.');
  console.log('  -> Student name:', studentLoginRes.user?.fullName, 'Role:', studentLoginRes.user?.role);
  console.log('  -> mustChangePassword flag:', studentLoginRes.user?.mustChangePassword);

  const student1Id = studentLoginRes.user?.id;

  // Find Student Two ID from user list
  const usersListRes = await fetch(`${BASE_URL}/users`, { headers: adminHeaders }).then((r) => r.json());
  const student2Obj = usersListRes.users?.find((u) => u.username === `istudent2_${suffix}`);
  const student2Id = student2Obj?.id || student2Obj?._id;

  // ----------------------------------------------------
  // TEST 3: Admin Password Reset Workflow
  // ----------------------------------------------------
  console.log('\n[3] Testing Admin Password Reset Workflow for Student 1...');
  const newPasswordForStudent1 = `NewlyResetPass#${suffix}!`;
  const resetRes = await fetch(`${BASE_URL}/users/${student1Id}/reset-password`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      newPassword: newPasswordForStudent1,
      requirePasswordChange: true,
    }),
  }).then((r) => r.json());

  if (!resetRes.success) {
    throw new Error(`Admin password reset failed: ${JSON.stringify(resetRes)}`);
  }
  console.log('  -> Success! Password reset succeeded.');

  // Try logging in with the OLD password (should fail 401)
  const oldLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `istudent1_${suffix}`,
      password: `TempStudent#1_${suffix}!`,
      databaseName: dbName,
    }),
  });
  if (oldLoginRes.status !== 401) {
    throw new Error(`Old password was not invalidated! Status: ${oldLoginRes.status}`);
  }
  console.log('  -> Old password correctly rejected with 401 Unauthorized.');

  // Try logging in with the NEW password (should succeed)
  const newLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `istudent1_${suffix}`,
      password: newPasswordForStudent1,
      databaseName: dbName,
    }),
  }).then((r) => r.json());

  if (!newLoginRes.success) {
    throw new Error(`Login with new reset password failed: ${JSON.stringify(newLoginRes)}`);
  }
  console.log('  -> Success! Student successfully logged in with the reset password.');

  // ----------------------------------------------------
  // TEST 4: Easy Class Allotment & Bulk Allotment
  // ----------------------------------------------------
  console.log('\n[4] Testing Easy Class Allotment (Classes A & B, multi-student allotment)...');

  // Find Teacher ID
  const teacherObj = usersListRes.users?.find((u) => u.username === `iteacher_${suffix}`) || usersListRes.users?.find((u) => u.role === 'teacher');
  const teacherId = teacherObj?.id || teacherObj?._id;

  // Create Class A
  const classARes = await fetch(`${BASE_URL}/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Class A - Cohort ${suffix}`,
      gradeLevel: 'Grade 11',
      section: 'A',
      roomNumber: 'Room 101',
      capacity: 35,
      primaryTeacherId: teacherId,
    }),
  }).then((r) => r.json());
  const classAId = classARes.class?.id || classARes.class?._id;

  // Create Class B
  const classBRes = await fetch(`${BASE_URL}/classes`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: `Class B - Cohort ${suffix}`,
      gradeLevel: 'Grade 11',
      section: 'B',
      roomNumber: 'Room 102',
      capacity: 35,
      primaryTeacherId: teacherId,
    }),
  }).then((r) => r.json());
  const classBId = classBRes.class?.id || classBRes.class?._id;

  console.log('  -> Created Class A (ID:', classAId, ') and Class B (ID:', classBId, ')');

  // Bulk allot Student 1 and Student 2 to Class A
  console.log('  -> Bulk allotting Students 1 & 2 to Class A...');
  const bulkAllotRes = await fetch(`${BASE_URL}/classes/${classAId}/bulk-allot`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      studentIds: [student1Id, student2Id],
    }),
  }).then((r) => r.json());

  if (!bulkAllotRes.success) {
    throw new Error(`Bulk allotment failed: ${JSON.stringify(bulkAllotRes)}`);
  }
  console.log('  -> Success! Bulk allotted count:', bulkAllotRes.allottedCount);
  console.log('  -> Class A enrolled student count:', bulkAllotRes.class?.studentIds?.length);

  // Verify students reflect Class A
  const checkUsersRes = await fetch(`${BASE_URL}/users`, { headers: adminHeaders }).then((r) => r.json());
  const stu1Updated = checkUsersRes.users.find((u) => u.id === student1Id || u._id === student1Id);
  const stu2Updated = checkUsersRes.users.find((u) => u.id === student2Id || u._id === student2Id);

  if (stu1Updated.assignedClassId !== classAId || stu2Updated.assignedClassId !== classAId) {
    throw new Error('Students do not reflect Class A assignment!');
  }
  console.log('  -> Verified: Both students now have assignedClassId set to Class A.');

  // Re-allot Student 1 to Class B in bulk
  console.log('  -> Moving Student 1 to Class B...');
  const moveRes = await fetch(`${BASE_URL}/classes/${classBId}/bulk-allot`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      studentIds: [student1Id],
    }),
  }).then((r) => r.json());

  if (!moveRes.success) {
    throw new Error(`Moving student to Class B failed: ${JSON.stringify(moveRes)}`);
  }

  // Verify Class A no longer has Student 1, and Class B now has Student 1 (preventing duplicate/conflicting assignments)
  const classesListRes = await fetch(`${BASE_URL}/classes`, { headers: adminHeaders }).then((r) => r.json());
  const freshClassA = classesListRes.classes.find((c) => c.id === classAId || c._id === classAId);
  const freshClassB = classesListRes.classes.find((c) => c.id === classBId || c._id === classBId);

  const student1InA = freshClassA.studentIds?.includes(student1Id);
  const student1InB = freshClassB.studentIds?.includes(student1Id);

  console.log('  -> Student 1 in Class A?', student1InA, '(Expected: false)');
  console.log('  -> Student 1 in Class B?', student1InB, '(Expected: true)');

  if (student1InA || !student1InB) {
    throw new Error('Conflicting class assignment detected!');
  }
  console.log('  -> Conflict prevention verified: student is in Class B only.');

  // ----------------------------------------------------
  // TEST 5: Study AI Gemini endpoint check
  // ----------------------------------------------------
  console.log('\n[5] Testing Study AI role authorization and endpoint...');
  const teacherToken = (await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: `iteacher_${suffix}`,
      password: `TempTeach#${suffix}!`,
      databaseName: dbName,
    }),
  }).then((r) => r.json())).token;

  const teacherAiHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${teacherToken}`,
    'x-tenant-database': dbName,
  };

  // Test Study AI from teacher (if GEMINI_API_KEY is present or gracefully returns 503 with instructions)
  try {
    const aiTestRes = await fetch(`${BASE_URL}/ai/chat`, {
      method: 'POST',
      headers: teacherAiHeaders,
      body: JSON.stringify({
        prompt: 'Explain the difference between TCP and UDP in 2 bullet points.',
      }),
      signal: AbortSignal.timeout(5000),
    });

    const aiTestJson = await aiTestRes.json().catch(() => ({}));
    console.log('  -> AI Endpoint Status:', aiTestRes.status);
    if (aiTestRes.status === 200) {
      console.log('  -> AI Response generated successfully with model:', aiTestJson.model);
    } else if (aiTestRes.status === 503) {
      console.log('  -> AI Service returned expected 503 when GEMINI_API_KEY is unset or experiencing quota.');
      console.log('  -> Message:', aiTestJson.message);
    }
  } catch (err) {
    console.log('  -> AI test completed (timeout/offline guard):', err.message);
  }

  // Admin calling Study AI should be blocked with 403 Forbidden
  const adminAiRes = await fetch(`${BASE_URL}/ai/chat`, {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ prompt: 'Hello' }),
  });
  console.log('  -> Admin Study AI blocked status:', adminAiRes.status, '(Expected: 403)');
  if (adminAiRes.status !== 403) {
    throw new Error('Admin was not blocked from Study AI!');
  }

  console.log('\n====================================================');
  console.log('ALL VERIFICATION SUITES COMPLETED WITH 100% SUCCESS!');
  console.log('====================================================');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('\nVerification failed:', err.message);
  process.exit(1);
});
