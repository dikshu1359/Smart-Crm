import React from 'react';
import {
  ArrowRight,
  Database,
  CalendarClock,
  FileCheck2,
  BarChart3,
  Layers,
  Lock,
  Building2,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import navbarLogo from '../assets/logo.png';

export const LandingPage: React.FC = () => {
  const { setCurrentView, setSelectedRole } = useApp();

  const handleStart = (role?: 'admin' | 'teacher' | 'student') => {
    if (role) {
      setSelectedRole(role);
      setCurrentView(role === 'admin' ? 'auth-admin' : role === 'teacher' ? 'auth-teacher' : 'auth-student');
    } else {
      setCurrentView('role-selection');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A14] text-slate-100 relative overflow-x-hidden">
      {/* Ambient Lighting & Floating Animated Shapes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-0 select-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-purple-600/20 blur-[130px] pulse-ambient" />
        <div className="absolute top-1/4 -right-40 w-[450px] h-[450px] rounded-full bg-pink-600/15 blur-[150px] pulse-ambient" />
        <div className="absolute top-2/3 left-1/3 w-96 h-96 rounded-full bg-cyan-600/15 blur-[140px] pulse-ambient" />

        {/* Floating circles, squares, curved particles */}
        <div className="absolute top-24 left-[12%] w-14 h-14 rounded-full border border-purple-500/25 bg-purple-500/5 float-drift-1" />
        <div className="absolute top-44 right-[15%] w-10 h-10 rounded-xl border border-pink-500/25 bg-pink-500/5 rotate-12 float-drift-2" />
        <div className="absolute top-[520px] left-[8%] w-8 h-8 rounded-lg border border-cyan-400/25 bg-cyan-400/5 -rotate-6 float-drift-3" />
        <div className="absolute top-[680px] right-[10%] w-16 h-16 rounded-full border border-purple-400/20 bg-purple-500/5 float-drift-1" />
        <div className="absolute bottom-[400px] left-[18%] w-12 h-12 rounded-2xl border border-pink-400/20 bg-pink-500/5 rotate-45 float-drift-2" />

        <div className="absolute top-36 left-[35%] w-2 h-2 rounded-full bg-purple-400/40 float-drift-3" />
        <div className="absolute top-72 right-[32%] w-1.5 h-1.5 rounded-full bg-cyan-400/50 float-drift-1" />
        <div className="absolute top-[900px] left-[25%] w-2 h-2 rounded-full bg-pink-400/40 float-drift-2" />
        <div className="absolute top-[1100px] right-[20%] w-2.5 h-2.5 rounded-full bg-purple-400/30 float-drift-3" />
      </div>

      {/* Top Bar */}
      <header className="relative z-20 flex items-center justify-between gap-8 max-w-[1360px] mx-auto px-6 py-5 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-purple-500/25 border border-purple-500/30 flex items-center justify-center bg-[#0d0c1d] shrink-0">
            <img
              src={navbarLogo}
              alt="Smart Institutional CRM Logo"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap">
            Smart Institutional CRM
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">
            Core Modules
          </a>
          <a href="#architecture" className="hover:text-white transition-colors">
            Multi-Tenant Isolation
          </a>
          <a href="#portals" className="hover:text-white transition-colors">
            Role Portals
          </a>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleStart()}
            className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all cursor-pointer"
          >
            Sign In
          </button>
          <button
            onClick={() => handleStart('admin')}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all shadow-md shadow-purple-600/30 cursor-pointer"
          >
            Register Institution
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-[1360px] mx-auto px-6 pt-16 pb-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-purple-500/30 bg-purple-950/40 text-purple-300 text-xs font-medium mb-6">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>Multi-Tenant Architecture with Dedicated Institution Databases</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15] mb-6 font-display">
            The Complete Operating System for{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-purple-300">
              Modern Educational Institutions
            </span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto mb-8">
            Isolated tenant databases, role-based access control, conflict-free scheduling, end-to-end assignment workflows, interactive quizzes, and real-time analytics for administrators, faculty, and students.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => handleStart()}
              className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 via-pink-600 to-purple-600 rounded-xl hover:opacity-95 active:scale-[0.98] transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleStart('admin')}
              className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-slate-200 hover:text-white border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-xl active:scale-[0.98] transition-all cursor-pointer"
            >
              Register New Institution
            </button>
          </div>
        </div>

        {/* Feature Grid */}
        <section id="features" className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 font-display">
              Built for Institutional Excellence
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Every workflow is engineered with strict validation, real database persistence, and role-based permissions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Isolated Multi-Tenant Databases</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Independent database instances for each institution registered in the platform, ensuring absolute security, data isolation, and compliance.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4">
                <FileCheck2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Advanced Assignment Lifecycle</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multi-class assignment distribution, file uploads, submission tracking, teacher review, accept/reject workflows, grading, and resubmissions.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                <CalendarClock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Conflict-Free Timetables</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Weekly scheduling across 09:00 AM – 02:30 PM with automatic teacher and room collision prevention and reserved 12:00–12:30 lunch break lock.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Interactive Quiz & Testing Engine</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Teacher-authored multiple-choice assessments, custom timers, student attempt management, and automatic server-side scoring.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Institutional Messaging</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Secure internal communications connecting Administrators, Teachers, and Students within institutional boundaries with unread status tracking.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10 hover:-translate-y-1 transition-all duration-300">
              <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Real-Time Performance Analytics</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Grade distributions, completion rates, and subject performance computed directly from live database submissions and assessments.
              </p>
            </div>
          </div>
        </section>

        {/* Role Portals Overview */}
        <section id="portals" className="mb-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 font-display">
              Dedicated Role Portals
            </h2>
            <p className="text-sm text-slate-400 max-w-xl mx-auto">
              Role-Based Access Control guarantees strict separation of duties and interfaces.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-gradient-to-b from-purple-950/20 to-transparent border border-purple-500/20 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                  <Building2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Administrator Portal</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Institution profile management, teacher and student account provisioning, class creation and allotment, weekly timetable builder, notices, and audit logs.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Institution registration & database control
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Account creation with initial credentials
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Conflict-free scheduling & room allocation
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleStart('admin')}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 active:scale-[0.98] rounded-lg transition-all cursor-pointer"
              >
                Access Admin Portal
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-pink-950/20 to-transparent border border-pink-500/20 hover:border-pink-500/50 hover:shadow-xl hover:shadow-pink-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-pink-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400 mb-4">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Teacher Portal</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Assigned class rosters, multi-class assignment authoring, submission grading, quiz creation, timetable viewing, and student communication.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" /> Provisioned exclusively by institution admin
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" /> Assignment review, grading, and resubmissions
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-pink-400" /> Quiz builder with automatic evaluation
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleStart('teacher')}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 active:scale-[0.98] rounded-lg transition-all cursor-pointer"
              >
                Access Teacher Portal (Login Only)
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-b from-purple-950/20 to-transparent border border-purple-500/20 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Student Portal</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Class timetable, assignment submission with file attachments, real-time grading and feedback, interactive quizzes, notices, and messaging.
                </p>
                <ul className="text-xs text-slate-300 space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Provisioned exclusively by institution admin
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Overdue tracking & resubmission requests
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> Actual grade and performance metrics
                  </li>
                </ul>
              </div>
              <button
                onClick={() => handleStart('student')}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 active:scale-[0.98] rounded-lg transition-all cursor-pointer"
              >
                Access Student Portal (Login Only)
              </button>
            </div>
          </div>
        </section>

        {/* Multi-Tenant Architecture Banner */}
        <section id="architecture" className="p-8 rounded-3xl bg-gradient-to-r from-purple-900/30 via-pink-900/20 to-purple-900/30 border border-white/10 text-center">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-purple-300 mx-auto mb-4">
            <Layers className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 font-display">Database-per-Institution Architecture</h2>
          <p className="text-sm text-slate-300 max-w-2xl mx-auto mb-6">
            Each educational institution operates on an isolated database instance. Cross-tenant access attempts are strictly blocked by backend authentication middleware and token verification.
          </p>
          <div className="flex items-center justify-center gap-3">
            <span className="px-3 py-1 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Master Registry: smart_crm_master
            </span>
            <span className="px-3 py-1 text-xs rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
              Tenant Database: smart_crm_[slug]_[timestamp]
            </span>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
        <p>Smart Institutional CRM — Multi-Tenant Architecture with Dedicated Database Isolation.</p>
      </footer>
    </div>
  );
};
export default LandingPage;
