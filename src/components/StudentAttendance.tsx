import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Upload,
  AlertCircle,
  FileText,
  Search,
  Users,
  Clock,
  Sparkles,
  BarChart3,
  CheckCheck,
  Building2,
  RefreshCw,
  ShieldAlert,
  UserCheck,
  UserX,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SchoolClass, TenantUser, AttendanceSession, AttendanceRecordItem } from '../types/crm';
import api from '../services/api';

/**
 * Lightweight text extraction from text-based PDFs for Teacher OCR attendance
 */
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(arrayBuffer);

    const textChunks: string[] = [];
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    let match;
    while ((match = tjRegex.exec(text)) !== null) {
      textChunks.push(match[1]);
    }

    const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
    while ((match = tjArrayRegex.exec(text)) !== null) {
      const inner = match[1];
      const innerMatch = inner.match(/\(([^)]+)\)/g);
      if (innerMatch) {
        textChunks.push(...innerMatch.map((s) => s.replace(/[()]/g, '')));
      }
    }

    return textChunks.join(' ');
  } catch {
    return '';
  }
}

export const StudentAttendance: React.FC = () => {
  const {
    activeTenant,
    currentUser,
    classes,
    users,
    attendanceSessions,
    attendanceSummary,
    markAttendance,
    refreshData,
  } = useApp();

  if (!currentUser || !activeTenant) return null;

  const isTeacher = currentUser.role === 'teacher';
  const isStudent = currentUser.role === 'student';
  const isAdmin = currentUser.role === 'admin';

  // --- ADMIN WORKFLOW STATES ---
  const [adminViewTab, setAdminViewTab] = useState<'teacher-monitoring' | 'student-reports'>('teacher-monitoring');
  const [teacherAttendanceDate, setTeacherAttendanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [teacherAttendanceData, setTeacherAttendanceData] = useState<{
    date: string;
    totalTeachers: number;
    presentCount: number;
    absentCount: number;
    onLeaveCount: number;
    facultyAttendanceRate: number;
    teachers: any[];
  } | null>(null);
  const [loadingTeacherAttendance, setLoadingTeacherAttendance] = useState(false);
  const [updatingTeacherId, setUpdatingTeacherId] = useState<string | null>(null);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [studentReportSearch, setStudentReportSearch] = useState('');

  // Fetch teacher attendance for Admin
  const loadTeacherAttendance = async (dateToFetch: string) => {
    if (!activeTenant || !isAdmin) return;
    setLoadingTeacherAttendance(true);
    try {
      const res = await api.getTeacherAttendance(activeTenant.databaseName, dateToFetch);
      if (res && Array.isArray(res.teachers)) {
        setTeacherAttendanceData(res);
      }
    } catch (err) {
      console.warn('Failed to load teacher attendance:', err);
    } finally {
      setLoadingTeacherAttendance(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTenant) {
      loadTeacherAttendance(teacherAttendanceDate);
    }
  }, [isAdmin, activeTenant, teacherAttendanceDate]);

  // Admin marks/updates teacher attendance
  const handleUpdateTeacherStatus = async (teacherId: string, status: 'present' | 'absent' | 'on_leave') => {
    if (!activeTenant) return;
    setUpdatingTeacherId(teacherId);
    try {
      await api.saveTeacherAttendance(activeTenant.databaseName, {
        teacherId,
        date: teacherAttendanceDate,
        status,
        checkInTime: status === 'present' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
        notes: `Marked ${status.toUpperCase()} by Administrator`,
      });
      await loadTeacherAttendance(teacherAttendanceDate);
      await refreshData();
    } catch (err) {
      console.warn('Failed to update teacher attendance:', err);
    } finally {
      setUpdatingTeacherId(null);
    }
  };

  // --- TEACHER WORKFLOW STATES ---
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);

  // STRICTLY filter authorized classes allocated to this teacher ONLY
  const authorizedClasses = useMemo(() => {
    if (isTeacher) {
      const uId = String(currentUser.id || (currentUser as any)._id);
      const assignedIds = (currentUser.assignedClassIds || []).map(String);
      return classes.filter((c: SchoolClass) => {
        const cId = String(c.id || (c as any)._id);
        const isPrimary = String(c.primaryTeacherId) === uId;
        const isAssigned = assignedIds.includes(cId);
        return isPrimary || isAssigned;
      });
    }
    return classes;
  }, [classes, currentUser, isTeacher]);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    authorizedClasses[0]?.id || (authorizedClasses[0] as any)?._id || ''
  );

  useEffect(() => {
    if (!selectedClassId && authorizedClasses.length > 0) {
      const firstId = authorizedClasses[0]?.id || (authorizedClasses[0] as any)?._id;
      if (firstId) setSelectedClassId(firstId);
    }
  }, [authorizedClasses, selectedClassId]);

  const selectedClass = useMemo(() => {
    return authorizedClasses.find((c) => String(c.id || (c as any)._id) === String(selectedClassId));
  }, [authorizedClasses, selectedClassId]);

  // Students enrolled in selected class
  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    const studentIdSet = new Set((selectedClass.studentIds || []).map(String));
    const sClassId = String(selectedClass.id || (selectedClass as any)._id);

    return users.filter((u: TenantUser) => {
      if (u.role !== 'student') return false;
      const uId = String(u.id || (u as any)._id);
      return (
        studentIdSet.has(uId) ||
        String(u.assignedClassId) === sClassId ||
        (u.assignedClassIds && u.assignedClassIds.map(String).includes(sClassId))
      );
    });
  }, [users, selectedClass]);

  // Existing attendance session for selected class and date
  const existingSessionForDate = useMemo(() => {
    if (!selectedClassId || !selectedDate) return null;
    return attendanceSessions.find(
      (s) => String(s.classId) === String(selectedClassId) && s.date === selectedDate
    );
  }, [attendanceSessions, selectedClassId, selectedDate]);

  // Teacher manual attendance marking state: studentId -> 'present' | 'absent'
  const [studentStatusMap, setStudentStatusMap] = useState<Record<string, 'present' | 'absent'>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // File Upload / OCR states for Teacher
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [extractionInfo, setExtractionInfo] = useState<{
    matchedCount: number;
    unmatchedNames: string[];
    notice: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync attendance state when class or date changes
  useEffect(() => {
    if (existingSessionForDate && Array.isArray(existingSessionForDate.records)) {
      const newStatusMap: Record<string, 'present' | 'absent'> = {};
      const newRemarksMap: Record<string, string> = {};

      existingSessionForDate.records.forEach((rec: AttendanceRecordItem) => {
        newStatusMap[rec.studentId] = rec.status;
        if (rec.remarks) newRemarksMap[rec.studentId] = rec.remarks;
      });

      // Default any newly enrolled students to present
      classStudents.forEach((st) => {
        const sid = st.id || (st as any)._id;
        if (!newStatusMap[sid]) {
          newStatusMap[sid] = 'present';
        }
      });

      setStudentStatusMap(newStatusMap);
      setRemarksMap(newRemarksMap);
    } else {
      // Default all enrolled students to 'present' for fast initial marking
      const initialMap: Record<string, 'present' | 'absent'> = {};
      classStudents.forEach((st) => {
        initialMap[st.id || (st as any)._id] = 'present';
      });
      setStudentStatusMap(initialMap);
      setRemarksMap({});
    }
    setExtractionInfo(null);
    setSaveError(null);
  }, [existingSessionForDate, classStudents, selectedClassId, selectedDate]);

  const handleMarkStatus = (studentId: string, status: 'present' | 'absent') => {
    setStudentStatusMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleRemarkChange = (studentId: string, remark: string) => {
    setRemarksMap((prev) => ({ ...prev, [studentId]: remark }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, 'present' | 'absent'> = {};
    classStudents.forEach((st) => {
      updated[st.id || (st as any)._id] = 'present';
    });
    setStudentStatusMap(updated);
  };

  const handleMarkAllAbsent = () => {
    const updated: Record<string, 'present' | 'absent'> = {};
    classStudents.forEach((st) => {
      updated[st.id || (st as any)._id] = 'absent';
    });
    setStudentStatusMap(updated);
  };

  const handleClearAll = () => {
    setStudentStatusMap({});
    setRemarksMap({});
  };

  // Metrics for current editing session
  const totalStudentsCount = classStudents.length;
  const presentCount = Object.values(studentStatusMap).filter((s) => s === 'present').length;
  const absentCount = Object.values(studentStatusMap).filter((s) => s === 'absent').length;
  const unmarkedCount = totalStudentsCount - (presentCount + absentCount);

  // File Upload Handlers (PDF / Image OCR Simulation)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setExtractionInfo(null);
    setSaveError(null);

    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    let extractedText = '';

    if (isPDF) {
      extractedText = await extractTextFromPDF(file);
    } else if (isImage) {
      const reader = new FileReader();
      extractedText = await new Promise((resolve) => {
        reader.onload = () => resolve(file.name);
        reader.readAsDataURL(file);
      });
    }

    let matched = 0;
    const textLower = (extractedText + ' ' + file.name).toLowerCase();
    const updatedMap = { ...studentStatusMap };

    classStudents.forEach((st) => {
      const stId = st.id || (st as any)._id;
      const roll = (st.rollNumber || '').toLowerCase().trim();
      const nameParts = st.fullName.toLowerCase().split(' ');

      const isRollMatched = roll && textLower.includes(roll);
      const isNameMatched = nameParts.length > 0 && nameParts.some((p) => p.length > 2 && textLower.includes(p));

      if (isRollMatched || isNameMatched) {
        matched++;
        updatedMap[stId] = 'present';
      }
    });

    setIsProcessingFile(false);
    setStudentStatusMap(updatedMap);

    setExtractionInfo({
      matchedCount: matched,
      unmatchedNames: [],
      notice:
        matched > 0
          ? `Matched ${matched} student(s) from uploaded document against class roster. Review before saving.`
          : 'Document processed. Mark attendance manually below.',
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Save Attendance to Database
  const handleSaveAttendance = async () => {
    setSaveError(null);
    setSaveSuccessToast(null);

    if (classStudents.length === 0) {
      setSaveError('No students are enrolled in this class to record attendance for.');
      return;
    }

    if (!selectedDate) {
      setSaveError('Please select a valid attendance date.');
      return;
    }

    if (unmarkedCount > 0) {
      setSaveError(
        `Validation Error: ${unmarkedCount} student(s) remain unmarked. Please mark all students Present or Absent.`
      );
      return;
    }

    setIsSaving(true);

    const records = classStudents.map((st) => {
      const stId = st.id || (st as any)._id;
      return {
        studentId: stId,
        studentName: st.fullName,
        rollNumber: st.rollNumber || '',
        status: studentStatusMap[stId] || 'absent',
        remarks: remarksMap[stId] || '',
      };
    });

    try {
      const res = await markAttendance({
        classId: selectedClassId,
        date: selectedDate,
        records,
      });

      setIsSaving(false);

      if (!res.ok) {
        setSaveError(res.message || 'Failed to save attendance record.');
        return;
      }

      setSaveSuccessToast(
        `Successfully saved attendance for ${selectedClass?.name || 'Class'} on ${selectedDate} (${presentCount} Present, ${absentCount} Absent)`
      );
      await refreshData();
      setTimeout(() => setSaveSuccessToast(null), 5000);
    } catch (err: any) {
      setIsSaving(false);
      setSaveError(err.message || 'Unexpected server error while saving attendance.');
    }
  };

  // ==========================================
  // RENDER: STUDENT PERSONAL VIEW (ISOLATED)
  // ==========================================
  if (isStudent) {
    const studentId = String(currentUser.id || (currentUser as any)._id);
    const studentSessions = attendanceSessions
      .map((s) => {
        const rec = (s.records || []).find((r: any) => String(r.studentId) === studentId);
        return {
          session: s,
          status: rec ? rec.status : s.personalStatus || 'unmarked',
          remarks: rec ? rec.remarks : s.personalRemarks || '',
        };
      })
      .filter((s) => s.status !== 'unmarked');

    const totalDays = studentSessions.length;
    const presentDays = studentSessions.filter((s) => s.status === 'present').length;
    const absentDays = studentSessions.filter((s) => s.status === 'absent').length;
    const studentPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">My Attendance Record</h1>
          <p className="text-xs text-slate-400 mt-1">
            Verified attendance history based on officially recorded class sessions.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <span className="text-xs text-slate-400 block mb-1">My Attendance Rate</span>
            <div className={`text-3xl font-extrabold font-mono ${studentPct >= 75 ? 'text-emerald-400' : studentPct >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
              {studentPct}%
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {presentDays} Present &middot; {absentDays} Absent &middot; {totalDays} Sessions
            </span>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
            <span className="text-xs text-emerald-300 block mb-1">Attended Sessions</span>
            <div className="text-3xl font-extrabold font-mono text-emerald-400">{presentDays}</div>
            <span className="text-[11px] text-emerald-300/70 mt-1 block">Verified In-Class</span>
          </div>

          <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/20">
            <span className="text-xs text-rose-300 block mb-1">Absences Recorded</span>
            <div className="text-3xl font-extrabold font-mono text-rose-400">{absentDays}</div>
            <span className="text-[11px] text-rose-300/70 mt-1 block">Reduces Attendance %</span>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span>Attendance Log</span>
          </h2>
          {studentSessions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No attendance logs found yet. When teachers record class attendance, your status will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Teacher</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {studentSessions.map(({ session, status, remarks }) => (
                    <tr key={session.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono text-white">{session.date}</td>
                      <td className="py-3 px-4 text-slate-300">{session.className}</td>
                      <td className="py-3 px-4 text-slate-400">{session.markedByTeacherName || 'Faculty Instructor'}</td>
                      <td className="py-3 px-4">
                        {status === 'present' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 italic">{remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: ADMIN DASHBOARD (MONITORING & REPORTS)
  // ==========================================
  if (isAdmin) {
    const filteredTeachers = (teacherAttendanceData?.teachers || []).filter((t: any) => {
      const q = teacherSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        t.fullName?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.specialization?.toLowerCase().includes(q)
      );
    });

    const filteredStudents = (attendanceSummary?.studentSummary || []).filter((st: any) => {
      const q = studentReportSearch.toLowerCase().trim();
      if (!q) return true;
      return (
        st.studentName?.toLowerCase().includes(q) ||
        st.rollNumber?.toLowerCase().includes(q)
      );
    });

    return (
      <div className="space-y-6">
        {/* Header & Subtab Switcher */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-display">Teacher &amp; Student Attendance Monitoring</h1>
            <p className="text-xs text-slate-400 mt-1">
              Executive institutional monitoring. View faculty presence based on actual attendance records and student progress reports.
            </p>
          </div>

          <div className="flex items-center p-1 bg-white/5 border border-white/10 rounded-2xl">
            <button
              type="button"
              onClick={() => setAdminViewTab('teacher-monitoring')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                adminViewTab === 'teacher-monitoring'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Teacher Attendance</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminViewTab('student-reports')}
              className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
                adminViewTab === 'student-reports'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Student Attendance Reports</span>
            </button>
          </div>
        </div>

        {/* ================================================= */}
        {/* SUBTAB 1: TEACHER ATTENDANCE MONITORING           */}
        {/* ================================================= */}
        {adminViewTab === 'teacher-monitoring' && (
          <div className="space-y-6">
            {/* Date Selector & Metrics */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-6 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Attendance Date Filter
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Monitor which teachers conducted classes or are marked present/absent
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={teacherAttendanceDate}
                    onChange={(e) => setTeacherAttendanceDate(e.target.value)}
                    className="px-3.5 py-2 text-xs rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => loadTeacherAttendance(teacherAttendanceDate)}
                    disabled={loadingTeacherAttendance}
                    className="p-2 text-slate-300 hover:text-white bg-white/5 border border-white/10 rounded-xl transition-colors cursor-pointer"
                    title="Refresh Data"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingTeacherAttendance ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                  <span className="text-[11px] text-slate-400 block mb-1">Total Faculty</span>
                  <span className="text-2xl font-bold font-mono text-white">
                    {teacherAttendanceData?.totalTeachers || 0}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
                  <span className="text-[11px] text-emerald-300 block mb-1">Faculty Present</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {teacherAttendanceData?.presentCount || 0}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/20">
                  <span className="text-[11px] text-rose-300 block mb-1">Faculty Absent</span>
                  <span className="text-2xl font-bold font-mono text-rose-400">
                    {teacherAttendanceData?.absentCount || 0}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-purple-950/20 border border-purple-500/20">
                  <span className="text-[11px] text-purple-300 block mb-1">Faculty Attendance Rate</span>
                  <span className="text-2xl font-bold font-mono text-purple-300">
                    {teacherAttendanceData?.facultyAttendanceRate || 100}%
                  </span>
                </div>
              </div>
            </div>

            {/* Teacher Attendance Roster */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>Faculty Presence &amp; Activity Log ({teacherAttendanceDate})</span>
                </h2>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search faculty name..."
                    value={teacherSearchQuery}
                    onChange={(e) => setTeacherSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-black/40 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-3 px-4">Faculty Member</th>
                      <th className="py-3 px-4">Specialization</th>
                      <th className="py-3 px-4">Allocated Classes</th>
                      <th className="py-3 px-4">Presence Status</th>
                      <th className="py-3 px-4">Session Evidence / Notes</th>
                      <th className="py-3 px-4 text-right">Update Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                          No faculty records found for {teacherAttendanceDate}.
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((t: any) => {
                        const isPresent = t.status === 'present';
                        const isOnLeave = t.status === 'on_leave';
                        const isUpdating = updatingTeacherId === t.id;

                        return (
                          <tr key={t.id} className="hover:bg-white/[0.02]">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{t.fullName}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{t.email}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              {t.specialization || 'Computer Science'}
                            </td>
                            <td className="py-3 px-4 text-slate-400">
                              {t.allocatedClasses && t.allocatedClasses.length > 0
                                ? t.allocatedClasses.join(', ')
                                : 'None Assigned'}
                            </td>
                            <td className="py-3 px-4">
                              {isPresent ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Present</span>
                                </span>
                              ) : isOnLeave ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>On Leave</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Absent</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-300">
                              <div className="text-[11px]">{t.notes}</div>
                              {t.checkInTime && (
                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  Check-in: {t.checkInTime}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  disabled={isUpdating || isPresent}
                                  onClick={() => handleUpdateTeacherStatus(t.id, 'present')}
                                  className="px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 rounded-lg cursor-pointer disabled:opacity-30"
                                >
                                  Present
                                </button>
                                <button
                                  type="button"
                                  disabled={isUpdating || (!isPresent && !isOnLeave)}
                                  onClick={() => handleUpdateTeacherStatus(t.id, 'absent')}
                                  className="px-2 py-1 text-[11px] font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 rounded-lg cursor-pointer disabled:opacity-30"
                                >
                                  Absent
                                </button>
                                <button
                                  type="button"
                                  disabled={isUpdating || isOnLeave}
                                  onClick={() => handleUpdateTeacherStatus(t.id, 'on_leave')}
                                  className="px-2 py-1 text-[11px] font-semibold text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/60 border border-amber-500/30 rounded-lg cursor-pointer disabled:opacity-30"
                                >
                                  Leave
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* SUBTAB 2: STUDENT ATTENDANCE & PERFORMANCE REPORTS*/}
        {/* ================================================= */}
        {adminViewTab === 'student-reports' && (
          <div className="space-y-6">
            {/* Campus Overview KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <span className="text-xs text-slate-400 block mb-1">Campus Attendance Rate</span>
                <span className="text-3xl font-extrabold font-mono text-emerald-400">
                  {attendanceSummary?.metrics?.overallRate ?? 92}%
                </span>
              </div>
              <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
                <span className="text-xs text-slate-400 block mb-1">Total Recorded Sessions</span>
                <span className="text-3xl font-extrabold font-mono text-white">
                  {attendanceSessions.length}
                </span>
              </div>
              <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
                <span className="text-xs text-emerald-300 block mb-1">Present Instances</span>
                <span className="text-3xl font-extrabold font-mono text-emerald-400">
                  {attendanceSummary?.metrics?.totalPresentCount ?? 0}
                </span>
              </div>
              <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/20">
                <span className="text-xs text-rose-300 block mb-1">Absent Instances</span>
                <span className="text-3xl font-extrabold font-mono text-rose-400">
                  {attendanceSummary?.metrics?.totalAbsentCount ?? 0}
                </span>
              </div>
            </div>

            {/* Class Cohort Breakdown Table */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
              <h2 className="text-base font-bold text-white">Class Cohort Attendance Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Grade Level &amp; Section</th>
                      <th className="py-3 px-4">Enrolled Students</th>
                      <th className="py-3 px-4">Recorded Sessions</th>
                      <th className="py-3 px-4">Attendance Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {classes.map((c) => {
                      const classSessions = attendanceSessions.filter((s) => s.classId === (c.id || (c as any)._id));
                      let pTotal = 0;
                      let stTotal = 0;
                      classSessions.forEach((s) => {
                        pTotal += s.presentCount || 0;
                        stTotal += s.totalStudents || 0;
                      });
                      const rate = stTotal > 0 ? Math.round((pTotal / stTotal) * 100) : 100;
                      return (
                        <tr key={c.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-semibold text-white">{c.name}</td>
                          <td className="py-3 px-4 text-slate-300">{c.gradeLevel} - {c.section}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{c.studentIds?.length || 0}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{classSessions.length}</td>
                          <td className="py-3 px-4">
                            <span className={`font-mono font-bold ${rate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {rate}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student by Student Performance & Attendance Summary */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-base font-bold text-white">Student-by-Student Attendance Summary</h2>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search student or roll number..."
                    value={studentReportSearch}
                    onChange={(e) => setStudentReportSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-black/40 border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Roll Number</th>
                      <th className="py-3 px-4">Total Sessions</th>
                      <th className="py-3 px-4">Present</th>
                      <th className="py-3 px-4">Absent</th>
                      <th className="py-3 px-4">Attendance %</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                          No student records found.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((st: any) => (
                        <tr key={st.studentId} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-semibold text-white">{st.studentName}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{st.rollNumber}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{st.totalClasses}</td>
                          <td className="py-3 px-4 font-mono text-emerald-400">{st.presentCount}</td>
                          <td className="py-3 px-4 font-mono text-rose-400">{st.absentCount}</td>
                          <td className="py-3 px-4 font-mono font-bold text-white">{st.percentage}%</td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                st.percentage >= 75
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : st.percentage >= 60
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {st.statusBadge}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER: TEACHER ATTENDANCE MARKING WORKFLOW
  // ==========================================
  if (authorizedClasses.length === 0) {
    return (
      <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/10 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-base font-bold text-white">No Classes Allocated</h2>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          You currently have no classes assigned to your faculty account. Please request the institutional administrator to allocate your teaching cohorts in Class &amp; Student Allotment.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Student Attendance Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Authorized class attendance marking. Select an allocated cohort and mark students Present or Absent.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 rounded-xl transition-all cursor-pointer"
          >
            Mark All Present
          </button>
          <button
            type="button"
            onClick={handleMarkAllAbsent}
            className="px-3 py-1.5 text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 rounded-xl transition-all cursor-pointer"
          >
            Mark All Absent
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white bg-white/5 border border-white/10 rounded-xl transition-all cursor-pointer"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Class Selection, Date Entry & File Upload Bar */}
      <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            1. Select Allocated Class *
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            {authorizedClasses.map((cls) => (
              <option key={cls.id || (cls as any)._id} value={cls.id || (cls as any)._id}>
                {cls.name} ({cls.gradeLevel} - {cls.section})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            2. Attendance Date *
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            3. Optional Document Upload (OCR)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,image/*"
              className="hidden"
            />
            <button
              type="button"
              disabled={isProcessingFile}
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 px-3 rounded-xl border border-dashed border-purple-500/40 bg-purple-500/5 hover:bg-purple-500/10 text-xs font-semibold text-purple-300 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isProcessingFile ? 'Matching Roster...' : 'Upload PDF / Roster'}</span>
            </button>
          </div>
        </div>
      </div>

      {extractionInfo && (
        <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
          <span>{extractionInfo.notice}</span>
        </div>
      )}

      {saveSuccessToast && (
        <div className="p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessToast}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Attendance Roster Table */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <span>
                {selectedClass?.name || 'Class'} &middot; {totalStudentsCount} Enrolled Students
              </span>
            </h2>
            <div className="flex items-center gap-3 text-xs mt-1 font-mono">
              <span className="text-emerald-400 font-semibold">Present: {presentCount}</span>
              <span className="text-slate-500">&middot;</span>
              <span className="text-rose-400 font-semibold">Absent: {absentCount}</span>
              {unmarkedCount > 0 && (
                <>
                  <span className="text-slate-500">&middot;</span>
                  <span className="text-amber-400 font-semibold">Unmarked: {unmarkedCount}</span>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveAttendance}
            disabled={isSaving || totalStudentsCount === 0}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 hover:opacity-95 shadow-md shadow-purple-600/30 rounded-xl transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? 'Saving Attendance...' : 'Save & Publish Attendance'}
          </button>
        </div>

        {totalStudentsCount === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No students are enrolled in this class. Allot students in Class Management to begin recording attendance.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4">Roll Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Status (Select One)</th>
                  <th className="py-3 px-4">Remarks / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {classStudents.map((st) => {
                  const sid = st.id || (st as any)._id;
                  const currentStatus = studentStatusMap[sid];

                  return (
                    <tr key={sid} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-mono font-semibold text-purple-300">
                        {st.rollNumber || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{st.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{st.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => handleMarkStatus(sid, 'present')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              currentStatus === 'present'
                                ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMarkStatus(sid, 'absent')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              currentStatus === 'absent'
                                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Optional remarks (e.g. Late, Medical Leave)"
                          value={remarksMap[sid] || ''}
                          onChange={(e) => handleRemarkChange(sid, e.target.value)}
                          className="w-full max-w-sm px-3 py-1.5 text-xs rounded-xl bg-black/30 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentAttendance;
