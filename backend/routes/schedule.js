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
  const clean = tStr.trim();
  const [h, m] = clean.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function parseSlotRange(timeSlot) {
  if (!timeSlot || !timeSlot.includes('-')) return null;
  const parts = timeSlot.split('-').map((s) => s.trim());
  if (parts.length !== 2) return null;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  return { start, end, startStr: parts[0], endStr: parts[1] };
}

function isOverlapping(slotA, slotB) {
  const rangeA = parseSlotRange(slotA);
  const rangeB = parseSlotRange(slotB);
  if (!rangeA || !rangeB) return slotA === slotB;
  return rangeA.start < rangeB.end && rangeA.end > rangeB.start;
}

/**
 * GET /api/schedule
 * List timetable slots (supports Mon-Sat and configurable breaks)
 */
router.get('/', async (req, res) => {
  try {
    const { classId, teacherId } = req.query;
    let query = {};

    if (classId) {
      // Include class slots plus institutional breaks
      query = { $or: [{ classId }, { isBreak: true, classId: 'all' }] };
    } else if (teacherId) {
      query = { $or: [{ teacherId }, { isBreak: true }] };
    } else if (req.user?.role === 'student' && req.user?.id && req.user.id !== 'system') {
      const student = await req.tenantDb.User.findById(req.user.id);
      const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);
      if (studentClassId) {
        query = { $or: [{ classId: String(studentClassId) }, { isBreak: true, classId: 'all' }] };
      }
    } else if (req.user?.role === 'teacher' && req.user?.id && req.user.id !== 'system') {
      query = { $or: [{ teacherId: req.user.id }, { isBreak: true }] };
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
 * Administrator schedules a class session or configurable break
 */
router.post('/', authorizeRoles('admin'), async (req, res) => {
  try {
    let { day, timeSlot, startTime, endTime, classId, subject, teacherId, roomNumber, isBreak, breakTitle } = req.body;

    if (!timeSlot && startTime && endTime) {
      timeSlot = `${startTime} - ${endTime}`;
    }

    if (!day || !timeSlot) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Day and time slot are required.',
      });
    }

    // 1. Validate that End Time is strictly later than Start Time
    const slotRange = parseSlotRange(timeSlot);
    if (!slotRange || slotRange.end <= slotRange.start) {
      return res.status(400).json({
        error: 'InvalidTimeRange',
        message: `Validation Error: End time (${slotRange?.endStr || 'N/A'}) must be strictly later than start time (${slotRange?.startStr || 'N/A'}).`,
      });
    }

    // 2. Handle Break Period Creation
    if (isBreak) {
      const title = (breakTitle || subject || 'Institutional Break').trim();
      const targetClassId = classId || 'all';

      // Remove any existing duplicate break for same time and day
      await req.tenantDb.Schedule.deleteMany({ day, timeSlot, isBreak: true, classId: targetClassId });

      const newBreak = await req.tenantDb.Schedule.create({
        day,
        timeSlot,
        classId: targetClassId,
        subject: title,
        teacherId: '',
        roomNumber: '',
        isBreak: true,
        breakTitle: title,
        startTime: slotRange.startStr,
        endTime: slotRange.endStr,
        createdAt: new Date(),
      });

      await dbManager.logActivity({
        databaseName: req.databaseName,
        institutionName: req.user.institutionName,
        actorName: req.user.fullName,
        actorRole: req.user.role,
        actionCategory: 'SCHEDULE',
        description: `Configured break period "${title}" on ${day} (${timeSlot})`,
      });

      const bObj = newBreak.toObject ? newBreak.toObject() : { ...newBreak };
      bObj.id = newBreak._id ? newBreak._id.toString() : newBreak.id;
      return res.status(201).json({ success: true, slot: bObj });
    }

    // 3. Regular Session Validation
    if (!classId || !teacherId) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Class and assigned teacher are required for academic sessions.',
      });
    }

    // Check all existing slots on this day for overlaps
    const existingDaySlots = await req.tenantDb.Schedule.find({ day });

    for (const existing of existingDaySlots) {
      if (isOverlapping(existing.timeSlot, timeSlot)) {
        // Check if overlaps with an active break
        if (existing.isBreak && (existing.classId === 'all' || existing.classId === String(classId))) {
          return res.status(409).json({
            error: 'BreakConflict',
            message: `Conflict Detected: This period overlaps with scheduled ${existing.breakTitle || 'Break'} (${existing.timeSlot}).`,
          });
        }

        // Check teacher conflict
        if (existing.teacherId && String(existing.teacherId) === String(teacherId) && String(existing.classId) !== String(classId)) {
          const conflictClass = await req.tenantDb.Class.findById(existing.classId).catch(() => null);
          const teacher = await req.tenantDb.User.findById(teacherId).catch(() => null);
          return res.status(409).json({
            error: 'TeacherConflict',
            message: `Conflict Detected: ${teacher?.fullName || 'Faculty'} is already scheduled for ${conflictClass?.name || 'another class'} (${existing.subject}) on ${day} during ${existing.timeSlot}.`,
          });
        }

        // Check room conflict
        if (roomNumber && existing.roomNumber && existing.roomNumber.trim().toLowerCase() === roomNumber.trim().toLowerCase() && String(existing.classId) !== String(classId)) {
          const conflictClass = await req.tenantDb.Class.findById(existing.classId).catch(() => null);
          return res.status(409).json({
            error: 'RoomConflict',
            message: `Conflict Detected: Room "${roomNumber}" is already booked for ${conflictClass?.name || 'another cohort'} on ${day} during ${existing.timeSlot}.`,
          });
        }

        // Overlapping session for same class
        if (String(existing.classId) === String(classId) && existing.timeSlot !== timeSlot) {
          return res.status(409).json({
            error: 'ClassOverlap',
            message: `Conflict Detected: Class already has another session "${existing.subject}" scheduled during ${existing.timeSlot}.`,
          });
        }
      }
    }

    // Replace existing slot for the exact same class, day, and time slot if any (in-place update)
    await req.tenantDb.Schedule.deleteMany({ day, timeSlot, classId: String(classId) });

    const newSlot = await req.tenantDb.Schedule.create({
      day,
      timeSlot,
      classId: String(classId),
      subject: (subject || 'Core Subject').trim(),
      teacherId: String(teacherId),
      roomNumber: (roomNumber || 'Room 101').trim(),
      isBreak: false,
      startTime: slotRange.startStr,
      endTime: slotRange.endStr,
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
 * Administrator updates a timetable slot or break
 */
router.put('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { day, timeSlot, startTime, endTime, classId, subject, teacherId, roomNumber, isBreak, breakTitle } = req.body;

    const existing = await req.tenantDb.Schedule.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'ScheduleNotFound', message: 'Schedule slot not found.' });
    }

    let finalTimeSlot = timeSlot || existing.timeSlot;
    if (startTime && endTime) {
      finalTimeSlot = `${startTime} - ${endTime}`;
    }

    const slotRange = parseSlotRange(finalTimeSlot);
    if (slotRange && slotRange.end <= slotRange.start) {
      return res.status(400).json({
        error: 'InvalidTimeRange',
        message: `Validation Error: End time (${slotRange.endStr}) must be strictly later than start time (${slotRange.startStr}).`,
      });
    }

    const targetDay = day || existing.day;
    const targetClassId = classId || existing.classId;
    const targetTeacherId = teacherId !== undefined ? teacherId : existing.teacherId;
    const targetRoom = roomNumber !== undefined ? roomNumber : existing.roomNumber;
    const targetIsBreak = isBreak !== undefined ? Boolean(isBreak) : existing.isBreak;

    // Overlap conflict check against other slots (excluding this one)
    if (!targetIsBreak) {
      const otherSlots = await req.tenantDb.Schedule.find({ day: targetDay });
      for (const other of otherSlots) {
        const otherId = other._id ? other._id.toString() : other.id;
        if (otherId === id) continue;

        if (isOverlapping(other.timeSlot, finalTimeSlot)) {
          if (other.isBreak && (other.classId === 'all' || other.classId === String(targetClassId))) {
            return res.status(409).json({
              error: 'BreakConflict',
              message: `Conflict Detected: This period overlaps with scheduled ${other.breakTitle || 'Break'} (${other.timeSlot}).`,
            });
          }

          if (targetTeacherId && other.teacherId && String(other.teacherId) === String(targetTeacherId) && String(other.classId) !== String(targetClassId)) {
            const conflictClass = await req.tenantDb.Class.findById(other.classId).catch(() => null);
            return res.status(409).json({
              error: 'TeacherConflict',
              message: `Conflict Detected: Teacher is already scheduled for ${conflictClass?.name || 'another class'} during ${other.timeSlot}.`,
            });
          }

          if (targetRoom && other.roomNumber && other.roomNumber.trim().toLowerCase() === targetRoom.trim().toLowerCase() && String(other.classId) !== String(targetClassId)) {
            return res.status(409).json({
              error: 'RoomConflict',
              message: `Conflict Detected: Room "${targetRoom}" is already booked during ${other.timeSlot}.`,
            });
          }
        }
      }
    }

    const updates = {
      day: targetDay,
      timeSlot: finalTimeSlot,
      classId: targetClassId,
      subject: (breakTitle || subject || existing.subject || '').trim(),
      teacherId: targetTeacherId,
      roomNumber: targetRoom,
      isBreak: targetIsBreak,
      breakTitle: breakTitle || existing.breakTitle || '',
    };
    if (slotRange) {
      updates.startTime = slotRange.startStr;
      updates.endTime = slotRange.endStr;
    }

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
    res.json({ success: true, message: `Schedule slot removed.` });
  } catch (err) {
    res.status(500).json({ error: 'DeleteScheduleError', message: err.message });
  }
});

export default router;
