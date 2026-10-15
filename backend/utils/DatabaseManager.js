import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'smart-institutional-crm-super-secret-jwt-key';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart_crm';

/* Master Schemas */
const InstitutionSchema = new mongoose.Schema(
  {
    institutionName: { type: String, required: true },
    adminUsername: { type: String, required: true, unique: true },
    adminName: { type: String, required: true },
    adminEmail: { type: String, required: true },
    databaseName: { type: String, required: true, unique: true },
    campusCode: { type: String, default: 'CAMPUS-01' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const MasterLogSchema = new mongoose.Schema(
  {
    databaseName: { type: String, required: true },
    institutionName: { type: String, default: '' },
    actorName: { type: String, required: true },
    actorRole: { type: String, default: 'admin' },
    actionCategory: { type: String, required: true },
    description: { type: String, required: true },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: 'Node.js/Express' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/* Tenant Schemas */
const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
    databaseName: { type: String, required: true },
    phone: { type: String, default: '' },
    specialization: { type: String, default: '' },
    qualification: { type: String, default: '' },
    assignedClassIds: [{ type: String }],
    rollNumber: { type: String, default: '' },
    gradeLevel: { type: String, default: '' },
    guardianContact: { type: String, default: '' },
    assignedClassId: { type: String, default: '' },
    mustChangePassword: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

const ClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    gradeLevel: { type: String, required: true },
    section: { type: String, required: true },
    roomNumber: { type: String, required: true },
    capacity: { type: Number, default: 30 },
    primaryTeacherId: { type: String, required: true },
    studentIds: [{ type: String }],
    subjects: [{ type: String }],
  },
  { timestamps: true }
);

const FileAttachmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  size: { type: String, default: '0 KB' },
  mimeType: { type: String, default: 'application/octet-stream' },
  contentPreview: { type: String, default: '' },
  dataUrl: { type: String, default: '' },
  uploadedAt: { type: Date, default: Date.now },
});

const SubmissionSchema = new mongoose.Schema(
  {
    assignmentId: { type: String, required: true, index: true },
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    rollNumber: { type: String, default: '' },
    classId: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'under_review', 'accepted', 'rejected', 'reassigned', 'graded'],
      default: 'submitted',
    },
    submittedAt: { type: Date, default: Date.now },
    studentNotes: { type: String, default: '' },
    attachments: [FileAttachmentSchema],
    teacherReviewNotes: { type: String, default: '' },
    marksObtained: { type: Number, default: null },
    gradedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const AssignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    targetClassIds: [{ type: String, required: true }],
    teacherId: { type: String, required: true },
    teacherName: { type: String, required: true },
    dueDate: { type: String, required: true },
    maxMarks: { type: Number, default: 100 },
    attachments: [FileAttachmentSchema],
  },
  { timestamps: true }
);

const ScheduleSchema = new mongoose.Schema(
  {
    day: { type: String, enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], required: true },
    timeSlot: { type: String, required: true },
    classId: { type: String, required: true },
    subject: { type: String, required: true },
    teacherId: { type: String, required: true },
    roomNumber: { type: String, required: true },
  },
  { timestamps: true }
);

const QuizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    targetClassIds: [{ type: String, required: true }],
    teacherId: { type: String, required: true },
    teacherName: { type: String, required: true },
    durationMinutes: { type: Number, default: 30 },
    totalMarks: { type: Number, default: 20 },
    passMarks: { type: Number, default: 10 },
    questions: [
      {
        questionText: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctOptionIndex: { type: Number, required: true },
        marks: { type: Number, default: 5 },
      },
    ],
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const QuizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: String, required: true, index: true },
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    rollNumber: { type: String, default: '' },
    classId: { type: String, required: true },
    answers: [
      {
        questionIndex: { type: Number, required: true },
        selectedOptionIndex: { type: Number, required: true },
      },
    ],
    score: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const NoticeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: {
      type: String,
      enum: ['Institutional', 'Assignment', 'Schedule', 'Examination'],
      default: 'Institutional',
    },
    targetRole: { type: String, enum: ['all', 'teacher', 'student'], default: 'all' },
    targetClassId: { type: String, default: '' },
    authorName: { type: String, required: true },
    authorRole: { type: String, default: 'admin' },
    readByUserIds: [{ type: String }],
  },
  { timestamps: true }
);

const MessageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    senderRole: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
    recipientId: { type: String, required: true, index: true },
    recipientName: { type: String, required: true },
    recipientRole: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
    text: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ActivityLogSchema = new mongoose.Schema(
  {
    databaseName: { type: String, required: true },
    institutionName: { type: String, default: '' },
    actorName: { type: String, required: true },
    actorRole: { type: String, default: 'admin' },
    actionCategory: { type: String, required: true },
    description: { type: String, required: true },
    ipAddress: { type: String, default: '127.0.0.1' },
    userAgent: { type: String, default: 'Node.js/Express' },
  },
  { timestamps: true }
);

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.tenantModels = new Map();
    this.masterDb = null;
    this.initPromise = this.connect();
  }

  async connect() {
    if (this.connection && this.connection.readyState === 1) {
      return this.connection;
    }
    try {
      this.connection = await mongoose.createConnection(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 20,
      }).asPromise();

      console.log('[DatabaseManager] Connected to MongoDB Atlas cluster.');
      const masterConn = this.connection.useDb('smart_crm_master', { useCache: true });
      this.masterDb = {
        name: 'smart_crm_master',
        conn: masterConn,
        Institution: masterConn.model('Institution', InstitutionSchema),
        MasterLog: masterConn.model('MasterLog', MasterLogSchema),
      };
      return this.connection;
    } catch (err) {
      console.error('[DatabaseManager] Connection error:', err.message);
      throw err;
    }
  }

  async ensureConnected() {
    if (!this.connection || this.connection.readyState !== 1) {
      await this.connect();
    }
  }

  async getMasterDB() {
    await this.ensureConnected();
    return this.masterDb;
  }

  async getTenantDB(databaseName) {
    if (!databaseName) return null;
    await this.ensureConnected();

    if (this.tenantModels.has(databaseName)) {
      return this.tenantModels.get(databaseName);
    }

    const tenantConn = this.connection.useDb(databaseName, { useCache: true });
    const models = {
      databaseName,
      conn: tenantConn,
      User: tenantConn.model('User', UserSchema),
      Class: tenantConn.model('Class', ClassSchema),
      Assignment: tenantConn.model('Assignment', AssignmentSchema),
      Submission: tenantConn.model('Submission', SubmissionSchema),
      Schedule: tenantConn.model('Schedule', ScheduleSchema),
      Quiz: tenantConn.model('Quiz', QuizSchema),
      QuizAttempt: tenantConn.model('QuizAttempt', QuizAttemptSchema),
      Notice: tenantConn.model('Notice', NoticeSchema),
      Message: tenantConn.model('Message', MessageSchema),
      ActivityLog: tenantConn.model('ActivityLog', ActivityLogSchema),
    };

    this.tenantModels.set(databaseName, models);
    return models;
  }

  async createTenantDatabase({ institutionName, adminUsername, adminName, adminEmail, campusCode, password }) {
    await this.ensureConnected();
    const cleanSlug = adminUsername
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 16) || 'tenant';
    const timestamp = Date.now();
    const databaseName = `smart_crm_${cleanSlug}_${timestamp}`;

    // Check duplicate in Master DB
    const existing = await this.masterDb.Institution.findOne({
      $or: [{ adminUsername: cleanSlug }, { institutionName: institutionName.trim() }],
    });
    if (existing) {
      throw new Error(`Institution name or admin username "${cleanSlug}" is already registered.`);
    }

    // 1. Create entry in master DB
    const registryEntry = await this.masterDb.Institution.create({
      institutionName: institutionName.trim(),
      adminUsername: cleanSlug,
      adminName: adminName.trim(),
      adminEmail: adminEmail.trim(),
      databaseName,
      campusCode: campusCode?.trim() || 'CAMPUS-01',
      status: 'active',
    });

    // 2. Initialize isolated tenant database
    const tenantDb = await this.getTenantDB(databaseName);

    // 3. Create initial Admin account
    const passwordHash = bcrypt.hashSync(password || 'admin123', 10);
    const adminUser = await tenantDb.User.create({
      username: cleanSlug,
      passwordHash,
      fullName: adminName.trim(),
      email: adminEmail.trim(),
      role: 'admin',
      databaseName,
      status: 'active',
    });

    // 4. Log in master and tenant activity
    await this.logActivity({
      databaseName,
      institutionName,
      actorName: adminName,
      actorRole: 'admin',
      actionCategory: 'TENANT_DB',
      description: `Provisioned isolated database ${databaseName} on MongoDB Atlas`,
    });

    return { databaseName, registryEntry, adminUser };
  }

  async deleteTenantDatabase(databaseName) {
    await this.ensureConnected();
    const institution = await this.masterDb.Institution.findOne({ databaseName });
    if (!institution) return false;

    // Drop database from MongoDB
    const tenantDb = await this.getTenantDB(databaseName);
    if (tenantDb && tenantDb.conn) {
      await tenantDb.conn.dropDatabase();
    }
    this.tenantModels.delete(databaseName);

    // Remove from master registry
    await this.masterDb.Institution.deleteOne({ databaseName });

    // Log deletion
    await this.logActivity({
      databaseName: 'smart_crm_master',
      institutionName: institution.institutionName,
      actorName: 'System Administrator',
      actorRole: 'admin',
      actionCategory: 'TENANT_DB',
      description: `Dropped tenant database ${databaseName}`,
    });

    return true;
  }

  async authenticateUser(usernameOrEmail, password, requestedDatabaseName = null) {
    await this.ensureConnected();
    const query = (usernameOrEmail || '').trim();
    if (!query) return null;

    // If tenant database specified, search directly in that tenant
    if (requestedDatabaseName) {
      const tenant = await this.getTenantDB(requestedDatabaseName);
      if (tenant) {
        const user = await tenant.User.findOne({
          $or: [{ username: query.toLowerCase() }, { email: query.toLowerCase() }],
        });
        if (user && bcrypt.compareSync(password, user.passwordHash)) {
          const inst = await this.masterDb.Institution.findOne({ databaseName: requestedDatabaseName });
          const token = jwt.sign(
            {
              id: user._id.toString(),
              username: user.username,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              databaseName: requestedDatabaseName,
              institutionName: inst?.institutionName || '',
            },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          return { user: user.toObject(), tenantDb: tenant, token, institutionName: inst?.institutionName };
        }
      }
    }

    // Cross-Database Search: iterate over registered institutions in Master DB
    const institutions = await this.masterDb.Institution.find({ status: 'active' });
    for (const inst of institutions) {
      const tenant = await this.getTenantDB(inst.databaseName);
      const user = await tenant.User.findOne({
        $or: [{ username: query.toLowerCase() }, { email: query.toLowerCase() }],
      });
      if (user) {
        if (bcrypt.compareSync(password, user.passwordHash)) {
          const token = jwt.sign(
            {
              id: user._id.toString(),
              username: user.username,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              databaseName: inst.databaseName,
              institutionName: inst.institutionName,
            },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          return { user: user.toObject(), tenantDb: tenant, token, institutionName: inst.institutionName };
        }
      }
    }

    return null;
  }

  async logActivity({
    databaseName,
    institutionName = '',
    actorName,
    actorRole = 'admin',
    actionCategory,
    description,
    ipAddress = '127.0.0.1',
    userAgent = 'CRM-Backend/1.0',
  }) {
    try {
      await this.ensureConnected();
      const logData = {
        databaseName,
        institutionName,
        actorName,
        actorRole,
        actionCategory,
        description,
        ipAddress,
        userAgent,
        timestamp: new Date(),
      };

      if (this.masterDb?.MasterLog) {
        await this.masterDb.MasterLog.create(logData);
      }

      if (databaseName && databaseName !== 'smart_crm_master') {
        const tenantDb = await this.getTenantDB(databaseName);
        if (tenantDb?.ActivityLog) {
          await tenantDb.ActivityLog.create(logData);
        }
      }
    } catch (err) {
      console.warn('[DatabaseManager] Failed to log activity:', err.message);
    }
  }
}

export const dbManager = new DatabaseManager();
export default dbManager;
