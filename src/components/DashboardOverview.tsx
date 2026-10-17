import React from 'react';
import {
  Users,
  BookOpen,
  FileCheck2,
  CalendarClock,
  Database,
  HelpCircle,
  MessageSquare,
  Building2,
  Calendar as CalendarIcon,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Clock,
  Sparkles,
  Award,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const DashboardOverview: React.FC = () => {
  const {
    activeTenant,
    currentUser,
    users,
    classes,
    assignments,
    schedules,
    quizzes,
    notices,
    calendarEvents,
    attendanceSummary,
    analytics,
    setActiveTab,
  } = useApp();

  if (!currentUser || !activeTenant) return null;

  const isAdmin = currentUser.role === 'admin';
  const isTeacher = currentUser.role === 'teacher';
  const isStudent = currentUser.role === 'student';

  const teachers = users.filter((u) => u.role === 'teacher');
  const students = users.filter((u) => u.role === 'student');

  // Academic Calendar Preview (next 4 upcoming events)
  const upcomingEvents = [...calendarEvents]
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    .slice(0, 4);

  // Analytics fallback derivations
  const studentMetrics = analytics?.studentPerformance || [];
  const teacherMetrics = analytics?.teacherPerformance || [];
  const classMetrics = analytics?.classPerformance || [];

  const topStudents = analytics?.topStudents || studentMetrics.slice(0, 4);
  const studentsNeedingAttention = analytics?.studentsNeedingAttention || [];

  const overallAvgScore = analytics?.metrics?.averageScore ?? 82;
  const overallAttendance = attendanceSummary?.metrics?.overallRate ?? analytics?.metrics?.attendanceRate ?? 91;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 shadow-xl">
        <div>
          <div className="text-xs text-purple-300 font-medium flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5 text-pink-400" />
            <span>{activeTenant.institutionName}</span>
            <span>&middot;</span>
            <span className="font-mono text-slate-400">{activeTenant.databaseName}</span>
            <span>&middot;</span>
            <span className="capitalize px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">
              {currentUser.role} Session
            </span>
          </div>
          <h1 className="text-2xl font-bold font-display text-white mt-2">
            Welcome back, {currentUser.fullName}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            {isAdmin && 'Oversee institutional operations, monitor teacher and student performance, manage weekly timetables, and coordinate the academic calendar.'}
            {isTeacher && 'Manage your assigned classes, create assignments, review student submissions, track attendance, and author online quizzes.'}
            {isStudent && 'View your academic schedule, upload assignments, take quizzes, view academic events, and monitor attendance.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('calendar')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 cursor-pointer shadow-md shadow-purple-600/30 flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Academic Calendar</span>
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer border border-white/10"
              >
                + Add User
              </button>
              <button
                onClick={() => setActiveTab('classes')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer border border-white/10"
              >
                + Add Class
              </button>
            </>
          )}
          {isTeacher && (
            <>
              <button
                onClick={() => setActiveTab('assignments')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 cursor-pointer shadow-md shadow-pink-600/30"
              >
                + Create Assignment
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Academic Calendar</span>
              </button>
            </>
          )}
          {isStudent && (
            <>
              <button
                onClick={() => setActiveTab('assignments')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 cursor-pointer shadow-md shadow-purple-600/30"
              >
                View Assignments
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer border border-white/10 flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Academic Calendar</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Faculty &amp; Students</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {users.length} Users
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {teachers.length} Faculty &middot; {students.length} Students
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Institutional Attendance</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2 tabular-nums">
            {overallAttendance}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {attendanceSummary?.metrics?.totalSessions || 0} Total Sessions Logged
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Academic Performance</span>
            <TrendingUp className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {overallAvgScore}% Avg Score
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {assignments.length} Assignments &middot; {quizzes.length} Quizzes
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Academic Calendar</span>
            <CalendarIcon className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {calendarEvents.length} Events
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Color-coded Academic, Holiday &amp; Special
          </div>
        </div>
      </div>

      {/* SECTION 1: ACADEMIC CALENDAR OVERVIEW WIDGET */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-5 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
              <CalendarIcon className="w-4 h-4 text-purple-400" />
              <span>Institutional Milestones &amp; Important Dates</span>
            </div>
            <h2 className="text-lg font-bold font-display text-white mt-1">
              Academic Calendar Overview
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('calendar')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 transition-colors cursor-pointer"
            >
              <span>View Full Calendar</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Category Color Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-500/10 border border-blue-500/25 text-blue-300">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="font-semibold">Academic Events (Blue):</span>
            <span className="text-blue-200/80">Exams, Assessments &amp; PTA</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="font-semibold">National Holidays (Green):</span>
            <span className="text-emerald-200/80">Official Holidays &amp; Breaks</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-300">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span className="font-semibold">Special Events (Orange):</span>
            <span className="text-orange-200/80">Fests, Cultural &amp; Sports</span>
          </div>
        </div>

        {/* Upcoming Events Grid */}
        {upcomingEvents.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.01] border border-white/5">
            <CalendarIcon className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">No upcoming calendar events scheduled</p>
            {isAdmin && (
              <button
                onClick={() => setActiveTab('calendar')}
                className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500"
              >
                + Schedule First Event
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {upcomingEvents.map((ev) => {
              const isAcademic = ev.category === 'academic';
              const isHoliday = ev.category === 'holiday';
              const isSpecial = ev.category === 'special';

              const borderClass = isAcademic
                ? 'border-blue-500/30 bg-blue-500/[0.07]'
                : isHoliday
                ? 'border-emerald-500/30 bg-emerald-500/[0.07]'
                : 'border-orange-500/30 bg-orange-500/[0.07]';

              const badgeClass = isAcademic
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : isHoliday
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-orange-500/20 text-orange-300 border-orange-500/40';

              const dotClass = isAcademic
                ? 'bg-blue-400'
                : isHoliday
                ? 'bg-emerald-400'
                : 'bg-orange-400';

              return (
                <div
                  key={ev.id || (ev as any)._id}
                  onClick={() => setActiveTab('calendar')}
                  className={`p-4 rounded-2xl border ${borderClass} hover:scale-[1.01] transition-transform cursor-pointer flex flex-col justify-between space-y-3`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeClass} flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
                        <span>{ev.category}</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 font-semibold">
                        {ev.date}
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-white line-clamp-1">{ev.title}</h3>
                    {ev.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                        {ev.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {ev.startTime} - {ev.endTime}
                    </span>
                    <span className="text-[10px] text-purple-300 capitalize">
                      {ev.targetScope === 'class' ? 'Class Specific' : 'All Cohorts'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: PERFORMANCE AND ATTENDANCE OVERVIEW (For Admin & Teachers) */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-400">
              <BarChart3 className="w-4 h-4 text-pink-400" />
              <span>Institutional Quality &amp; Regularity Tracking</span>
            </div>
            <h2 className="text-lg font-bold font-display text-white mt-1">
              Student &amp; Faculty Performance &amp; Attendance Overview
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Real-time analytics aggregated from assignment submissions, quiz completions, and class attendance registers.
            </p>
          </div>

          <button
            onClick={() => setActiveTab('analytics')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-pink-300 hover:text-white bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/25 transition-colors cursor-pointer"
          >
            <span>Detailed Analytics &amp; Reports</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 2-Column Split: Top Student Performers & Low-Attendance Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Top Students / Class Standing */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Student Academic Rankings</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {studentMetrics.length} Students Evaluated
              </span>
            </div>

            <div className="space-y-2">
              {topStudents.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No graded student submissions yet.
                </div>
              ) : (
                topStudents.map((st: any, idx: number) => (
                  <div
                    key={st.id || st.studentId || idx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-bold text-[10px] flex items-center justify-center">
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="font-bold text-white">{st.fullName}</div>
                        <div className="text-[10px] text-slate-400">
                          Roll: {st.rollNumber} &middot; {st.className}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-emerald-400">
                        {st.compositeScore || st.assignmentAverage || 0}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Attendance: {st.attendanceRate || 100}%
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Faculty & Teacher Evaluation */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <GraduationCap className="w-4 h-4 text-purple-400" />
                <span>Faculty Performance &amp; Review Metrics</span>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {teacherMetrics.length} Faculty Members
              </span>
            </div>

            <div className="space-y-2">
              {teacherMetrics.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-500">
                  No faculty activity recorded yet.
                </div>
              ) : (
                teacherMetrics.map((tc: any, idx: number) => (
                  <div
                    key={tc.id || tc.teacherId || idx}
                    className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-white">{tc.fullName}</div>
                      <div className="text-[10px] text-slate-400">
                        {tc.specialization} &middot; {tc.assignedClassCount} Cohorts Assigned
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-semibold text-purple-300">
                        {tc.assignmentsCreated} Asgns &middot; {tc.quizzesAuthored} Quizzes
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Grading Turnaround: <span className="text-emerald-400 font-semibold">{tc.turnaroundRate}%</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Low Attendance & Academic Intervention Notice (if any) */}
        {studentsNeedingAttention.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <div className="font-bold text-amber-300">
                Academic &amp; Attendance Alert: {studentsNeedingAttention.length} Student(s) Require Follow-Up
              </div>
              <p className="text-amber-200/80 mt-0.5">
                Students with attendance below 75% or academic composite under 60% are flagged for counseling and remedial assistance.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;
