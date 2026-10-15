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
import { ScheduleManagement } from './components/ScheduleManagement';
import { PerformanceAnalytics } from './components/PerformanceAnalytics';
import { NoticeCommunication } from './components/NoticeCommunication';
import { ChatCommunication } from './components/ChatCommunication';
import {
  TenantDatabaseConsole,
  AuditLogConsole,
} from './components/TenantAndAuditManager';
import { ProfileView } from './components/ProfileView';

const CRMWorkspaceShell: React.FC = () => {
  const { currentView, selectedRole, isAuthenticated, currentUser, activeTab, loading } = useApp();
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

  return (
    <div className="min-h-screen bg-[#0B0A14] text-slate-100 flex">
      <Navigation mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

      <div className="flex-1 flex flex-col min-w-0">
        <TopWorkspaceBar onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 p-6 lg:p-8 max-w-[1360px] w-full mx-auto">
          {activeTab === 'overview' && <DashboardOverview />}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'classes' && <ClassManagement />}
          {activeTab === 'assignments' &&
            (currentUser.role === 'student' ? (
              <StudentAssignments />
            ) : (
              <TeacherAssignments />
            ))}
          {activeTab === 'quizzes' && <QuizManagement />}
          {activeTab === 'schedule' && <ScheduleManagement />}
          {activeTab === 'analytics' && <PerformanceAnalytics />}
          {activeTab === 'notices' && <NoticeCommunication />}
          {activeTab === 'chat' && <ChatCommunication />}
          {activeTab === 'tenants' && <TenantDatabaseConsole />}
          {activeTab === 'audit' && <AuditLogConsole />}
          {activeTab === 'profile' && <ProfileView />}
        </main>
      </div>
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
