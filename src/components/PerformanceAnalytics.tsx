import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Users,
  GraduationCap,
  CalendarCheck2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Filter,
  Search,
  BookOpen,
  Calendar,
  Save,
  Check,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const PerformanceAnalytics: React.FC = () => {
  const {
    activeTenant,
    currentUser,
    classes,
    users,
    analytics,
    attendanceSummary,
    attendanceSessions,
    markAttendance,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'students' | 'teachers' | 'attendance'>('overview');

  // Filters for Student Roster
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStandingFilter, setSelectedStandingFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Attendance Marking State
  const [attendanceClassId, setAttendanceClassId] = useState(() => classes[0]?.id || (classes[0] as any)?._id || '');
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState<{ [studentId: string]: 'present' | 'absent' }>({});
  const [attendanceRemarks, setAttendanceRemarks] = useState<{ [studentId: string]: string }>({});
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [attendanceSavedSuccess, setAttendanceSavedSuccess] = useState(false);

  if (!activeTenant || !currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const isTeacher = currentUser.role === 'teacher';

  const studentPerformance = analytics?.studentPerformance || [];
  const teacherPerformance = analytics?.teacherPerformance || [];
  const classPerformance = analytics?.classPerformance || [];
  const gradeDistribution = analytics?.gradeDistribution || [];
  const subjectPerformance = analytics?.subjectPerformance || [];

  // Filter students
  const filteredStudents = studentPerformance.filter((s: any) => {
    if (selectedClassFilter !== 'all' && s.classId !== selectedClassFilter) return false;
    if (selectedStandingFilter !== 'all' && s.standing !== selectedStandingFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = s.fullName.toLowerCase().includes(q);
      const matchRoll = (s.rollNumber || '').toLowerCase().includes(q);
      if (!matchName && !matchRoll) return false;
    }
    return true;
  });

  // Students belonging to attendance selected class
  const classObj = classes.find((c) => (c.id || (c as any)._id) === attendanceClassId);
  const classStudentIds = classObj?.studentIds || [];
  const enrolledStudents = users.filter((u) => u.role === 'student' && classStudentIds.includes(u.id || (u as any)._id));

  // Initialize or update attendance records when class/date changes
  const handleLoadClassAttendance = (clsId: string, dt: string) => {
    setAttendanceClassId(clsId);
    setAttendanceDate(dt);
    setAttendanceSavedSuccess(false);

    // Check if session already recorded
    const existing = attendanceSessions.find((s) => s.classId === clsId && s.date === dt);
    const initialRecords: { [id: string]: 'present' | 'absent' } = {};
    const initialRemarks: { [id: string]: string } = {};

    const cls = classes.find((c) => (c.id || (c as any)._id) === clsId);
    const stIds = cls?.studentIds || [];
    const stList = users.filter((u) => u.role === 'student' && stIds.includes(u.id || (u as any)._id));

    stList.forEach((st) => {
      const sid = st.id || (st as any)._id;
      if (existing) {
        const rec = existing.records.find((r) => r.studentId === sid);
        initialRecords[sid] = rec ? rec.status : 'present';
        initialRemarks[sid] = rec?.remarks || '';
      } else {
        initialRecords[sid] = 'present';
        initialRemarks[sid] = '';
      }
    });

    setAttendanceRecords(initialRecords);
    setAttendanceRemarks(initialRemarks);
  };

  const handleSaveAttendance = async () => {
    if (!attendanceClassId || !attendanceDate) return;
    setAttendanceSaving(true);
    setAttendanceSavedSuccess(false);

    const records = enrolledStudents.map((st) => {
      const sid = st.id || (st as any)._id;
      return {
        studentId: sid,
        studentName: st.fullName,
        rollNumber: st.rollNumber || 'N/A',
        status: attendanceRecords[sid] || 'present',
        remarks: attendanceRemarks[sid] || '',
      };
    });

    const res = await markAttendance({
      classId: attendanceClassId,
      date: attendanceDate,
      records,
    });

    setAttendanceSaving(false);
    if (res.ok) {
      setAttendanceSavedSuccess(true);
      setTimeout(() => setAttendanceSavedSuccess(false), 3000);
    } else {
      alert(res.message || 'Failed to save attendance');
    }
  };

  const COLORS = ['#A855F7', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-400">
            <BarChart3 className="w-4 h-4 text-pink-400" />
            <span>Academic Excellence &amp; Attendance Analytics</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-white mt-1">
            Performance &amp; Attendance Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Detailed tracking of grade distributions, individual student standings, faculty workload turnaround, and class attendance registers.
          </p>
        </div>

        {/* Tab selection */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1 shrink-0">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'overview' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Overview &amp; Grades
          </button>
          <button
            onClick={() => setActiveSubTab('students')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'students' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Student Roster
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveSubTab('teachers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                activeSubTab === 'teachers' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Faculty Evaluation
            </button>
          )}
          <button
            onClick={() => {
              setActiveSubTab('attendance');
              if (classes.length > 0 && !attendanceClassId) {
                handleLoadClassAttendance(classes[0].id || (classes[0] as any)._id, attendanceDate);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeSubTab === 'attendance' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Attendance Tracker
          </button>
        </div>
      </div>

      {/* SUBTAB: OVERVIEW & GRADES */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Top Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <span className="text-xs text-slate-400 block">Institutional Average</span>
              <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                {analytics?.metrics?.averageScore ?? 82}%
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Assignments &amp; Quizzes</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <span className="text-xs text-slate-400 block">Overall Attendance</span>
              <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                {attendanceSummary?.metrics?.overallRate ?? analytics?.metrics?.attendanceRate ?? 91}%
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Regularity across cohorts</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <span className="text-xs text-slate-400 block">High Performers</span>
              <div className="text-2xl font-bold font-mono text-pink-400 mt-1">
                {analytics?.metrics?.highPerformersCount ?? 0} Students
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Scored &ge; 85% Composite</span>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <span className="text-xs text-slate-400 block">Needs Attention</span>
              <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
                {analytics?.metrics?.needsAttentionCount ?? 0} Students
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">&lt; 75% Attend or &lt; 60% Marks</span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Grade Distribution Bar Chart */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
              <h2 className="text-sm font-bold text-white">Composite Grade Distribution</h2>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={gradeDistribution} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="band" stroke="#94A3B8" fontSize={11} />
                    <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#141124',
                        borderColor: 'rgba(168,85,247,0.4)',
                        color: '#fff',
                        fontSize: '12px',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="count" fill="#A855F7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Class Benchmark Comparison */}
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
              <h2 className="text-sm font-bold text-white">Class Benchmark &amp; Regularity</h2>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {classPerformance.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-500">No classes registered yet.</div>
                ) : (
                  classPerformance.map((c: any) => (
                    <div key={c.classId} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-white">{c.name} ({c.gradeLevel} - {c.section})</span>
                        <span className="font-mono text-purple-400 font-semibold">{c.averageScore}% Avg</span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>{c.studentCount} Students Enrolled</span>
                        <span className="text-emerald-400">{c.attendanceRate}% Attendance</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, c.averageScore || 0)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB: STUDENT ROSTER & RANKINGS */}
      {activeSubTab === 'students' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Class Filter */}
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all" className="bg-[#141124]">All Classes</option>
                {classes.map((c) => (
                  <option key={c.id || (c as any)._id} value={c.id || (c as any)._id} className="bg-[#141124]">
                    {c.name} ({c.gradeLevel} - {c.section})
                  </option>
                ))}
              </select>

              {/* Standing Filter */}
              <select
                value={selectedStandingFilter}
                onChange={(e) => setSelectedStandingFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all" className="bg-[#141124]">All Standings</option>
                <option value="Excellent" className="bg-[#141124]">Excellent (&ge; 85%)</option>
                <option value="Good" className="bg-[#141124]">Good (70 - 84%)</option>
                <option value="Average" className="bg-[#141124]">Average (60 - 69%)</option>
                <option value="Needs Attention" className="bg-[#141124]">Needs Attention (&lt; 60% or &lt; 75% Attend)</option>
              </select>
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="Search student or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-52"
              />
            </div>
          </div>

          {/* Student Performance Table */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-x-auto shadow-xl">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Class</th>
                  <th className="py-3 px-4 text-center">Assignments</th>
                  <th className="py-3 px-4 text-center">Quizzes Passed</th>
                  <th className="py-3 px-4 text-center">Composite Score</th>
                  <th className="py-3 px-4 text-center">Attendance</th>
                  <th className="py-3 px-4 text-right">Academic Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      No students match the selected criteria.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st: any) => {
                    const standing = st.standing || 'Good';
                    const badgeClass =
                      standing === 'Excellent'
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : standing === 'Needs Attention'
                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                        : 'bg-blue-500/15 text-blue-300 border-blue-500/30';

                    return (
                      <tr key={st.studentId} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4">
                          <div className="font-bold text-white">{st.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">Roll: {st.rollNumber}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{st.className}</td>
                        <td className="py-3 px-4 text-center font-mono">
                          {st.gradedSubmissions} / {st.totalSubmissions}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {st.quizzesPassed} / {st.quizzesAttempted}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-purple-300">
                          {st.compositeScore}%
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                          {st.attendanceRate}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass}`}>
                            {standing}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: FACULTY EVALUATION */}
      {activeSubTab === 'teachers' && isAdmin && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-x-auto shadow-xl">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.02] text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Faculty Member</th>
                <th className="py-3 px-4">Specialization</th>
                <th className="py-3 px-4 text-center">Cohorts Handled</th>
                <th className="py-3 px-4 text-center">Assignments Created</th>
                <th className="py-3 px-4 text-center">Submissions Reviewed</th>
                <th className="py-3 px-4 text-center">Turnaround Rate</th>
                <th className="py-3 px-4 text-right">Quizzes Authored</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {teacherPerformance.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No faculty members found.
                  </td>
                </tr>
              ) : (
                teacherPerformance.map((tc: any) => (
                  <tr key={tc.teacherId} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white">{tc.fullName}</div>
                      <div className="text-[11px] text-slate-400">{tc.email}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{tc.specialization}</td>
                    <td className="py-3 px-4 text-center font-mono">{tc.assignedClassCount}</td>
                    <td className="py-3 px-4 text-center font-mono">{tc.assignmentsCreated}</td>
                    <td className="py-3 px-4 text-center font-mono">
                      {tc.submissionsReviewed} / {tc.totalSubmissionsReceived}
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                      {tc.turnaroundRate}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-purple-300">
                      {tc.quizzesAuthored}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB: ATTENDANCE TRACKER & LOGGER */}
      {activeSubTab === 'attendance' && (
        <div className="space-y-6">
          {/* Class & Date Selector */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Select Class Cohort
                </label>
                <select
                  value={attendanceClassId}
                  onChange={(e) => handleLoadClassAttendance(e.target.value, attendanceDate)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {classes.map((c) => (
                    <option key={c.id || (c as any)._id} value={c.id || (c as any)._id} className="bg-[#141124]">
                      {c.name} ({c.gradeLevel} - {c.section})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Attendance Date
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => handleLoadClassAttendance(attendanceClassId, e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            {(isAdmin || isTeacher) && (
              <button
                onClick={handleSaveAttendance}
                disabled={attendanceSaving || enrolledStudents.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 shadow-md shadow-purple-600/30 cursor-pointer disabled:opacity-50"
              >
                {attendanceSavedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Attendance Saved!</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{attendanceSaving ? 'Saving...' : 'Save Attendance Register'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Student Attendance List */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-white/10 bg-white/[0.02] flex justify-between items-center text-xs">
              <span className="font-bold text-white">
                Class Register: {classObj?.name || 'Selected Class'} &middot; {enrolledStudents.length} Students
              </span>
              <div className="flex gap-4 text-xs font-mono">
                <span className="text-emerald-400 font-semibold">
                  Present: {Object.values(attendanceRecords).filter((s) => s === 'present').length}
                </span>
                <span className="text-rose-400 font-semibold">
                  Absent: {Object.values(attendanceRecords).filter((s) => s === 'absent').length}
                </span>
              </div>
            </div>

            <div className="divide-y divide-white/5">
              {enrolledStudents.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  No students allotted to this class yet.
                </div>
              ) : (
                enrolledStudents.map((st) => {
                  const sid = st.id || (st as any)._id;
                  const currentStatus = attendanceRecords[sid] || 'present';
                  return (
                    <div
                      key={sid}
                      className="p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-white/[0.01]"
                    >
                      <div>
                        <div className="text-xs font-bold text-white">{st.fullName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Roll: {st.rollNumber || 'N/A'} &middot; Username: {st.username}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <input
                          type="text"
                          placeholder="Remarks (optional)"
                          value={attendanceRemarks[sid] || ''}
                          onChange={(e) =>
                            setAttendanceRemarks({ ...attendanceRemarks, [sid]: e.target.value })
                          }
                          className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-36"
                        />

                        <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                          <button
                            type="button"
                            onClick={() => setAttendanceRecords({ ...attendanceRecords, [sid]: 'present' })}
                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              currentStatus === 'present'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Present</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAttendanceRecords({ ...attendanceRecords, [sid]: 'absent' })}
                            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                              currentStatus === 'absent'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Absent</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceAnalytics;
