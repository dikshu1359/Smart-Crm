import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/notices
 * Returns notices targeted to user role or institution-wide
 */
router.get('/', async (req, res) => {
  try {
    const query = {
      $or: [{ targetRole: 'all' }, { targetRole: req.user.role }],
    };
    if (req.user.role === 'admin') {
      delete query.$or; // Admin can see all notices
    }

    const notices = await req.tenantDb.Notice.find(query).sort({ createdAt: -1 });
    res.json({ notices, count: notices.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchNoticesError', message: err.message });
  }
});

/**
 * POST /api/notices
 * Broadcasts an institutional notice
 */
router.post('/', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { title, content, category, targetRole } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'MissingFields', message: 'Title and content are required.' });
    }

    const newNotice = await req.tenantDb.Notice.create({
      title: title.trim(),
      content: content.trim(),
      category: category || 'Institutional',
      targetRole: targetRole || 'all',
      authorName: req.user.fullName,
      authorRole: req.user.role,
      readByUserIds: [req.user.id],
    });

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'NOTICE',
      description: `Broadcasted notice "${newNotice.title}" targeted to ${newNotice.targetRole.toUpperCase()}`,
      ipAddress: req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Unknown',
    });

    res.status(201).json({ success: true, notice: newNotice });
  } catch (err) {
    res.status(500).json({ error: 'CreateNoticeError', message: err.message });
  }
});

/**
 * POST /api/notices/:id/read
 * Marks notice as read for authenticated user
 */
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await req.tenantDb.Notice.findByIdAndUpdate(
      id,
      { $addToSet: { readByUserIds: req.user.id } },
      { new: true }
    );
    if (!notice) {
      return res.status(404).json({ error: 'NoticeNotFound', message: `Notice "${id}" not found.` });
    }
    res.json({ success: true, notice });
  } catch (err) {
    res.status(500).json({ error: 'ReadNoticeError', message: err.message });
  }
});

/**
 * DELETE /api/notices/:id
 * Removes a notice
 */
router.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await req.tenantDb.Notice.findByIdAndDelete(id);
    res.json({ success: true, message: `Notice ${id} removed.` });
  } catch (err) {
    res.status(500).json({ error: 'DeleteNoticeError', message: err.message });
  }
});

export default router;
