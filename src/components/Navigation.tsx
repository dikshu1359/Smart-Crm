import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileCheck2,
  CalendarClock,
  HelpCircle,
  MessageSquare,
  BarChart3,
  Bell,
  Database,
  ShieldAlert,
  UserCircle,
  LogOut,
  Menu,
  X,
  Building2,
  Calendar as CalendarIcon,
  Table,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DashboardTab, UserRole } from '../types/crm';
import navbarLogo from '../assets/logo.png';

interface NavigationProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ mobileOpen, setMobileOpen }) => {
  const {
    activeTenant,
    currentUser,
    activeTab,
    setActiveTab,
    logout,
    notices,
    chatContacts,
  } = useApp();

  if (!currentUser || !activeTenant) return null;

  const unreadNoticeCount = notices.filter(
    (n) => !n.readByUserIds?.includes(currentUser.id || (currentUser as any)._id)
  ).length;

  const unreadChatCount = chatContacts.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  const navItems: {
    id: DashboardTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    roles: UserRole[];
    badgeCount?: number;
  }[] = [
    {
      id: 'overview',
      label: 'Dashboard Overview',
      icon: LayoutDashboard,
      roles: ['admin', 'teacher', 'student'],
    },
    {
      id: 'users',
      label: 'User Directory & Accounts',
      icon: Users,
      roles: ['admin'],
    },
    {
      id: 'classes',
      label: currentUser.role === 'admin' ? 'Class & Student Allotment' : 'Assigned Classes',
      icon: BookOpen,
      roles: ['admin', 'teacher'],
    },
    {
      id: 'attendance',
      label: currentUser.role === 'admin' ? 'Teacher & Student Attendance' : 'Student Attendance',
      icon: CheckCircle2,
      roles: ['admin', 'teacher'],
    },
    {
      id: 'student-data',
      label: currentUser.role === 'student' ? 'My Student Profile' : 'Student Important Information',
      icon: FileSpreadsheet,
      roles: ['admin', 'teacher', 'student'],
    },
    {
      id: 'assignments',
      label: currentUser.role === 'student' ? 'My Assignments' : 'Assignment Management',
      icon: FileCheck2,
      roles: ['teacher', 'student'],
    },
    {
      id: 'quizzes',
      label: currentUser.role === 'student' ? 'Online Quizzes' : 'Quiz & Exam Builder',
      icon: HelpCircle,
      roles: ['teacher', 'student'],
    },
    {
      id: 'roster',
      label: currentUser.role === 'admin' ? 'Import Student Roster' : 'Student Roster',
      icon: Users,
      roles: ['admin', 'teacher'],
    },
    {
      id: 'marks',
      label: currentUser.role === 'student' ? 'My Marks & Gradebook' : 'Marks Spreadsheet',
      icon: Table,
      roles: ['teacher', 'student'],
    },
    {
      id: 'study-ai',
      label: 'Study AI Assistant',
      icon: Sparkles,
      roles: ['teacher', 'student'],
    },
    {
      id: 'schedule',
      label: 'Smart Timetable',
      icon: CalendarClock,
      roles: ['admin', 'teacher', 'student'],
    },
    {
      id: 'calendar',
      label: 'Academic Calendar',
      icon: CalendarIcon,
      roles: ['admin', 'teacher', 'student'],
    },
    {
      id: 'analytics',
      label: 'Performance Analytics',
      icon: BarChart3,
      roles: ['admin', 'teacher', 'student'],
    },
    {
      id: 'notices',
      label: 'Notice Announcements',
      icon: Bell,
      roles: ['admin', 'teacher', 'student'],
      badgeCount: unreadNoticeCount,
    },
    {
      id: 'chat',
      label: 'Messages & Chat',
      icon: MessageSquare,
      roles: ['admin', 'teacher', 'student'],
      badgeCount: unreadChatCount,
    },
    {
      id: 'tenants',
      label: 'Institution Databases',
      icon: Database,
      roles: ['admin'],
    },
    {
      id: 'audit',
      label: 'Activity & Audit Trail',
      icon: ShieldAlert,
      roles: ['admin'],
    },
    {
      id: 'profile',
      label: 'Account Profile',
      icon: UserCircle,
      roles: ['admin', 'teacher', 'student'],
    },
  ];

  const filteredItems = navItems.filter((item) => item.roles.includes(currentUser.role));

