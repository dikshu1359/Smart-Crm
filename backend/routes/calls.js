import express from 'express';
import { tenantAuth } from '../middleware/tenantAuth.js';
import {
  getActiveCalls,
  createCallSession,
  terminateCallSession,
  broadcastToUser,
} from '../websocket.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * Helper to fetch authorized teachers for a student
 */
async function getAuthorizedTeacherIdsForStudent(tenantDb, studentId) {
  const student = await tenantDb.User.findById(studentId);
  const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);
  if (!studentClassId) {
    const allTeachers = await tenantDb.User.find({ role: 'teacher', status: 'active' });
    return new Set(allTeachers.map((t) => String(t._id || t.id)));
  }

  const studentClass = await tenantDb.Class.findById(studentClassId).catch(() => null);
  const primaryTeacherId = studentClass?.primaryTeacherId;

  const classTeachers = await tenantDb.User.find({
    role: 'teacher',
    status: 'active',
    $or: [{ assignedClassIds: studentClassId }, { assignedClassId: studentClassId }],
  });

  const scheduleSlots = await tenantDb.Schedule.find({ classId: studentClassId });
  const scheduledTeacherIds = scheduleSlots.map((s) => String(s.teacherId)).filter(Boolean);

  const teacherIds = new Set([
    ...(primaryTeacherId ? [String(primaryTeacherId)] : []),
    ...classTeachers.map((t) => String(t._id || t.id)),
    ...scheduledTeacherIds,
  ]);

  if (teacherIds.size === 0) {
    const fallback = await tenantDb.User.find({ role: 'teacher', status: 'active' });
    return new Set(fallback.map((t) => String(t._id || t.id)));
  }

  return teacherIds;
}

/**
 * GET /api/calls/active
 * Returns current active call involving the authenticated user (incoming or outgoing)
 */
router.get('/active', async (req, res) => {
  try {
    const currentUserId = String(req.user.id || req.user._id);
    const activeCalls = getActiveCalls();

    let userCall = null;
    for (const [, call] of activeCalls.entries()) {
      if (
        String(call.callerId) === currentUserId ||
        String(call.recipientId) === currentUserId
      ) {
        userCall = call;
        break;
      }
    }

    res.json({ call: userCall || null });
  } catch (err) {
    res.status(500).json({ error: 'GetActiveCallError', message: err.message });
  }
});

/**
 * POST /api/calls/initiate
 * Initiates an authorized call with validation
 */
router.post('/initiate', async (req, res) => {
  try {
    const { recipientId, callType = 'audio', offerSdp } = req.body;
    const currentUserId = String(req.user.id || req.user._id);
    const currentUserRole = req.user.role || 'admin';

    if (!recipientId) {
      return res.status(400).json({ error: 'MissingRecipient', message: 'Recipient ID is required.' });
    }

    let recipient = null;
    try {
      recipient = await req.tenantDb.User.findById(recipientId);
    } catch {
      recipient = await req.tenantDb.User.findOne({
        $or: [{ _id: recipientId }, { id: recipientId }],
      }).catch(() => null);
    }

    if (!recipient) {
      return res.status(404).json({ error: 'RecipientNotFound', message: 'Recipient not found.' });
    }

    // Role-based authorization
    if (currentUserRole === 'student') {
      if (recipient.role !== 'teacher') {
        return res.status(403).json({
          error: 'UnauthorizedCall',
          message: 'Students are only authorized to call assigned faculty teachers.',
        });
      }
      const authorizedTeachers = await getAuthorizedTeacherIdsForStudent(req.tenantDb, currentUserId);
      if (authorizedTeachers.size > 0 && !authorizedTeachers.has(String(recipientId))) {
        return res.status(403).json({
          error: 'UnauthorizedCall',
          message: 'You are not authorized to call this teacher.',
        });
      }
    } else if (currentUserRole === 'teacher' && recipient.role === 'student') {
      const teacher = await req.tenantDb.User.findById(currentUserId);
      const assignedClassIds = teacher?.assignedClassIds || [];
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: currentUserId });
      const allClassesForTeacher = new Set([...assignedClassIds, ...primaryClasses.map((c) => c._id.toString())]);

      const studentClassId = String(
        recipient.assignedClassId || (recipient.assignedClassIds && recipient.assignedClassIds[0])
      );
      if (allClassesForTeacher.size > 0 && !allClassesForTeacher.has(studentClassId)) {
        return res.status(403).json({
          error: 'UnauthorizedCall',
          message: 'You may only call students enrolled in your assigned classes.',
        });
      }
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const callData = {
      callId,
      callerId: currentUserId,
      callerName: req.user.fullName,
      callerRole: currentUserRole,
      recipientId: String(recipient._id || recipient.id),
      recipientName: recipient.fullName,
      recipientRole: recipient.role,
      type: callType === 'video' ? 'video' : 'audio',
      status: 'ringing',
      startedAt: new Date().toISOString(),
      connectedAt: null,
      databaseName: req.databaseName,
      offerSdp: offerSdp || null,
      answerSdp: null,
      iceCandidates: [],
    };

    createCallSession(callData);

    res.status(201).json({ success: true, call: callData });
  } catch (err) {
    res.status(500).json({ error: 'InitiateCallError', message: err.message });
  }
});

