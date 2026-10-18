import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

mongoose.set('bufferCommands', false);

const JWT_SECRET = process.env.JWT_SECRET || 'smart-institutional-crm-super-secret-jwt-key';
const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Generate 24-character hexadecimal ObjectId string
 */
function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

/**
 * In-Memory Query / Document Helpers
 */
class InMemoryQuery {
  constructor(docsPromise) {
    this._promise = Promise.resolve(docsPromise);
    this._sortKey = null;
    this._limitCount = null;
    this._skipCount = 0;
    this._selectFields = null;
    this._isSingle = false;
  }

  sort(criteria) {
    this._sortKey = criteria;
    return this;
  }

  select(fields) {
    this._selectFields = fields;
    return this;
  }

  limit(n) {
    this._limitCount = Number(n);
    return this;
  }

  skip(n) {
    this._skipCount = Number(n);
    return this;
  }

  lean() {
    return this;
  }

  async exec() {
    let result = await this._promise;

    if (this._isSingle) {
      if (!result) return null;
      return this._applySelect(result);
    }

    if (!Array.isArray(result)) return result;

    let items = [...result];

    if (this._sortKey) {
      const keys = Object.keys(this._sortKey);
      items.sort((a, b) => {
        for (const key of keys) {
          const dir = this._sortKey[key] === -1 || this._sortKey[key] === 'desc' ? -1 : 1;
          const valA = a[key];
          const valB = b[key];
          if (valA === valB) continue;
          if (valA === undefined || valA === null) return 1 * dir;
          if (valB === undefined || valB === null) return -1 * dir;
          if (valA > valB) return 1 * dir;
          if (valA < valB) return -1 * dir;
        }
        return 0;
      });
    }

    if (this._skipCount > 0) {
      items = items.slice(this._skipCount);
    }

    if (this._limitCount !== null && !isNaN(this._limitCount)) {
      items = items.slice(0, this._limitCount);
    }

    return items.map((doc) => this._applySelect(doc));
  }

