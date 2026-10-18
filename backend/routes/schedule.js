import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * Helper to parse time string "HH:MM" into minutes
 */
function parseTimeToMinutes(tStr) {
  if (!tStr) return 0;
  const [h, m] = tStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

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
      const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);
      if (studentClassId) {
        query.classId = studentClassId;
      }
    } else if (req.user?.role === 'teacher' && req.user?.id && req.user.id !== 'system') {
      query.teacherId = req.user.id;
    }

    const schedules = await req.tenantDb.Schedule.find(query);
    const formatted = schedules.map((s) => {
      const sObj = s.toObject ? s.toObject() : { ...s };
      sObj.id = s._id ? s._id.toString() : s.id;
      return sObj;
    });
    res.json({ schedules: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchScheduleError', message: err.message });
  }
});

/**
 * POST /api/schedule
 * Administrator schedules a class session with comprehensive conflict detection and time validation
 */
router.post('/', authorizeRoles('admin'), async (req, res) => {
  try {
    let { day, timeSlot, startTime, endTime, classId, subject, teacherId, roomNumber } = req.body;

    // Support startTime & endTime or timeSlot
    if (!timeSlot && startTime && endTime) {
      timeSlot = `${startTime} - ${endTime}`;
    }

    if (!day || !timeSlot || !classId || !teacherId) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Day, time slot, class, and assigned teacher are required fields.',
      });
    }

    // 1. Validate that End Time is later than Start Time
    if (timeSlot.includes('-')) {
      const parts = timeSlot.split('-').map((s) => s.trim());
      if (parts.length === 2) {
        const startMin = parseTimeToMinutes(parts[0]);
        const endMin = parseTimeToMinutes(parts[1]);
        if (endMin <= startMin) {
          return res.status(400).json({
            error: 'InvalidTimeRange',
            message: `Validation Error: Session end time (${parts[1]}) must be strictly later than start time (${parts[0]}).`,
          });
        }
      }
    }

    // 2. Lunch Break Enforcement
    if (timeSlot.includes('12:00') && timeSlot.includes('12:30')) {
      return res.status(400).json({
        error: 'LunchBreakConflict',
        message: '12:00 - 12:30 is reserved for Institutional Lunch Break across all cohorts.',
      });
    }

    // 3. Teacher Conflict Detection
    const teacherConflict = await req.tenantDb.Schedule.findOne({
      day,
      timeSlot,
      teacherId: String(teacherId),
      classId: { $ne: String(classId) },
    });

    if (teacherConflict) {
      const conflictClass = await req.tenantDb.Class.findById(teacherConflict.classId);
      const teacher = await req.tenantDb.User.findById(teacherId);
      return res.status(409).json({
        error: 'TeacherConflict',
        message: `Conflict Detected: ${teacher?.fullName || 'Faculty'} is already scheduled for ${conflictClass?.name || 'another class'} (${teacherConflict.subject}) on ${day} during ${timeSlot}.`,
      });
    }

    // 4. Room Conflict Detection (if room specified)
    if (roomNumber && roomNumber.trim()) {
      const cleanRoom = roomNumber.trim();
      const roomConflict = await req.tenantDb.Schedule.findOne({
        day,
        timeSlot,
        roomNumber: cleanRoom,
        classId: { $ne: String(classId) },
      });

      if (roomConflict) {
        const conflictClass = await req.tenantDb.Class.findById(roomConflict.classId);
        return res.status(409).json({
          error: 'RoomConflict',
          message: `Conflict Detected: Room "${cleanRoom}" is already booked for ${conflictClass?.name || 'another cohort'} on ${day} during ${timeSlot}.`,
        });
      }
    }

    // 5. Replace existing slot for the same class, day, and time slot if any (update in-place)
    await req.tenantDb.Schedule.deleteMany({ day, timeSlot, classId: String(classId) });

    const newSlot = await req.tenantDb.Schedule.create({
      day,
      timeSlot,
      classId: String(classId),
      subject: (subject || 'Core Subject').trim(),
      teacherId: String(teacherId),
      roomNumber: (roomNumber || 'Room 101').trim(),
      createdAt: new Date(),
    });

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'SCHEDULE',
      description: `Scheduled ${newSlot.subject} on ${newSlot.day} (${newSlot.timeSlot}) in ${newSlot.roomNumber}`,
    });

    const sObj = newSlot.toObject ? newSlot.toObject() : { ...newSlot };
    sObj.id = newSlot._id ? newSlot._id.toString() : newSlot.id;

    res.status(201).json({ success: true, slot: sObj });
  } catch (err) {
    res.status(500).json({ error: 'ScheduleError', message: err.message });
  }
});

/**
 * PUT /api/schedule/:id
 * Administrator updates a timetable slot
 */
router.put('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { day, timeSlot, classId, subject, teacherId, roomNumber } = req.body;

    const existing = await req.tenantDb.Schedule.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'ScheduleNotFound', message: 'Schedule slot not found.' });
    }

    const updates = {};
    if (day) updates.day = day;
    if (timeSlot) updates.timeSlot = timeSlot;
    if (classId) updates.classId = String(classId);
    if (subject) updates.subject = subject.trim();
    if (teacherId) updates.teacherId = String(teacherId);
    if (roomNumber) updates.roomNumber = roomNumber.trim();

    const updated = await req.tenantDb.Schedule.findByIdAndUpdate(id, updates, { new: true });
    const sObj = updated.toObject ? updated.toObject() : { ...updated };
    sObj.id = updated._id ? updated._id.toString() : updated.id;

    res.json({ success: true, slot: sObj });
  } catch (err) {
    res.status(500).json({ error: 'UpdateScheduleError', message: err.message });
  }
});

/**
 * DELETE /api/schedule/:id
 */
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await req.tenantDb.Schedule.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'NotFound', message: 'Schedule slot not found.' });
    }
    res.json({ success: true, message: `Schedule slot ${id} removed.` });
  } catch (err) {
    res.status(500).json({ error: 'DeleteScheduleError', message: err.message });
  }
});

export default router;
