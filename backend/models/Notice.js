/**
 * Notice Model
 * Role-targeted announcements and automatic assignment notifications.
 */
export const NoticeSchema = {
  id: String,
  title: { type: String, required: true },
  content: { type: String, required: true },
  category: {
    type: String,
    enum: ['Institutional', 'Assignment', 'Schedule', 'Examination'],
    default: 'Institutional',
  },
  targetRole: {
    type: String,
    enum: ['all', 'teacher', 'student'],
    default: 'all',
  },
  targetClassId: String,
  authorName: String,
  authorRole: {
    type: String,
    enum: ['admin', 'teacher', 'student'],
    default: 'admin',
  },
  createdAt: { type: String, default: () => new Date().toISOString() },
  readByUserIds: [String],
};

export class Notice {
  constructor(data) {
    this.id = data.id || `not-${Date.now()}`;
    this.title = data.title;
    this.content = data.content;
    this.category = data.category || 'Institutional';
    this.targetRole = data.targetRole || 'all';
    this.targetClassId = data.targetClassId;
    this.authorName = data.authorName;
    this.authorRole = data.authorRole || 'admin';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.readByUserIds = data.readByUserIds || [];
  }
}

export default Notice;
