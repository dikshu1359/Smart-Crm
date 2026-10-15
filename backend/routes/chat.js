import express from 'express';
import { tenantAuth } from '../middleware/tenantAuth.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * Generate a consistent conversation ID for two users in an institution
 */
function getConversationId(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
}

/**
 * GET /api/chat/contacts
 * Returns eligible contacts for current user based on institutional permissions:
 * - Admin: all teachers and students
 * - Teacher: admins and students in teacher's assigned classes
 * - Student: admins and teachers of student's assigned class
 */
router.get('/contacts', async (req, res) => {
  try {
    const { role } = req.user;
    let query = { _id: { $ne: req.user.id }, status: 'active' };

    if (role === 'admin') {
      query.role = { $in: ['teacher', 'student'] };
    } else if (role === 'teacher') {
      const teacher = await req.tenantDb.User.findById(req.user.id);
      const assignedClassIds = teacher?.assignedClassIds || [];
      query = {
        _id: { $ne: req.user.id },
        $or: [
          { role: 'admin' },
          { role: 'student', assignedClassId: { $in: assignedClassIds } },
        ],
      };
    } else if (role === 'student') {
      const student = await req.tenantDb.User.findById(req.user.id);
      const studentClassId = student?.assignedClassId;
      query = {
        _id: { $ne: req.user.id },
        $or: [
          { role: 'admin' },
          { role: 'teacher', assignedClassIds: studentClassId },
        ],
      };
    }

    const contacts = await req.tenantDb.User.find(query).select('fullName username role email specialization assignedClassId').lean();

    // Get unread counts per contact
    const unreadMessages = await req.tenantDb.Message.find({
      recipientId: req.user.id,
      read: false,
    });

    const contactsWithUnread = contacts.map((c) => {
      const unreadCount = unreadMessages.filter((m) => m.senderId === c._id.toString()).length;
      return {
        id: c._id.toString(),
        fullName: c.fullName,
        username: c.username,
        role: c.role,
        email: c.email,
        unreadCount,
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
    );

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'FetchMessagesError', message: err.message });
  }
});

/**
 * POST /api/chat/messages
 * Send message to an authorized recipient
 */
router.post('/messages', async (req, res) => {
  try {
    const { recipientId, text } = req.body;
    if (!recipientId || !text?.trim()) {
      return res.status(400).json({ error: 'MissingFields', message: 'Recipient and message text are required.' });
    }

    const recipient = await req.tenantDb.User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ error: 'RecipientNotFound', message: 'Recipient user not found.' });
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
      text: text.trim(),
      read: false,
    });

    res.status(201).json({ success: true, message });
  } catch (err) {
    res.status(500).json({ error: 'SendMessageError', message: err.message });
  }
});

export default router;
