import dbManager from '../utils/DatabaseManager.js';

/**
 * Activity Logger Middleware
 * Logs API mutations and administrative actions to both Tenant and Master DB audit trails,
 * tracking Client IP Address and User-Agent.
 */
export function activityLogger(category = 'SYSTEM') {
  return (req, res, next) => {
    // Intercept response finish for mutation methods (POST, PUT, DELETE, PATCH)
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const originalSend = res.send;

      res.send = function (data) {
        res.send = originalSend;

        // Extract client IP and user agent
        const ipAddress =
          req.headers['x-forwarded-for']?.split(',')[0] ||
          req.connection?.remoteAddress ||
          req.socket?.remoteAddress ||
          '127.0.0.1';
        const userAgent = req.headers['user-agent'] || 'Unknown-Client';

        const actorName = req.user?.fullName || req.user?.username || 'System';
        const actorRole = req.user?.role || 'admin';
        const databaseName = req.databaseName || req.tenantDb?.databaseName || 'smart_crm_master';
        const institutionName = req.tenantDb?.institutionName || 'Institutional System';

        const description = `${req.method} ${req.originalUrl || req.url} by ${actorName}`;

        dbManager.logActivity({
          databaseName,
          institutionName,
          actorName,
          actorRole,
          actionCategory: category,
          description,
          ipAddress,
          userAgent,
        });

        return res.send(data);
      };
    }

    next();
  };
}

export default activityLogger;
