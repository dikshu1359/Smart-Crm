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
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'students' | 'teachers' | 'attendance'>('overview');

  // Filters for Student Roster
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStandingFilter, setSelectedStandingFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceClassFilter, setAttendanceClassFilter] = useState('all');

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
          {/* Institutional Attendance Metrics */}
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
              <span className="text-xs text-emerald-300 block mb-1">Total Present Records</span>
              <span className="text-3xl font-extrabold font-mono text-emerald-400">
                {attendanceSummary?.metrics?.totalPresentCount ?? 0}
              </span>
            </div>
            <div className="p-5 rounded-2xl bg-rose-950/20 border border-rose-500/20">
              <span className="text-xs text-rose-300 block mb-1">Total Absent Records</span>
              <span className="text-3xl font-extrabold font-mono text-rose-400">
                {attendanceSummary?.metrics?.totalAbsentCount ?? 0}
              </span>
            </div>
          </div>

          {/* Class Cohort Attendance Breakdown Table */}
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                <span>Class Cohort Attendance Breakdown</span>
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Grade Level &amp; Section</th>
                    <th className="py-3 px-4">Enrolled Students</th>
                    <th className="py-3 px-4">Recorded Sessions</th>
                    <th className="py-3 px-4">Average Attendance Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {classes.map((c) => {
                    const classSessions = attendanceSessions.filter(
                      (s) => String(s.classId) === String(c.id || (c as any)._id)
                    );
                    let pTotal = 0;
                    let stTotal = 0;
                    classSessions.forEach((s) => {
                      pTotal += s.presentCount || 0;
                      stTotal += s.totalStudents || 0;
                    });
                    const rate = stTotal > 0 ? Math.round((pTotal / stTotal) * 100) : 100;

                    return (
                      <tr key={c.id || (c as any)._id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-semibold text-white">{c.name}</td>
                        <td className="py-3 px-4 text-slate-300">
                          {c.gradeLevel} - {c.section}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          {c.studentIds?.length || 0}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">{classSessions.length}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`font-mono font-bold ${
                              rate >= 80 ? 'text-emerald-400' : rate >= 65 ? 'text-amber-400' : 'text-rose-400'
                            }`}
                          >
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

          {/* Low Attendance Critical Alerts */}
          {attendanceSummary?.lowAttendanceStudents && attendanceSummary.lowAttendanceStudents.length > 0 && (
            <div className="p-6 rounded-3xl bg-rose-950/20 border border-rose-500/20 space-y-4 shadow-xl">
              <h2 className="text-base font-bold text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <span>Attendance Alerts: Students Below 75% Threshold</span>
              </h2>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {attendanceSummary.lowAttendanceStudents.map((st: any) => (
                      <tr key={st.studentId} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-semibold text-white">{st.studentName}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{st.rollNumber}</td>
                        <td className="py-3 px-4 font-mono text-slate-300">{st.totalClasses}</td>
                        <td className="py-3 px-4 font-mono text-emerald-400">{st.presentCount}</td>
                        <td className="py-3 px-4 font-mono text-rose-400">{st.absentCount}</td>
                        <td className="py-3 px-4 font-mono font-bold text-rose-400">{st.percentage}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PerformanceAnalytics;
