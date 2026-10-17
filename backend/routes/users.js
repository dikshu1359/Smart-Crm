import express from 'express';
import bcrypt from 'bcryptjs';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/users
 * Returns users in the active institution tenant. Filterable by role.
 */
router.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    const query = {};
    if (role) {
      query.role = role;
    }

    const users = await req.tenantDb.User.find(query).select('-passwordHash').sort({ createdAt: -1 });
    const formatted = users.map((u) => ({
      ...u.toObject(),
      id: u._id.toString(),
    }));
    res.json({ users: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchUsersError', message: err.message });
  }
});

/**
 * POST /api/users
 * Administrator creates a teacher or student account
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
      gradeLevel: gradeLevel || '',
      guardianContact: guardianContact || '',
      assignedClassId: assignedClassId || '',
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
      description: `Created new ${role} account for ${user.fullName} (${user.username})`,
    });

    const userObj = user.toObject();
    delete userObj.passwordHash;
    userObj.id = user._id.toString();

    res.status(201).json({
      success: true,
      user: userObj,
      initialPassword, // Provided securely once upon creation for initial delivery
    });
  } catch (err) {
    res.status(500).json({ error: 'CreateUserError', message: err.message });
  }
});

/**
 * PUT /api/users/:id
 * Update user details
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden', message: 'You cannot edit other users.' });
    }

    const updates = { ...req.body };
    delete updates.passwordHash; // Do not allow direct passwordHash manipulation
    delete updates.role; // Do not allow arbitrary role changes

    if (updates.password) {
      updates.passwordHash = bcrypt.hashSync(updates.password, 10);
      delete updates.password;
      updates.mustChangePassword = false;
    }

    const updatedUser = await req.tenantDb.User.findByIdAndUpdate(id, updates, { new: true }).select('-passwordHash');
    if (!updatedUser) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User not found.' });
    }

    res.json({ success: true, user: updatedUser });
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
    if (req.user.id === id) {
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
