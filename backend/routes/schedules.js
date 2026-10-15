import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import { activityLogger } from '../middleware/activityLogger.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/schedules
 * Get weekly schedule slots for tenant, optionally filtered by classId or teacherId
 */
router.get('/', (req, res) => {
  const { classId, teacherId } = req.query;
  let schedules = req.tenantDb.schedules;

  if (classId) {
    schedules = schedules.filter((s) => s.classId === classId);
  } else if (teacherId) {
    schedules = schedules.filter((s) => s.teacherId === teacherId);
  } else if (req.user.role === 'student' && req.user.assignedClassId) {
    schedules = schedules.filter((s) => s.classId === req.user.assignedClassId);
  }

  return res.json({
    databaseName: req.databaseName,
    count: schedules.length,
    schedules,
  });
});

/**
 * POST /api/schedules
 * Add scheduled session with automatic conflict detection
 */
router.post(
  '/',
  authorizeRoles('admin'),
  activityLogger('SCHEDULE'),
  (req, res) => {
    const { day, timeSlot, classId, subject, teacherId, roomNumber } = req.body;

    if (!day || !timeSlot || !classId || !subject || !teacherId) {
      return res.status(400).json({ error: 'BadRequest', message: 'day, timeSlot, classId, subject, and teacherId are required.' });
    }

    if (timeSlot === '12:00 - 12:30') {
      return res.status(400).json({
        error: 'Conflict',
        message: '12:00 - 12:30 is reserved for Institutional Lunch Break across all cohorts.',
      });
    }

    // 1. Teacher Conflict Detection: check if teacher is already booked in another class at that slot
    const teacherConflict = req.tenantDb.schedules.find(
      (s) => s.day === day && s.timeSlot === timeSlot && s.teacherId === teacherId && s.classId !== classId
    );

    if (teacherConflict) {
      const conflictClass = req.tenantDb.classes.find((c) => c.id === teacherConflict.classId);
      return res.status(409).json({
        error: 'Conflict',
        message: `Teacher Conflict: Selected faculty is already teaching ${teacherConflict.subject} in ${conflictClass?.name || 'another class'} on ${day} (${timeSlot}).`,
      });
    }

    // 2. Room Conflict Detection: check if room is already occupied by another class
    const roomConflict = req.tenantDb.schedules.find(
      (s) =>
        s.day === day &&
        s.timeSlot === timeSlot &&
        s.roomNumber?.trim().toLowerCase() === (roomNumber || '').trim().toLowerCase() &&
        s.classId !== classId
    );

    if (roomConflict) {
      const conflictClass = req.tenantDb.classes.find((c) => c.id === roomConflict.classId);
      return res.status(409).json({
        error: 'Conflict',
        message: `Room Conflict: ${roomNumber} is occupied by ${conflictClass?.name || 'another cohort'} on ${day} (${timeSlot}).`,
      });
    }

    // Remove existing slot for the exact same class/day/slot if updating
    req.tenantDb.schedules = req.tenantDb.schedules.filter(
      (s) => !(s.day === day && s.timeSlot === timeSlot && s.classId === classId)
    );

    const newSlot = {
      id: `sch-${Date.now()}`,
      day,
      timeSlot,
      classId,
      subject,
      teacherId,
      roomNumber: roomNumber || 'Room 101',
    };

    req.tenantDb.schedules.push(newSlot);

    return res.status(201).json({
      message: 'Scheduled session successfully with zero conflicts.',
      slot: newSlot,
    });
  }
);

/**
 * DELETE /api/schedules/:id
 */
router.delete(
  '/:id',
  authorizeRoles('admin'),
  activityLogger('SCHEDULE'),
  (req, res) => {
    const slotId = req.params.id;
    req.tenantDb.schedules = req.tenantDb.schedules.filter((s) => s.id !== slotId);
    return res.json({ message: `Slot ${slotId} removed.` });
  }
);

export default router;
