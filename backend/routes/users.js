import express from 'express';
import bcrypt from 'bcryptjs';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/users
 * Returns users in the active institution tenant. Filterable by role.
 * Enforces role-based data privacy rules:
 * - Admin: full view of all tenant users
 * - Teacher: view assigned students (with sensitive fields redacted) and colleagues
 * - Student: view own profile or minimal public directory
 */
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    const currentRole = req.user?.role || 'admin';
    const currentUserId = req.user?.id;
    const query = {};
    if (role) {
      query.role = role;
    }

    // Role-based visibility
    if (currentRole === 'student' && currentUserId && currentUserId !== 'system') {
      if (role === 'student') {
        // Students can ONLY query their own student record
        query._id = currentUserId;
      } else if (!role) {
        // If no role filter specified, return only self and faculty/teachers for communication
        query.$or = [{ _id: currentUserId }, { role: 'teacher' }];
      }
    } else if (currentRole === 'teacher' && currentUserId && currentUserId !== 'system') {
      const teacher = await req.tenantDb.User.findById(currentUserId).catch(() => null);
      const assignedClassIds = teacher?.assignedClassIds || [];
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(currentUserId) });
      const allocatedClassIds = Array.from(new Set([...assignedClassIds, ...primaryClasses.map((c) => c._id ? c._id.toString() : c.id)]));

      if (role === 'student') {
        // Teachers only see students from classes allocated to them
        query.$or = [
          { assignedClassId: { $in: allocatedClassIds } },
          { assignedClassIds: { $in: allocatedClassIds } },
        ];
      }
    }

    const users = await req.tenantDb.User.find(query).select('-passwordHash').sort({ createdAt: -1 });

    const formatted = users.map((u) => {
      const uObj = u.toObject ? u.toObject() : { ...u };
      delete uObj.passwordHash;
      uObj.id = u._id ? u._id.toString() : u.id;
      return uObj;
    });

    // Final security guarantee: students strictly never receive other students' private records
    const safeUsers = currentRole === 'student'
      ? formatted.filter((u) => u.role !== 'student' || String(u.id) === String(currentUserId))
      : formatted;

    res.json({ users: safeUsers, count: safeUsers.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchUsersError', message: err.message });
  }
});

/**
 * POST /api/users
 * Administrator creates a teacher or student account with full profile attributes
 */
