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
 * GET /api/chat/contacts
 * Returns eligible contacts for current user based on institutional permissions:
 * - Student: ONLY teachers who are actually assigned to teach that student
 *            (via class primary teacher, teacher assignedClassIds, or schedule subjects).
 *            ADMIN IS STRICTLY EXCLUDED for students.
 * - Teacher: admins and students enrolled in teacher's assigned classes
 * - Admin: all teachers and students
 */
router.get('/contacts', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id || req.user?._id;

    let contacts = [];

    if (role === 'admin') {
      // Admin sees teachers and students
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

      // Teachers see Admins and students from their assigned classes
      contacts = await req.tenantDb.User.find({
        _id: { $ne: userId },
        status: 'active',
        $or: [
          { role: 'admin' },
          { role: 'student', assignedClassId: { $in: allClassesForTeacher } },
          { role: 'student', assignedClassIds: { $in: allClassesForTeacher } },
        ],
      }).select('fullName username role email specialization assignedClassId photoUrl');
    } else if (role === 'student' && userId && userId !== 'system') {
      // STUDENT PORTAL: STRICTLY ASSIGNED TEACHERS ONLY - NO ADMINS
      const student = await req.tenantDb.User.findById(userId);
      const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);

      if (studentClassId) {
        // 1. Primary teacher of the class
        const studentClass = await req.tenantDb.Class.findById(studentClassId).catch(() => null);
        const primaryTeacherId = studentClass?.primaryTeacherId;

        // 2. Teachers with this class in assignedClassIds
        const classTeachers = await req.tenantDb.User.find({
          role: 'teacher',
          status: 'active',
          $or: [{ assignedClassIds: studentClassId }, { assignedClassId: studentClassId }],
        });

        // 3. Teachers scheduled in timetable slots for this class
        const scheduleSlots = await req.tenantDb.Schedule.find({ classId: studentClassId });
        const scheduledTeacherIds = scheduleSlots.map((s) => String(s.teacherId)).filter(Boolean);

        const eligibleTeacherIds = new Set([
          ...(primaryTeacherId ? [String(primaryTeacherId)] : []),
          ...classTeachers.map((t) => String(t._id || t.id)),
          ...scheduledTeacherIds,
        ]);

        if (eligibleTeacherIds.size > 0) {
          contacts = await req.tenantDb.User.find({
            _id: { $in: Array.from(eligibleTeacherIds) },
            role: 'teacher',
            status: 'active',
          }).select('fullName username role email specialization assignedClassId photoUrl');
        } else {
          contacts = [];
        }
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
      const unreadCount = unreadMessages.filter((m) => m.senderId === cId).length;
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
 * GET /api/chat/messages/:recipientId
 * Get conversation history between current user and recipient
 */
router.get('/messages/:recipientId', async (req, res) => {
  try {
    const { recipientId } = req.params;
    const conversationId = getConversationId(req.user.id, recipientId);

    const messages = await req.tenantDb.Message.find({ conversationId }).sort({ createdAt: 1 });

    // Mark messages sent to current user as read
    await req.tenantDb.Message.updateMany(
      { conversationId, recipientId: req.user.id, read: false },
      { read: true }
    ).catch(() => {});

    const formatted = messages.map((m) => {
      const mObj = m.toObject ? m.toObject() : { ...m };
      mObj.id = m._id ? m._id.toString() : m.id;
      return mObj;
    });

    res.json({ messages: formatted });
  } catch (err) {
    res.status(500).json({ error: 'FetchMessagesError', message: err.message });
  }
});

/**
 * POST /api/chat/messages
 * Send message with text and/or file attachments (images, PDFs)
 */
router.post('/messages', async (req, res) => {
  try {
    const { recipientId, text, attachments } = req.body;
    const hasText = Boolean(text && text.trim());
    const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

    if (!recipientId || (!hasText && !hasAttachments)) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Recipient and message content (text or file attachment) are required.',
      });
    }

    const recipient = await req.tenantDb.User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'RecipientNotFound', message: 'Recipient user not found.' });
    }

    // Role-based authorization for students: cannot message Admin
    if (req.user?.role === 'student' && recipient.role === 'admin') {
      return res.status(403).json({
        error: 'ForbiddenRecipient',
        message: 'Students may only send messages to their assigned faculty teachers.',
      });
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

    const conversationId = getConversationId(req.user.id, recipientId);

    const message = await req.tenantDb.Message.create({
      conversationId,
      senderId: req.user.id,
      senderName: req.user.fullName,
      senderRole: req.user.role,
      recipientId,
      recipientName: recipient.fullName,
      recipientRole: recipient.role,
      text: (text || '').trim(),
      attachments: safeAttachments,
      read: false,
      createdAt: new Date(),
    });

    const msgObj = message.toObject ? message.toObject() : { ...message };
    msgObj.id = message._id ? message._id.toString() : message.id;

    res.status(201).json({ success: true, message: msgObj });
  } catch (err) {
    res.status(500).json({ error: 'SendMessageError', message: err.message });
  }
});

export default router;
