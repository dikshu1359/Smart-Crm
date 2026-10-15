import express from 'express';
import dbManager from '../utils/DatabaseManager.js';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';

const router = express.Router();

/**
 * GET /api/tenants
 * Lists registered institution tenants from `smart_crm_master`
 */
router.get('/', async (req, res) => {
  try {
    const masterDB = await dbManager.getMasterDB();
    const institutions = await masterDB.Institution.find({ status: 'active' }).sort({ createdAt: -1 });

    const institutionsWithStats = await Promise.all(
      institutions.map(async (inst) => {
        try {
          const tenant = await dbManager.getTenantDB(inst.databaseName);
          const [userCount, classCount, assignmentCount] = await Promise.all([
            tenant.User.countDocuments(),
            tenant.Class.countDocuments(),
            tenant.Assignment.countDocuments(),
          ]);
          return {
            id: inst._id.toString(),
            institutionName: inst.institutionName,
            adminUsername: inst.adminUsername,
            adminName: inst.adminName,
            adminEmail: inst.adminEmail,
            databaseName: inst.databaseName,
            campusCode: inst.campusCode,
            status: inst.status,
            createdAt: inst.createdAt,
            userCount,
            classCount,
            assignmentCount,
          };
        } catch {
          return {
            id: inst._id.toString(),
            institutionName: inst.institutionName,
            adminUsername: inst.adminUsername,
            adminName: inst.adminName,
            adminEmail: inst.adminEmail,
            databaseName: inst.databaseName,
            campusCode: inst.campusCode,
            status: inst.status,
            createdAt: inst.createdAt,
            userCount: 0,
            classCount: 0,
            assignmentCount: 0,
          };
        }
      })
    );

    res.json({
      masterDatabase: 'smart_crm_master',
      institutions: institutionsWithStats,
      count: institutionsWithStats.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'FetchTenantsError', message: err.message });
  }
});

/**
 * DELETE /api/tenants/:databaseName
 * Deletes tenant database and cleans up master registry
 */
router.delete('/:databaseName', tenantAuth, authorizeRoles('admin'), async (req, res) => {
  try {
    const { databaseName } = req.params;

    // Self-deletion guard: ensure admin belongs to this tenant
    if (req.user.databaseName !== databaseName) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only decommission your own institution database.',
      });
    }

    const success = await dbManager.deleteTenantDatabase(databaseName);
    if (!success) {
      return res.status(404).json({ error: 'TenantNotFound', message: `Database "${databaseName}" not found.` });
    }

    res.json({ success: true, message: `Database "${databaseName}" dropped and purged from master registry.` });
  } catch (err) {
    res.status(500).json({ error: 'DeleteTenantError', message: err.message });
  }
});

export default router;
