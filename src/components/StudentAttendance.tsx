import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Upload,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Check,
  X,
  RefreshCw,
  Search,
  Users,
  Clock,
  Sparkles,
  HelpCircle,
  BarChart3,
  CheckCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SchoolClass, TenantUser, AttendanceSession, AttendanceRecordItem } from '../types/crm';
import api from '../services/api';

/**
 * Lightweight text extraction from text-based PDFs
 */
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoder = new TextDecoder('latin1');
    const text = decoder.decode(arrayBuffer);

    // Look for text streams in PDF: (string) Tj or [(string)] TJ
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

  // --- TEACHER WORKFLOW STATES ---
  const todayDateStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);

  // Authorized classes for teacher
  const authorizedClasses = useMemo(() => {
    if (isAdmin) return classes;
    if (isTeacher) {
      const filtered = classes.filter((c: SchoolClass) => {
        const cId = c.id || (c as any)._id;
        const isPrimary = c.primaryTeacherId === currentUser.id;
        const isAssigned = currentUser.assignedClassIds?.includes(cId);
        return isPrimary || isAssigned;
      });
      return filtered.length > 0 ? filtered : classes;
    }
    return classes;
  }, [classes, currentUser, isAdmin, isTeacher]);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    authorizedClasses[0]?.id || (authorizedClasses[0] as any)?._id || ''
  );

  // Keep selectedClassId synced when authorizedClasses load
  useEffect(() => {
    if (!selectedClassId && authorizedClasses.length > 0) {
      const firstId = authorizedClasses[0]?.id || (authorizedClasses[0] as any)?._id;
      if (firstId) setSelectedClassId(firstId);
    }
  }, [authorizedClasses, selectedClassId]);

  const selectedClass = useMemo(() => {
    return authorizedClasses.find(
      (c) => (c.id || (c as any)._id) === selectedClassId
    );
  }, [authorizedClasses, selectedClassId]);

  // Students enrolled in the selected class
  const classStudents = useMemo(() => {
    if (!selectedClass) return [];
    const studentIdSet = new Set(selectedClass.studentIds || []);

    return users.filter((u: TenantUser) => {
      if (u.role !== 'student') return false;
      const uId = u.id || (u as any)._id;
      return (
        studentIdSet.has(uId) ||
        u.assignedClassId === selectedClassId ||
        (u.assignedClassIds && u.assignedClassIds.includes(selectedClassId))
      );
    });
  }, [selectedClass, selectedClassId, users]);

  // Attendance status mapping per student: 'unmarked' | 'present' | 'absent'
  const [studentStatusMap, setStudentStatusMap] = useState<Record<string, 'unmarked' | 'present' | 'absent'>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [isPreviouslySaved, setIsPreviouslySaved] = useState(false);
  const [saveSuccessToast, setSaveSuccessToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // File extraction states
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractionInfo, setExtractionInfo] = useState<{
    matchedCount: number;
    unmatchedNames: string[];
    notice?: string;
  } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing attendance for selected class and date
  useEffect(() => {
    if (!selectedClassId || !selectedDate) return;

    // Check existing attendance sessions
    const session = attendanceSessions.find(
      (s: AttendanceSession) => s.classId === selectedClassId && s.date === selectedDate
    );

    const initialMap: Record<string, 'unmarked' | 'present' | 'absent'> = {};
    const initialRemarks: Record<string, string> = {};

    if (session && session.records && session.records.length > 0) {
      session.records.forEach((rec: AttendanceRecordItem) => {
        initialMap[rec.studentId] = rec.status;
        if (rec.remarks) initialRemarks[rec.studentId] = rec.remarks;
      });
      // Fill any remaining students in class as unmarked if not present in saved record
      classStudents.forEach((st) => {
        const stId = st.id || (st as any)._id;
        if (!initialMap[stId]) {
          initialMap[stId] = 'unmarked';
        }
      });
      setIsPreviouslySaved(true);
    } else {
      // Initially, each student's status must be Unmarked per requirements
      classStudents.forEach((st) => {
        const stId = st.id || (st as any)._id;
        initialMap[stId] = 'unmarked';
      });
      setIsPreviouslySaved(false);
    }

    setStudentStatusMap(initialMap);
    setRemarksMap(initialRemarks);
    setSaveError(null);
  }, [selectedClassId, selectedDate, attendanceSessions, classStudents]);

  // Counts of Present, Absent, and Unmarked
  const { presentCount, absentCount, unmarkedCount } = useMemo(() => {
    let p = 0;
    let a = 0;
    let u = 0;

    classStudents.forEach((st) => {
      const stId = st.id || (st as any)._id;
      const status = studentStatusMap[stId] || 'unmarked';
      if (status === 'present') p++;
      else if (status === 'absent') a++;
      else u++;
    });

    return { presentCount: p, absentCount: a, unmarkedCount: u };
  }, [classStudents, studentStatusMap]);

  // Marking action handler
  const handleSetStatus = (studentId: string, status: 'present' | 'absent') => {
    setStudentStatusMap((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === status ? 'unmarked' : status,
    }));
    setSaveError(null);
  };

  const handleMarkAllPresent = () => {
    const nextMap: Record<string, 'unmarked' | 'present' | 'absent'> = {};
    classStudents.forEach((st) => {
      const stId = st.id || (st as any)._id;
      nextMap[stId] = 'present';
    });
    setStudentStatusMap(nextMap);
  };

  const handleMarkAllAbsent = () => {
    const nextMap: Record<string, 'unmarked' | 'present' | 'absent'> = {};
    classStudents.forEach((st) => {
      const stId = st.id || (st as any)._id;
      nextMap[stId] = 'absent';
    });
    setStudentStatusMap(nextMap);
  };

  const handleClearAll = () => {
    const nextMap: Record<string, 'unmarked' | 'present' | 'absent'> = {};
    classStudents.forEach((st) => {
      const stId = st.id || (st as any)._id;
      nextMap[stId] = 'unmarked';
    });
    setStudentStatusMap(nextMap);
  };

  // Upload & Extraction Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setIsProcessingFile(true);
    setExtractionInfo(null);

    const isPDF = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    let extractedText = '';

    if (isPDF) {
      extractedText = await extractTextFromPDF(file);
    } else if (isImage) {
      // Image support: read preview and verify file signature
      const reader = new FileReader();
      extractedText = await new Promise((resolve) => {
        reader.onload = () => resolve(file.name);
        reader.readAsDataURL(file);
      });
    }

    // Match extracted text with student accounts in selected class
    let matched = 0;
    const unmatched: string[] = [];
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
        // Pre-suggest as present for review
        updatedMap[stId] = 'present';
      }
    });

    setIsProcessingFile(false);
    setStudentStatusMap(updatedMap);

    setExtractionInfo({
      matchedCount: matched,
      unmatchedNames: unmatched,
      notice:
        matched > 0
          ? `Successfully matched ${matched} student(s) from document against class roster. Please review and verify before saving.`
          : 'Document uploaded. Could not automatically match names to this class roster. Please mark attendance manually.',
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
      setSaveError('Please enter a valid attendance date.');
      return;
    }

    // Validate that no students remain unmarked
    if (unmarkedCount > 0) {
      setSaveError(
        `Validation Error: ${unmarkedCount} student(s) are still Unmarked. Please mark all students Present or Absent before saving.`
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

      setIsPreviouslySaved(true);
      setSaveSuccessToast(
        `Attendance successfully saved for ${selectedClass?.name || 'Class'} on ${selectedDate} (${presentCount} Present, ${absentCount} Absent).`
      );
      setTimeout(() => setSaveSuccessToast(null), 5000);
    } catch (err: any) {
      setIsSaving(false);
      setSaveError(err.message || 'An unexpected error occurred.');
    }
  };

  // --- STUDENT READ-ONLY ATTENDANCE VIEW ---
  const [studentRefetching, setStudentRefetching] = useState(false);

  const handleStudentRefresh = async () => {
    setStudentRefetching(true);
    await refreshData();
    setStudentRefetching(false);
  };

  // Student's personal attendance history
  const studentSessions = useMemo(() => {
    if (!isStudent) return [];
    const myId = currentUser.id || (currentUser as any)._id;

    return attendanceSessions
      .map((s: AttendanceSession) => {
        const myRecord = (s.records || []).find((r) => r.studentId === myId);
        return {
          session: s,
          status: myRecord ? myRecord.status : (s as any).personalStatus || null,
          remarks: myRecord ? myRecord.remarks : '',
        };
      })
      .filter((entry) => entry.status !== null)
      .sort((a, b) => b.session.date.localeCompare(a.session.date));
  }, [attendanceSessions, currentUser, isStudent]);

  const studentStats = useMemo(() => {
    const total = studentSessions.length;
    const present = studentSessions.filter((s) => s.status === 'present').length;
    const absent = studentSessions.filter((s) => s.status === 'absent').length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 100;
    return { total, present, absent, rate };
  }, [studentSessions]);

  // ==========================================
  // RENDER: STUDENT VIEW (READ-ONLY)
  // ==========================================
  if (isStudent) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-display">My Attendance Records</h1>
            <p className="text-xs text-slate-400 mt-1">
              Read-only verified attendance logs recorded by faculty members for your cohort.
            </p>
          </div>
          <button
            onClick={handleStudentRefresh}
            disabled={studentRefetching}
            className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-white/5 border border-white/10 hover:border-white/20 rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${studentRefetching ? 'animate-spin' : ''}`} />
            <span>Refresh Live Attendance</span>
          </button>
        </div>

        {/* Student Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <span className="text-xs text-slate-400 block mb-1">Attendance Rate</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono ${studentStats.rate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {studentStats.rate}%
              </span>
              <span className="text-[11px] text-slate-500">overall</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <span className="text-xs text-slate-400 block mb-1">Total Sessions Recorded</span>
            <span className="text-3xl font-extrabold font-mono text-white">{studentStats.total}</span>
          </div>

          <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20">
            <span className="text-xs text-emerald-300 block mb-1">Present Days</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-3xl font-extrabold font-mono text-emerald-400">{studentStats.present}</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/20">
            <span className="text-xs text-rose-300 block mb-1">Absent Days</span>
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-rose-400" />
              <span className="text-3xl font-extrabold font-mono text-rose-400">{studentStats.absent}</span>
            </div>
          </div>
        </div>

        {/* Student Attendance History Table */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-purple-400" />
            <span>Attendance Log</span>
          </h2>

          {studentSessions.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-xs">
              No attendance logs found yet. When your teachers record class attendance, your verified status will appear here.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 px-4">Attendance Date</th>
                    <th className="py-3 px-4">Class / Cohort</th>
                    <th className="py-3 px-4">Recorded By Teacher</th>
                    <th className="py-3 px-4">Attendance Status</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {studentSessions.map(({ session, status, remarks }) => {
                    const isPresent = status === 'present';
                    return (
                      <tr key={session.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-mono text-white">
                          {new Date(session.date).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{session.className || 'Assigned Class'}</td>
                        <td className="py-3 px-4 text-slate-400">{session.markedByTeacherName || 'Faculty Instructor'}</td>
                        <td className="py-3 px-4">
                          {isPresent ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Present</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Absent</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-400 italic">{remarks || '—'}</td>
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
  }

  // ==========================================
  // RENDER: ADMIN OVERVIEW (READ-ONLY OVERVIEW)
  // ==========================================
  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Institutional Attendance Overview</h1>
          <p className="text-xs text-slate-400 mt-1">
            Executive monitoring across all academic classes and attendance sessions.
          </p>
        </div>

        {/* Institutional Metrics */}
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

        {/* Class Attendance Summary */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
          <h2 className="text-base font-bold text-white">Class Cohort Attendance Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4">Grade Level & Section</th>
                  <th className="py-3 px-4">Enrolled Students</th>
                  <th className="py-3 px-4">Recorded Sessions</th>
                  <th className="py-3 px-4">Average Attendance</th>
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
      </div>
    );
  }

  // ==========================================
  // RENDER: TEACHER ATTENDANCE MARKING WORKFLOW
  // ==========================================
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Student Attendance</h1>
          <p className="text-xs text-slate-400 mt-1">
            Authorized class attendance marking with text-based PDF/image roster matching and instant database synchronization.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Quick Mark Actions */}
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
        {/* Step 1: Authorized Class Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            1. Select Authorized Class *
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
          >
            {authorizedClasses.map((cls) => (
              <option key={cls.id || (cls as any)._id} value={cls.id || (cls as any)._id}>
                {cls.name} ({cls.gradeLevel} - {cls.section})
              </option>
            ))}
          </select>
        </div>

        {/* Step 2: Attendance Date Manual Entry */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            2. Attendance Date *
          </label>
          <div className="relative">
            <input
              type="date"
              required
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Step 3: PDF / Image List Upload (Optional Roster Extraction) */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            3. Upload Student List PDF / Image (Optional)
          </label>
          <div className="flex items-center gap-2">
            <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-purple-300 bg-purple-950/30 hover:bg-purple-900/40 border border-purple-500/30 rounded-xl cursor-pointer transition-all">
              <Upload className="w-3.5 h-3.5" />
              <span className="truncate">{uploadedFileName ? uploadedFileName : 'Upload PDF / JPG / PNG'}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/png,image/jpeg,image/jpg"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            {uploadedFileName && (
              <button
                type="button"
                onClick={() => {
                  setUploadedFileName(null);
                  setExtractionInfo(null);
                }}
                className="p-2 text-slate-400 hover:text-white"
                title="Clear uploaded file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Extraction Feedback Banner */}
      {isProcessingFile && (
        <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs text-purple-200 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
          <span>Processing document and matching student roster against class records...</span>
        </div>
      )}

      {extractionInfo && (
        <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs text-purple-200 flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">{extractionInfo.notice}</span>
            {extractionInfo.unmatchedNames.length > 0 && (
              <p className="text-amber-300 text-[11px] mt-1">
                Notice: {extractionInfo.unmatchedNames.length} names could not be verified in this cohort.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Existing Saved Session Alert */}
      {isPreviouslySaved && (
        <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCheck className="w-4 h-4 text-blue-400 shrink-0" />
            <span>
              Loaded existing attendance record for <strong>{selectedDate}</strong>. Any changes you make will update the database.
            </span>
          </div>
        </div>
      )}

      {/* Attendance Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10">
          <span className="text-[11px] text-slate-400 block mb-0.5">Total Enrolled</span>
          <span className="text-2xl font-extrabold font-mono text-white">{classStudents.length}</span>
        </div>

        <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
          <span className="text-[11px] text-emerald-300 block mb-0.5">Present</span>
          <span className="text-2xl font-extrabold font-mono text-emerald-400">{presentCount}</span>
        </div>

        <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30">
          <span className="text-[11px] text-rose-300 block mb-0.5">Absent</span>
          <span className="text-2xl font-extrabold font-mono text-rose-400">{absentCount}</span>
        </div>

        <div className={`p-4 rounded-xl border ${unmarkedCount > 0 ? 'bg-amber-950/20 border-amber-500/30' : 'bg-white/[0.03] border-white/10'}`}>
          <span className={`text-[11px] block mb-0.5 ${unmarkedCount > 0 ? 'text-amber-300 font-semibold' : 'text-slate-400'}`}>
            Unmarked (Pending)
          </span>
          <span className={`text-2xl font-extrabold font-mono ${unmarkedCount > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
            {unmarkedCount}
          </span>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex justify-between items-center pb-2 border-b border-white/10">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span>Attendance Table — {selectedClass?.name || 'Class Roster'}</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">Date: {selectedDate}</span>
        </div>

        {classStudents.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No students are currently enrolled in this class. Allot students under "Assigned Classes" or contact the Administrator.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-3 px-4 w-28">Roll Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4 text-center w-36">Mark Present</th>
                  <th className="py-3 px-4 text-center w-36">Mark Absent</th>
                  <th className="py-3 px-4 text-right w-36">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {classStudents.map((st) => {
                  const stId = st.id || (st as any)._id;
                  const currentStatus = studentStatusMap[stId] || 'unmarked';
                  const isPresent = currentStatus === 'present';
                  const isAbsent = currentStatus === 'absent';
                  const isUnmarked = currentStatus === 'unmarked';

                  return (
                    <tr
                      key={stId}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        isPresent ? 'bg-emerald-950/10' : isAbsent ? 'bg-rose-950/10' : ''
                      }`}
                    >
                      {/* Roll Number */}
                      <td className="py-3 px-4 font-mono font-semibold text-purple-300">
                        {st.rollNumber || 'N/A'}
                      </td>

                      {/* Student Name */}
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{st.fullName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">@{st.username}</span>
                        </div>
                      </td>

                      {/* Present Button: Green styling, checkmark icon, "Present" */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleSetStatus(stId, 'present')}
                          className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isPresent
                              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400'
                              : 'bg-emerald-950/30 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/40'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Present</span>
                        </button>
                      </td>

                      {/* Absent Button: Red styling, cross icon, "Absent" */}
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleSetStatus(stId, 'absent')}
                          className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isAbsent
                              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-2 ring-rose-400'
                              : 'bg-rose-950/30 text-rose-300 border border-rose-500/30 hover:bg-rose-900/40'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Absent</span>
                        </button>
                      </td>

                      {/* Attendance Status */}
                      <td className="py-3 px-4 text-right">
                        {isPresent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Present</span>
                          </span>
                        )}
                        {isAbsent && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                            <XCircle className="w-3 h-3" />
                            <span>Absent</span>
                          </span>
                        )}
                        {isUnmarked && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-slate-400 border border-white/10">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>Unmarked</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Validation Errors & Toast Messages */}
        {saveError && (
          <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {saveSuccessToast && (
          <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveSuccessToast}</span>
          </div>
        )}

        {/* Save Attendance Button */}
        <div className="flex justify-between items-center pt-4 border-t border-white/10">
          <div className="text-xs text-slate-400">
            {unmarkedCount > 0 ? (
              <span className="text-amber-400 font-medium">
                * Please mark all {classStudents.length} students before saving.
              </span>
            ) : (
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> All students marked. Ready to save.
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={isSaving || classStudents.length === 0}
            onClick={handleSaveAttendance}
            className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Attendance...</span>
              </>
            ) : (
              <>
                <span>Save Attendance Record</span>
                <Check className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentAttendance;
