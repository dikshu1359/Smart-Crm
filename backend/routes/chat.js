import express from 'express';
import { tenantAuth } from '../middleware/tenantAuth.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * Generate a consistent conversation ID for two users in an institution
 */
function getConversationId(userId1, userId2) {
  return [String(userId1), String(userId2)].sort().join('_');
}

/**
 * Helper to fetch authorized teachers for a student
 */
async function getAuthorizedTeacherIdsForStudent(tenantDb, studentId) {
  const student = await tenantDb.User.findById(studentId);
  const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);
  if (!studentClassId) return new Set();

  const studentClass = await tenantDb.Class.findById(studentClassId).catch(() => null);
  const primaryTeacherId = studentClass?.primaryTeacherId;

  const classTeachers = await tenantDb.User.find({
    role: 'teacher',
    status: 'active',
    $or: [{ assignedClassIds: studentClassId }, { assignedClassId: studentClassId }],
  });

  const scheduleSlots = await tenantDb.Schedule.find({ classId: studentClassId });
  const scheduledTeacherIds = scheduleSlots.map((s) => String(s.teacherId)).filter(Boolean);

  return new Set([
    ...(primaryTeacherId ? [String(primaryTeacherId)] : []),
    ...classTeachers.map((t) => String(t._id || t.id)),
    ...scheduledTeacherIds,
  ]);
}

/**
 * GET /api/chat/contacts
 * Returns eligible contacts for current user based on institutional permissions:
 * - Student: ONLY teachers who are actually assigned to teach that student
 * - Teacher: admins, fellow faculty members (collaboration), and students enrolled in teacher's assigned classes
 * - Admin: all teachers and students
 */
router.get('/contacts', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id || req.user?._id;

    let contacts = [];

    if (role === 'admin') {
      contacts = await req.tenantDb.User.find({
        _id: { $ne: userId },
        status: 'active',
        role: { $in: ['teacher', 'student'] },
      }).select('fullName username role email specialization assignedClassId photoUrl');
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId);
      const assignedClassIds = teacher?.assignedClassIds || [];

      // Also find classes where this teacher is primary
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(userId) });
      const allClassesForTeacher = Array.from(
        new Set([...assignedClassIds, ...primaryClasses.map((c) => c._id.toString())])
      );

      // Teachers see Admins, fellow Teachers (collaboration), and students from their assigned classes
      contacts = await req.tenantDb.User.find({
        _id: { $ne: userId },
        status: 'active',
        $or: [
          { role: 'admin' },
          { role: 'teacher' },
          { role: 'student', assignedClassId: { $in: allClassesForTeacher } },
          { role: 'student', assignedClassIds: { $in: allClassesForTeacher } },
        ],
      }).select('fullName username role email specialization assignedClassId photoUrl');
    } else if (role === 'student' && userId && userId !== 'system') {
      // STUDENT PORTAL: STRICTLY ASSIGNED TEACHERS ONLY - NO ADMINS, NO OTHER STUDENTS
      const eligibleTeacherIds = await getAuthorizedTeacherIdsForStudent(req.tenantDb, userId);

      if (eligibleTeacherIds.size > 0) {
        contacts = await req.tenantDb.User.find({
          _id: { $in: Array.from(eligibleTeacherIds) },
          role: 'teacher',
          status: 'active',
        }).select('fullName username role email specialization assignedClassId photoUrl');
      } else {
        contacts = [];
      }
    }

    // Get unread counts per contact
    let unreadMessages = [];
    if (userId && userId !== 'system') {
      unreadMessages = await req.tenantDb.Message.find({
        recipientId: userId,
        read: false,
      });
    }

    const contactsWithUnread = contacts.map((c) => {
      const cId = c._id ? c._id.toString() : c.id;
      const unreadCount = unreadMessages.filter((m) => String(m.senderId) === String(cId)).length;
      return {
        id: cId,
        fullName: c.fullName,
        username: c.username,
        role: c.role,
        email: c.email,
        unreadCount,
        photoUrl: c.photoUrl || '',
        specialization: c.specialization || '',
      };
    });

    res.json({ contacts: contactsWithUnread });
  } catch (err) {
    res.status(500).json({ error: 'FetchContactsError', message: err.message });
  }
});

/**
 * GET /api/chat/messages
 * Fallback when no recipient is specified
 */
router.get('/messages', (req, res) => {
  res.json({ messages: [] });
});

/**
 * GET /api/chat/messages/:recipientId
 * Get conversation history between current user and recipient with strict authorization
 */
