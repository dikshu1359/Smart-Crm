import express from 'express';
import bcrypt from 'bcryptjs';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/classes
 * Returns classes for current institution with populated student counts
 */
router.get('/', async (req, res) => {
  try {
    const classes = await req.tenantDb.Class.find().sort({ createdAt: -1 });
    const formatted = classes.map((c) => ({
      ...c.toObject(),
      id: c._id.toString(),
      studentCount: c.studentIds?.length || 0,
    }));
    res.json({ classes: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchClassesError', message: err.message });
  }
});

/**
 * POST /api/classes
 * Administrator creates an academic class
 */
router.post('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const { name, gradeLevel, section, roomNumber, capacity, primaryTeacherId, subjects } = req.body;
    if (!name || !gradeLevel || !section || !primaryTeacherId) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Name, grade level, section, and primary teacher are required.',
      });
    }

    // Verify teacher exists in tenant
    const teacher = await req.tenantDb.User.findOne({ _id: primaryTeacherId, role: 'teacher' });
    if (!teacher) {
      return res.status(400).json({ error: 'TeacherNotFound', message: 'Assigned teacher does not exist.' });
    }

    const newClass = await req.tenantDb.Class.create({
      name: name.trim(),
      gradeLevel: gradeLevel.trim(),
      section: section.trim(),
      roomNumber: (roomNumber || 'Room 101').trim(),
      capacity: Number(capacity) || 30,
      primaryTeacherId,
      studentIds: [],
      subjects: subjects || ['Core Subjects'],
    });

    // Update teacher assignedClassIds
    await req.tenantDb.User.findByIdAndUpdate(primaryTeacherId, {
      $addToSet: { assignedClassIds: newClass._id.toString() },
    });

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'CLASS_MGMT',
      description: `Created class ${newClass.name} (${newClass.gradeLevel})`,
    });

    res.status(201).json({ success: true, class: newClass });
  } catch (err) {
    res.status(500).json({ error: 'CreateClassError', message: err.message });
  }
});

/**
 * POST /api/classes/:classId/allot-student
 * Allot student to class (reassigns if previously assigned to another)
 */
router.post('/:classId/allot-student', authorizeRoles('admin'), async (req, res) => {
  try {
    const { classId } = req.params;
    const { studentId } = req.body;

    const [targetClass, student] = await Promise.all([
      req.tenantDb.Class.findById(classId),
      req.tenantDb.User.findOne({ _id: studentId, role: 'student' }),
    ]);

    if (!targetClass) return res.status(404).json({ error: 'ClassNotFound', message: 'Target class not found.' });
    if (!student) return res.status(404).json({ error: 'StudentNotFound', message: 'Student account not found.' });

    // Capacity check
    if (targetClass.studentIds.length >= targetClass.capacity) {
      return res.status(400).json({
        error: 'ClassCapacityReached',
        message: `Class "${targetClass.name}" has reached its maximum capacity of ${targetClass.capacity} students.`,
      });
    }

    // Remove from previous class if assigned
    if (student.assignedClassId && student.assignedClassId !== classId) {
      await req.tenantDb.Class.findByIdAndUpdate(student.assignedClassId, {
        $pull: { studentIds: student._id.toString() },
      });
    }

    // Add to new class and update student
    await Promise.all([
      req.tenantDb.Class.findByIdAndUpdate(classId, {
        $addToSet: { studentIds: student._id.toString() },
      }),
      req.tenantDb.User.findByIdAndUpdate(studentId, {
        assignedClassId: classId,
      }),
    ]);

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'CLASS_MGMT',
      description: `Allotted student ${student.fullName} to ${targetClass.name}`,
    });

    res.json({ success: true, message: `Student ${student.fullName} allotted to ${targetClass.name}.` });
  } catch (err) {
    res.status(500).json({ error: 'AllotStudentError', message: err.message });
  }
});

/**
 * DELETE /api/classes/:id
 */
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const cls = await req.tenantDb.Class.findByIdAndDelete(id);
    if (!cls) return res.status(404).json({ error: 'ClassNotFound', message: 'Class not found.' });

    // Clear assignments from students
    await req.tenantDb.User.updateMany({ assignedClassId: id }, { assignedClassId: '' });

    res.json({ success: true, message: `Class ${cls.name} deleted.` });
  } catch (err) {
    res.status(500).json({ error: 'DeleteClassError', message: err.message });
  }
});

/**
 * POST /api/classes/:id/import-roster
 * Teacher or Admin imports student roster from parsed CSV/Excel file
 */
