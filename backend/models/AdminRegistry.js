/**
 * AdminRegistry Model
 * Stored in `smart_crm_master` database to track all registered institution tenants.
 */
export const AdminRegistrySchema = {
  id: String,
  institutionName: String,
  adminUsername: { type: String, unique: true },
  adminName: String,
  adminEmail: { type: String, unique: true },
  databaseName: { type: String, unique: true }, // Naming: smart_crm_[username]_[timestamp]
  campusCode: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
};

export class AdminRegistry {
  constructor(data) {
    this.id = data.id || `inst-${Date.now()}`;
    this.institutionName = data.institutionName;
    this.adminUsername = data.adminUsername;
    this.adminName = data.adminName;
    this.adminEmail = data.adminEmail;
    this.databaseName = data.databaseName;
    this.campusCode = data.campusCode || 'CAMPUS-01';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.status = data.status || 'active';
  }
}

export default AdminRegistry;