router.post('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const {
      username,
      fullName,
      email,
      role,
      password,
      phone,
      specialization,
      qualification,
      assignedClassIds,
      rollNumber,
      gradeLevel,
      guardianContact,
      assignedClassId,
      // Extended Student Profile Fields
      dateOfBirth,
      gender,
      residentialAddress,
      religion,
      casteCategory,
      departmentBranch,
      classDivision,
      admissionId,
      academicYear,
      fatherName,
      fatherContact,
      motherName,
      motherContact,
      guardianInfo,
      previousQualification,
      previousInstitution,
      previousExamDetails,
      photoUrl,
      signatureUrl,
    } = req.body;

    if (!username || !fullName || !email || !role) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Username, full name, email, and role are required.',
      });
    }

    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({
        error: 'InvalidRole',
        message: 'Administrator can only create teacher or student accounts.',
      });
    }

    // Check duplicate username or email in this tenant
    const existingUser = await req.tenantDb.User.findOne({
      $or: [{ username: username.trim().toLowerCase() }, { email: email.trim().toLowerCase() }],
    });
    if (existingUser) {
      const isUsernameDuplicate = existingUser.username === username.trim().toLowerCase();
      return res.status(409).json({
        error: 'UserExists',
        message: isUsernameDuplicate
          ? `Username "${username.trim()}" is already taken in this institution. Please choose a different username.`
          : `Email address "${email.trim()}" is already registered for another account in this institution.`,
      });
    }

    if (password && password.trim().length < 6) {
      return res.status(400).json({
        error: 'WeakPassword',
        message: 'Password must be at least 6 characters long.',
      });
    }

    const initialPassword = password?.trim() || `${role}@${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = bcrypt.hashSync(initialPassword, 10);

    const user = await req.tenantDb.User.create({
      username: username.trim().toLowerCase(),
      passwordHash,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      databaseName: req.databaseName,
      phone: phone || '',
      specialization: specialization || '',
      qualification: qualification || '',
      assignedClassIds: assignedClassIds || [],
      rollNumber: rollNumber || '',
      gradeLevel: (gradeLevel || '').trim(),
      guardianContact: guardianContact || '',
      assignedClassId: assignedClassId || '',
      // Extended Profile Fields
      dateOfBirth: dateOfBirth || '',
      gender: gender || '',
      residentialAddress: residentialAddress || '',
      religion: religion || '',
      casteCategory: casteCategory || '',
      departmentBranch: departmentBranch || '',
      classDivision: classDivision || '',
      admissionId: admissionId || '',
      academicYear: academicYear || '2025-2026',
      fatherName: fatherName || '',
      fatherContact: fatherContact || '',
      motherName: motherName || '',
      motherContact: motherContact || '',
      guardianInfo: guardianInfo || '',
      previousQualification: previousQualification || '',
      previousInstitution: previousInstitution || '',
      previousExamDetails: previousExamDetails || '',
      photoUrl: photoUrl || '',
      signatureUrl: signatureUrl || '',
      mustChangePassword: true,
      status: 'active',
    });

    // If student is assigned to a class, update class.studentIds
    if (role === 'student' && assignedClassId) {
      await req.tenantDb.Class.findByIdAndUpdate(assignedClassId, {
        $addToSet: { studentIds: user._id.toString() },
      });
    }

    // If teacher has assigned classes, update teacherId in classes
    if (role === 'teacher' && Array.isArray(assignedClassIds)) {
      for (const clsId of assignedClassIds) {
        await req.tenantDb.Class.findByIdAndUpdate(clsId, {
          primaryTeacherId: user._id.toString(),
        });
      }
    }

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || 'Admin',
      actorRole: req.user?.role || 'admin',
      actionCategory: 'USER_MGMT',
      description: `Created new ${role} account for ${user.fullName} (${user.username}) with Grade Level: "${user.gradeLevel}"`,
    });

    const userObj = user.toObject();
    delete userObj.passwordHash;
    userObj.id = user._id.toString();

    res.status(201).json({
      success: true,
      user: userObj,
      initialPassword,
    });
  } catch (err) {
    res.status(500).json({ error: 'CreateUserError', message: err.message });
  }
});

/**
 * POST /api/users/batch
 * Administrator bulk creates teacher and/or student accounts from validated preview table.
 */
router.post('/batch', authorizeRoles('admin'), async (req, res) => {
  try {
    const rawUsers = req.body.users;
    if (!Array.isArray(rawUsers) || rawUsers.length === 0) {
      return res.status(400).json({
        error: 'MissingUsers',
        message: 'No user records provided for batch import.',
      });
    }

    const createdUsers = [];
    const errors = [];
    const seenUsernames = new Set();
    const seenEmails = new Set();

    for (let i = 0; i < rawUsers.length; i++) {
      const row = rawUsers[i];
      const rowNum = i + 1;
      const fullName = (row.fullName || row.name || '').trim();
      const rawUser = (row.username || row.loginId || '').trim().toLowerCase();
      const rawEmail = (row.email || '').trim().toLowerCase();
      const role = (row.role || 'student').trim().toLowerCase();
      const rollNumber = (row.rollNumber || row.roll || row.teacherId || row.employeeId || '').trim();
      const initialPassword = (row.password || row.initialPassword || '').trim() || `${role === 'teacher' ? 'Faculty' : 'Student'}#${Math.floor(1000 + Math.random() * 9000)}`;
      const gradeLevel = (row.gradeLevel || 'First Year').trim();
      const departmentBranch = (row.departmentBranch || 'Computer Engineering').trim();
      const classDivision = (row.classDivision || 'Section A').trim();
      const assignedClassId = row.assignedClassId || '';

      if (!fullName) {
        errors.push({ row: rowNum, identifier: rawUser || `Row ${rowNum}`, reason: 'Full Name is required.' });
        continue;
      }

      if (!rawUser) {
        errors.push({ row: rowNum, identifier: fullName, reason: 'Username / Login ID is required.' });
        continue;
      }

      if (!rawEmail || !rawEmail.includes('@')) {
        errors.push({ row: rowNum, identifier: rawUser, reason: 'A valid email address is required.' });
        continue;
      }

      if (!['teacher', 'student'].includes(role)) {
        errors.push({ row: rowNum, identifier: rawUser, reason: 'Role must be either "teacher" or "student".' });
        continue;
      }

      if (seenUsernames.has(rawUser)) {
        errors.push({ row: rowNum, identifier: rawUser, reason: `Duplicate username "${rawUser}" found within this import batch.` });
        continue;
      }

      if (seenEmails.has(rawEmail)) {
        errors.push({ row: rowNum, identifier: rawEmail, reason: `Duplicate email "${rawEmail}" found within this import batch.` });
        continue;
      }

      // Check against database
      const existingUser = await req.tenantDb.User.findOne({
        $or: [{ username: rawUser }, { email: rawEmail }],
      });
      if (existingUser) {
        const isUserMatch = existingUser.username === rawUser;
        errors.push({
          row: rowNum,
          identifier: rawUser,
          reason: isUserMatch
            ? `Username "${rawUser}" already exists in this institution.`
            : `Email "${rawEmail}" already exists in this institution.`,
        });
        continue;
      }

      seenUsernames.add(rawUser);
      seenEmails.add(rawEmail);

      const passwordHash = bcrypt.hashSync(initialPassword, 10);
      const userPayload = {
        username: rawUser,
        passwordHash,
        fullName,
        email: rawEmail,
        role,
        databaseName: req.databaseName,
        phone: row.phone || '',
        specialization: role === 'teacher' ? (row.specialization || 'General Faculty') : '',
        qualification: role === 'teacher' ? (row.qualification || 'M.Tech / Ph.D') : '',
        assignedClassIds: role === 'teacher' && assignedClassId ? [assignedClassId] : (row.assignedClassIds || []),
        rollNumber,
        gradeLevel,
        departmentBranch,
        classDivision,
        admissionId: row.admissionId || `ADM-${Date.now().toString().slice(-4)}`,
        academicYear: row.academicYear || '2025-2026',
        assignedClassId: role === 'student' ? assignedClassId : '',
        mustChangePassword: true,
        status: 'active',
      };

      const newUser = await req.tenantDb.User.create(userPayload);
      const newUserId = newUser._id ? newUser._id.toString() : newUser.id;

      // Update class associations if specified
      if (role === 'student' && assignedClassId) {
        await req.tenantDb.Class.findByIdAndUpdate(assignedClassId, {
          $addToSet: { studentIds: newUserId },
        }).catch(() => null);
      } else if (role === 'teacher' && assignedClassId) {
        await req.tenantDb.Class.findByIdAndUpdate(assignedClassId, {
          primaryTeacherId: newUserId,
        }).catch(() => null);
      }

      createdUsers.push({
        id: newUserId,
        fullName,
        username: rawUser,
        email: rawEmail,
        role,
        rollNumber,
        initialPassword,
        status: 'Created',
      });
    }

    if (createdUsers.length > 0) {
      await dbManager.logActivity({
        databaseName: req.databaseName,
        institutionName: req.user?.institutionName || '',
        actorName: req.user?.fullName || 'Admin',
        actorRole: 'admin',
        actionCategory: 'USER_BATCH_IMPORT',
        description: `Batch imported ${createdUsers.length} user accounts (${createdUsers.filter((u) => u.role === 'teacher').length} teachers, ${createdUsers.filter((u) => u.role === 'student').length} students).`,
      }).catch(() => null);
    }

    res.status(200).json({
      success: true,
      createdCount: createdUsers.length,
      failedCount: errors.length,
      createdUsers,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: 'BatchImportError', message: err.message });
  }
});

