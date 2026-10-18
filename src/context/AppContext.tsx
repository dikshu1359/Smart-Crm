import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  TenantUser,
  UserRole,
  DashboardTab,
  SchoolClass,
  Assignment,
  ScheduleSlot,
  NoticeItem,
  Quiz,
  QuizAttempt,
  ChatContact,
  AuditLogEntry,
  InstitutionRegistry,
  CalendarEvent,
  AttendanceSession,
  StudentMarksRecord,
} from '../types/crm';
import api from '../services/api';

export type AppView = 'landing' | 'role-selection' | 'auth-admin' | 'auth-teacher' | 'auth-student' | 'dashboard';

interface AppContextValue {
  isAuthenticated: boolean;
  currentUser: TenantUser | null;
  activeTenant: {
    databaseName: string;
    institutionName: string;
    institutionId?: string;
    campusCode?: string;
  } | null;
  currentView: AppView;
  selectedRole: UserRole | null;
  activeTab: DashboardTab;
  loading: boolean;
  error: string | null;

  // Active Tenant Collections
  institutions: InstitutionRegistry[];
  users: TenantUser[];
  classes: SchoolClass[];
  assignments: Assignment[];
  schedules: ScheduleSlot[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
  notices: NoticeItem[];
  chatContacts: ChatContact[];
  auditLogs: AuditLogEntry[];
  analytics: any;
  calendarEvents: CalendarEvent[];
  attendanceSessions: AttendanceSession[];
  attendanceSummary: any;
  marks: StudentMarksRecord[];

  // Actions
  setCurrentView: (view: AppView) => void;
  setSelectedRole: (role: UserRole | null) => void;
  setActiveTab: (tab: DashboardTab) => void;
  login: (
    username: string,
    password: string,
    databaseName?: string
  ) => Promise<{ ok: boolean; message: string; user?: any }>;
  registerInstitution: (payload: {
    institutionName: string;
    adminUsername: string;
    adminName: string;
    adminEmail: string;
    password: string;
    campusCode?: string;
  }) => Promise<{ ok: boolean; message: string; user?: any }>;
  logout: () => void;
  refreshData: () => Promise<void>;

  // Domain Actions
  createUser: (
    userPayload: any
  ) => Promise<{ ok: boolean; message?: string; initialPassword?: string; user?: any }>;
  updateUser: (userId: string, updates: any) => Promise<{ ok: boolean; message?: string }>;
  deleteUser: (userId: string) => Promise<{ ok: boolean; message?: string }>;
  createClass: (classPayload: any) => Promise<{ ok: boolean; message?: string }>;
  allotStudent: (classId: string, studentId: string) => Promise<{ ok: boolean; message?: string }>;
  deleteClass: (classId: string) => Promise<{ ok: boolean; message?: string }>;
  createAssignment: (payload: any) => Promise<{ ok: boolean; message?: string; assignment?: any }>;
  updateAssignment: (assignmentId: string, payload: any) => Promise<{ ok: boolean; message?: string; assignment?: any }>;
  submitAssignment: (assignmentId: string, payload: any) => Promise<{ ok: boolean; message?: string }>;
  reviewSubmission: (
    assignmentId: string,
    studentId: string,
    action: 'accept' | 'reject' | 'reassign' | 'grade',
    marksObtained?: number,
    feedback?: string
  ) => Promise<{ ok: boolean; message?: string }>;
  deleteAssignment: (assignmentId: string) => Promise<{ ok: boolean; message?: string }>;
  createQuiz: (payload: any) => Promise<{ ok: boolean; message?: string }>;
  submitQuiz: (quizId: string, answers: any[]) => Promise<{ ok: boolean; message?: string }>;
  togglePublishQuiz: (quizId: string, isPublished: boolean) => Promise<{ ok: boolean; message?: string }>;
  addScheduleSlot: (slotPayload: any) => Promise<{ ok: boolean; message?: string }>;
  updateScheduleSlot: (slotId: string, slotPayload: any) => Promise<{ ok: boolean; message?: string }>;
  deleteScheduleSlot: (slotId: string) => Promise<{ ok: boolean; message?: string }>;
  createCalendarEvent: (payload: any) => Promise<{ ok: boolean; message?: string; overlapWarning?: string | null }>;
  updateCalendarEvent: (eventId: string, payload: any) => Promise<{ ok: boolean; message?: string }>;
  deleteCalendarEvent: (eventId: string) => Promise<{ ok: boolean; message?: string }>;
  markAttendance: (payload: { classId: string; date: string; records: any[] }) => Promise<{ ok: boolean; message?: string }>;
  createNotice: (payload: any) => Promise<{ ok: boolean; message?: string }>;
  markNoticeRead: (noticeId: string) => Promise<{ ok: boolean; message?: string }>;
  deleteNotice: (noticeId: string) => Promise<{ ok: boolean; message?: string }>;
  sendChatMessage: (recipientId: string, text: string, attachments?: any[]) => Promise<{ ok: boolean; message?: string }>;
  deleteTenant: (databaseName: string) => Promise<{ ok: boolean; message?: string }>;
  fetchMarks: (filter?: { classId?: string; subject?: string; assessmentTitle?: string }) => Promise<StudentMarksRecord[]>;
  saveMarksBatch: (payload: any) => Promise<{ ok: boolean; message?: string; count?: number }>;
  importClassRoster: (classId: string, students: any[]) => Promise<{ ok: boolean; message?: string; importedCount?: number; createdCount?: number; updatedCount?: number }>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null);
  const [activeTenant, setActiveTenant] = useState<{
    databaseName: string;
    institutionName: string;
    institutionId?: string;
    campusCode?: string;
  } | null>(null);

