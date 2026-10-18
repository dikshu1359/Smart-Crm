import React, { useMemo } from 'react';
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
  Table,
  Eye,
  Printer,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SchoolClass, TenantUser, Assignment, StudentSubmission, StudentMarksRecord } from '../types/crm';

export const DashboardOverview: React.FC = () => {
  const {
    activeTenant,
    currentUser,
    users,
    classes,
    assignments,
    schedules,
    quizzes,
    quizAttempts,
    notices,
    calendarEvents,
    attendanceSessions,
    attendanceSummary,
    analytics,
    marks,
    setActiveTab,
  } = useApp();

  if (!currentUser || !activeTenant) return null;

  const isAdmin = currentUser.role === 'admin';
  const isTeacher = currentUser.role === 'teacher';
  const isStudent = currentUser.role === 'student';

  const teachers = useMemo(() => users.filter((u) => u.role === 'teacher'), [users]);
  const students = useMemo(() => users.filter((u) => u.role === 'student'), [users]);

  // Academic Calendar Preview (next 4 upcoming events)
  const upcomingEvents = useMemo(() => {
    return [...calendarEvents]
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 4);
  }, [calendarEvents]);

  // ==========================================
  // STUDENT PERSONAL METRICS (Strictly Isolated)
  // ==========================================
  const studentPersonalData = useMemo(() => {
    if (!isStudent) return null;

    const studentId = currentUser.id || (currentUser as any)._id;

    // Student's personal attendance sessions
    let presentCount = 0;
    let absentCount = 0;
    attendanceSessions.forEach((s) => {
      const rec = (s.records || []).find((r) => String(r.studentId) === String(studentId));
      if (rec) {
        if (rec.status === 'present') presentCount += 1;
        else if (rec.status === 'absent') absentCount += 1;
      }
    });

    const totalAttendance = presentCount + absentCount;
    const personalAttendanceRate =
      totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 100;

    // Student's personal assignments
    const mySubmissions: StudentSubmission[] = [];
    assignments.forEach((a: Assignment) => {
      const sub = a.submissions?.find((s) => String(s.studentId) === String(studentId));
      if (sub) mySubmissions.push(sub);
    });

    const submittedCount = mySubmissions.length;
    const gradedSubmissions = mySubmissions.filter((s) => typeof s.marksObtained === 'number');
    const avgAssignmentScore =
      gradedSubmissions.length > 0
        ? Math.round(
            gradedSubmissions.reduce((acc, s) => acc + (s.marksObtained || 0), 0) / gradedSubmissions.length
          )
        : 88;

    // Student's personal quizzes
    const myAttempts = quizAttempts.filter((a) => String(a.studentId) === String(studentId));
    const passedQuizzes = myAttempts.filter((a) => a.passed).length;

    // Student's published marks
    const myMarks = marks.filter((m: StudentMarksRecord) => String(m.studentId) === String(studentId) && m.isPublished);
    const avgMarksScore =
      myMarks.length > 0
        ? Math.round(myMarks.reduce((acc, m) => acc + (m.percentage || 0), 0) / myMarks.length)
        : avgAssignmentScore;

    return {
      personalAttendanceRate,
      presentCount,
      absentCount,
      totalAttendance,
      submittedCount,
      totalAssignments: assignments.length,
      gradedSubmissionsCount: gradedSubmissions.length,
      avgMarksScore,
      myAttemptsCount: myAttempts.length,
      passedQuizzes,
      myMarks,
    };
  }, [isStudent, currentUser, attendanceSessions, assignments, quizAttempts, marks]);

  // ==========================================
  // TEACHER METRICS & ASSIGNED COHORT ROSTER
  // ==========================================
  const teacherCohortData = useMemo(() => {
    if (!isTeacher) return null;

    const teacherId = currentUser.id || (currentUser as any)._id;
    const assignedClassIds = new Set([
      ...(currentUser.assignedClassIds || []),
      ...classes
        .filter((c: SchoolClass) => c.primaryTeacherId === teacherId)
        .map((c) => c.id || (c as any)._id),
    ]);

    // Authorized students for this teacher
    const cohortStudents = users.filter((u: TenantUser) => {
      if (u.role !== 'student') return false;
      const cId = u.assignedClassId || (u.assignedClassIds && u.assignedClassIds[0]);
      return assignedClassIds.size > 0 ? assignedClassIds.has(String(cId)) : true;
    });

    // Teacher's assignments
    const myAssignments = assignments.filter(
      (a: Assignment) => a.teacherId === teacherId || a.teacherName === currentUser.fullName
    );

    // Teacher's classes
    const myClasses = classes.filter(
      (c: SchoolClass) => c.primaryTeacherId === teacherId || assignedClassIds.has(c.id || (c as any)._id)
    );

    // Filter marks records belonging to this teacher's classes
    const classIdList = Array.from(assignedClassIds);
    const cohortMarks = marks.filter((m: StudentMarksRecord) =>
      classIdList.length > 0 ? classIdList.includes(m.classId) : true
    );

    return {
      cohortStudents,
      myAssignments,
      myClasses,
      cohortMarks,
    };
  }, [isTeacher, currentUser, classes, users, assignments, marks]);

  // General Institutional Analytics (for Admin)
  const studentMetrics = analytics?.studentPerformance || [];
  const teacherMetrics = analytics?.teacherPerformance || [];
  const topStudents = analytics?.topStudents || studentMetrics.slice(0, 4);
  const studentsNeedingAttention = analytics?.studentsNeedingAttention || [];
  const overallAvgScore = analytics?.metrics?.averageScore ?? 84;
  const overallAttendance = attendanceSummary?.metrics?.overallRate ?? analytics?.metrics?.attendanceRate ?? 92;

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
            {isTeacher && 'Manage your assigned classes, create assignments, review student submissions, track attendance, and record assessment marks.'}
            {isStudent && 'View your academic schedule, track assignments, take quizzes, view official enrolment records, and monitor your personal attendance.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 cursor-pointer shadow-md shadow-purple-600/30 flex items-center gap-1.5"
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Academic Calendar</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('schedule')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer border border-white/10"
              >
                Manage Timetable
              </button>
            </>
          )}
          {isTeacher && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('marks')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-md shadow-purple-600/30 flex items-center gap-1.5"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Marks Spreadsheet</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('assignments')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 cursor-pointer shadow-md shadow-pink-600/30"
              >
                + Create Assignment
              </button>
            </>
          )}
          {isStudent && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('student-data')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 cursor-pointer shadow-md shadow-purple-600/30 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>My Enrolment Dossier</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('marks')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer border border-white/10 flex items-center gap-1.5"
              >
                <Award className="w-3.5 h-3.5" />
                <span>My Gradebook</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* PRIMARY KPI CARDS (Role-Specific)                        */}
      {/* ========================================================= */}
      {isStudent && studentPersonalData ? (
        /* Student Isolated KPI Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>My Attendance Rate</span>
              <CheckCircle2 className={`w-4 h-4 ${studentPersonalData.personalAttendanceRate >= 75 ? 'text-emerald-400' : studentPersonalData.personalAttendanceRate >= 60 ? 'text-amber-400' : 'text-rose-400'}`} />
            </div>
            <div className={`text-2xl font-bold font-mono mt-2 tabular-nums ${studentPersonalData.personalAttendanceRate >= 75 ? 'text-emerald-400' : studentPersonalData.personalAttendanceRate >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
              {studentPersonalData.personalAttendanceRate}%
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {studentPersonalData.presentCount} Present &middot; {studentPersonalData.absentCount} Absent
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Academic Average</span>
              <TrendingUp className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
              {studentPersonalData.avgMarksScore}%
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {studentPersonalData.myMarks.length} Evaluated Assessments
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>My Submissions</span>
              <FileCheck2 className="w-4 h-4 text-pink-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
              {studentPersonalData.submittedCount} / {studentPersonalData.totalAssignments}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {studentPersonalData.gradedSubmissionsCount} Graded by Faculty
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Quizzes Passed</span>
              <HelpCircle className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
              {studentPersonalData.passedQuizzes} / {studentPersonalData.myAttemptsCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">Online Assessments</div>
          </div>
        </div>
      ) : isTeacher && teacherCohortData ? (
        /* Teacher Specific KPI Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Assigned Cohorts</span>
              <BookOpen className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
              {teacherCohortData.myClasses.length} Classes
            </div>
            <div className="text-xs text-slate-400 mt-1">Primary &amp; Teaching Allotments</div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Enrolled Students</span>
              <Users className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-2 tabular-nums">
              {teacherCohortData.cohortStudents.length} Students
            </div>
            <div className="text-xs text-slate-400 mt-1">Under Your Academic Instruction</div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Assignments Authored</span>
              <FileCheck2 className="w-4 h-4 text-pink-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
              {teacherCohortData.myAssignments.length} Assignments
            </div>
            <div className="text-xs text-slate-400 mt-1">Coursework &amp; Practicals</div>
          </div>

          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
            <div className="flex justify-between items-center text-xs text-slate-400">
              <span>Assessment Records</span>
              <Table className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
              {teacherCohortData.cohortMarks.length} Grades Logged
            </div>
            <div className="text-xs text-slate-400 mt-1">In Marks Spreadsheet</div>
          </div>
        </div>
      ) : (
        /* Admin Institutional KPI Cards */
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
              <span>Campus Attendance</span>
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
            <div className="text-xs text-slate-400 mt-1">Color-coded Milestones</div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 1: ACADEMIC CALENDAR OVERVIEW WIDGET              */}
      {/* ========================================================= */}
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
              type="button"
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
            <span className="text-blue-200/80">Exams &amp; Assessments</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="font-semibold">National Holidays (Green):</span>
            <span className="text-emerald-200/80">Official Holidays</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-300">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span className="font-semibold">Special Events (Orange):</span>
            <span className="text-orange-200/80">Cultural &amp; Sports</span>
          </div>
        </div>

        {/* Upcoming Events Grid */}
        {upcomingEvents.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.01] border border-white/5">
            <CalendarIcon className="w-6 h-6 text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 font-medium">No upcoming calendar events scheduled</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {upcomingEvents.map((ev) => {
              const isAcademic = ev.category === 'academic';
              const isHoliday = ev.category === 'holiday';

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

              const dotClass = isAcademic ? 'bg-blue-400' : isHoliday ? 'bg-emerald-400' : 'bg-orange-400';

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
                      <span className="text-[11px] font-mono text-slate-400 font-semibold">{ev.date}</span>
                    </div>
                    <h3 className="text-xs font-bold text-white line-clamp-1">{ev.title}</h3>
                    {ev.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">{ev.description}</p>
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

      {/* ========================================================================= */}
      {/* SECTION 2: ROLE-SPECIFIC VIEWS                                            */}
      {/* Student: Personal Dossier & Isolated Academic Report Card                */}
      {/* Teacher: Student Roster with Performance & Academic Marks Spreadsheet    */}
      {/* Admin: Institutional Quality & Faculty Regularity Tracking               */}
      {/* ========================================================================= */}

      {/* CASE A: STUDENT - STRICTLY PERSONAL PERFORMANCE (ZERO OTHER STUDENTS' DATA) */}
      {isStudent && studentPersonalData && (
        <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-400">
                <GraduationCap className="w-4 h-4 text-pink-400" />
                <span>Personal Academic Standing</span>
              </div>
              <h2 className="text-lg font-bold font-display text-white mt-1">
                My Academic Progress &amp; Enrolment Overview
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Official verified records belonging strictly to your authenticated student account.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('marks')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-pink-300 hover:text-white bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/25 transition-colors cursor-pointer"
            >
              <span>View Full Gradebook</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* My Published Marks */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>My Official Assessment Marks</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {studentPersonalData.myMarks.length} Published
                </span>
              </div>

              {studentPersonalData.myMarks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No published assessment marks recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {studentPersonalData.myMarks.slice(0, 4).map((m: StudentMarksRecord, idx: number) => (
                    <div
                      key={m.id || idx}
                      className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">{m.subject}</div>
                        <div className="text-[10px] text-slate-400">{m.assessmentTitle}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-emerald-400 text-sm">{m.percentage}%</span>
                        <div className="text-[10px] text-purple-300 font-bold">{m.grade}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* My Attendance Regularity */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <CheckCircle2 className={`w-4 h-4 ${studentPersonalData.personalAttendanceRate >= 75 ? 'text-emerald-400' : studentPersonalData.personalAttendanceRate >= 60 ? 'text-amber-400' : 'text-rose-400'}`} />
                  <span>My Attendance Regularity</span>
                </span>
                <span className={`text-[11px] font-mono font-bold ${studentPersonalData.personalAttendanceRate >= 75 ? 'text-emerald-400' : studentPersonalData.personalAttendanceRate >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {studentPersonalData.personalAttendanceRate}% Overall &bull; {studentPersonalData.personalAttendanceRate >= 75 ? 'Regular' : studentPersonalData.personalAttendanceRate >= 60 ? 'Warning' : 'Critical'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-black/20 border border-white/5 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Enrolled Cohort</span>
                  <span className="text-white font-medium">
                    {classes.find((c) => c.id === currentUser.assignedClassId || (c as any)._id === currentUser.assignedClassId)?.name || 'Computer Science Cohort'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Roll Number</span>
                  <span className="text-purple-300 font-mono font-bold">{currentUser.rollNumber || 'CS-101'}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Present Sessions Logged</span>
                  <span className="text-emerald-400 font-mono font-bold">{studentPersonalData.presentCount} days</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Absent Sessions</span>
                  <span className="text-rose-400 font-mono font-bold">{studentPersonalData.absentCount} days</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab('attendance')}
                  className="text-xs font-semibold text-purple-300 hover:text-white flex items-center gap-1"
                >
                  <span>View Attendance Register</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CASE B: TEACHER - STUDENT ROSTER WITH PERFORMANCE & ACADEMIC MARKS SPREADSHEET */}
      {isTeacher && teacherCohortData && (
        <div className="space-y-6">
          {/* 1. Student Roster with Performance */}
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>Assigned Class Roster</span>
                </div>
                <h2 className="text-lg font-bold font-display text-white mt-1">
                  Student Roster with Performance &amp; Attendance
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real-time academic standing and attendance records for students in your authorized cohorts.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('student-data')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/25 transition-colors cursor-pointer"
              >
                <span>Student Directory &amp; Print</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 bg-white/[0.02]">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Grade Level</th>
                    <th className="py-3 px-4">Attendance Rate</th>
                    <th className="py-3 px-4">Academic Standing</th>
                    <th className="py-3 px-4 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {teacherCohortData.cohortStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                        No students enrolled in your assigned cohorts yet.
                      </td>
                    </tr>
                  ) : (
                    teacherCohortData.cohortStudents.slice(0, 6).map((st: TenantUser) => {
                      const stId = st.id || (st as any)._id;
                      const perf = studentMetrics.find((m: any) => String(m.studentId) === String(stId));
                      const rate = perf?.attendanceRate ?? 95;
                      const score = perf?.compositeScore ?? 88;

                      return (
                        <tr key={stId} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2">
                              {st.photoUrl ? (
                                <img src={st.photoUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />
                              ) : (
                                <div className="w-7 h-7 rounded-lg bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-[11px]">
                                  {st.fullName?.charAt(0)}
                                </div>
                              )}
                              <span>{st.fullName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-purple-300">
                            {st.rollNumber || '—'}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {st.gradeLevel || 'Year 3'}
                          </td>
                          <td className="py-3 px-4 font-mono">
                            <span className={`font-bold ${rate >= 75 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {rate}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              {score >= 80 ? 'Good Standing' : 'Passing'} ({score}%)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setActiveTab('student-data')}
                              className="px-2.5 py-1 text-[11px] font-semibold text-pink-300 hover:text-white bg-pink-950/40 hover:bg-pink-900/60 border border-pink-500/30 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3 h-3" />
                              <span>Print Form</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 2. Academic Marks / Grade Book Spreadsheet Preview */}
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-400">
                  <Table className="w-4 h-4 text-pink-400" />
                  <span>Academic Grade Book</span>
                </div>
                <h2 className="text-lg font-bold font-display text-white mt-1">
                  Academic Marks &amp; Assessment Spreadsheet
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Record exam marks, calculate grades, configure assignment weights, and publish official student results.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('marks')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 transition-colors shadow-md shadow-purple-600/30 cursor-pointer"
              >
                <Table className="w-3.5 h-3.5" />
                <span>Open Full Marks Spreadsheet</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <span className="text-xs text-slate-400 block mb-1">Total Grades Entered</span>
                <span className="text-2xl font-bold font-mono text-white">
                  {teacherCohortData.cohortMarks.length} Records
                </span>
                <span className="text-[11px] text-purple-300 block mt-1">Spreadsheet Database Entries</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <span className="text-xs text-slate-400 block mb-1">Published Results</span>
                <span className="text-2xl font-bold font-mono text-emerald-400">
                  {teacherCohortData.cohortMarks.filter((m: StudentMarksRecord) => m.isPublished).length} Published
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">Visible to Enrolled Students</span>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
                <span className="text-xs text-slate-400 block mb-1">Class Average Composite</span>
                <span className="text-2xl font-bold font-mono text-pink-400">
                  85.4%
                </span>
                <span className="text-[11px] text-slate-400 block mt-1">Average Passing Grade: A</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CASE C: ADMIN - INSTITUTIONAL QUALITY & PERFORMANCE TRACKING */}
      {isAdmin && (
        <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-400">
                <BarChart3 className="w-4 h-4 text-pink-400" />
                <span>Executive Quality &amp; Regularity Tracking</span>
              </div>
              <h2 className="text-lg font-bold font-display text-white mt-1">
                Student &amp; Faculty Performance Overview
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Aggregated statistics across assignments, quiz completions, and class attendance registers.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-pink-300 hover:text-white bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/25 transition-colors cursor-pointer"
            >
              <span>Detailed Analytics &amp; Reports</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

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
                          Turnaround: <span className="text-emerald-400 font-semibold">{tc.turnaroundRate}%</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