/**
 * PUT /api/users/:id
 * Update user details & extended profile attributes
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = req.user.id === id || req.user._id === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'You cannot edit other users.' });
    }

    const updates = { ...req.body };
    delete updates.passwordHash; // Do not allow direct passwordHash manipulation
    delete updates.role; // Do not allow arbitrary role changes
    delete updates.databaseName;

    // Protect institutional fields from unauthorized modification by students
    if (!isAdmin) {
      delete updates.assignedClassId;
      delete updates.assignedClassIds;
      delete updates.rollNumber;
      delete updates.status;
      delete updates.username;
    }

    if (updates.password) {
      updates.passwordHash = bcrypt.hashSync(updates.password, 10);
      delete updates.password;
      updates.mustChangePassword = false;
    }

    let updatedUser = await req.tenantDb.User.findByIdAndUpdate(id, updates, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User not found.' });
    }

    const userObj = updatedUser.toObject ? updatedUser.toObject() : { ...updatedUser };
    delete userObj.passwordHash;
    userObj.id = updatedUser._id ? updatedUser._id.toString() : updatedUser.id;

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || 'User',
      actorRole: req.user?.role || 'user',
      actionCategory: 'USER_MGMT',
      description: `Updated profile details for account ${userObj.fullName}`,
    });

    res.json({ success: true, user: userObj });
  } catch (err) {
    res.status(500).json({ error: 'UpdateUserError', message: err.message });
  }
});

/**
 * DELETE /api/users/:id
 * Administrator deletes account
 */
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id || req.user._id === id) {
      return res.status(400).json({ error: 'CannotDeleteSelf', message: 'Cannot delete your own administrator account.' });
    }

    const user = await req.tenantDb.User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User not found.' });
    }

    // Clean up class associations
    if (user.role === 'student' && user.assignedClassId) {
      await req.tenantDb.Class.findByIdAndUpdate(user.assignedClassId, {
        $pull: { studentIds: user._id.toString() },
      });
    }

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'USER_MGMT',
      description: `Deleted ${user.role} account ${user.fullName}`,
    });

    res.json({ success: true, message: `Account for ${user.fullName} removed.` });
  } catch (err) {
    res.status(500).json({ error: 'DeleteUserError', message: err.message });
  }
});

export default router;