  const [currentView, setViewInternal] = useState<AppView>('landing');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Collections
  const [institutions, setInstitutions] = useState<InstitutionRegistry[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [schedules, setSchedules] = useState<ScheduleSlot[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [chatContacts, setChatContacts] = useState<ChatContact[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<any>(null);
  const [marks, setMarks] = useState<StudentMarksRecord[]>([]);

  const setCurrentView = (view: AppView) => {
    // Protected routes check: Cannot open dashboard if unauthenticated
    if (view === 'dashboard' && !isAuthenticated) {
      setViewInternal('role-selection');
      return;
    }
    setViewInternal(view);
  };

  // Fetch all registered institutions (public / multi-tenant directory)
  const fetchInstitutions = useCallback(async () => {
    try {
      const data = await api.getTenants();
      if (data?.institutions) {
        setInstitutions(data.institutions);
      }
    } catch {
      // silent
    }
  }, []);

  // Fetch all tenant data for authenticated user
  const refreshData = useCallback(async () => {
    if (!activeTenant?.databaseName) return;
    const dbName = activeTenant.databaseName;

    try {
      const [
        usersRes,
        classesRes,
        assignmentsRes,
        scheduleRes,
        quizzesRes,
        noticesRes,
        contactsRes,
        auditRes,
        analyticsRes,
        calendarRes,
        attendanceSumRes,
        attendanceLogsRes,
        marksRes,
      ] = await Promise.all([
        api.getUsers(dbName),
        api.getClasses(dbName),
        api.getAssignments(dbName),
        api.getSchedule(dbName),
        api.getQuizzes(dbName),
        api.getNotices(dbName),
        api.getChatContacts(dbName),
        api.getAuditLogs(dbName, 'tenant'),
        api.getAnalytics(dbName),
        api.getCalendarEvents(dbName),
        api.getAttendanceSummary(dbName),
        api.getAttendance(dbName),
        api.getMarks(dbName).catch(() => null),
      ]);

      if (usersRes?.users) {
        setUsers(usersRes.users.map((u: any) => ({ ...u, id: u.id || u._id?.toString() || u.username })));
      }
      if (classesRes?.classes) {
        setClasses(classesRes.classes.map((c: any) => ({ ...c, id: c.id || c._id?.toString(), studentIds: c.studentIds || [] })));
      }
      if (assignmentsRes?.assignments) {
        setAssignments(assignmentsRes.assignments.map((a: any) => ({ ...a, id: a.id || a._id?.toString() })));
      }
      if (scheduleRes?.schedules) {
        setSchedules(scheduleRes.schedules.map((s: any) => ({ ...s, id: s.id || s._id?.toString() })));
      }
      if (quizzesRes?.quizzes) {
        setQuizzes(quizzesRes.quizzes.map((q: any) => ({ ...q, id: q.id || q._id?.toString() })));
      }
      if (quizzesRes?.attempts) {
        setQuizAttempts(quizzesRes.attempts.map((a: any) => ({ ...a, id: a.id || a._id?.toString() })));
      }
      if (noticesRes?.notices) {
        setNotices(noticesRes.notices.map((n: any) => ({ ...n, id: n.id || n._id?.toString() })));
      }
      if (contactsRes?.contacts) {
        setChatContacts(contactsRes.contacts.map((c: any) => ({ ...c, id: c.id || c._id?.toString() })));
      }
      if (auditRes?.logs) {
        setAuditLogs(auditRes.logs.map((l: any) => ({ ...l, id: l.id || l._id?.toString() })));
      }
      if (analyticsRes) setAnalytics(analyticsRes);
      if (calendarRes?.events) {
        setCalendarEvents(calendarRes.events.map((e: any) => ({ ...e, id: e.id || e._id?.toString() })));
      }
      if (attendanceSumRes) {
        setAttendanceSummary(attendanceSumRes);
      }
      if (attendanceLogsRes?.attendance) {
        setAttendanceSessions(attendanceLogsRes.attendance.map((s: any) => ({ ...s, id: s.id || s._id?.toString() })));
      }
      if (marksRes?.marks) {
        setMarks(marksRes.marks.map((m: any) => ({ ...m, id: m.id || m._id?.toString() })));
      }
    } catch (err: any) {
      console.error('[AppContext] Failed to refresh tenant data:', err.message);
    }
  }, [activeTenant]);

  // Initial session restoration check
  useEffect(() => {
    const checkSession = async () => {
      setLoading(true);
      await fetchInstitutions();

      try {
        const session = await api.getCurrentUser();
        if (session?.user && session?.tenant) {
          const userWithId = {
            ...session.user,
            id: session.user.id || session.user._id?.toString(),
          };
          setCurrentUser(userWithId);
          setActiveTenant(session.tenant);
          setSelectedRole(session.user.role);
          setIsAuthenticated(true);
          setViewInternal('dashboard');
        } else {
          setIsAuthenticated(false);
          setViewInternal('landing');
        }
      } catch {
        setIsAuthenticated(false);
        setViewInternal('landing');
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [fetchInstitutions]);

  // Refresh data whenever activeTenant changes
  useEffect(() => {
    if (isAuthenticated && activeTenant) {
      refreshData();
    }
  }, [isAuthenticated, activeTenant, refreshData]);

  // Login handler
  const login = async (username: string, password: string, databaseName?: string) => {
    setError(null);
    try {
      const res = await api.login(username, password, databaseName);
      if (!res.success) {
        return { ok: false, message: res.message || 'Authentication failed.' };
      }

      const userWithId = {
        ...res.user,
        id: res.user.id || res.user._id?.toString(),
      };
      setCurrentUser(userWithId);
      setActiveTenant(res.tenant);
      setSelectedRole(res.user.role);
      setIsAuthenticated(true);
      setActiveTab('overview');
      setViewInternal('dashboard');
      await fetchInstitutions();
      return { ok: true, message: 'Logged in successfully.', user: userWithId };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Login error occurred.' };
    }
  };

  // Register Institution handler
  const registerInstitution = async (payload: {
    institutionName: string;
    adminUsername: string;
    adminName: string;
    adminEmail: string;
    password: string;
    campusCode?: string;
  }) => {
    setError(null);
    try {
      const res = await api.registerInstitution(payload);
      if (!res.success) {
        return { ok: false, message: res.message || 'Registration failed.' };
      }

      const userWithId = {
        ...res.user,
        id: res.user.id || res.user._id?.toString(),
      };
      setCurrentUser(userWithId);
      setActiveTenant(res.tenant);
      setSelectedRole('admin');
      setIsAuthenticated(true);
      setActiveTab('overview');
      setViewInternal('dashboard');
      await fetchInstitutions();
      return { ok: true, message: res.message, user: userWithId };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Registration error.' };
    }
  };

  // Logout handler
  const logout = () => {
    api.logout();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTenant(null);
    setSelectedRole(null);
    setActiveTab('overview');
    setViewInternal('landing');
  };

  // Domain Actions
  const createUser = async (userPayload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.createUser(activeTenant.databaseName, userPayload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to create user.' };
      await refreshData();
      return { ok: true, message: `Account created for ${res.user.fullName}. Initial password: ${res.initialPassword}` };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const updateUser = async (userId: string, updates: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.updateUser(activeTenant.databaseName, userId, updates);
      if (!res.success) return { ok: false, message: res.message || 'Update failed.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const deleteUser = async (userId: string) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.deleteUser(activeTenant.databaseName, userId);
      if (!res.success) return { ok: false, message: res.message || 'Delete failed.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const createClass = async (classPayload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.createClass(activeTenant.databaseName, classPayload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to create class.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const allotStudent = async (classId: string, studentId: string) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.allotStudent(activeTenant.databaseName, classId, studentId);
      if (!res.success) return { ok: false, message: res.message || 'Failed to allot student.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const deleteClass = async (classId: string) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.deleteClass(activeTenant.databaseName, classId);
      if (!res.success) return { ok: false, message: res.message || 'Failed to delete class.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const createAssignment = async (payload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.createAssignment(activeTenant.databaseName, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to create assignment.' };
      await refreshData();
      return { ok: true, assignment: res.assignment };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const submitAssignment = async (assignmentId: string, payload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.submitAssignment(activeTenant.databaseName, assignmentId, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to submit.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const reviewSubmission = async (
    assignmentId: string,
    studentId: string,
    action: 'accept' | 'reject' | 'reassign' | 'grade',
    marksObtained?: number,
    feedback?: string
  ) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.reviewSubmission(activeTenant.databaseName, assignmentId, studentId, action, marksObtained, feedback);
      if (!res.success) return { ok: false, message: res.message || 'Failed to review submission.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const updateAssignment = async (assignmentId: string, payload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.updateAssignment(activeTenant.databaseName, assignmentId, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to update assignment.' };
      await refreshData();
      return { ok: true, assignment: res.assignment };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const deleteAssignment = async (assignmentId: string) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.deleteAssignment(activeTenant.databaseName, assignmentId);
      if (!res.success) return { ok: false, message: res.message || 'Failed to delete assignment.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const createQuiz = async (payload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.createQuiz(activeTenant.databaseName, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to create quiz.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const submitQuiz = async (quizId: string, answers: any[]) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.submitQuiz(activeTenant.databaseName, quizId, answers);
      if (!res.success) return { ok: false, message: res.message || 'Failed to submit quiz.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const togglePublishQuiz = async (quizId: string, isPublished: boolean) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.togglePublishQuiz(activeTenant.databaseName, quizId, isPublished);
      if (!res.success) return { ok: false, message: res.message || 'Failed to update quiz.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const addScheduleSlot = async (slotPayload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.addScheduleSlot(activeTenant.databaseName, slotPayload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to schedule slot.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const updateScheduleSlot = async (slotId: string, slotPayload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.updateScheduleSlot(activeTenant.databaseName, slotId, slotPayload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to update schedule slot.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const deleteScheduleSlot = async (slotId: string) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.deleteScheduleSlot(activeTenant.databaseName, slotId);
      if (!res.success) return { ok: false, message: res.message || 'Failed to delete slot.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const createNotice = async (payload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.createNotice(activeTenant.databaseName, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to create notice.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const markNoticeRead = async (noticeId: string) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      await api.markNoticeRead(activeTenant.databaseName, noticeId);
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const deleteNotice = async (noticeId: string) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.deleteNotice(activeTenant.databaseName, noticeId);
      if (!res.success) return { ok: false, message: res.message || 'Failed to delete notice.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const sendChatMessage = async (recipientId: string, text: string, attachments?: any[]) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.sendChatMessage(activeTenant.databaseName, recipientId, text, attachments);
      if (!res.success) return { ok: false, message: res.message || 'Failed to send message.' };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const createCalendarEvent = async (payload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.createCalendarEvent(activeTenant.databaseName, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to create calendar event.' };
      await refreshData();
      return { ok: true, overlapWarning: res.overlapWarning };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const updateCalendarEvent = async (eventId: string, payload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.updateCalendarEvent(activeTenant.databaseName, eventId, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to update calendar event.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const deleteCalendarEvent = async (eventId: string) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.deleteCalendarEvent(activeTenant.databaseName, eventId);
      if (!res.success) return { ok: false, message: res.message || 'Failed to delete calendar event.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const markAttendance = async (payload: { classId: string; date: string; records: any[] }) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.markAttendance(activeTenant.databaseName, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to record attendance.' };
      await refreshData();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const deleteTenant = async (databaseName: string) => {
    try {
      const res = await api.deleteTenant(databaseName);
      if (!res.success) return { ok: false, message: res.message || 'Failed to delete institution.' };
      logout();
      await fetchInstitutions();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const fetchMarks = async (filter?: { classId?: string; subject?: string; assessmentTitle?: string }) => {
    if (!activeTenant) return [];
    try {
      const res = await api.getMarks(activeTenant.databaseName, filter);
      if (res.success && res.marks) {
        setMarks(res.marks.map((m: any) => ({ ...m, id: m.id || m._id?.toString() })));
        return res.marks;
      }
      return [];
    } catch {
      return [];
    }
  };

  const saveMarksBatch = async (payload: any) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.saveMarksBatch(activeTenant.databaseName, payload);
      if (!res.success) return { ok: false, message: res.message || 'Failed to save marks.' };
      await refreshData();
      return { ok: true, count: res.count };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  const importClassRoster = async (classId: string, students: any[]) => {
    if (!activeTenant) return { ok: false, message: 'No active institution.' };
    try {
      const res = await api.importClassRoster(activeTenant.databaseName, classId, students);
      if (!res.success) return { ok: false, message: res.message || 'Failed to import roster.' };
      await refreshData();
      return {
        ok: true,
        message: res.message,
        importedCount: res.importedCount,
        createdCount: res.createdCount,
        updatedCount: res.updatedCount,
      };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  };

  return (
    <AppContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        activeTenant,
        currentView,
        selectedRole,
        activeTab,
        loading,
        error,
        institutions,
        users,
        classes,
        assignments,
        schedules,
        quizzes,
        quizAttempts,
        notices,
        chatContacts,
        auditLogs,
        analytics,
        calendarEvents,
        attendanceSessions,
        attendanceSummary,
        marks,
        setCurrentView,
        setSelectedRole,
        setActiveTab,
        login,
        registerInstitution,
        logout,
        refreshData,
        createUser,
        updateUser,
        deleteUser,
        createClass,
        allotStudent,
        deleteClass,
        createAssignment,
        updateAssignment,
        submitAssignment,
        reviewSubmission,
        deleteAssignment,
        createQuiz,
        submitQuiz,
        togglePublishQuiz,
        addScheduleSlot,
        updateScheduleSlot,
        deleteScheduleSlot,
        createCalendarEvent,
        updateCalendarEvent,
        deleteCalendarEvent,
        markAttendance,
        createNotice,
        markNoticeRead,
        deleteNotice,
        sendChatMessage,
        deleteTenant,
        fetchMarks,
        saveMarksBatch,
        importClassRoster,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
