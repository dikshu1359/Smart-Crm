/**
 * Class Model
 * Academic class cohort structure with teacher assignment and student allotments.
 */
export const ClassSchema = {
  id: String,
  name: { type: String, required: true },
  gradeLevel: { type: String, required: true },
  section: { type: String, required: true },
  roomNumber: { type: String, required: true },
  capacity: { type: Number, default: 30 },
  primaryTeacherId: { type: String, required: true },
  studentIds: [String],
  subjects: [String],
  createdAt: { type: String, default: () => new Date().toISOString() },
};

export class SchoolClass {
  constructor(data) {
    this.id = data.id || `cls-${Date.now()}`;
    this.name = data.name;
    this.gradeLevel = data.gradeLevel;
    this.section = data.section;
    this.roomNumber = data.roomNumber;
    this.capacity = Number(data.capacity) || 30;
    this.primaryTeacherId = data.primaryTeacherId;
    this.studentIds = data.studentIds || [];
    this.subjects = data.subjects || [];
    this.createdAt = data.createdAt || new Date().toISOString();
  }
}

export default SchoolClass;