router.get('/messages/:recipientId', async (req, res) => {
  try {
    const { recipientId } = req.params;
    if (!recipientId || recipientId === 'undefined' || recipientId === 'null') {
      return res.json({ messages: [] });
    }

    const currentUserId = req.user.id || req.user._id;
    const currentUserRole = req.user.role || 'admin';

    // Verify recipient exists safely
    let recipient = null;
    try {
      recipient = await req.tenantDb.User.findById(recipientId);
    } catch {
      recipient = await req.tenantDb.User.findOne({
        $or: [{ _id: recipientId }, { id: recipientId }],
      }).catch(() => null);
    }
    if (!recipient) {
      return res.status(404).json({ error: 'RecipientNotFound', message: 'User not found.' });
    }

    // Role-based authorization: Student can only view conversation with their assigned teachers
    if (currentUserRole === 'student') {
      if (recipient.role !== 'teacher') {
        return res.status(403).json({
          error: 'UnauthorizedConversation',
          message: 'Students are only authorized to communicate with allocated faculty teachers.',
        });
      }
      const eligibleTeacherIds = await getAuthorizedTeacherIdsForStudent(req.tenantDb, currentUserId);
      if (!eligibleTeacherIds.has(String(recipientId))) {
        return res.status(403).json({
          error: 'UnauthorizedConversation',
          message: 'You are not authorized to view messages with this teacher.',
        });
      }
    } else if (currentUserRole === 'teacher' && recipient.role === 'student') {
      // Teacher communicating with student: student must be in teacher's assigned classes
      const teacher = await req.tenantDb.User.findById(currentUserId);
      const assignedClassIds = teacher?.assignedClassIds || [];
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(currentUserId) });
      const allClassesForTeacher = new Set([...assignedClassIds, ...primaryClasses.map((c) => c._id.toString())]);

      const studentClassId = String(recipient.assignedClassId || (recipient.assignedClassIds && recipient.assignedClassIds[0]));
      if (!allClassesForTeacher.has(studentClassId)) {
        return res.status(403).json({
          error: 'UnauthorizedConversation',
          message: 'You may only view messages for students enrolled in your assigned classes.',
        });
      }
    }

    const conversationId = getConversationId(currentUserId, recipientId);
    const messages = await req.tenantDb.Message.find({ conversationId }).sort({ createdAt: 1 });

    // Mark messages sent to current user as read
    if (typeof req.tenantDb.Message.updateMany === 'function') {
      try {
        await req.tenantDb.Message.updateMany(
          { conversationId, recipientId: String(currentUserId), read: false },
          { read: true }
        );
      } catch (markErr) {
        // silent
      }
    }

    const formatted = messages.map((m) => {
      const mObj = m.toObject ? m.toObject() : { ...m };
      mObj.id = m._id ? m._id.toString() : m.id;
      const actualText = mObj.text || mObj.content || mObj.message || mObj.body || '';
      mObj.text = actualText;
      mObj.content = actualText;
      mObj.message = actualText;
      mObj.createdAt = mObj.createdAt || mObj.timestamp || new Date().toISOString();
      return mObj;
    });

    res.json({ messages: formatted });
  } catch (err) {
    res.status(500).json({ error: 'FetchMessagesError', message: err.message });
  }
});

/**
 * POST /api/chat/messages
 * Send message with text, file attachments (images, PDFs), and/or call event data
 */
router.post('/messages', async (req, res) => {
  try {
    const { recipientId, text, content, message: bodyMsg, attachments, callData } = req.body;
    const currentUserId = req.user.id || req.user._id;
    const currentUserRole = req.user.role || 'admin';

    const rawText = (text || content || bodyMsg || '').trim();
    const hasText = Boolean(rawText);
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
    const isCallEvent = Boolean(callData);

    if (!recipientId || (!hasText && !hasAttachments && !isCallEvent)) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Recipient and message content (text, file attachment, or call event) are required.',
      });
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
      return res.status(404).json({ error: 'RecipientNotFound', message: 'Recipient user not found.' });
    }

    // Role-based authorization for students: cannot message Admin or other students
    if (currentUserRole === 'student') {
      if (recipient.role !== 'teacher') {
        return res.status(403).json({
          error: 'ForbiddenRecipient',
          message: 'Students may only send messages to their assigned faculty teachers.',
        });
      }
      const eligibleTeacherIds = await getAuthorizedTeacherIdsForStudent(req.tenantDb, currentUserId);
      if (!eligibleTeacherIds.has(String(recipientId))) {
        return res.status(403).json({
          error: 'UnauthorizedRecipient',
          message: 'You are only authorized to message faculty teachers allocated to your cohort.',
        });
      }
    } else if (currentUserRole === 'teacher' && recipient.role === 'student') {
      // Teacher messaging student: must belong to allocated class
      const teacher = await req.tenantDb.User.findById(currentUserId);
      const assignedClassIds = teacher?.assignedClassIds || [];
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(currentUserId) });
      const allClassesForTeacher = new Set([...assignedClassIds, ...primaryClasses.map((c) => c._id.toString())]);

      const studentClassId = String(recipient.assignedClassId || (recipient.assignedClassIds && recipient.assignedClassIds[0]));
      if (!allClassesForTeacher.has(studentClassId)) {
        return res.status(403).json({
          error: 'UnauthorizedRecipient',
          message: 'You are only authorized to message students enrolled in your assigned classes.',
        });
      }
    }

    // Validate attachments if provided
    let safeAttachments = [];
    if (hasAttachments) {
      safeAttachments = attachments.map((att, idx) => ({
        id: att.id || `chat-att-${Date.now()}-${idx}`,
        name: att.name || 'document',
        size: att.size || '0 KB',
        mimeType: att.mimeType || 'application/octet-stream',
        contentPreview: att.contentPreview || att.name || 'Attachment',
        dataUrl: att.dataUrl || '',
        uploadedAt: new Date().toISOString(),
      }));
    }

    const conversationId = getConversationId(currentUserId, recipientId);

    const createdMsg = await req.tenantDb.Message.create({
      conversationId,
      senderId: currentUserId,
      senderName: req.user.fullName,
      senderRole: req.user.role,
      recipientId,
      recipientName: recipient.fullName,
      recipientRole: recipient.role,
      text: rawText,
      content: rawText,
      message: rawText,
      attachments: safeAttachments,
      callData: callData || null,
      read: false,
      createdAt: new Date(),
      timestamp: new Date(),
    });

    const msgObj = createdMsg.toObject ? createdMsg.toObject() : { ...createdMsg };
    msgObj.id = createdMsg._id ? createdMsg._id.toString() : createdMsg.id;
    msgObj.text = rawText;
    msgObj.content = rawText;
    msgObj.message = rawText;

    res.status(201).json({ success: true, message: msgObj });
  } catch (err) {
    res.status(500).json({ error: 'SendMessageError', message: err.message });
  }
});

export default router;