  _applySelect(doc) {
    if (!doc || !this._selectFields) return doc;
    const raw = doc.toObject ? doc.toObject() : { ...doc };

    if (typeof this._selectFields === 'string') {
      const parts = this._selectFields.trim().split(/\s+/);
      const isExclude = parts.some((p) => p.startsWith('-'));

      if (isExclude) {
        const excludeKeys = parts.filter((p) => p.startsWith('-')).map((p) => p.slice(1));
        excludeKeys.forEach((k) => delete raw[k]);
        return wrapDocument(raw, doc._collection);
      } else {
        const keepKeys = new Set(parts.concat(['_id', 'id']));
        const filtered = {};
        for (const k of Object.keys(raw)) {
          if (keepKeys.has(k)) filtered[k] = raw[k];
        }
        return wrapDocument(filtered, doc._collection);
      }
    }
    return doc;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

function matchFilter(doc, filter) {
  if (!filter || Object.keys(filter).length === 0) return true;

  for (const [key, value] of Object.entries(filter)) {
    if (key === '$or') {
      if (!Array.isArray(value) || value.length === 0) return true;
      const matchedAny = value.some((subFilter) => matchFilter(doc, subFilter));
      if (!matchedAny) return false;
      continue;
    }

    if (key === '$and') {
      if (!Array.isArray(value)) return true;
      const matchedAll = value.every((subFilter) => matchFilter(doc, subFilter));
      if (!matchedAll) return false;
      continue;
    }

    const docVal = doc[key];

    // MongoDB ID matching compatibility (_id or id)
    if (key === '_id' || key === 'id') {
      const docIdStr = String(doc._id || doc.id || '');
      if (typeof value === 'object' && value !== null) {
        if (value.$ne !== undefined) {
          if (docIdStr === String(value.$ne)) return false;
          continue;
        }
        if (Array.isArray(value.$in)) {
          const inStrs = value.$in.map(String);
          if (!inStrs.includes(docIdStr)) return false;
          continue;
        }
      } else {
        if (docIdStr !== String(value)) return false;
        continue;
      }
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (value.$in !== undefined && Array.isArray(value.$in)) {
        if (Array.isArray(docVal)) {
          const docStrs = docVal.map(String);
          const hasCommon = value.$in.some((v) => docStrs.includes(String(v)));
          if (!hasCommon) return false;
        } else {
          const inStrs = value.$in.map(String);
          if (!inStrs.includes(String(docVal ?? ''))) return false;
        }
        continue;
      }

      if (value.$ne !== undefined) {
        if (docVal === value.$ne || String(docVal) === String(value.$ne)) return false;
        continue;
      }

      if (value.$regex !== undefined) {
        const reg = new RegExp(value.$regex, value.$options || '');
        if (!reg.test(String(docVal ?? ''))) return false;
        continue;
      }
    }

    // Scalar match or array containment match
    if (Array.isArray(docVal)) {
      if (!docVal.map(String).includes(String(value))) return false;
    } else {
      if (String(docVal ?? '').toLowerCase() !== String(value ?? '').toLowerCase()) {
        return false;
      }
    }
  }

  return true;
}

function wrapDocument(raw, collection) {
  if (!raw) return null;
  const doc = { ...raw };

  if (!doc._id) {
    doc._id = generateId();
  }
  doc.id = doc._id.toString();
  doc._collection = collection;

  doc.toObject = function () {
    const copy = { ...this };
    delete copy.toObject;
    delete copy.save;
    delete copy._collection;
    copy.id = this._id ? this._id.toString() : this.id;
    return copy;
  };

  doc.save = async function () {
    if (this._collection) {
      await this._collection.findByIdAndUpdate(this._id, this.toObject(), { new: true });
    }
    return this;
  };

  return doc;
}

class InMemoryCollection {
  constructor(name) {
    this.name = name;
    this.documents = [];
  }

  find(query = {}) {
    const queryFn = () => {
      const matched = this.documents.filter((doc) => matchFilter(doc, query));
      return matched.map((doc) => wrapDocument(doc, this));
    };
    return new InMemoryQuery(queryFn());
  }

  findOne(query = {}) {
    const queryFn = () => {
      const doc = this.documents.find((d) => matchFilter(d, query));
      return doc ? wrapDocument(doc, this) : null;
    };
    const q = new InMemoryQuery(queryFn());
    q._isSingle = true;
    return q;
  }

  findById(id) {
    return this.findOne({ _id: id });
  }

  findByIdAndUpdate(id, update, options = { new: true }) {
    const doUpdate = async () => {
      const idStr = String(id);
      const index = this.documents.findIndex((d) => String(d._id) === idStr || String(d.id) === idStr);
      if (index === -1) return null;

      const existing = { ...this.documents[index] };
      let updated = { ...existing };

      if (update.$set) {
        Object.assign(updated, update.$set);
      }
      if (update.$addToSet) {
        for (const [key, val] of Object.entries(update.$addToSet)) {
          if (!Array.isArray(updated[key])) updated[key] = [];
          if (!updated[key].map(String).includes(String(val))) {
            updated[key].push(val);
          }
        }
      }
      if (update.$pull) {
        for (const [key, val] of Object.entries(update.$pull)) {
          if (Array.isArray(updated[key])) {
            updated[key] = updated[key].filter((item) => String(item) !== String(val));
          }
        }
      }
      if (update.$inc) {
        for (const [key, val] of Object.entries(update.$inc)) {
          updated[key] = (Number(updated[key]) || 0) + Number(val);
        }
      }

      // Direct plain fields
      for (const [key, val] of Object.entries(update)) {
        if (!key.startsWith('$')) {
          updated[key] = val;
        }
      }

      updated.updatedAt = new Date();
      this.documents[index] = updated;

      return wrapDocument(options.new ? updated : existing, this);
    };

    const q = new InMemoryQuery(doUpdate());
    q._isSingle = true;
    return q;
  }

  findOneAndUpdate(query = {}, update = {}, options = { new: true }) {
    const doFindAndUpdate = async () => {
      let doc = this.documents.find((d) => matchFilter(d, query));
      if (!doc) {
        if (options.upsert) {
          let initialDoc = { ...query };
          if (update.$set) Object.assign(initialDoc, update.$set);
          for (const [k, v] of Object.entries(update)) {
            if (!k.startsWith('$')) initialDoc[k] = v;
          }
          return this.create(initialDoc);
        }
        return null;
      }
      return this.findByIdAndUpdate(doc._id || doc.id, update, options);
    };

    const q = new InMemoryQuery(doFindAndUpdate());
    q._isSingle = true;
    return q;
  }

  findOneAndDelete(query = {}) {
    const doFindAndDelete = async () => {
      const doc = this.documents.find((d) => matchFilter(d, query));
      if (!doc) return null;
      return this.findByIdAndDelete(doc._id || doc.id);
    };
    const q = new InMemoryQuery(doFindAndDelete());
    q._isSingle = true;
    return q;
  }

  async updateOne(query = {}, update = {}, options = {}) {
    const res = await this.findOneAndUpdate(query, update, options);
    return { matchedCount: res ? 1 : 0, modifiedCount: res ? 1 : 0 };
  }

  async updateMany(query = {}, update = {}, options = {}) {
    let matchedCount = 0;
    let modifiedCount = 0;
    const updateFields = update.$set ? update.$set : update;

    for (let i = 0; i < this.documents.length; i++) {
      if (matchFilter(this.documents[i], query)) {
        matchedCount++;
        for (const [key, val] of Object.entries(updateFields)) {
          if (!key.startsWith('$')) {
            this.documents[i][key] = val;
          }
        }
        this.documents[i].updatedAt = new Date();
        modifiedCount++;
      }
    }
    return { matchedCount, modifiedCount, acknowledged: true };
  }

  findByIdAndDelete(id) {
    const doDelete = async () => {
      const idStr = String(id);
      const index = this.documents.findIndex((d) => String(d._id) === idStr || String(d.id) === idStr);
      if (index === -1) return null;
      const [removed] = this.documents.splice(index, 1);
      return wrapDocument(removed, this);
    };
    const q = new InMemoryQuery(doDelete());
    q._isSingle = true;
    return q;
  }

  async create(payload) {
    if (Array.isArray(payload)) {
      return this.insertMany(payload);
    }
    const docData = {
      ...payload,
      _id: payload._id || generateId(),
      createdAt: payload.createdAt || new Date(),
      updatedAt: payload.updatedAt || new Date(),
    };
    this.documents.push(docData);
    return wrapDocument(docData, this);
  }

  async insertMany(docs) {
    const created = [];
    for (const doc of docs) {
      const d = await this.create(doc);
      created.push(d);
    }
    return created;
  }

  async countDocuments(query = {}) {
    return this.documents.filter((d) => matchFilter(d, query)).length;
  }

  async deleteOne(query = {}) {
    const index = this.documents.findIndex((d) => matchFilter(d, query));
    if (index !== -1) {
      this.documents.splice(index, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(query = {}) {
    const initialCount = this.documents.length;
    this.documents = this.documents.filter((d) => !matchFilter(d, query));
    return { deletedCount: initialCount - this.documents.length };
  }
}

/**
 * Seed initial sample institution and demo datasets
 */
function seedDemoData(masterDb, tenantDatabases) {
  const vcetDbName = 'smart_crm_vcetadmin_1792247322612';
  const apexDbName = 'smart_crm_apexadmin_1792247322999';

  // Master Institutions
  masterDb.Institution.create({
    institutionName: 'Vidyavardhini College of Engineering & Technology',
    adminUsername: 'vcetadmin',
    adminName: 'Prof. Rajesh Sharma',
    adminEmail: 'admin@vcet.edu',
    databaseName: vcetDbName,
    campusCode: 'VCET-WEST',
    status: 'active',
    createdAt: new Date('2026-01-15T08:00:00.000Z'),
  });

  masterDb.Institution.create({
    institutionName: 'Apex Institute of Science & Technology',
    adminUsername: 'apexadmin',
    adminName: 'Dr. Siddharth Mehta',
    adminEmail: 'admin@apexinstitute.edu',
    databaseName: apexDbName,
    campusCode: 'APEX-MAIN',
    status: 'active',
    createdAt: new Date('2026-02-01T08:00:00.000Z'),
  });

  // VCET Tenant Database Setup
  const vcet = createTenantModels(vcetDbName);
  tenantDatabases.set(vcetDbName, vcet);

  const hashAdmin = bcrypt.hashSync('admin123', 10);
  const hashTeacher = bcrypt.hashSync('teacher123', 10);
  const hashStudent = bcrypt.hashSync('student123', 10);

  const adminId = '6ad3861aee1bd533a001b2ca';
  const teacherId1 = '6ad3861aee1bd533a001b2cc';
  const teacherId2 = '6ad3861aee1bd533a001b2cd';
  const studentId1 = '6ad3861aee1bd533a001b2cb';
  const studentId2 = '6ad3861aee1bd533a001b2ce';
  const studentId3 = '6ad3861aee1bd533a001b2cf';
  const classId1 = 'class-vcet-cs-a';
  const classId2 = 'class-vcet-cs-b';

  // Users
  vcet.User.create({
    _id: adminId,
    username: 'vcetadmin',
    passwordHash: hashAdmin,
    fullName: 'Prof. Rajesh Sharma',
    email: 'admin@vcet.edu',
    role: 'admin',
    databaseName: vcetDbName,
    status: 'active',
  });

  vcet.User.create({
    _id: teacherId1,
    username: 'jdoe',
    passwordHash: hashTeacher,
    fullName: 'Dr. Anita Desai',
    email: 'anita.desai@vcet.edu',
    role: 'teacher',
    databaseName: vcetDbName,
    specialization: 'Operating Systems & Distributed Networks',
    qualification: 'Ph.D. in Computer Science',
    assignedClassIds: [classId1],
    status: 'active',
  });

  vcet.User.create({
    _id: teacherId2,
    username: 'rkumar',
    passwordHash: hashTeacher,
    fullName: 'Prof. Rakesh Kumar',
    email: 'rakesh.kumar@vcet.edu',
    role: 'teacher',
    databaseName: vcetDbName,
    specialization: 'Database Systems & Data Engineering',
    qualification: 'M.Tech in Software Systems',
    assignedClassIds: [classId1, classId2],
    status: 'active',
  });

  vcet.User.create({
    _id: studentId1,
    username: 'cs101_rahul',
    passwordHash: hashStudent,
    fullName: 'Rahul Deshmukh',
    email: 'rahul.deshmukh@vcet.edu',
    role: 'student',
    phone: '+91 98200 88991',
    rollNumber: 'CS-101',
    gradeLevel: 'Year 3 / Semester 5',
    assignedClassId: classId1,
    assignedClassIds: [classId1],
    dateOfBirth: '2004-05-14',
    gender: 'Male',
    residentialAddress: 'Flat 402, Greenfield Heights, Linking Road, Mumbai 400050',
    religion: 'Hindu',
    casteCategory: 'General',
    departmentBranch: 'Computer Engineering',
    classDivision: 'Division A',
    admissionId: 'ADM-2024-CS101',
    academicYear: '2025-2026',
    fatherName: 'Suresh Deshmukh',
    fatherContact: '+91 98200 11223',
    fatherOccupation: 'Senior Electrical Engineer',
    fatherAddress: 'Flat 402, Greenfield Heights, Linking Road, Mumbai 400050',
    motherName: 'Sunita Deshmukh',
    motherContact: '+91 98200 11224',
    motherOccupation: 'High School Lecturer',
    motherAddress: 'Flat 402, Greenfield Heights, Linking Road, Mumbai 400050',
    guardianContact: '+91 98200 11223',
    previousQualification: 'Higher Secondary Certificate (HSC 12th)',
    previousInstitution: 'St. Xavier Junior College',
    previousExamDetails: 'Scored 92.4% in PCM Board Examinations',
    photoUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&auto=format&fit=crop&q=80',
    signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40"><path d="M10 25 Q 30 5, 50 25 T 90 25 T 130 20 T 170 28" fill="none" stroke="%23111" stroke-width="2"/></svg>',
    databaseName: vcetDbName,
    status: 'active',
  });

  vcet.User.create({
    _id: studentId2,
    username: 'cs102_priya',
    passwordHash: hashStudent,
    fullName: 'Priya Patel',
    email: 'priya.patel@vcet.edu',
    role: 'student',
    phone: '+91 98200 44558',
    rollNumber: 'CS-102',
    gradeLevel: 'Year 3 / Semester 5',
    assignedClassId: classId1,
    assignedClassIds: [classId1],
    dateOfBirth: '2004-08-22',
    gender: 'Female',
    residentialAddress: 'B-12 Shanti Niketan, SV Road, Andheri West, Mumbai 400058',
    religion: 'Hindu',
    casteCategory: 'OBC',
    departmentBranch: 'Computer Engineering',
    classDivision: 'Division A',
    admissionId: 'ADM-2024-CS102',
    academicYear: '2025-2026',
    fatherName: 'Kishore Patel',
    fatherContact: '+91 98200 44556',
    fatherOccupation: 'Business Proprietor',
    fatherAddress: 'B-12 Shanti Niketan, SV Road, Andheri West, Mumbai 400058',
    motherName: 'Meena Patel',
    motherContact: '+91 98200 44557',
    motherOccupation: 'Chartered Accountant',
    motherAddress: 'B-12 Shanti Niketan, SV Road, Andheri West, Mumbai 400058',
    guardianContact: '+91 98200 44556',
    previousQualification: 'Higher Secondary Certificate (HSC 12th)',
    previousInstitution: 'National Model College',
    previousExamDetails: 'Scored 89.6% in Science Stream',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
    signatureUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="180" height="40"><path d="M10 20 Q 25 35, 45 15 T 85 22 T 120 18 T 160 25" fill="none" stroke="%23111" stroke-width="2"/></svg>',
    databaseName: vcetDbName,
    status: 'active',
  });

  vcet.User.create({
    _id: studentId3,
    username: 'cs103_amit',
    passwordHash: hashStudent,
    fullName: 'Amit Verma',
    email: 'amit.verma@vcet.edu',
    role: 'student',
    phone: '+91 98200 77880',
    rollNumber: 'CS-103',
    gradeLevel: 'Year 3 / Semester 5',
    assignedClassId: classId1,
    assignedClassIds: [classId1],
    dateOfBirth: '2004-11-05',
    gender: 'Male',
    residentialAddress: 'C-303 Royal Palms, Goregaon East, Mumbai 400065',
    religion: 'Hindu',
    casteCategory: 'General',
    departmentBranch: 'Computer Engineering',
    classDivision: 'Division A',
    admissionId: 'ADM-2024-CS103',
    academicYear: '2025-2026',
    fatherName: 'Rajesh Verma',
    fatherContact: '+91 98200 77889',
    fatherOccupation: 'Civil Contractor',
    fatherAddress: 'C-303 Royal Palms, Goregaon East, Mumbai 400065',
    motherName: 'Kavita Verma',
    motherContact: '+91 98200 77888',
    motherOccupation: 'Architect',
    motherAddress: 'C-303 Royal Palms, Goregaon East, Mumbai 400065',
    guardianContact: '+91 98200 77889',
    databaseName: vcetDbName,
    status: 'active',
  });

  // Classes
  vcet.Class.create({
    _id: classId1,
    name: 'B.Tech Computer Science - Section A',
    gradeLevel: 'Year 3 / Semester 5',
    section: 'A',
    roomNumber: 'Lab 304',
    capacity: 60,
    primaryTeacherId: teacherId1,
    studentIds: [studentId1, studentId2, studentId3],
    subjects: ['Operating Systems', 'Database Systems', 'Computer Networks'],
  });

  vcet.Class.create({
    _id: classId2,
    name: 'B.Tech Computer Science - Section B',
    gradeLevel: 'Year 3 / Semester 5',
    section: 'B',
    roomNumber: 'Lecture Hall 202',
    capacity: 60,
    primaryTeacherId: teacherId2,
    studentIds: [],
    subjects: ['Data Structures', 'Web Engineering', 'Discrete Mathematics'],
  });

  // Assignments
  const asgn1 = 'asgn-vcet-os-01';
  vcet.Assignment.create({
    _id: asgn1,
    title: 'Operating Systems Virtual Memory Lab',
    subject: 'Operating Systems',
    description: 'Implement page replacement algorithms (FIFO, LRU, Optimal) in C++ and analyze hit ratios.',
    targetClassIds: [classId1],
    teacherId: teacherId1,
    teacherName: 'Dr. Anita Desai',
    issueDate: '2026-10-10T09:00:00.000Z',
    dueDate: '2026-10-31T23:59:59.000Z',
    maxMarks: 100,
    attachments: [{ name: 'virtual_memory_spec.pdf', size: '1.2 MB', mimeType: 'application/pdf' }],
  });

  vcet.Assignment.create({
    _id: 'asgn-vcet-db-02',
    title: 'Distributed Database Transaction Design',
    subject: 'Database Systems',
    description: 'Design two-phase commit protocol state machines and analyze deadlock detection in distributed database nodes.',
    targetClassIds: [classId1],
    teacherId: teacherId2,
    teacherName: 'Prof. Rakesh Kumar',
    issueDate: '2026-10-12T10:00:00.000Z',
    dueDate: '2026-11-05T23:59:59.000Z',
    maxMarks: 50,
    attachments: [],
  });

  // Submissions
  vcet.Submission.create({
    _id: 'sub-vcet-001',
    assignmentId: asgn1,
    studentId: studentId1,
    studentName: 'Rahul Deshmukh',
    rollNumber: 'CS-101',
    classId: classId1,
    status: 'graded',
    submittedAt: new Date('2026-10-14T14:30:00Z'),
    studentNotes: 'Implemented FIFO, LRU, and Optimal algorithms with comparison plots for 4 and 8 page frames.',
    marksObtained: 94,
    teacherReviewNotes: 'Outstanding implementation and clear visualization of page fault behaviors.',
    gradedAt: new Date('2026-10-15T10:00:00Z'),
  });

  vcet.Submission.create({
    _id: 'sub-vcet-002',
    assignmentId: asgn1,
    studentId: studentId2,
    studentName: 'Priya Patel',
    rollNumber: 'CS-102',
    classId: classId1,
    status: 'submitted',
    submittedAt: new Date('2026-10-16T16:00:00Z'),
    studentNotes: 'Completed code and test cases. Verification pending instructor review.',
    marksObtained: null,
  });

  // Quizzes
  const quiz1 = 'quiz-vcet-001';
  vcet.Quiz.create({
    _id: quiz1,
    title: 'OS Process Synchronization Quiz',
    subject: 'Operating Systems',
    description: 'Critical Section, Semaphores, Mutex locks, and Classical IPC problems.',
    targetClassIds: [classId1],
    teacherId: teacherId1,
    teacherName: 'Dr. Anita Desai',
    durationMinutes: 30,
    totalMarks: 20,
    passMarks: 10,
    isPublished: true,
    questions: [
      {
        questionText: 'Which primitive provides mutual exclusion without busy waiting?',
        options: ['Counting Semaphore', 'Spinlock', 'Peterson Algorithm', 'Test-and-Set'],
        correctOptionIndex: 0,
        marks: 5,
      },
      {
        questionText: 'What condition is NOT required for a deadlock to occur?',
        options: ['Mutual Exclusion', 'Hold and Wait', 'Preemption Allowed', 'Circular Wait'],
        correctOptionIndex: 2,
        marks: 5,
      },
      {
        questionText: 'In Banker Algorithm, what constitutes a safe state?',
        options: [
          'No processes running',
          'Resource allocation graph has cycles',
          'System can allocate resources to each process in some order avoiding deadlock',
          'CPU utilization is 100%',
        ],
        correctOptionIndex: 2,
        marks: 5,
      },
      {
        questionText: 'Which scheduling algorithm is non-preemptive by definition?',
        options: ['Round Robin', 'FCFS (First-Come, First-Served)', 'Priority Preemptive', 'Multilevel Feedback Queue'],
        correctOptionIndex: 1,
        marks: 5,
      },
    ],
  });

  // Quiz Attempt
  vcet.QuizAttempt.create({
    _id: 'attempt-vcet-001',
    quizId: quiz1,
    studentId: studentId1,
    studentName: 'Rahul Deshmukh',
    rollNumber: 'CS-101',
    classId: classId1,
    answers: [
      { questionIndex: 0, selectedOptionIndex: 0 },
      { questionIndex: 1, selectedOptionIndex: 2 },
      { questionIndex: 2, selectedOptionIndex: 2 },
      { questionIndex: 3, selectedOptionIndex: 1 },
    ],
    score: 20,
    totalMarks: 20,
    passed: true,
    submittedAt: new Date('2026-10-14T11:00:00Z'),
  });

  // Schedule
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const subjectsMap = [
    { sub: 'Operating Systems', teacher: teacherId1, room: 'Lab 304' },
    { sub: 'Database Systems', teacher: teacherId2, room: 'Room 201' },
    { sub: 'Computer Networks', teacher: teacherId1, room: 'Lab 302' },
  ];

  days.forEach((day, dIdx) => {
    vcet.Schedule.create({
      day,
      timeSlot: '09:00 - 10:00',
      classId: classId1,
      subject: subjectsMap[dIdx % 3].sub,
      teacherId: subjectsMap[dIdx % 3].teacher,
      roomNumber: subjectsMap[dIdx % 3].room,
    });

    vcet.Schedule.create({
      day,
      timeSlot: '10:00 - 11:00',
      classId: classId1,
      subject: subjectsMap[(dIdx + 1) % 3].sub,
      teacherId: subjectsMap[(dIdx + 1) % 3].teacher,
      roomNumber: subjectsMap[(dIdx + 1) % 3].room,
    });

    vcet.Schedule.create({
      day,
      timeSlot: '12:30 - 13:30',
      classId: classId1,
      subject: subjectsMap[(dIdx + 2) % 3].sub,
      teacherId: subjectsMap[(dIdx + 2) % 3].teacher,
      roomNumber: subjectsMap[(dIdx + 2) % 3].room,
    });
  });

  // Notices
  vcet.Notice.create({
    title: 'Mid-Semester Examination Schedule Announced',
    content: 'Mid-Term Examinations for Year 3 cohorts will commence on November 10th, 2026. Hall tickets available on portal.',
    category: 'Examination',
    targetRole: 'all',
    authorName: 'Prof. Rajesh Sharma',
    authorRole: 'admin',
    readByUserIds: [adminId],
  });

  vcet.Notice.create({
    title: 'Faculty Curriculum Review Meeting',
    content: 'All faculty members are invited for the semester accreditation and lesson plan review this Friday at 4 PM.',
    category: 'Institutional',
    targetRole: 'teacher',
    authorName: 'Prof. Rajesh Sharma',
    authorRole: 'admin',
    readByUserIds: [adminId],
  });

  vcet.Notice.create({
    title: 'Operating Systems Practical Lab Submissions',
    content: 'Virtual Memory assignments must be uploaded before Oct 31st with code and test traces.',
    category: 'Assignment',
    targetRole: 'student',
    authorName: 'Dr. Anita Desai',
    authorRole: 'teacher',
    readByUserIds: [teacherId1],
  });

  // Calendar
  vcet.CalendarEvent.create({
    title: 'Mid-Semester Examinations Week',
    category: 'academic',
    description: 'Centralized semester examinations across all engineering branches.',
    date: '2026-11-10',
    startTime: '09:00',
    endTime: '16:00',
    targetScope: 'all',
    authorName: 'Prof. Rajesh Sharma',
    authorRole: 'admin',
  });

  vcet.CalendarEvent.create({
    title: 'National Technology & Innovation Day',
    category: 'holiday',
    description: 'Campus holiday honoring national engineering discoveries.',
    date: '2026-10-28',
    startTime: '00:00',
    endTime: '23:59',
    targetScope: 'all',
    authorName: 'Prof. Rajesh Sharma',
    authorRole: 'admin',
  });

  vcet.CalendarEvent.create({
    title: 'Smart Campus Hackathon 2026',
    category: 'special',
    description: '48-hour institutional hackathon for AI and IoT innovation.',
    date: '2026-11-20',
    startTime: '10:00',
    endTime: '18:00',
    targetScope: 'all',
    authorName: 'Prof. Rajesh Sharma',
    authorRole: 'admin',
  });

  // Attendance
  vcet.Attendance.create({
    classId: classId1,
    date: '2026-10-16',
    markedByTeacherId: teacherId1,
    markedByTeacherName: 'Dr. Anita Desai',
    records: [
      { studentId: studentId1, studentName: 'Rahul Deshmukh', rollNumber: 'CS-101', status: 'present', remarks: '' },
      { studentId: studentId2, studentName: 'Priya Patel', rollNumber: 'CS-102', status: 'present', remarks: '' },
      { studentId: studentId3, studentName: 'Amit Verma', rollNumber: 'CS-103', status: 'absent', remarks: 'Medical leave' },
    ],
    totalStudents: 3,
    presentCount: 2,
    absentCount: 1,
  });

  // Marks
  vcet.Marks.create({
    classId: classId1,
    studentId: studentId1,
    studentName: 'Rahul Deshmukh',
    rollNumber: 'CS-101',
    subject: 'Operating Systems',
    assessmentTitle: 'Mid-Term Exam 2026',
    assignmentMarks: 28,
    internalMarks: 18,
    examMarks: 48,
    otherMarks: 0,
    totalMarks: 94,
    maxMarks: 100,
    percentage: 94,
    grade: 'A+',
    teacherFeedback: 'Outstanding analytical reasoning and implementation proficiency.',
    isPublished: true,
    updatedByTeacherId: teacherId1,
  });

  vcet.Marks.create({
    classId: classId1,
    studentId: studentId2,
    studentName: 'Priya Patel',
    rollNumber: 'CS-102',
    subject: 'Operating Systems',
    assessmentTitle: 'Mid-Term Exam 2026',
    assignmentMarks: 24,
    internalMarks: 16,
    examMarks: 42,
    otherMarks: 0,
    totalMarks: 82,
    maxMarks: 100,
    percentage: 82,
    grade: 'A',
    teacherFeedback: 'Strong grasp of core scheduling and synchronization concepts.',
    isPublished: true,
    updatedByTeacherId: teacherId1,
  });

  // Chat
  const convId = [adminId, teacherId1].sort().join('_');
  vcet.Message.create({
    conversationId: convId,
    senderId: adminId,
    senderName: 'Prof. Rajesh Sharma',
    senderRole: 'admin',
    recipientId: teacherId1,
    recipientName: 'Dr. Anita Desai',
    recipientRole: 'teacher',
    text: 'Welcome to the Smart Institutional CRM workspace, Dr. Desai. The curriculum plans are now accessible.',
    read: true,
  });

  // Activity Logs
  vcet.ActivityLog.create({
    databaseName: vcetDbName,
    institutionName: 'Vidyavardhini College of Engineering & Technology',
    actorName: 'Prof. Rajesh Sharma',
    actorRole: 'admin',
    actionCategory: 'TENANT_DB',
    description: 'System initialized and academic cohort configured successfully.',
  });

  // Apex Institute Setup
  const apex = createTenantModels(apexDbName);
  tenantDatabases.set(apexDbName, apex);

  apex.User.create({
    username: 'apexadmin',
    passwordHash: hashAdmin,
    fullName: 'Dr. Siddharth Mehta',
    email: 'admin@apexinstitute.edu',
    role: 'admin',
    databaseName: apexDbName,
    status: 'active',
  });
}

function createTenantModels(databaseName) {
  return {
    databaseName,
    User: new InMemoryCollection(`${databaseName}_users`),
    Class: new InMemoryCollection(`${databaseName}_classes`),
    Assignment: new InMemoryCollection(`${databaseName}_assignments`),
    Submission: new InMemoryCollection(`${databaseName}_submissions`),
    Schedule: new InMemoryCollection(`${databaseName}_schedules`),
    Quiz: new InMemoryCollection(`${databaseName}_quizzes`),
    QuizAttempt: new InMemoryCollection(`${databaseName}_quizattempts`),
    Notice: new InMemoryCollection(`${databaseName}_notices`),
    Message: new InMemoryCollection(`${databaseName}_messages`),
    ActivityLog: new InMemoryCollection(`${databaseName}_activitylogs`),
    CalendarEvent: new InMemoryCollection(`${databaseName}_calendarevents`),
    Attendance: new InMemoryCollection(`${databaseName}_attendance`),
    Marks: new InMemoryCollection(`${databaseName}_marks`),
    StudentNote: new InMemoryCollection(`${databaseName}_studentnotes`),
  };
}

class DatabaseManager {
  constructor() {
    this.connection = null;
    this.useInMemory = true;
    this.tenantModels = new Map();

    // Master DB in-memory collections
    this.masterDb = {
      name: 'smart_crm_master',
      Institution: new InMemoryCollection('master_institutions'),
      MasterLog: new InMemoryCollection('master_logs'),
    };

    // Pre-seed demo datasets
    seedDemoData(this.masterDb, this.tenantModels);

    // If MongoDB URI is configured, optionally connect asynchronously without blocking or failing
    if (MONGODB_URI) {
      this.initMongoConnection().catch(() => {});
    }
  }

  async initMongoConnection() {
    if (!MONGODB_URI) return;
    try {
      this.connection = await mongoose.createConnection(MONGODB_URI, {
        serverSelectionTimeoutMS: 3000,
        maxPoolSize: 10,
      }).asPromise();
      console.log('[DatabaseManager] Connected to external MongoDB cluster.');
      this.useInMemory = false;
    } catch (err) {
      console.warn('[DatabaseManager] MongoDB unreachable, maintaining resilient in-memory database:', err.message);
      this.useInMemory = true;
    }
  }

  async ensureConnected() {
    return;
  }

  async getMasterDB() {
    return this.masterDb;
  }

  async getTenantDB(databaseName) {
    if (!databaseName) return null;

    if (this.tenantModels.has(databaseName)) {
      return this.tenantModels.get(databaseName);
    }

    const tenant = createTenantModels(databaseName);
    this.tenantModels.set(databaseName, tenant);
    return tenant;
  }

  async createTenantDatabase({ institutionName, adminUsername, adminName, adminEmail, campusCode, password }) {
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
      createdAt: new Date(),
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
      description: `Provisioned isolated database ${databaseName}`,
    });

    return { databaseName, registryEntry, adminUser };
  }

  async deleteTenantDatabase(databaseName) {
    const institution = await this.masterDb.Institution.findOne({ databaseName });
    if (!institution) return false;

    this.tenantModels.delete(databaseName);
    await this.masterDb.Institution.deleteOne({ databaseName });

    await this.logActivity({
      databaseName: 'smart_crm_master',
      institutionName: institution.institutionName,
      actorName: 'System Administrator',
      actorRole: 'admin',
      actionCategory: 'TENANT_DB',
      description: `Decommissioned tenant database ${databaseName}`,
    });

    return true;
  }

  async authenticateUser(usernameOrEmail, password, requestedDatabaseName = null) {
    const query = (usernameOrEmail || '').trim().toLowerCase();
    if (!query) return null;

    // Direct search in requested tenant or institution if specified
    if (requestedDatabaseName) {
      let targetDbName = requestedDatabaseName;
      let matchedInst = await this.masterDb.Institution.findOne({ databaseName: targetDbName });
      if (!matchedInst) {
        matchedInst = await this.masterDb.Institution.findOne({
          institutionName: { $regex: new RegExp(`^${requestedDatabaseName.trim()}$`, 'i') },
        });
        if (matchedInst) {
          targetDbName = matchedInst.databaseName;
        }
      }

      const tenant = await this.getTenantDB(targetDbName);
      if (tenant) {
        const user = await tenant.User.findOne({
          $or: [{ username: query }, { email: query }],
        });
        if (user && bcrypt.compareSync(password, user.passwordHash)) {
          const inst = matchedInst || (await this.masterDb.Institution.findOne({ databaseName: targetDbName }));
          const token = jwt.sign(
            {
              id: user._id.toString(),
              username: user.username,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              databaseName: targetDbName,
              institutionName: inst?.institutionName || '',
            },
            JWT_SECRET,
            { expiresIn: '7d' }
          );
          return { user: user.toObject(), tenantDb: tenant, token, institutionName: inst?.institutionName };
        }
      }
    }

    // Cross-Database Search across all registered institutions
    const institutions = await this.masterDb.Institution.find({ status: 'active' });
    for (const inst of institutions) {
      const tenant = await this.getTenantDB(inst.databaseName);
      if (!tenant) continue;
      const user = await tenant.User.findOne({
        $or: [{ username: query }, { email: query }],
      });
      if (user && bcrypt.compareSync(password, user.passwordHash)) {
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
