export type UserRole = 'admin' | 'teacher' | 'student';

export interface FileAttachment {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  uploadedAt: string;
  contentPreview: string;
  dataUrl?: string;
}

export interface InstitutionRegistry {
  id: string;
  institutionName: string;
  adminUsername: string;
  adminName: string;
  adminEmail: string;
  databaseName: string; // e.g. smart_crm_[slug]_[timestamp]
  createdAt: string;
  status: 'active' | 'suspended';
  campusCode: string;
  userCount?: number;
  classCount?: number;
  assignmentCount?: number;
}

export interface AuditLogEntry {
  _id?: string;
  id?: string;
  timestamp: string;
  databaseName: string;
  institutionName?: string;
  actorName: string;
  actorRole: string;
  actionCategory: string;
  description: string;
  ipAddress: string;
  userAgent: string;
}

export interface TenantUser {
  id: string;
  _id?: string;
  username: string;
  passwordHash?: string;
  fullName: string;
  email: string;
  role: UserRole;
  databaseName: string;
  createdAt: string;
  phone?: string;
  specialization?: string;
  qualification?: string;
  assignedClassIds?: string[];
  rollNumber?: string;
  gradeLevel?: string;
  guardianContact?: string;
  assignedClassId?: string;
  mustChangePassword?: boolean;
}

export interface SchoolClass {
  id: string;
  _id?: string;
  name: string;
  gradeLevel: string;
  section: string;
  roomNumber: string;
  capacity: number;
  primaryTeacherId: string;
  studentIds: string[];
  subjects: string[];
  studentCount?: number;
  createdAt: string;
}

export type SubmissionStatus =
  | 'pending'
  | 'submitted'
  | 'under_review'
  | 'accepted'
  | 'rejected'
  | 'reassigned'
  | 'graded';

export interface StudentSubmission {
  id?: string;
  _id?: string;
  assignmentId?: string;
  studentId: string;
  studentName: string;
  rollNumber?: string;
  classId: string;
  status: SubmissionStatus;
  submittedAt?: string;
  studentNotes?: string;
  attachments: FileAttachment[];
  teacherReviewNotes?: string;
  marksObtained?: number;
  gradedAt?: string;
}

export interface Assignment {
  id: string;
  _id?: string;
  title: string;
  subject: string;
  description: string;
  teacherId: string;
  teacherName: string;
  targetClassIds: string[];
  dueDate: string;
  maxMarks: number;
  createdAt: string;
  attachments: FileAttachment[];
  submissions?: StudentSubmission[];
  submissionCount?: number;
}

export interface QuizQuestion {
  _id?: string;
  id?: string;
  questionText: string;
  options: string[];
  correctOptionIndex?: number;
  marks: number;
}

export interface Quiz {
  _id: string;
  id?: string;
  title: string;
  subject: string;
  description: string;
  targetClassIds: string[];
  teacherId: string;
  teacherName: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  questions: QuizQuestion[];
  isPublished: boolean;
  createdAt: string;
}

export interface QuizAttempt {
  _id?: string;
  quizId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  classId: string;
  answers: {
    questionIndex: number;
    selectedOptionIndex: number;
  }[];
  score: number;
  totalMarks: number;
  passed: boolean;
  submittedAt: string;
}

export interface ChatMessage {
  _id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  text: string;
  read: boolean;
  createdAt: string;
}

export interface ChatContact {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  email: string;
  unreadCount: number;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';

export type TimeSlotInterval =
  | '09:00 - 10:00'
  | '10:00 - 11:00'
  | '11:00 - 12:00'
  | '12:00 - 12:30' // Reserved for Lunch Break
  | '12:30 - 13:30'
  | '13:30 - 14:30';

export interface ScheduleSlot {
  id?: string;
  _id?: string;
  day: DayOfWeek;
  timeSlot: TimeSlotInterval;
  classId: string;
  subject: string;
  teacherId: string;
  roomNumber: string;
}

export interface NoticeItem {
  id?: string;
  _id?: string;
  title: string;
  content: string;
  category: 'Institutional' | 'Assignment' | 'Schedule' | 'Examination';
  targetRole: 'all' | 'teacher' | 'student';
  targetClassId?: string;
  authorName: string;
  authorRole: string;
  createdAt: string;
  readByUserIds: string[];
}

export type DashboardTab =
  | 'overview'
  | 'users'
  | 'classes'
  | 'assignments'
  | 'quizzes'
  | 'schedule'
  | 'analytics'
  | 'notices'
  | 'chat'
  | 'tenants'
  | 'audit'
  | 'profile';
