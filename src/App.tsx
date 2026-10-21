import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { LandingPage } from './pages/LandingPage';
import { RoleSelectionPage } from './pages/RoleSelectionPage';
import { Navigation, TopWorkspaceBar } from './components/Navigation';
import { DashboardOverview } from './components/DashboardOverview';
import { UserManagement } from './components/UserManagement';
import { ClassManagement } from './components/ClassManagement';
import { TeacherAssignments } from './components/TeacherAssignments';
import { StudentAssignments } from './components/StudentAssignments';
import { QuizManagement } from './components/QuizManagement';
import { MarksSpreadsheet } from './components/MarksSpreadsheet';
import { StudentAttendance } from './components/StudentAttendance';
import { StudentImportantInformation } from './components/StudentImportantInformation';
import { TeacherStudentRoster } from './components/TeacherStudentRoster';
import { ScheduleManagement } from './components/ScheduleManagement';
import { AcademicCalendar } from './components/AcademicCalendar';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';
import { NoticeCommunication } from './components/NoticeCommunication';
import { ChatCommunication } from './components/ChatCommunication';
import { StudentRosterImport } from './components/StudentRosterImport';
import {
  TenantDatabaseConsole,
  AuditLogConsole,
} from './components/TenantAndAuditManager';
import { ProfileView } from './components/ProfileView';
import { StudyAI } from './components/StudyAI';
import { DashboardAnimatedBackground } from './components/DashboardAnimatedBackground';
import { PrintableDossier } from './components/PrintableDossier';

const CRMWorkspaceShell: React.FC = () => {
  const {
    currentView,
    selectedRole,
    isAuthenticated,
    currentUser,
    activeTenant,
    activeTab,
    loading,
    printingUser,
    classes,
    attendanceSessions,
    marks,
    assignments,
  } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A14] flex flex-col items-center justify-center text-slate-400 gap-3">
        <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono">Initializing Multi-Tenant CRM Engine...</p>
      </div>
    );
  }

  // Application Flow views
  if (currentView === 'landing') {
    return <LandingPage />;
  }

  if (currentView === 'role-selection' || currentView === 'auth-admin' || currentView === 'auth-teacher' || currentView === 'auth-student') {
    return <RoleSelectionPage initialRole={selectedRole} />;
  }

  // Protected Dashboard check
  if (!isAuthenticated || !currentUser) {
    return <RoleSelectionPage initialRole={selectedRole} />;
  }

  // User to display in print mode: either explicitly printingUser or current student
  const activePrintUser = printingUser || (currentUser.role === 'student' ? currentUser : null);

  return (
    <div className="min-h-screen bg-[#0B0A14] text-slate-100 flex relative overflow-x-hidden">
      {/* Background Animated Floating Shapes for Admin, Teacher, and Student Dashboards */}
      <DashboardAnimatedBackground />

      <Navigation mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <TopWorkspaceBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {activeTab === 'overview' && <DashboardOverview />}
          {activeTab === 'users' && (currentUser.role === 'admin' ? <UserManagement /> : <DashboardOverview />)}
          {activeTab === 'classes' && (currentUser.role !== 'student' ? <ClassManagement /> : <DashboardOverview />)}

          {/* Student Attendance & Teacher Attendance Monitoring */}
          {activeTab === 'attendance' && (
            currentUser.role !== 'student' ? <StudentAttendance /> : <DashboardOverview />
          )}

          {activeTab === 'student-data' && <StudentImportantInformation />}

          {/* Assignments: Teacher & Student only. Admin cannot access Assignment Management */}
          {activeTab === 'assignments' && (
            currentUser.role === 'student' ? (
              <StudentAssignments />
            ) : currentUser.role === 'teacher' ? (
              <TeacherAssignments />
            ) : (
              <DashboardOverview />
            )
          )}

          {/* Quizzes: Teacher & Student only. Admin cannot access Quiz Management */}
          {activeTab === 'quizzes' && (
            currentUser.role !== 'admin' ? <QuizManagement /> : <DashboardOverview />
          )}

          {/* Marks Spreadsheet: Teacher and Student only. Admin monitors via Performance Analytics */}
          {activeTab === 'marks' && (currentUser.role !== 'admin' ? <MarksSpreadsheet /> : <PerformanceAnalytics />)}
          {activeTab === 'study-ai' && (currentUser.role !== 'admin' ? <StudyAI /> : <DashboardOverview />)}
          {activeTab === 'roster' && (currentUser.role === 'admin' ? <StudentRosterImport /> : <TeacherStudentRoster />)}
          {activeTab === 'schedule' && <ScheduleManagement />}
          {activeTab === 'calendar' && <AcademicCalendar />}
          {activeTab === 'analytics' && <PerformanceAnalytics />}
          {activeTab === 'notices' && <NoticeCommunication />}
          {activeTab === 'chat' && <ChatCommunication />}
          {activeTab === 'tenants' && (currentUser.role === 'admin' ? <TenantDatabaseConsole /> : <DashboardOverview />)}
          {activeTab === 'audit' && (currentUser.role === 'admin' ? <AuditLogConsole /> : <DashboardOverview />)}
          {activeTab === 'profile' && <ProfileView />}
        </main>
      </div>

      {/* Official Printable Dossier (rendered exclusively in browser print dialog) */}
      <PrintableDossier
        user={activePrintUser}
        institutionName={activeTenant?.institutionName || ''}
        campusCode={activeTenant?.campusCode}
        classes={classes}
        attendanceSessions={attendanceSessions}
        marks={marks}
        assignments={assignments}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <CRMWorkspaceShell />
    </AppProvider>
  );
}
