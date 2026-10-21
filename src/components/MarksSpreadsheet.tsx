import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Save,
  CheckCircle2,
  AlertCircle,
  Download,
  Filter,
  RefreshCw,
  Search,
  BookOpen,
  Award,
  TrendingUp,
  FileSpreadsheet,
  Check,
  Eye,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SchoolClass, TenantUser, StudentMarksRecord } from '../types/crm';

export const MarksSpreadsheet: React.FC = () => {
  const {
    currentUser,
    classes,
    users,
    marks,
    fetchMarks,
    saveMarksBatch,
    setActiveTab,
  } = useApp();

  if (!currentUser) return null;

  const isStudent = currentUser.role === 'student';
  const isTeacher = currentUser.role === 'teacher';
  const isAdmin = currentUser.role === 'admin';

  if (isAdmin) {
    return (
      <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/10 max-w-xl mx-auto my-12">
        <Award className="w-10 h-10 text-purple-400 mx-auto mb-3" />
        <h2 className="text-base font-bold text-white font-display">Teacher Marks-Entry Workflow</h2>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          The Marks Spreadsheet is dedicated exclusively to assigned faculty for entering and updating cohort marks. Institutional administrators monitor academic performance, gradebooks, and trends via Performance Analytics.
        </p>
        <button
          onClick={() => setActiveTab('analytics')}
          className="mt-5 px-5 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all cursor-pointer shadow-md shadow-purple-600/30"
        >
          Open Performance Analytics
        </button>
      </div>
    );
  }

  // Teacher/Admin authorized classes
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

  // Selected Class
  const [selectedClassId, setSelectedClassId] = useState<string>(
    authorizedClasses[0]?.id || (authorizedClasses[0] as any)?._id || ''
  );

  useEffect(() => {
    if (!selectedClassId && authorizedClasses.length > 0) {
      setSelectedClassId(authorizedClasses[0].id || (authorizedClasses[0] as any)?._id || '');
    }
  }, [authorizedClasses, selectedClassId]);

  // Assessment & Subject metadata
  const selectedClass = authorizedClasses.find(
    (c) => (c.id || (c as any)._id) === selectedClassId
  );

  const defaultSubject = selectedClass?.subjects?.[0] || 'Core Subject';
  const [subject, setSubject] = useState(defaultSubject);
  const [assessmentTitle, setAssessmentTitle] = useState('Mid-Term Assessment 2026');

  // Max marks configuration
  const [maxAssignmentMarks, setMaxAssignmentMarks] = useState<number>(30);
  const [maxExamMarks, setMaxExamMarks] = useState<number>(50);
  const [maxInternalMarks, setMaxInternalMarks] = useState<number>(20);

  const calculatedMaxTotal = maxAssignmentMarks + maxExamMarks + maxInternalMarks;

  // Search filter
  const [studentSearch, setStudentSearch] = useState('');

  // Row state for spreadsheet
  interface GridRow {
    studentId: string;
    studentName: string;
    rollNumber: string;
    assignmentMarks: number | string;
    examMarks: number | string;
    internalMarks: number | string;
    totalMarks: number;
    percentage: number;
    grade: string;
    teacherFeedback: string;
    isPublished: boolean;
    hasError?: boolean;
    errorMessage?: string;
  }

  const [rows, setRows] = useState<GridRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load students of selected class
  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return users.filter((u: TenantUser) => {
      if (u.role !== 'student') return false;
      const cId = u.assignedClassId;
      const inArray = u.assignedClassIds?.includes(selectedClassId);
      const inClassStudentIds = selectedClass?.studentIds?.includes(u.id || (u as any)._id);
      return cId === selectedClassId || inArray || inClassStudentIds;
    }).sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
  }, [users, selectedClassId, selectedClass]);

  // Load existing saved marks for class & assessment
  useEffect(() => {
    if (isStudent) return;
    if (!selectedClassId) return;

    let isMounted = true;
    setIsLoading(true);

    fetchMarks({
      classId: selectedClassId,
      subject,
      assessmentTitle,
    }).then((existingMarks) => {
      if (!isMounted) return;
      setIsLoading(false);

      // Match students with existing saved marks or default empty
      const initialRows: GridRow[] = classStudents.map((stu) => {
        const stuId = stu.id || (stu as any)._id;
        const saved = existingMarks.find((m) => m.studentId === stuId);

        const aMarks = saved?.assignmentMarks !== undefined ? saved.assignmentMarks : 0;
        const eMarks = saved?.examMarks !== undefined ? saved.examMarks : 0;
        const iMarks = saved?.internalMarks !== undefined ? saved.internalMarks : 0;
        const total = aMarks + eMarks + iMarks;
        const pct = calculatedMaxTotal > 0 ? Number(((total / calculatedMaxTotal) * 100).toFixed(1)) : 0;

        let grade = 'F';
        if (pct >= 90) grade = 'A+';
        else if (pct >= 80) grade = 'A';
        else if (pct >= 70) grade = 'B';
        else if (pct >= 60) grade = 'C';
        else if (pct >= 50) grade = 'D';
        else if (pct >= 40) grade = 'E';

        return {
          studentId: stuId,
          studentName: stu.fullName || stu.username,
          rollNumber: stu.rollNumber || '-',
          assignmentMarks: aMarks,
          examMarks: eMarks,
          internalMarks: iMarks,
          totalMarks: total,
          percentage: pct,
          grade: saved?.grade || grade,
          teacherFeedback: saved?.teacherFeedback || '',
          isPublished: saved?.isPublished !== undefined ? saved.isPublished : true,
        };
      });

      setRows(initialRows);
      setHasUnsavedChanges(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedClassId, subject, assessmentTitle, classStudents, isStudent, calculatedMaxTotal]);

  // Handle cell edits
  const handleMarkChange = (
    index: number,
    field: 'assignmentMarks' | 'examMarks' | 'internalMarks' | 'teacherFeedback' | 'isPublished',
    value: any
  ) => {
    setRows((prev) => {
      const updated = [...prev];
      const row = { ...updated[index] };

      if (field === 'teacherFeedback' || field === 'isPublished') {
        (row as any)[field] = value;
      } else {
        const numVal = value === '' ? '' : Math.max(0, Number(value) || 0);
        (row as any)[field] = numVal;

        // Validation against maximums
        let maxAllowed = 100;
        if (field === 'assignmentMarks') maxAllowed = maxAssignmentMarks;
        if (field === 'examMarks') maxAllowed = maxExamMarks;
        if (field === 'internalMarks') maxAllowed = maxInternalMarks;

        if (typeof numVal === 'number' && numVal > maxAllowed) {
          row.hasError = true;
          row.errorMessage = `${field.replace('Marks', '')} cannot exceed ${maxAllowed} marks`;
        } else {
          row.hasError = false;
          row.errorMessage = undefined;
        }

        // Recompute Total & Percentage
        const a = typeof row.assignmentMarks === 'number' ? row.assignmentMarks : 0;
        const e = typeof row.examMarks === 'number' ? row.examMarks : 0;
        const i = typeof row.internalMarks === 'number' ? row.internalMarks : 0;
        const total = a + e + i;
        const pct = calculatedMaxTotal > 0 ? Number(((total / calculatedMaxTotal) * 100).toFixed(1)) : 0;

        let grade = 'F';
        if (pct >= 90) grade = 'A+';
        else if (pct >= 80) grade = 'A';
        else if (pct >= 70) grade = 'B';
        else if (pct >= 60) grade = 'C';
        else if (pct >= 50) grade = 'D';
        else if (pct >= 40) grade = 'E';

        row.totalMarks = total;
        row.percentage = pct;
        row.grade = grade;
      }

      updated[index] = row;
      return updated;
    });

    setHasUnsavedChanges(true);
    setStatusMessage(null);
  };

  // Save spreadsheet marks batch
  const handleSaveMarks = async () => {
    setStatusMessage(null);

    // Validation check
    const hasAnyError = rows.some((r) => r.hasError);
    if (hasAnyError) {
      setStatusMessage({
        type: 'error',
        text: 'Please correct the marks exceeding maximum thresholds before saving.',
      });
      return;
    }

    if (!selectedClassId) {
      setStatusMessage({ type: 'error', text: 'Please select a valid class cohort.' });
      return;
    }

    setIsSaving(true);

    const payload = {
      classId: selectedClassId,
      subject: subject.trim(),
      assessmentTitle: assessmentTitle.trim(),
      maxMarks: calculatedMaxTotal,
      records: rows.map((r) => ({
        studentId: r.studentId,
        studentName: r.studentName,
        rollNumber: r.rollNumber,
        assignmentMarks: Number(r.assignmentMarks) || 0,
        examMarks: Number(r.examMarks) || 0,
        internalMarks: Number(r.internalMarks) || 0,
        totalMarks: r.totalMarks,
        percentage: r.percentage,
        grade: r.grade,
        teacherFeedback: r.teacherFeedback,
        isPublished: r.isPublished,
      })),
    };

    const res = await saveMarksBatch(payload);
    setIsSaving(false);

    if (res.ok) {
      setHasUnsavedChanges(false);
      setStatusMessage({
        type: 'success',
        text: `Spreadsheet marks saved successfully for ${rows.length} students in ${selectedClass?.name || 'class'}.`,
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } else {
      setStatusMessage({
        type: 'error',
        text: res.message || 'Failed to save spreadsheet marks.',
      });
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (rows.length === 0) return;
    const headers = [
      'Roll Number',
      'Student Name',
      `Assignment Marks (Max ${maxAssignmentMarks})`,
      `Exam Marks (Max ${maxExamMarks})`,
      `Internal Marks (Max ${maxInternalMarks})`,
      `Total Marks (Max ${calculatedMaxTotal})`,
      'Percentage (%)',
      'Grade',
      'Teacher Feedback',
    ];

    const csvRows = [headers.join(',')];
    rows.forEach((r) => {
      csvRows.push(
        [
          `"${r.rollNumber}"`,
          `"${r.studentName}"`,
          r.assignmentMarks,
          r.examMarks,
          r.internalMarks,
          r.totalMarks,
          `${r.percentage}%`,
          r.grade,
          `"${r.teacherFeedback.replace(/"/g, '""')}"`,
        ].join(',')
      );
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedClass?.name || 'Class'}_${subject}_Marks.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filtered rows for search
  const filteredRows = useMemo(() => {
    if (!studentSearch.trim()) return rows;
    const q = studentSearch.toLowerCase();
    return rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.rollNumber.toLowerCase().includes(q)
    );
  }, [rows, studentSearch]);

  // Student Personal View
  if (isStudent) {
    const studentMarks = marks.filter(
      (m: StudentMarksRecord) => m.studentId === currentUser.id && m.isPublished
    );

    const totalAssessments = studentMarks.length;
    const avgScore =
      totalAssessments > 0
        ? (studentMarks.reduce((acc, m) => acc + (m.percentage || 0), 0) / totalAssessments).toFixed(1)
        : '0.0';

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">My Academic Marks &amp; Report Card</h1>
          <p className="text-xs text-slate-400 mt-1">Review official verified marks, examination scores, and faculty feedback.</p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <span className="text-xs text-slate-400 font-medium">Recorded Assessments</span>
            <div className="text-2xl font-bold font-display text-white mt-1">{totalAssessments} Tests</div>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <span className="text-xs text-slate-400 font-medium">Cumulative Average</span>
            <div className="text-2xl font-bold font-display text-purple-400 mt-1">{avgScore}%</div>
          </div>
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <span className="text-xs text-slate-400 font-medium">Status</span>
            <div className="text-2xl font-bold font-display text-emerald-400 mt-1">
              {Number(avgScore) >= 75 ? 'Good Standing' : 'Passing'}
            </div>
          </div>
        </div>

        {/* Marks Table */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Transcript &amp; Grade Records</h2>
            <span className="text-xs text-slate-400 font-mono">{studentMarks.length} Published Results</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 bg-white/[0.02]">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Assessment Title</th>
                  <th className="py-3 px-4 text-right">Assignment</th>
                  <th className="py-3 px-4 text-right">Examination</th>
                  <th className="py-3 px-4 text-right">Total Marks</th>
                  <th className="py-3 px-4 text-right">Percentage</th>
                  <th className="py-3 px-4 text-center">Grade</th>
                  <th className="py-3 px-4">Faculty Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {studentMarks.length > 0 ? (
                  studentMarks.map((m, idx) => (
                    <tr key={m.id || idx} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-white font-medium">{m.subject}</td>
                      <td className="py-3 px-4 text-purple-200">{m.assessmentTitle}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">{m.assignmentMarks}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">{m.examMarks}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {m.totalMarks} / {m.maxMarks}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-purple-300 font-bold">{m.percentage}%</td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            m.grade.startsWith('A')
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : m.grade.startsWith('B')
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {m.grade}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400 italic">
                        {m.teacherFeedback || 'No additional remarks provided.'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-500">
                      No published assessment marks found for your account yet. When faculty finalizes grades, they will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Teacher & Admin View
  return (
    <div className="space-y-6">
      {/* Banner Notifications */}
      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/10 border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Academic Marks &amp; Gradebook Spreadsheet</h1>
          <p className="text-xs text-slate-400 mt-1">
            Maintain student examination and assignment scores with auto-computation, grade distributions, and persistent records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            disabled={rows.length === 0}
            className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={handleSaveMarks}
            disabled={isSaving || rows.length === 0}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer ${
              hasUnsavedChanges
                ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30 animate-pulse'
                : 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/20'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Spreadsheet...' : 'Save All Marks'}</span>
          </button>
        </div>
      </div>

      {/* Controls Bar: Class Selection, Subject, Assessment, Max Marks */}
      <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Class Select */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Authorized Cohort / Class</label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
            >
              {authorizedClasses.map((c) => {
                const cId = c.id || (c as any)._id;
                return (
                  <option key={cId} value={cId} className="bg-slate-900 text-white">
                    {c.name} ({c.gradeLevel} - {c.section || 'General'})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Academic Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Mathematics / Physics"
              className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Assessment Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assessment Title</label>
            <input
              type="text"
              value={assessmentTitle}
              onChange={(e) => setAssessmentTitle(e.target.value)}
              placeholder="e.g. Mid-Term Examination 2026"
              className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Search Student in Grid */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Filter Student</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search name or roll..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Max Marks Configuration */}
        <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-slate-400 font-medium">Configured Maximum Thresholds:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Assignment:</span>
              <input
                type="number"
                min="0"
                value={maxAssignmentMarks}
                onChange={(e) => setMaxAssignmentMarks(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 text-xs rounded bg-black/40 border border-white/15 text-white font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Exam:</span>
              <input
                type="number"
                min="0"
                value={maxExamMarks}
                onChange={(e) => setMaxExamMarks(Math.max(1, Number(e.target.value)))}
                className="w-16 px-2 py-1 text-xs rounded bg-black/40 border border-white/15 text-white font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Internal:</span>
              <input
                type="number"
                min="0"
                value={maxInternalMarks}
                onChange={(e) => setMaxInternalMarks(Math.max(0, Number(e.target.value)))}
                className="w-16 px-2 py-1 text-xs rounded bg-black/40 border border-white/15 text-white font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-purple-300 font-bold">
              Total Max: {calculatedMaxTotal} Pts
            </span>
            {hasUnsavedChanges && (
              <span className="text-amber-400 text-[11px] flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
                Unsaved edits
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white">Student Marks Register</h2>
            <span className="text-xs text-purple-300 px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 font-mono">
              {rows.length} Enrolled Students
            </span>
          </div>

          {isLoading && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Loading saved marks...
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-white/[0.02]">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 w-28">Roll No</th>
                <th className="py-3 px-4 min-w-[160px]">Student Name</th>
                <th className="py-3 px-4 w-32 text-right">
                  Assignment <span className="text-[10px] text-slate-500 font-mono">({maxAssignmentMarks})</span>
                </th>
                <th className="py-3 px-4 w-32 text-right">
                  Exam / Test <span className="text-[10px] text-slate-500 font-mono">({maxExamMarks})</span>
                </th>
                <th className="py-3 px-4 w-32 text-right">
                  Internal <span className="text-[10px] text-slate-500 font-mono">({maxInternalMarks})</span>
                </th>
                <th className="py-3 px-4 w-28 text-right font-mono">Total ({calculatedMaxTotal})</th>
                <th className="py-3 px-4 w-24 text-right font-mono">Pct (%)</th>
                <th className="py-3 px-4 w-20 text-center">Grade</th>
                <th className="py-3 px-4 min-w-[200px]">Remarks / Feedback</th>
                <th className="py-3 px-4 w-20 text-center">Publish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 font-sans">
              {filteredRows.length > 0 ? (
                filteredRows.map((row, idx) => {
                  return (
                    <tr
                      key={row.studentId}
                      className={`hover:bg-white/[0.02] transition-colors ${
                        row.hasError ? 'bg-red-500/10' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 text-center text-slate-500 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-white">{row.rollNumber}</td>
                      <td className="py-2.5 px-4 text-white font-medium">{row.studentName}</td>

                      {/* Assignment Marks */}
                      <td className="py-2 px-4 text-right">
                        <input
                          type="number"
                          min="0"
                          max={maxAssignmentMarks}
                          value={row.assignmentMarks}
                          onChange={(e) => handleMarkChange(idx, 'assignmentMarks', e.target.value)}
                          className={`w-20 px-2 py-1 text-xs text-right rounded-lg bg-black/40 border font-mono focus:outline-none ${
                            Number(row.assignmentMarks) > maxAssignmentMarks
                              ? 'border-red-500 text-red-300'
                              : 'border-white/15 text-white focus:border-purple-500'
                          }`}
                        />
                      </td>

                      {/* Exam Marks */}
                      <td className="py-2 px-4 text-right">
                        <input
                          type="number"
                          min="0"
                          max={maxExamMarks}
                          value={row.examMarks}
                          onChange={(e) => handleMarkChange(idx, 'examMarks', e.target.value)}
                          className={`w-20 px-2 py-1 text-xs text-right rounded-lg bg-black/40 border font-mono focus:outline-none ${
                            Number(row.examMarks) > maxExamMarks
                              ? 'border-red-500 text-red-300'
                              : 'border-white/15 text-white focus:border-purple-500'
                          }`}
                        />
                      </td>

                      {/* Internal Marks */}
                      <td className="py-2 px-4 text-right">
                        <input
                          type="number"
                          min="0"
                          max={maxInternalMarks}
                          value={row.internalMarks}
                          onChange={(e) => handleMarkChange(idx, 'internalMarks', e.target.value)}
                          className={`w-20 px-2 py-1 text-xs text-right rounded-lg bg-black/40 border font-mono focus:outline-none ${
                            Number(row.internalMarks) > maxInternalMarks
                              ? 'border-red-500 text-red-300'
                              : 'border-white/15 text-white focus:border-purple-500'
                          }`}
                        />
                      </td>

                      {/* Computed Total */}
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-white">
                        {row.totalMarks}
                      </td>

                      {/* Computed Percentage */}
                      <td className="py-2.5 px-4 text-right font-mono text-purple-300 font-bold">
                        {row.percentage}%
                      </td>

                      {/* Grade Badge */}
                      <td className="py-2.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            row.grade.startsWith('A')
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : row.grade.startsWith('B')
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : row.grade.startsWith('C') || row.grade.startsWith('D')
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {row.grade}
                        </span>
                      </td>

                      {/* Remarks */}
                      <td className="py-2 px-4">
                        <input
                          type="text"
                          value={row.teacherFeedback}
                          onChange={(e) => handleMarkChange(idx, 'teacherFeedback', e.target.value)}
                          placeholder="Feedback remarks..."
                          className="w-full px-2.5 py-1 text-xs rounded-lg bg-black/40 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                        />
                        {row.errorMessage && (
                          <div className="text-[10px] text-red-400 mt-0.5">{row.errorMessage}</div>
                        )}
                      </td>

                      {/* Publish checkbox */}
                      <td className="py-2.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={row.isPublished}
                          onChange={(e) => handleMarkChange(idx, 'isPublished', e.target.checked)}
                          className="rounded border-white/20 text-purple-600 focus:ring-0 cursor-pointer"
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-xs text-slate-500">
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" /> Loading class roster and marks...
                      </span>
                    ) : classStudents.length === 0 ? (
                      <div className="space-y-2">
                        <p>No students enrolled in this class cohort yet.</p>
                        <p className="text-[11px] text-purple-400">
                          Use the "Student Roster Import" tab to upload students via CSV or Excel file.
                        </p>
                      </div>
                    ) : (
                      'No students matched your search query.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