  const initials = currentUser.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#100E1E] border-r border-white/10 w-[272px] shrink-0 select-none">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md shadow-purple-500/25 border border-purple-500/30 flex items-center justify-center bg-[#0d0c1d] shrink-0">
            <img
              src={navbarLogo}
              alt="Smart Institutional CRM Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="text-sm font-bold font-display text-white">Smart Institutional CRM</div>
            <div className="text-[10px] font-mono text-purple-300 truncate max-w-[170px]">
              {activeTenant.databaseName}
            </div>
          </div>
        </div>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Active Institution Card */}
      <div className="p-4 border-b border-white/10 bg-white/[0.02]">
        <span className="block text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1">
          Active Institution
        </span>
        <div className="text-xs font-semibold text-white truncate">{activeTenant.institutionName}</div>
        <div className="text-[10px] text-emerald-400 flex items-center gap-1.5 mt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>MongoDB Atlas Connected</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setMobileOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                active
                  ? 'bg-purple-600/25 text-white border border-purple-500/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center gap-3 truncate">
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-pink-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500 text-white">
                  {item.badgeCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Session & Logout */}
      <div className="p-4 border-t border-white/10 space-y-3 bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">{currentUser.fullName}</div>
            <div className="text-[11px] text-slate-400 truncate">
              <span className="capitalize text-purple-300 font-medium">{currentUser.role}</span> &middot; @{currentUser.username}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-red-300 bg-red-950/30 hover:bg-red-950/50 border border-red-500/20 transition-all cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block h-screen sticky top-0">{sidebarContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};

export const TopWorkspaceBar: React.FC<{ onOpenMobileMenu: () => void }> = ({ onOpenMobileMenu }) => {
  const {
    activeTenant,
    activeTab,
    notices,
    currentUser,
    setActiveTab,
    chatContacts,
    openChatWith,
  } = useApp();

  const [showChatMenu, setShowChatMenu] = useState(false);

  const unreadNoticeCount = notices.filter(
    (n) => !n.readByUserIds?.includes(currentUser?.id || (currentUser as any)?._id)
  ).length;

  const contactsWithUnread = chatContacts.filter((c) => (c.unreadCount || 0) > 0);
  const totalUnreadChat = contactsWithUnread.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <header className="sticky top-0 z-30 bg-[#141124]/80 backdrop-blur-md border-b border-white/10 px-6 py-3.5 flex items-center justify-between gap-6">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onOpenMobileMenu} className="lg:hidden p-2 rounded-lg bg-white/5 text-slate-300 hover:text-white cursor-pointer">
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-xs sm:text-sm text-slate-400 truncate">
          <span className="font-medium text-slate-200">{activeTenant?.institutionName}</span>
          <span className="mx-2 text-slate-600">/</span>
          <span className="text-purple-300 capitalize">{activeTab}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 relative">
        {/* Chat Notifications */}
        <div className="relative">
          <button
            onClick={() => {
              if (contactsWithUnread.length === 1) {
                openChatWith(contactsWithUnread[0].id);
              } else if (contactsWithUnread.length > 1) {
                setShowChatMenu((prev) => !prev);
              } else {
                setActiveTab('chat');
              }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1.5 cursor-pointer relative"
            title="Messages & Chat"
          >
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            <span>Messages</span>
            {totalUnreadChat > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-pink-500 text-white font-mono text-[10px] font-bold animate-pulse">
                {totalUnreadChat}
              </span>
            )}
          </button>

          {/* Unread Chat Dropdown Menu */}
          {showChatMenu && contactsWithUnread.length > 0 && (
            <div className="absolute right-0 mt-2 w-64 bg-[#141124] border border-white/20 rounded-2xl p-2 shadow-2xl z-50 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300 border-b border-white/10 flex justify-between items-center">
                <span>New Messages ({totalUnreadChat})</span>
                <button
                  onClick={() => setShowChatMenu(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {contactsWithUnread.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setShowChatMenu(false);
                    openChatWith(c.id);
                  }}
                  className="w-full text-left p-2.5 rounded-xl hover:bg-white/10 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{c.fullName}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{c.role}</p>
                  </div>
                  <span className="w-5 h-5 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {c.unreadCount}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notices */}
        <button
          onClick={() => setActiveTab('notices')}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-200 flex items-center gap-1.5 cursor-pointer"
        >
          <Bell className="w-3.5 h-3.5 text-pink-400" />
          <span>Notices {unreadNoticeCount > 0 ? `(${unreadNoticeCount})` : ''}</span>
        </button>
      </div>
    </header>
  );
};

export default Navigation;
