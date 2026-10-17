import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/schedule
 * List timetable slots
 */
router.get('/', async (req, res) => {
  try {
    const { classId, teacherId } = req.query;
    let query = {};

    if (classId) {
      query.classId = classId;
    } else if (teacherId) {
      query.teacherId = teacherId;
    } else if (req.user?.role === 'student' && req.user?.id && req.user.id !== 'system') {
      const student = await req.tenantDb.User.findById(req.user.id);
      if (student?.assignedClassId) {
        query.classId = student.assignedClassId;
      }
    } else if (req.user?.role === 'teacher' && req.user?.id && req.user.id !== 'system') {
      query.teacherId = req.user.id;
    }

    const schedules = await req.tenantDb.Schedule.find(query);
    const formatted = schedules.map((s) => ({
      ...s.toObject(),
      id: s._id.toString(),
    }));
    res.json({ schedules: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchScheduleError', message: err.message });
  }
});

/**
 * POST /api/schedule
 * Administrator schedules a class session with conflict detection
 */
router.post('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const { day, timeSlot, classId, subject, teacherId, roomNumber } = req.body;

    if (!day || !timeSlot || !classId || !teacherId) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Day, time slot, class, and teacher are required.',
      });
    }

    // 1. Lunch Break Enforcement
    if (timeSlot === '12:00 - 12:30') {
      return res.status(400).json({
        error: 'LunchBreakConflict',
        message: '12:00 - 12:30 is reserved for Institutional Lunch Break across all cohorts.',
      });
    }

    // 2. Teacher Conflict Detection
    const teacherConflict = await req.tenantDb.Schedule.findOne({
      day,
      timeSlot,
      teacherId,
      classId: { $ne: classId },
    });

    if (teacherConflict) {
      const conflictClass = await req.tenantDb.Class.findById(teacherConflict.classId);
      const teacher = await req.tenantDb.User.findById(teacherId);
      return res.status(409).json({
        error: 'TeacherConflict',
        message: `Conflict Detected: ${teacher?.fullName || 'Faculty'} is already scheduled for ${conflictClass?.name || 'another class'} (${teacherConflict.subject}) on ${day} at ${timeSlot}.`,
      });
    }

    // 3. Room Conflict Detection
    const roomConflict = await req.tenantDb.Schedule.findOne({
      day,
      timeSlot,
      roomNumber: (roomNumber || '').trim(),
      classId: { $ne: classId },
    });

    if (roomConflict) {
      const conflictClass = await req.tenantDb.Class.findById(roomConflict.classId);
      return res.status(409).json({
        error: 'RoomConflict',
        message: `Conflict Detected: Room ${roomNumber} is occupied by ${conflictClass?.name || 'another cohort'} on ${day} at ${timeSlot}.`,
      });
    }

    // Replace existing slot for same class, day, and time slot if any
    await req.tenantDb.Schedule.deleteMany({ day, timeSlot, classId });

    const newSlot = await req.tenantDb.Schedule.create({
      day,
      timeSlot,
      classId,
      subject: (subject || 'Core Curriculum').trim(),
      teacherId,
      roomNumber: (roomNumber || 'Room 101').trim(),
    });

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'SCHEDULE',
      description: `Scheduled ${newSlot.subject} on ${newSlot.day} (${newSlot.timeSlot}) in ${newSlot.roomNumber}`,
    });

    res.status(201).json({ success: true, slot: newSlot });
  } catch (err) {
    res.status(500).json({ error: 'ScheduleError', message: err.message });
  }
});

/**
 * DELETE /api/schedule/:id
 */
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await req.tenantDb.Schedule.findByIdAndDelete(id);
    res.json({ success: true, message: `Schedule slot ${id} removed.` });
  } catch (err) {
    res.status(500).json({ error: 'DeleteScheduleError', message: err.message });
  }
});

export default router;
