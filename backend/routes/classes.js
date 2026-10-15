import express from 'express';
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

export default router;
