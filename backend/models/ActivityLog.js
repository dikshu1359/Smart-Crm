/**
 * ActivityLog Model
 * Audit trail recording administrative operations, IP addresses, and User Agents
 * for both Master DB and Tenant DB compliance tracking.
 */
export const ActivityLogSchema = {
  id: String,
  timestamp: { type: String, default: () => new Date().toISOString() },
  databaseName: { type: String, required: true },
  institutionName: String,
  actorName: String,
  actorRole: {
    type: String,
    enum: ['admin', 'teacher', 'student'],
    default: 'admin',
  },
  actionCategory: {
    type: String,
    enum: [
      'AUTH',
      'TENANT_DB',
      'USER_MGMT',
      'CLASS_MGMT',
      'ASSIGNMENT',
      'SCHEDULE',
      'NOTICE',
      'SYSTEM',
    ],
    default: 'SYSTEM',
  },
  description: { type: String, required: true },
  ipAddress: String,
  userAgent: String,
};

export class ActivityLog {
  constructor(data) {
    this.id = data.id || `log-${Date.now()}`;
    this.timestamp = data.timestamp || new Date().toISOString();
    this.databaseName = data.databaseName;
    this.institutionName = data.institutionName;
    this.actorName = data.actorName;
    this.actorRole = data.actorRole || 'admin';
    this.actionCategory = data.actionCategory || 'SYSTEM';
    this.description = data.description;
    this.ipAddress = data.ipAddress || '127.0.0.1';
    this.userAgent = data.userAgent || 'Unknown';
  }
}

export default ActivityLog;
