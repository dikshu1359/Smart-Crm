/**
 * Assignment Model & Submission Subdocuments
 * Supports multi-class assignment distribution, file attachments,
 * student submissions, accept/reject workflows, grading, and reassignment.
 */
export const SubmissionSchema = {
  studentId: { type: String, required: true },
  studentName: { type: String, required: true },
  rollNumber: String,
  classId: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'submitted', 'accepted', 'rejected', 'reassigned', 'graded'],
    default: 'pending',
  },
  submittedAt: String,
  studentNotes: String,
  attachments: [
    {
      id: String,
      name: String,
      size: String,
      mimeType: String,
      uploadedAt: String,
      contentPreview: String,
      dataUrl: String,
    },
  ],
  teacherReviewNotes: String,
  marksObtained: Number,
  gradedAt: String,
};

export const AssignmentSchema = {
  id: String,
  title: { type: String, required: true },
  subject: { type: String, required: true },
  description: String,
  teacherId: { type: String, required: true },
  teacherName: { type: String, required: true },
  targetClassIds: [String],
  issueDate: { type: String, default: () => new Date().toISOString() },
  dueDate: { type: String, required: true },
  maxMarks: { type: Number, default: 100 },
  createdAt: { type: String, default: () => new Date().toISOString() },
  attachments: [
    {
      id: String,
      name: String,
      size: String,
      mimeType: String,
      uploadedAt: String,
      contentPreview: String,
      dataUrl: String,
    },
  ],
  submissions: [SubmissionSchema],
};

export class Assignment {
  constructor(data) {
    this.id = data.id || `asgn-${Date.now()}`;
    this.title = data.title;
    this.subject = data.subject;
    this.description = data.description || '';
    this.teacherId = data.teacherId;
    this.teacherName = data.teacherName;
    this.targetClassIds = data.targetClassIds || [];
    this.dueDate = data.dueDate;
    this.maxMarks = Number(data.maxMarks) || 100;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.attachments = data.attachments || [];
    this.submissions = data.submissions || [];
  }
}

export default Assignment;
