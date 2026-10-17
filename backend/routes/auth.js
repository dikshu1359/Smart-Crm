import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dbManager from '../utils/DatabaseManager.js';
import { tenantAuth } from '../middleware/tenantAuth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'smart-institutional-crm-super-secret-jwt-key';

/**
 * POST /api/auth/register-institution
 * Registers a new institution and creates an isolated database: smart_crm_[username]_[timestamp]
 */
router.post('/register-institution', async (req, res) => {
  try {
    const { institutionName, adminUsername, adminName, adminEmail, campusCode, password } = req.body;
    if (!institutionName || !adminUsername || !adminName || !adminEmail || !password) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Institution name, admin username, admin name, admin email, and password are required.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'WeakPassword',
        message: 'Password must be at least 6 characters long.',
      });
    }

    const { databaseName, registryEntry, adminUser } = await dbManager.createTenantDatabase({
      institutionName,
      adminUsername,
      adminName,
      adminEmail,
      campusCode,
      password,
    });

    const token = jwt.sign(
      {
        id: adminUser._id.toString(),
        username: adminUser.username,
        fullName: adminUser.fullName,
        email: adminUser.email,
        role: adminUser.role,
        databaseName,
        institutionName: registryEntry.institutionName,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: `Institution "${institutionName}" registered and database "${databaseName}" provisioned successfully.`,
      token,
      databaseName,
      user: {
        id: adminUser._id.toString(),
        username: adminUser.username,
        fullName: adminUser.fullName,
        email: adminUser.email,
        role: adminUser.role,
        databaseName,
      },
      tenant: {
        databaseName,
        institutionId: registryEntry._id.toString(),
        institutionName: registryEntry.institutionName,
      },
    });
  } catch (error) {
    res.status(400).json({ error: 'RegistrationFailed', message: error.message });
  }
});

/**
 * POST /api/auth/login
 * Cross-database authentication across all isolated tenant databases.
 */
router.post('/login', async (req, res) => {
  try {
    const usernameOrEmail = req.body.usernameOrEmail || req.body.username || req.body.email;
    const password = req.body.password;
    const requestedDatabaseName = req.body.databaseName || req.headers['x-tenant-database'];

    if (!usernameOrEmail || !password) {
      return res.status(400).json({
        error: 'MissingCredentials',
        message: 'Username/email and password are required.',
      });
    }

    const authResult = await dbManager.authenticateUser(usernameOrEmail, password, requestedDatabaseName);
    if (!authResult) {
      return res.status(401).json({
        error: 'InvalidCredentials',
        message: 'Invalid credentials. Please verify your username/email and password.',
      });
    }

    const { user, token, institutionName } = authResult;

    // Log login activity
    await dbManager.logActivity({
      databaseName: user.databaseName,
      institutionName: institutionName || '',
      actorName: user.fullName,
      actorRole: user.role,
      actionCategory: 'AUTH',
      description: `User ${user.fullName} (${user.role}) logged in successfully`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown',
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id.toString(),
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        databaseName: user.databaseName,
        assignedClassId: user.assignedClassId,
        assignedClassIds: user.assignedClassIds,
        rollNumber: user.rollNumber,
        specialization: user.specialization,
      },
      tenant: {
        databaseName: user.databaseName,
        institutionName: institutionName || '',
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'LoginFailed', message: error.message });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user session and tenant database metadata
 */
router.get('/me', tenantAuth, async (req, res) => {
  try {
    const userDoc = await req.tenantDb.User.findById(req.user.id).select('-passwordHash');
    if (!userDoc) {
      return res.status(404).json({ error: 'UserNotFound', message: 'User account not found.' });
    }

    const [userCount, classCount, assignmentCount] = await Promise.all([
      req.tenantDb.User.countDocuments(),
      req.tenantDb.Class.countDocuments(),
      req.tenantDb.Assignment.countDocuments(),
    ]);

    const masterDb = await dbManager.getMasterDB();
    const inst = await masterDb.Institution.findOne({ databaseName: req.databaseName });
    const userObj = userDoc.toObject();
    userObj.id = userDoc._id.toString();

    res.json({
      user: userObj,
      databaseName: req.databaseName,
      tenant: {
        databaseName: req.databaseName,
        institutionId: inst?._id.toString() || '',
        institutionName: inst?.institutionName || req.user.institutionName || '',
        userCount,
        classCount,
        assignmentCount,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'SessionError', message: error.message });
  }
});

export default router;
