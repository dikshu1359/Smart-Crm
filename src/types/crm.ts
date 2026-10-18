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
  // Extended Student Profile Fields
  dateOfBirth?: string;
  gender?: string;
  residentialAddress?: string;
  religion?: string;
  casteCategory?: string;
  departmentBranch?: string;
  classDivision?: string;
  admissionId?: string;
  academicYear?: string;
  fatherName?: string;
  fatherContact?: string;
  fatherOccupation?: string;
  fatherAddress?: string;
  motherName?: string;
  motherContact?: string;
  motherOccupation?: string;
  motherAddress?: string;
  guardianInfo?: string;
  previousQualification?: string;
  previousInstitution?: string;
  previousExamDetails?: string;
  photoUrl?: string;
  signatureUrl?: string;
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
  issueDate?: string;
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
  id?: string;
  _id?: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  recipientId: string;
  recipientName: string;
  recipientRole: UserRole;
  text: string;
  content?: string;
  message?: string;
  attachments?: FileAttachment[];
  callData?: {
    type: 'audio' | 'video';
    duration: number;
    status: 'completed' | 'missed' | 'declined';
    timestamp: string;
  };
  read: boolean;
  createdAt: string;
  timestamp?: string;
}

export interface ChatContact {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  email: string;
  unreadCount: number;
  photoUrl?: string;
  specialization?: string;
  assignedClassId?: string;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

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
  day: DayOfWeek | string;
  timeSlot: TimeSlotInterval | string;
  classId: string;
  subject: string;
  teacherId?: string;
  roomNumber?: string;
  isBreak?: boolean;
  breakTitle?: string;
  startTime?: string;
  endTime?: string;
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

export type CalendarEventCategory = 'academic' | 'holiday' | 'special';

export interface CalendarEvent {
  id: string;
  _id?: string;
  title: string;
  category: CalendarEventCategory;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  targetScope: 'all' | 'class';
  targetClassIds: string[];
  authorName: string;
  authorRole: string;
  createdAt?: string;
}

export interface AttendanceRecordItem {
  studentId: string;
  studentName: string;
  rollNumber: string;
  status: 'present' | 'absent';
  remarks?: string;
}

export interface AttendanceSession {
  id: string;
  _id?: string;
  classId: string;
  className?: string;
  date: string;
  markedByTeacherId?: string;
  markedByTeacherName?: string;
  records: AttendanceRecordItem[];
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  createdAt?: string;
}

export interface StudentMarksRecord {
  id?: string;
  _id?: string;
  classId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  subject: string;
  assessmentTitle: string;
  assignmentMarks: number;
  internalMarks?: number;
  examMarks: number;
  otherMarks?: number;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  teacherFeedback?: string;
  isPublished: boolean;
  updatedByTeacherId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type DashboardTab =
  | 'overview'
  | 'users'
  | 'classes'
  | 'assignments'
  | 'quizzes'
  | 'marks'
  | 'roster'
  | 'attendance'
  | 'student-data'
  | 'schedule'
  | 'calendar'
  | 'analytics'
  | 'notices'
  | 'chat'
  | 'tenants'
  | 'audit'
  | 'profile';

