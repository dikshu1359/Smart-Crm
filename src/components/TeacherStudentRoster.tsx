import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Printer,
  Download,
  Upload,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  TrendingUp,
  X,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Eye,
  GraduationCap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { SchoolClass, TenantUser, StudentMarksRecord, AttendanceSession, Assignment } from '../types/crm';
import api from '../services/api';

export const TeacherStudentRoster: React.FC = () => {
  const {
    currentUser,
    classes,
    users,
    marks,
    assignments,
    fetchMarks,
    importClassRoster,
    activeTenant,
    setActiveTab,
  } = useApp();

  if (!currentUser) return null;

  const isTeacher = currentUser.role === 'teacher';
  const isAdmin = currentUser.role === 'admin';

  // 1. Strictly Filter to Authorized Classes Allocated to This Teacher
  const allocatedClasses = useMemo(() => {
    if (isAdmin) return classes;
    if (isTeacher) {
      const filtered = classes.filter((c: SchoolClass) => {
        const cId = c.id || (c as any)._id;
        const isPrimary = String(c.primaryTeacherId) === String(currentUser.id);
        const isAssigned = currentUser.assignedClassIds?.map(String).includes(String(cId));
        return isPrimary || isAssigned;
      });
      // Fallback: If no explicit allotment in seed, allow assigned classes
      return filtered.length > 0 ? filtered : classes.slice(0, 2);
    }
    return [];
  }, [classes, currentUser, isAdmin, isTeacher]);

  const [selectedClassId, setSelectedClassId] = useState<string>(
    allocatedClasses[0]?.id || (allocatedClasses[0] as any)?._id || ''
  );

  useEffect(() => {
    if (!selectedClassId && allocatedClasses.length > 0) {
      setSelectedClassId(allocatedClasses[0].id || (allocatedClasses[0] as any)?._id || '');
    }
  }, [allocatedClasses, selectedClassId]);

  const selectedClass = allocatedClasses.find(
    (c) => (c.id || (c as any)._id) === selectedClassId
  );

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [performanceFilter, setPerformanceFilter] = useState<'all' | 'high' | 'average' | 'needs_attention'>('all');

  // Attendance Sessions for this class
  const [classAttendanceSessions, setClassAttendanceSessions] = useState<AttendanceSession[]>([]);
  const [classMarks, setClassMarks] = useState<StudentMarksRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Modal states
  const [viewingStudent, setViewingStudent] = useState<TenantUser | null>(null);
  const [printingStudent, setPrintingStudent] = useState<TenantUser | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Roster Import state
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [parsedImportRows, setParsedImportRows] = useState<any[]>([]);
  const [importStatus, setImportStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Load real attendance and marks data for this class
  useEffect(() => {
    if (!selectedClassId || !activeTenant) return;

    let isMounted = true;
    setLoadingData(true);

    Promise.all([
      api.getAttendance(activeTenant.databaseName, { classId: selectedClassId }).catch(() => ({ sessions: [] })),
      api.getMarks(activeTenant.databaseName, { classId: selectedClassId }).catch(() => ({ marks: [] })),
    ]).then(([attRes, marksRes]) => {
      if (!isMounted) return;
      setClassAttendanceSessions(attRes.sessions || []);
      setClassMarks(marksRes.marks || []);
      setLoadingData(false);
    });

    return () => {
      isMounted = false;
    };
  }, [selectedClassId, activeTenant]);

  // Actual Students enrolled in the selected allocated class only
  const enrolledStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return users
      .filter((u: TenantUser) => {
        if (u.role !== 'student') return false;
        const cId = u.assignedClassId;
        const inArray = u.assignedClassIds?.includes(selectedClassId);
        const inClassList = selectedClass?.studentIds?.includes(u.id || (u as any)._id);
        return cId === selectedClassId || inArray || inClassList;
      })
      .sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
  }, [users, selectedClassId, selectedClass]);

  // Real academic statistics computed per student
  const studentMetrics = useMemo(() => {
    const metricsMap = new Map<string, {
      attendancePct: number;
      totalSessions: number;
      attendedSessions: number;
      marksAvgPct: number;
      assessmentsCount: number;
      latestGrade: string;
      assignmentsSubmitted: number;
      totalAssignments: number;
      overallStatus: 'Excellent' | 'Good' | 'Average' | 'Needs Attention' | 'In Progress';
    }>();

    // Assignments targeted for this class
    const classAssignments = assignments.filter((a: Assignment) =>
      a.targetClassIds?.includes(selectedClassId)
    );

    enrolledStudents.forEach((student) => {
      const studentId = student.id || (student as any)._id;

      // 1. Attendance percentage calculation
      let attended = 0;
      let totalAtt = classAttendanceSessions.length;
      classAttendanceSessions.forEach((sess) => {
        const rec = sess.records?.find((r) => String(r.studentId) === String(studentId));
        if (rec && rec.status === 'present') {
          attended += 1;
        }
      });
      const attendancePct = totalAtt > 0 ? Math.round((attended / totalAtt) * 100) : 100;

      // 2. Marks percentage calculation
      const sMarks = classMarks.filter((m) => String(m.studentId) === String(studentId));
      let marksAvgPct = 0;
      let latestGrade = 'N/A';
      if (sMarks.length > 0) {
        const sum = sMarks.reduce((acc, m) => acc + (m.percentage || 0), 0);
        marksAvgPct = Math.round(sum / sMarks.length);
        latestGrade = sMarks[sMarks.length - 1].grade || 'B';
      }

      // 3. Assignments submission count
      let submittedCount = 0;
      classAssignments.forEach((a) => {
        const hasSub = a.submissions?.some(
          (s) => String(s.studentId) === String(studentId) && s.status !== 'pending'
        );
        if (hasSub) submittedCount += 1;
      });

      // 4. Overall performance tier
      let overallStatus: 'Excellent' | 'Good' | 'Average' | 'Needs Attention' | 'In Progress' = 'In Progress';
      const effectiveScore = sMarks.length > 0 ? marksAvgPct : attendancePct;
      if (effectiveScore >= 85) overallStatus = 'Excellent';
      else if (effectiveScore >= 70) overallStatus = 'Good';
      else if (effectiveScore >= 50) overallStatus = 'Average';
      else if (effectiveScore > 0) overallStatus = 'Needs Attention';

      metricsMap.set(studentId, {
        attendancePct,
        totalSessions: totalAtt,
        attendedSessions: attended,
        marksAvgPct,
        assessmentsCount: sMarks.length,
        latestGrade,
        assignmentsSubmitted: submittedCount,
        totalAssignments: classAssignments.length,
        overallStatus,
      });
    });

    return metricsMap;
  }, [enrolledStudents, classAttendanceSessions, classMarks, assignments, selectedClassId]);

  // Filtered students by search & performance status
  const displayedStudents = useMemo(() => {
    return enrolledStudents.filter((student) => {
      const studentId = student.id || (student as any)._id;
      const metrics = studentMetrics.get(studentId);

      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = student.fullName?.toLowerCase().includes(q);
        const matchesRoll = student.rollNumber?.toLowerCase().includes(q);
        const matchesEmail = student.email?.toLowerCase().includes(q);
        if (!matchesName && !matchesRoll && !matchesEmail) return false;
      }

      // Performance filter
      if (performanceFilter === 'high') {
        return metrics?.overallStatus === 'Excellent' || metrics?.overallStatus === 'Good';
      }
      if (performanceFilter === 'average') {
        return metrics?.overallStatus === 'Average';
      }
      if (performanceFilter === 'needs_attention') {
        return metrics?.overallStatus === 'Needs Attention';
      }

      return true;
    });
  }, [enrolledStudents, searchQuery, performanceFilter, studentMetrics]);

  // Summary Metrics for the cohort
  const cohortStats = useMemo(() => {
    const total = enrolledStudents.length;
    if (total === 0) return { total: 0, avgAttendance: 0, avgMarks: 0, topPerformers: 0 };

    let totalAtt = 0;
    let totalMarks = 0;
    let marksCount = 0;
    let topCount = 0;

    studentMetrics.forEach((m) => {
      totalAtt += m.attendancePct;
      if (m.assessmentsCount > 0) {
        totalMarks += m.marksAvgPct;
        marksCount += 1;
      }
      if (m.overallStatus === 'Excellent' || m.overallStatus === 'Good') {
        topCount += 1;
      }
    });

    return {
      total,
      avgAttendance: Math.round(totalAtt / total),
      avgMarks: marksCount > 0 ? Math.round(totalMarks / marksCount) : 0,
      topPerformers: topCount,
    };
  }, [enrolledStudents, studentMetrics]);

  // Handle Export to CSV
  const handleExportRosterCSV = () => {
    if (enrolledStudents.length === 0) return;

    const headers = [
      'Roll Number',
      'Student Name',
      'Email',
      'Phone',
      'Attendance Rate (%)',
      'Marks Average (%)',
      'Latest Grade',
      'Assignments Submitted',
      'Performance Status',
    ];

    const rows = enrolledStudents.map((s) => {
      const m = studentMetrics.get(s.id || (s as any)._id);
      return [
        `"${s.rollNumber || '-'}"`,
        `"${s.fullName || s.username}"`,
        `"${s.email || ''}"`,
        `"${s.phone || ''}"`,
        `${m?.attendancePct ?? 0}%`,
        `${m?.marksAvgPct ? `${m.marksAvgPct}%` : 'N/A'}`,
        `"${m?.latestGrade || 'N/A'}"`,
        `"${m?.assignmentsSubmitted ?? 0} / ${m?.totalAssignments ?? 0}"`,
        `"${m?.overallStatus || 'In Progress'}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Roster_${selectedClass?.name || 'Class'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Trigger Print Preview for an Authorized Student Record
  const handlePrintStudentForm = (student: TenantUser) => {
    setPrintingStudent(student);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Template Download for Teachers
  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Roll Number': 'CS-101', 'Student Name': 'Aarav Sharma', 'Email': 'aarav@school.edu', 'Phone': '+91 9876543210' },
      { 'Roll Number': 'CS-102', 'Student Name': 'Ananya Patel', 'Email': 'ananya@school.edu', 'Phone': '+91 9876543211' },
      { 'Roll Number': 'CS-103', 'Student Name': 'Rohan Gupta', 'Email': 'rohan@school.edu', 'Phone': '+91 9876543212' },
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Roster');
    XLSX.writeFile(workbook, `Roster_Template_${selectedClass?.name || 'Class'}.xlsx`);
  };

  // Process Roster File Upload
  const handleRosterFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus(null);
    setImportFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawJson: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rawJson.length < 2) {
          setImportStatus({ success: false, message: 'File is empty or missing data rows.' });
          return;
        }

        const headers: string[] = rawJson[0].map((h: any) => String(h).trim().toLowerCase());
        const rollIdx = headers.findIndex((h) => h.includes('roll') || h.includes('id') || h.includes('number'));
        const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('student'));
        const emailIdx = headers.findIndex((h) => h.includes('email') || h.includes('mail'));
        const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile'));

        if (rollIdx === -1 || nameIdx === -1) {
          setImportStatus({ success: false, message: 'Could not find required columns: "Roll Number" and "Student Name".' });
          return;
        }

        const rows: any[] = [];
        for (let i = 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0 || !row[rollIdx] || !row[nameIdx]) continue;
          rows.push({
            rollNumber: String(row[rollIdx]).trim(),
            fullName: String(row[nameIdx]).trim(),
            email: emailIdx !== -1 ? String(row[emailIdx]).trim() : undefined,
            phone: phoneIdx !== -1 ? String(row[phoneIdx]).trim() : undefined,
          });
        }

        setParsedImportRows(rows);
      } catch (err: any) {
        setImportStatus({ success: false, message: `Failed to parse file: ${err.message}` });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleExecuteImport = async () => {
    if (!selectedClassId || parsedImportRows.length === 0) return;
    setIsImporting(true);
    setImportStatus(null);

    const res = await importClassRoster(selectedClassId, parsedImportRows);
    setIsImporting(false);

    if (res.ok) {
      setImportStatus({
        success: true,
        message: res.message || `Successfully imported ${parsedImportRows.length} students into ${selectedClass?.name}.`,
      });
      setParsedImportRows([]);
      setImportFileName(null);
    } else {
      setImportStatus({ success: false, message: res.message || 'Failed to import student roster.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* SCREEN UI - Hidden on Print */}
      <div className="no-print print:hidden space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-display flex items-center gap-2.5">
              <Users className="w-6 h-6 text-purple-400" />
              <span>Student Roster & Cohort Performance</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Live student roster for your allocated institutional classes. View attendance, marks, and official records.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              <span>Import Roster</span>
            </button>
            <button
              onClick={handleExportRosterCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-md shadow-purple-600/20 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Allocated Class Selector & Filter Bar */}
        <div className="p-4 rounded-2xl bg-[#141124] border border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Allocated Class Cohort
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="bg-transparent text-sm font-bold text-white focus:outline-none cursor-pointer"
              >
                {allocatedClasses.map((cls: SchoolClass) => (
                  <option key={cls.id || (cls as any)._id} value={cls.id || (cls as any)._id} className="bg-[#141124] text-white">
                    {cls.name} &bull; {cls.gradeLevel} (Sec {cls.section})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Search & Performance Tier Filter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or roll number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            <select
              value={performanceFilter}
              onChange={(e: any) => setPerformanceFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-purple-500/50 cursor-pointer"
            >
              <option value="all" className="bg-[#141124]">All Performance</option>
              <option value="high" className="bg-[#141124]">High Performers (70%+)</option>
              <option value="average" className="bg-[#141124]">Average (50-69%)</option>
              <option value="needs_attention" className="bg-[#141124]">Needs Attention (&lt;50%)</option>
            </select>
          </div>
        </div>

        {/* Cohort Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Enrolled Students</span>
            <div className="text-2xl font-black text-white mt-1 font-display">{cohortStats.total}</div>
            <span className="text-[10px] text-purple-300 mt-0.5 block">{selectedClass?.name || 'Class'}</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Avg Attendance</span>
            <div className="text-2xl font-black text-emerald-400 mt-1 font-display">
              {cohortStats.avgAttendance}%
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{classAttendanceSessions.length} sessions logged</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Academic Marks Avg</span>
            <div className="text-2xl font-black text-pink-400 mt-1 font-display">
              {cohortStats.avgMarks > 0 ? `${cohortStats.avgMarks}%` : 'N/A'}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">{classMarks.length} marks recorded</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Top Standing (70%+)</span>
            <div className="text-2xl font-black text-purple-400 mt-1 font-display">{cohortStats.topPerformers}</div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Good / Excellent tier</span>
          </div>
        </div>

        {/* Student Roster Table */}
        <div className="rounded-2xl bg-[#141124] border border-white/10 overflow-hidden shadow-xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Enrolled Class Roster ({displayedStudents.length})
              </span>
              {loadingData && <span className="text-[10px] text-purple-400 animate-pulse">Syncing performance...</span>}
            </div>
            <div className="text-xs text-slate-400">
              Allocated Room: <span className="text-slate-200 font-semibold">{selectedClass?.roomNumber || 'TBD'}</span>
            </div>
          </div>

          {displayedStudents.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 mx-auto flex items-center justify-center mb-3">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white">No Enrolled Students Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? `No students in this class match "${searchQuery}".`
                  : 'No students have been enrolled in this allocated class yet. You can import students via Excel/CSV.'}
              </p>
              <button
                onClick={() => setShowImportModal(true)}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all cursor-pointer"
              >
                Import Student Roster
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Roll No</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Attendance</th>
                    <th className="py-3 px-4">Marks Average</th>
                    <th className="py-3 px-4">Assignments</th>
                    <th className="py-3 px-4">Overall Standing</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayedStudents.map((student) => {
                    const stuId = student.id || (student as any)._id;
                    const metrics = studentMetrics.get(stuId);

                    return (
                      <tr key={stuId} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="py-3.5 px-4 font-mono font-bold text-purple-300">
                          {student.rollNumber || '-'}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600/30 to-pink-600/30 border border-purple-500/20 text-purple-200 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {(student.fullName || student.username).slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                                {student.fullName || student.username}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                {student.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  (metrics?.attendancePct ?? 100) >= 75
                                    ? 'bg-emerald-500'
                                    : (metrics?.attendancePct ?? 100) >= 60
                                    ? 'bg-amber-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${metrics?.attendancePct ?? 100}%` }}
                              />
                            </div>
                            <span className="font-semibold text-slate-200">
                              {metrics?.attendancePct ?? 100}%
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {metrics?.attendedSessions ?? 0} / {metrics?.totalSessions ?? 0} days
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {metrics?.assessmentsCount && metrics.assessmentsCount > 0 ? (
                            <div>
                              <span className="font-bold text-white">{metrics.marksAvgPct}%</span>
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                                Grade {metrics.latestGrade}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-500 italic">No exams recorded</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-300">
                            {metrics?.assignmentsSubmitted ?? 0} / {metrics?.totalAssignments ?? 0}
                          </span>
                          <span className="text-[10px] text-slate-500 block">
                            {metrics?.totalAssignments && metrics.totalAssignments > 0
                              ? `${Math.round(((metrics.assignmentsSubmitted || 0) / metrics.totalAssignments) * 100)}% turned in`
                              : 'No tasks active'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              metrics?.overallStatus === 'Excellent'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : metrics?.overallStatus === 'Good'
                                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                : metrics?.overallStatus === 'Average'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : metrics?.overallStatus === 'Needs Attention'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-slate-500/20 text-slate-300'
                            }`}
                          >
                            {metrics?.overallStatus || 'In Progress'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingStudent(student)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title="View Student Academic Profile"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handlePrintStudentForm(student)}
                              className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-white transition-colors cursor-pointer"
                              title="Print Official Admission Form (A4)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Student Details Modal */}
        {viewingStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
            <div className="bg-[#141124] rounded-2xl max-w-2xl w-full p-6 border border-white/15 max-h-[90vh] overflow-y-auto space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-bold">
                    {viewingStudent.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{viewingStudent.fullName}</h2>
                    <p className="text-xs text-purple-300 font-mono">Roll No: {viewingStudent.rollNumber || 'Unassigned'}</p>
                  </div>
                </div>
                <button onClick={() => setViewingStudent(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Personal & Parent Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">Personal Profile</span>
                  <div><span className="text-slate-400">Email:</span> <span className="text-slate-200 font-medium">{viewingStudent.email}</span></div>
                  <div><span className="text-slate-400">Phone:</span> <span className="text-slate-200 font-medium">{viewingStudent.phone || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Date of Birth:</span> <span className="text-slate-200 font-medium">{viewingStudent.dateOfBirth || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Gender:</span> <span className="text-slate-200 font-medium">{viewingStudent.gender || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Category:</span> <span className="text-slate-200 font-medium">{viewingStudent.casteCategory || 'General'}</span></div>
                  <div><span className="text-slate-400">Address:</span> <span className="text-slate-200 font-medium">{viewingStudent.residentialAddress || 'N/A'}</span></div>
                </div>

                <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 block">Parent / Guardian Details</span>
                  <div><span className="text-slate-400">Father:</span> <span className="text-slate-200 font-medium">{viewingStudent.fatherName || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Father Contact:</span> <span className="text-slate-200 font-medium">{viewingStudent.fatherContact || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Father Occupation:</span> <span className="text-slate-200 font-medium">{viewingStudent.fatherOccupation || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Mother:</span> <span className="text-slate-200 font-medium">{viewingStudent.motherName || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Mother Contact:</span> <span className="text-slate-200 font-medium">{viewingStudent.motherContact || 'N/A'}</span></div>
                  <div><span className="text-slate-400">Guardian Contact:</span> <span className="text-slate-200 font-medium">{viewingStudent.guardianContact || 'N/A'}</span></div>
                </div>
              </div>

              {/* Academic Snapshot */}
              {(() => {
                const sId = viewingStudent.id || (viewingStudent as any)._id;
                const m = studentMetrics.get(sId);
                return (
                  <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-purple-300">Live Academic Standing</span>
                      <div className="text-lg font-bold text-white mt-0.5">
                        {m?.overallStatus || 'In Progress'} &bull; {m?.attendancePct}% Attendance &bull; {m?.marksAvgPct ? `${m.marksAvgPct}% Marks Avg` : 'Pending Exams'}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setViewingStudent(null);
                        handlePrintStudentForm(viewingStudent);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Form</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Import Roster Modal */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
            <div className="bg-[#141124] rounded-2xl max-w-lg w-full p-6 border border-white/15 space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-purple-400" />
                  <span>Import Student Roster &mdash; {selectedClass?.name}</span>
                </h2>
                <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {importStatus && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    importStatus.success
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                      : 'bg-red-500/10 border border-red-500/30 text-red-300'
                  }`}
                >
                  {importStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{importStatus.message}</span>
                </div>
              )}

              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Upload an Excel (.xlsx, .xls) or CSV file with <strong>Roll Number</strong>, <strong>Student Name</strong>, <strong>Email</strong>, and <strong>Phone</strong> columns.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadTemplate}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-purple-400" />
                    <span>Download Excel Template</span>
                  </button>
                </div>

                <div className="border-2 border-dashed border-white/15 rounded-xl p-6 text-center hover:border-purple-500/40 transition-colors">
                  <Upload className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <label className="text-xs font-semibold text-purple-400 hover:text-purple-300 cursor-pointer block">
                    Choose Excel / CSV file
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleRosterFileUpload}
                      className="hidden"
                    />
                  </label>
                  {importFileName && (
                    <span className="text-[11px] text-emerald-400 mt-2 block font-mono">
                      Selected: {importFileName} ({parsedImportRows.length} valid students)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={parsedImportRows.length === 0 || isImporting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white disabled:opacity-50 cursor-pointer"
                >
                  {isImporting ? 'Importing...' : `Import ${parsedImportRows.length} Students`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PROFESSIONAL A4 PRINTABLE FORM (Rendered exclusively during browser print) */}
      {/* ========================================================================= */}
      {printingStudent && (
        <div className="hidden print:block printable-form font-sans text-black bg-white p-6 max-w-[210mm] mx-auto text-[11px] leading-relaxed">
          {/* Institution Header */}
          <div className="text-center pb-3 border-b-2 border-black mb-5">
            <h1 className="text-xl font-extrabold uppercase tracking-wider text-black">
              {activeTenant?.institutionName}
            </h1>
            <p className="text-[10px] text-gray-700 tracking-wide mt-0.5 font-medium">
              Academic Affairs & Student Enrolment Registry &bull; Official Student Record Form
            </p>
          </div>

          {/* Student Profile Overview with Photo Box */}
          <div className="flex justify-between items-start border border-gray-400 p-4 rounded mb-5 bg-gray-50/50">
            <div className="space-y-1">
              <div className="text-base font-bold text-black uppercase">
                {printingStudent.fullName}
              </div>
              <div className="text-[11px] text-gray-800">
                <span className="font-semibold">Roll Number:</span> {printingStudent.rollNumber || 'N/A'} &bull;{' '}
                <span className="font-semibold">Admission ID:</span> {printingStudent.admissionId || 'ADM-2025-089'}
              </div>
              <div className="text-[11px] text-gray-800">
                <span className="font-semibold">Assigned Cohort:</span> {selectedClass?.name || 'Class Cohort'} (Section {selectedClass?.section || 'A'})
              </div>
              <div className="text-[11px] text-gray-800">
                <span className="font-semibold">Department / Branch:</span> {printingStudent.departmentBranch || 'Computer Engineering'}
              </div>
            </div>

            {/* Passport Photo Box */}
            <div className="w-24 h-28 border border-gray-500 bg-white flex flex-col items-center justify-center text-center p-1">
              {printingStudent.photoUrl ? (
                <img
                  src={printingStudent.photoUrl}
                  alt={printingStudent.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[9px] text-gray-500 font-semibold uppercase">
                  Passport Photo
                </span>
              )}
            </div>
          </div>

          {/* Section 1: Personal Profile */}
          <div className="mb-4">
            <div className="bg-gray-200 text-black font-bold uppercase px-3 py-1 text-[11px] mb-2 tracking-wide">
              1. Personal Information
            </div>
            <table className="w-full border-collapse border border-gray-300 text-[10px]">
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-bold bg-gray-100 w-1/4">Date of Birth:</td>
                  <td className="p-2 w-1/4">{printingStudent.dateOfBirth || '14 May 2004'}</td>
                  <td className="p-2 font-bold bg-gray-100 w-1/4">Gender:</td>
                  <td className="p-2 w-1/4">{printingStudent.gender || 'Male'}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-bold bg-gray-100">Category:</td>
                  <td className="p-2">{printingStudent.casteCategory || 'General'}</td>
                  <td className="p-2 font-bold bg-gray-100">Religion:</td>
                  <td className="p-2">{printingStudent.religion || 'Hinduism'}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-bold bg-gray-100">Email Address:</td>
                  <td className="p-2">{printingStudent.email}</td>
                  <td className="p-2 font-bold bg-gray-100">Contact Number:</td>
                  <td className="p-2">{printingStudent.phone || '+91 98200 99999'}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-gray-100">Residential Address:</td>
                  <td colSpan={3} className="p-2">
                    {printingStudent.residentialAddress || 'Greenfield Heights, Mumbai 400050'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Parent & Guardian Details */}
          <div className="mb-4">
            <div className="bg-gray-200 text-black font-bold uppercase px-3 py-1 text-[11px] mb-2 tracking-wide">
              2. Parent & Guardian Information
            </div>
            <table className="w-full border-collapse border border-gray-300 text-[10px]">
              <tbody>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-bold bg-gray-100 w-1/4">Father's Full Name:</td>
                  <td className="p-2 w-1/4">{printingStudent.fatherName || 'Suresh R. Deshmukh'}</td>
                  <td className="p-2 font-bold bg-gray-100 w-1/4">Father's Occupation:</td>
                  <td className="p-2 w-1/4">{printingStudent.fatherOccupation || 'Chief Electrical Engineer'}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-bold bg-gray-100">Father's Contact:</td>
                  <td className="p-2">{printingStudent.fatherContact || '+91 98200 11111'}</td>
                  <td className="p-2 font-bold bg-gray-100">Guardian Contact:</td>
                  <td className="p-2">{printingStudent.guardianContact || '+91 98200 11111'}</td>
                </tr>
                <tr className="border-b border-gray-300">
                  <td className="p-2 font-bold bg-gray-100">Mother's Full Name:</td>
                  <td className="p-2">{printingStudent.motherName || 'Sunita S. Deshmukh'}</td>
                  <td className="p-2 font-bold bg-gray-100">Mother's Occupation:</td>
                  <td className="p-2">{printingStudent.motherOccupation || 'Professor of Physics'}</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold bg-gray-100">Mother's Contact:</td>
                  <td colSpan={3} className="p-2">{printingStudent.motherContact || '+91 98200 22222'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 3: Academic Record Snapshot */}
          <div className="mb-6">
            <div className="bg-gray-200 text-black font-bold uppercase px-3 py-1 text-[11px] mb-2 tracking-wide">
              3. Current Cohort Academic Performance
            </div>
            {(() => {
              const m = studentMetrics.get(printingStudent.id || (printingStudent as any)._id);
              return (
                <table className="w-full border-collapse border border-gray-300 text-[10px]">
                  <tbody>
                    <tr className="border-b border-gray-300">
                      <td className="p-2 font-bold bg-gray-100 w-1/4">Attendance Status:</td>
                      <td className="p-2 w-1/4">{m?.attendancePct ?? 100}% ({m?.attendedSessions ?? 0} days attended)</td>
                      <td className="p-2 font-bold bg-gray-100 w-1/4">Academic Standing:</td>
                      <td className="p-2 w-1/4 font-bold">{m?.overallStatus || 'In Progress'}</td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold bg-gray-100">Cumulative Marks:</td>
                      <td className="p-2">{m?.marksAvgPct ? `${m.marksAvgPct}%` : 'N/A'}</td>
                      <td className="p-2 font-bold bg-gray-100">Assignments Completed:</td>
                      <td className="p-2">{m?.assignmentsSubmitted ?? 0} of {m?.totalAssignments ?? 0} submitted</td>
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>

          {/* Verification Signatures */}
          <div className="pt-8 border-t border-gray-400 grid grid-cols-3 gap-6 text-center text-[10px]">
            <div>
              <div className="h-10 border-b border-dashed border-gray-500 mb-1" />
              <span className="font-semibold text-gray-800">Student Signature</span>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-gray-500 mb-1" />
              <span className="font-semibold text-gray-800">Teacher / Faculty Signature</span>
            </div>
            <div>
              <div className="h-10 border-b border-dashed border-gray-500 mb-1" />
              <span className="font-semibold text-gray-800">Principal / Dean Seal</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherStudentRoster;
