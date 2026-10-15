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
    institutions,
    setActiveTab,
  } = useApp();

  if (!currentUser || !activeTenant) return null;

  const teachers = users.filter((u) => u.role === 'teacher');
  const students = users.filter((u) => u.role === 'student');

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
            {currentUser.role === 'admin' && 'Manage faculty & student accounts, allocate classes, build weekly schedules, and oversee institutional analytics.'}
            {currentUser.role === 'teacher' && 'Manage your assigned classes, create assignments, review and grade student submissions, and author quizzes.'}
            {currentUser.role === 'student' && 'View your class timetable, complete and upload assignments, attempt quizzes, and review grades.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {currentUser.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('users')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-md shadow-purple-600/30"
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
          {currentUser.role === 'teacher' && (
            <>
              <button
                onClick={() => setActiveTab('assignments')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 cursor-pointer shadow-md shadow-pink-600/30"
              >
                + Create Assignment
              </button>
              <button
                onClick={() => setActiveTab('quizzes')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer"
              >
                + Author Quiz
              </button>
            </>
          )}
          {currentUser.role === 'student' && (
            <>
              <button
                onClick={() => setActiveTab('assignments')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 cursor-pointer shadow-md shadow-purple-600/30"
              >
                View Assignments
              </button>
              <button
                onClick={() => setActiveTab('quizzes')}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer border border-white/10"
              >
                Take Quizzes
              </button>
            </>
          )}
        </div>
      </div>

      {/* KPI Cards */}
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
            {teachers.length} Teachers &middot; {students.length} Students
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Class Cohorts</span>
            <BookOpen className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {classes.length} Classes
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {schedules.length} Timetable Slots Scheduled
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Active Assignments</span>
            <FileCheck2 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {assignments.length} Active
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {assignments.reduce((sum, a) => sum + (a.submissionCount || 0), 0)} Submissions Recorded
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Quizzes & Exams</span>
            <HelpCircle className="w-4 h-4 text-pink-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white mt-2 tabular-nums">
            {quizzes.length} Quizzes
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {quizzes.filter((q) => q.isPublished).length} Published Online
          </div>
        </div>
      </div>
    </div>
  );
};
export default DashboardOverview;
