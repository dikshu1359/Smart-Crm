import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/calendar
 * Returns academic calendar events with role-specific class visibility
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id;
    const { category, month, classId } = req.query;

    let query = {};

    if (category && ['academic', 'holiday', 'special'].includes(category)) {
      query.category = category;
    }

    if (month) {
      // YYYY-MM prefix match
      query.date = { $regex: `^${month}` };
    }

    // Role-based visibility
    if (role === 'student' && userId && userId !== 'system') {
      const student = await req.tenantDb.User.findById(userId);
      const studentClassId = student?.assignedClassId;
      query.$or = [
        { targetScope: 'all' },
        ...(studentClassId ? [{ targetClassIds: studentClassId }] : []),
      ];
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId);
      const teacherClassIds = teacher?.assignedClassIds || [];
      query.$or = [
        { targetScope: 'all' },
        ...(teacherClassIds.length > 0 ? [{ targetClassIds: { $in: teacherClassIds } }] : []),
      ];
    } else if (classId) {
      query.$or = [{ targetScope: 'all' }, { targetClassIds: classId }];
    }

    const events = await req.tenantDb.CalendarEvent.find(query).sort({ date: 1, startTime: 1 });
    const formatted = events.map((e) => ({
      ...e.toObject(),
      id: e._id.toString(),
    }));

    res.json({ events: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchCalendarError', message: err.message });
  }
});

/**
 * POST /api/calendar
 * Administrator creates an academic calendar event
 */
router.post('/', authorizeRoles('admin'), async (req, res) => {
  try {
    const { title, category, description, date, startTime, endTime, targetScope, targetClassIds } = req.body;

    if (!title || !category || !date) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Title, category, and date are required.',
      });
    }

    if (!['academic', 'holiday', 'special'].includes(category)) {
      return res.status(400).json({
        error: 'InvalidCategory',
        message: 'Category must be academic (Blue), holiday (Green), or special (Orange).',
      });
    }

    // Validate date format YYYY-MM-DD
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date.trim())) {
      return res.status(400).json({
        error: 'InvalidDate',
        message: 'Date must be formatted as YYYY-MM-DD.',
      });
    }

    const sTime = startTime || '09:00';
    const eTime = endTime || '17:00';
    if (sTime >= eTime) {
      return res.status(400).json({
        error: 'InvalidTimeRange',
        message: 'Event start time must precede end time.',
      });
    }

    // Check overlapping events on the same date for the same scope
    const scope = targetScope === 'class' ? 'class' : 'all';
    const existingEvents = await req.tenantDb.CalendarEvent.find({ date: date.trim() });
    const hasOverlap = existingEvents.some((ev) => {
      // Overlap occurs if time windows intersect
      const evStart = ev.startTime || '09:00';
      const evEnd = ev.endTime || '17:00';
      const timesOverlap = sTime < evEnd && eTime > evStart;
      if (!timesOverlap) return false;
      if (scope === 'all' || ev.targetScope === 'all') return true;
      // Class-specific overlap
      return (targetClassIds || []).some((cid) => (ev.targetClassIds || []).includes(cid));
    });

    const newEvent = await req.tenantDb.CalendarEvent.create({
      title: title.trim(),
      category,
      description: (description || '').trim(),
      date: date.trim(),
      startTime: sTime,
      endTime: eTime,
      targetScope: scope,
      targetClassIds: Array.isArray(targetClassIds) ? targetClassIds : [],
      authorName: req.user?.fullName || 'Administrator',
      authorRole: req.user?.role || 'admin',
    });

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || 'Admin',
      actorRole: req.user?.role || 'admin',
      actionCategory: 'CALENDAR',
      description: `Created ${category.toUpperCase()} event: "${newEvent.title}" on ${newEvent.date}${hasOverlap ? ' (Note: overlapping schedule detected)' : ''}`,
    });

    const eventObj = newEvent.toObject();
    eventObj.id = newEvent._id.toString();

    res.status(201).json({
      success: true,
      event: eventObj,
      overlapWarning: hasOverlap ? 'Another event is scheduled during this time window on this date.' : null,
    });
  } catch (err) {
    res.status(500).json({ error: 'CreateCalendarEventError', message: err.message });
  }
});

/**
 * PUT /api/calendar/:id
 * Administrator updates an existing academic calendar event
 */
router.put('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, description, date, startTime, endTime, targetScope, targetClassIds } = req.body;

    const updates = {};
    if (title) updates.title = title.trim();
    if (category && ['academic', 'holiday', 'special'].includes(category)) updates.category = category;
    if (description !== undefined) updates.description = description.trim();
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        return res.status(400).json({ error: 'InvalidDate', message: 'Date must be formatted as YYYY-MM-DD.' });
      }
      updates.date = date.trim();
    }
    if (startTime) updates.startTime = startTime;
    if (endTime) updates.endTime = endTime;
    if (updates.startTime && updates.endTime && updates.startTime >= updates.endTime) {
      return res.status(400).json({ error: 'InvalidTimeRange', message: 'Start time must precede end time.' });
    }
    if (targetScope) updates.targetScope = targetScope === 'class' ? 'class' : 'all';
    if (Array.isArray(targetClassIds)) updates.targetClassIds = targetClassIds;

    const updated = await req.tenantDb.CalendarEvent.findByIdAndUpdate(id, updates, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'NotFound', message: 'Calendar event not found.' });
    }

    const eventObj = updated.toObject();
    eventObj.id = updated._id.toString();

    res.json({ success: true, event: eventObj });
  } catch (err) {
    res.status(500).json({ error: 'UpdateCalendarEventError', message: err.message });
  }
});

/**
 * DELETE /api/calendar/:id
 * Administrator deletes an academic calendar event
 */
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await req.tenantDb.CalendarEvent.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'NotFound', message: 'Calendar event not found.' });
    }

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || 'Admin',
      actorRole: req.user?.role || 'admin',
      actionCategory: 'CALENDAR',
      description: `Deleted calendar event: "${deleted.title}"`,
    });

    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'DeleteCalendarEventError', message: err.message });
  }
});

export default router;
