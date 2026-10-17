import jwt from 'jsonwebtoken';
import dbManager from '../utils/DatabaseManager.js';

const JWT_SECRET = process.env.JWT_SECRET || 'smart-institutional-crm-super-secret-jwt-key';

/**
 * Tenant Authentication Middleware
 * Resolves tenant database from JWT token or x-tenant-database header,
 * authenticates identity, and binds `req.user` and `req.tenantDb`.
 */
export async function tenantAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    const headerDbName = req.headers['x-tenant-database'] || req.headers['x-database-name'];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        const dbName = headerDbName || decoded.databaseName;

        const tenantDb = await dbManager.getTenantDB(dbName);
        if (!tenantDb) {
          return res.status(404).json({
            error: 'TenantNotFound',
            message: `Tenant database "${dbName}" not found or has been decommissioned.`,
          });
        }

        // Cross-tenant verification: token database must match requested tenant database
        if (decoded.databaseName && headerDbName && decoded.databaseName !== headerDbName) {
          return res.status(403).json({
            error: 'CrossTenantForbidden',
            message: 'Access denied: You cannot perform operations across isolated institutional databases.',
          });
        }

        req.tenantDb = tenantDb;
        req.databaseName = dbName;
        return next();
      } catch (jwtErr) {
        return res.status(401).json({
          error: 'InvalidToken',
          message: 'Session token is invalid or expired.',
        });
      }
    }

    // Direct tenant header (for unauthenticated or public institutional routes if needed)
    if (headerDbName) {
      const tenantDb = await dbManager.getTenantDB(headerDbName);
      if (!tenantDb) {
        return res.status(404).json({
          error: 'TenantNotFound',
          message: `Tenant database "${headerDbName}" not found.`,
        });
      }
      req.tenantDb = tenantDb;
      req.databaseName = headerDbName;
      req.user = {
        role: 'admin',
        id: 'system',
        username: 'system',
        fullName: 'Institutional System',
        databaseName: headerDbName,
      };
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token required.',
    });
  } catch (error) {
    return res.status(500).json({
      error: 'AuthMiddlewareError',
      message: error.message,
    });
  }
}

/**
 * Role-Based Access Control Middleware Helper
 * Usage: authorizeRoles('admin', 'teacher')
 */
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || req.user.id === 'system') {
      return res.status(401).json({ error: 'Unauthorized', message: 'User authentication token required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Access denied. Role "${req.user.role}" does not have required permissions. Required: [${allowedRoles.join(', ')}].`,
      });
    }
    next();
  };
}

export default tenantAuth;