/**
 * POST /api/calls/:callId/respond
 * Recipient answers or declines incoming call
 */
router.post('/:callId/respond', async (req, res) => {
  try {
    const { callId } = req.params;
    const { action, answerSdp } = req.body; // action: 'answer' | 'decline'
    const currentUserId = String(req.user.id || req.user._id);

    const activeCalls = getActiveCalls();
    const call = activeCalls.get(callId);

    if (!call) {
      return res.status(404).json({ error: 'CallNotFound', message: 'Active call session not found or already ended.' });
    }

    if (String(call.recipientId) !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not the designated recipient of this call.' });
    }

    if (action === 'answer') {
      call.status = 'connected';
      call.connectedAt = new Date().toISOString();
      if (answerSdp) {
        call.answerSdp = answerSdp;
      }

      broadcastToUser(call.callerId, 'call:answered', call);
      broadcastToUser(call.recipientId, 'call:connected', call);

      return res.json({ success: true, call });
    } else if (action === 'decline') {
      await terminateCallSession(call, 'declined', currentUserId);
      return res.json({ success: true, message: 'Call declined.' });
    } else {
      return res.status(400).json({ error: 'InvalidAction', message: 'Action must be "answer" or "decline".' });
    }
  } catch (err) {
    res.status(500).json({ error: 'RespondCallError', message: err.message });
  }
});

/**
 * POST /api/calls/:callId/signal
 * Send WebRTC signaling data (offer, answer, or ice candidate)
 */
router.post('/:callId/signal', async (req, res) => {
  try {
    const { callId } = req.params;
    const { signal } = req.body;
    const currentUserId = String(req.user.id || req.user._id);

    const activeCalls = getActiveCalls();
    const call = activeCalls.get(callId);

    if (!call) {
      return res.status(404).json({ error: 'CallNotFound', message: 'Active call session not found.' });
    }

    const targetUserId =
      String(call.callerId) === currentUserId ? call.recipientId : call.callerId;

    broadcastToUser(targetUserId, 'call:signal', {
      callId,
      fromUserId: currentUserId,
      signal,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'SignalCallError', message: err.message });
  }
});

/**
 * POST /api/calls/:callId/end
 * End an active call (caller or recipient)
 */
router.post('/:callId/end', async (req, res) => {
  try {
    const { callId } = req.params;
    const currentUserId = String(req.user.id || req.user._id);

    const activeCalls = getActiveCalls();
    const call = activeCalls.get(callId);

    if (!call) {
      return res.json({ success: true, message: 'Call already ended.' });
    }

    if (String(call.callerId) !== currentUserId && String(call.recipientId) !== currentUserId) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not a participant in this call.' });
    }

    const finalStatus = call.status === 'connected' ? 'completed' : 'missed';
    await terminateCallSession(call, finalStatus, currentUserId);

    res.json({ success: true, message: 'Call terminated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'EndCallError', message: err.message });
  }
});

export default router;
