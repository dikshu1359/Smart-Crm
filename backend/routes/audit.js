import express from 'express';
import dbManager from '../utils/DatabaseManager.js';
import { tenantAuth } from '../middleware/tenantAuth.js';

const router = express.Router();

/**
 * GET /api/audit
 * Returns dual-tier activity logs (Tenant DB or Master DB)
 */
router.get('/', tenantAuth, async (req, res) => {
  try {
    const { scope = 'tenant' } = req.query;

    if (scope === 'master' && req.user.role === 'admin') {
      const masterDB = await dbManager.getMasterDB();
      const logs = await masterDB.MasterLog.find().sort({ timestamp: -1 }).limit(100);
      return res.json({
        databaseName: 'smart_crm_master',
        scope: 'master',
        logs,
        count: logs.length,
      });
    }

    const logs = await req.tenantDb.ActivityLog.find().sort({ timestamp: -1 }).limit(100);
    res.json({
      databaseName: req.databaseName,
      scope: 'tenant',
      logs,
      count: logs.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'FetchAuditLogsError', message: err.message });
  }
});

export default router;