router.post('/:id/import-roster', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { students } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      return res.status(400).json({
        error: 'MissingStudents',
        message: 'No student records provided for import.',
      });
    }

    // Verify class exists
    const targetClass = await req.tenantDb.Class.findById(id).catch(() => null);
    if (!targetClass) {
      return res.status(404).json({ error: 'ClassNotFound', message: 'Target class cohort not found.' });
    }

    // Check teacher authorization
    if (req.user.role === 'teacher' && req.user.id !== 'system') {
      const teacher = await req.tenantDb.User.findById(req.user.id).catch(() => null);
      const isAssigned = teacher?.assignedClassIds?.includes(id);
      const isPrimary = targetClass.primaryTeacherId === req.user.id;
      const hasAnyAllotment = (teacher?.assignedClassIds && teacher.assignedClassIds.length > 0) || Boolean(targetClass.primaryTeacherId);
      if (hasAnyAllotment && !isAssigned && !isPrimary) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to import rosters for this class.',
        });
      }
    }

    const defaultPasswordHash = bcrypt.hashSync('Student@123', 10);
    const addedStudentIds = [];
    const processedStudents = [];
    let updatedCount = 0;
    let createdCount = 0;

    for (const s of students) {
      const rollNumber = String(s.rollNumber || '').trim();
      const fullName = String(s.fullName || s.name || '').trim();
      if (!rollNumber || !fullName) continue;

      // Check if student with this rollNumber already exists in this tenant
      let existingUser = await req.tenantDb.User.findOne({
        role: 'student',
        rollNumber,
      });

      if (existingUser) {
        // Update assignedClassId
        existingUser.assignedClassId = id;
        existingUser.fullName = fullName || existingUser.fullName;
        if (s.email && !existingUser.email) existingUser.email = s.email.trim().toLowerCase();
        if (s.phone && !existingUser.phone) existingUser.phone = s.phone.trim();
        await existingUser.save();

        addedStudentIds.push(existingUser._id.toString());
        processedStudents.push({
          id: existingUser._id.toString(),
          rollNumber: existingUser.rollNumber,
          fullName: existingUser.fullName,
          username: existingUser.username,
          status: 'associated',
        });
        updatedCount++;
      } else {
        // Generate a clean unique username
        const cleanRoll = rollNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        let usernameCandidate = `stu_${cleanRoll}`;
        let duplicateCheck = await req.tenantDb.User.findOne({ username: usernameCandidate });
        let counter = 1;
        while (duplicateCheck) {
          usernameCandidate = `stu_${cleanRoll}_${counter++}`;
          duplicateCheck = await req.tenantDb.User.findOne({ username: usernameCandidate });
        }

        const emailCandidate = s.email && s.email.trim()
          ? s.email.trim().toLowerCase()
          : `${usernameCandidate}@${req.databaseName}.edu`;

        const newStudent = await req.tenantDb.User.create({
          username: usernameCandidate,
          passwordHash: defaultPasswordHash,
          fullName,
          email: emailCandidate,
          role: 'student',
          databaseName: req.databaseName,
          rollNumber,
          phone: s.phone ? String(s.phone).trim() : '',
          gradeLevel: s.gradeLevel || targetClass.gradeLevel,
          assignedClassId: id,
          status: 'active',
        });

        addedStudentIds.push(newStudent._id.toString());
        processedStudents.push({
          id: newStudent._id.toString(),
          rollNumber: newStudent.rollNumber,
          fullName: newStudent.fullName,
          username: newStudent.username,
          status: 'created',
        });
        createdCount++;
      }
    }

    // Update targetClass.studentIds
    const currentStudentIds = targetClass.studentIds || [];
    const mergedIds = Array.from(new Set([...currentStudentIds, ...addedStudentIds]));
    targetClass.studentIds = mergedIds;
    await targetClass.save();

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName || req.user.username,
      actorRole: req.user.role,
      actionCategory: 'ROSTER_IMPORT',
      description: `Imported student roster of ${processedStudents.length} students (${createdCount} created, ${updatedCount} updated) for class "${targetClass.name}"`,
    }).catch(() => null);

    res.status(201).json({
      success: true,
      message: `Roster import complete: ${createdCount} new students enrolled, ${updatedCount} existing student records associated with ${targetClass.name}.`,
      totalEnrolled: mergedIds.length,
      createdCount,
      updatedCount,
      importedCount: processedStudents.length,
      students: processedStudents,
    });
  } catch (err) {
    res.status(500).json({ error: 'RosterImportError', message: err.message });
  }
});

export default router;
