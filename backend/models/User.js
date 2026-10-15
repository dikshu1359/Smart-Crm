/**
 * User Model
 * Tenant-scoped user entity with Role-Based Access Control (Admin, Teacher, Student).
 */
export const UserSchema = {
  id: String,
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
  databaseName: String,
  phone: String,
  // Teacher-specific fields
  specialization: String,
  qualification: String,
  assignedClassIds: [String],
  // Student-specific fields
  rollNumber: String,
  gradeLevel: String,
  guardianContact: String,
  assignedClassId: String,
  createdAt: { type: String, default: () => new Date().toISOString() },
};

export class User {
  constructor(data) {
    this.id = data.id || `u-${data.role || 'user'}-${Date.now()}`;
    this.username = data.username;
    this.passwordHash = data.passwordHash;
    this.fullName = data.fullName;
    this.email = data.email;
    this.role = data.role;
    this.databaseName = data.databaseName;
    this.phone = data.phone || '';
    this.specialization = data.specialization || '';
    this.qualification = data.qualification || '';
    this.assignedClassIds = data.assignedClassIds || [];
    this.rollNumber = data.rollNumber || '';
    this.gradeLevel = data.gradeLevel || '';
    this.guardianContact = data.guardianContact || '';
    this.assignedClassId = data.assignedClassId || '';
    this.createdAt = data.createdAt || new Date().toISOString();
  }
}

export default User;
