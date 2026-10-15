import React, { useState } from 'react';
import {
  ArrowRight,
  Database,
  CalendarClock,
  FileCheck2,
  BarChart3,
  Layers,
  Lock,
  Building2,
  UserCheck,
  GraduationCap,
  X,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NewLandingPage: React.FC = () => {
  const {
    state,
    activeTenant,
    currentUser,
    setCurrentView,
    switchPersona,
    crossDatabaseLogin,
    registerInstitution,
  } = useApp();

  const [tilt, setTilt] = useState({ rotateX: 7, rotateY: -11 });
  const [authModalMode, setAuthModalMode] = useState<'none' | 'login' | 'register'>('none');
  const [loginInput, setLoginInput] = useState('');
  const [loginFeedback, setLoginFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [instName, setInstName] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [campusCode, setCampusCode] = useState('');
  const [regError, setRegError] = useState('');

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rotateX: Number((-y * 14 + 4).toFixed(2)),
      rotateY: Number((x * 16 - 6).toFixed(2)),
    });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 7, rotateY: -11 });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = crossDatabaseLogin(loginInput);
    if (!res.ok) {
      setLoginFeedback({ type: 'error', text: res.message });
    } else {
      setLoginFeedback({ type: 'success', text: res.message });
      setTimeout(() => setAuthModalMode('none'), 300);
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instName.trim() || !adminUser.trim() || !adminFullName.trim() || !adminEmail.trim()) {
      setRegError('All institutional registration fields are required.');
      return;
    }
    registerInstitution({
      institutionName: instName.trim(),
      adminUsername: adminUser.trim(),
      adminName: adminFullName.trim(),
      adminEmail: adminEmail.trim(),
      campusCode: campusCode.trim() || 'CAMPUS-01',
    });
    setAuthModalMode('none');
  };

  const previewSlug = adminUser ? adminUser.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) : 'institution';

  return (
    <div className="min-h-screen bg-[#0B0A14] text-slate-100 relative overflow-x-hidden">
      {/* Top Bar */}
      <header className="relative z-20 flex items-center justify-between gap-8 max-w-[1360px] mx-auto px-6 py-5 border-b border-white/10">
        <a href="#top" className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0">
          Smart Institutional CRM
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#architecture" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Architecture
          </a>
          <a href="#capabilities" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Capabilities
          </a>
          <a href="#workflows" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Workflows
          </a>
          <a href="#tenants" className="hover:text-white transition-colors whitespace-nowrap shrink-0">
            Institutions
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            onClick={() => setCurrentView('dashboard')}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg hover:from-purple-500 hover:to-pink-500 transition-all cursor-pointer whitespace-nowrap shrink-0"
          >
            Launch Workspace
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-[1360px] mx-auto px-6 pt-12 pb-24">
        {/* Hero Section with 3D Spatial Card */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pb-20 border-b border-white/10">
          <div className="lg:col-span-6 space-y-6">
            <div className="text-xs font-medium text-purple-300">
              <span>Multi-Tenant Architecture</span>
              <span className="mx-2 text-slate-600">&middot;</span>
              <span>Database-Per-Institution</span>
              <span className="mx-2 text-slate-600">&middot;</span>
              <span>RBAC Security</span>
            </div>

            <h1 className="text-4xl sm:text-5xl font-bold font-display text-white leading-tight">
              Educational Operations with{' '}
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Isolated Tenant Databases
              </span>
            </h1>

            <p className="text-base text-slate-300 leading-relaxed max-w-xl">
              Automatic database creation on registration, conflict-free schedule management,
              and multi-class assignment workflows with grading and Recharts analytics.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:from-purple-500 hover:to-pink-500 shadow-xl cursor-pointer"
              >
                <span>Enter Live CRM Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setRegError('');
                  setAuthModalMode('register');
                }}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-medium text-slate-200 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 cursor-pointer"
              >
                <Database className="w-4 h-4 text-pink-400" />
                <span>Register Institution</span>
              </button>

              <button
                onClick={() => {
                  setLoginFeedback(null);
                  setAuthModalMode('login');
                }}
                className="px-4 py-3 text-sm font-medium text-purple-300 hover:text-white cursor-pointer"
              >
                Cross-DB Login
              </button>
            </div>

            <div className="pt-4 border-t border-white/10">
              <p className="text-xs text-slate-400 mb-3">
                Instant Role Access &mdash; Switch to active tenant ({activeTenant.databaseName}):
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {(['admin', 'teacher', 'student'] as const).map((role) => {
                  const userForRole = activeTenant.users.find((u) => u.role === role);
                  if (!userForRole) return null;
                  const isCurrent = currentUser.id === userForRole.id;
                  return (
                    <button
                      key={role}
                      onClick={() => switchPersona(activeTenant.databaseName, userForRole.id)}
                      className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-purple-600/20 border-purple-400 text-white'
                          : 'bg-white/[0.03] border-white/10 text-slate-300 hover:border-purple-400/50'
                      }`}
                    >
                      <div className="text-xs font-semibold capitalize text-purple-300">{role} View</div>
                      <div className="text-sm font-medium text-white truncate">{userForRole.fullName}</div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">@{userForRole.username}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3D Glass Stage */}
          <div
            className="lg:col-span-6 py-4"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ perspective: 1200 }}
          >
            <div
              className="p-6 rounded-2xl bg-white/[0.04] backdrop-blur-xl border border-white/15 shadow-2xl transition-transform duration-200 ease-out"
              style={{
                transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div>
                  <div className="text-xs text-purple-300 font-medium">Multi-Tenant Database Engine</div>
                  <div className="text-base font-bold text-white font-display">smart_crm_master &rarr; Tenants</div>
                </div>
                <span className="text-xs font-mono text-pink-300">
                  {state.masterDb.institutions.length} Active Databases
                </span>
              </div>

              <div className="space-y-3 mb-5">
                {state.masterDb.institutions.slice(0, 2).map((inst) => (
                  <div key={inst.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{inst.institutionName}</div>
                      <div className="text-xs font-mono text-purple-300">{inst.databaseName}</div>
                    </div>
                    <div className="text-xs text-slate-400 font-mono text-right">
                      {state.tenants[inst.databaseName]?.users.length || 0} Users
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20">
                  <div className="text-slate-400">Time Slots</div>
                  <div className="font-mono text-white font-bold mt-1">09:00 - 14:30</div>
                </div>
                <div className="p-2.5 rounded-xl bg-pink-950/30 border border-pink-500/20">
                  <div className="text-slate-400">Review</div>
                  <div className="font-mono text-white font-bold mt-1">Accept / Grade</div>
                </div>
                <div className="p-2.5 rounded-xl bg-fuchsia-950/30 border border-fuchsia-500/20">
                  <div className="text-slate-400">Audit Logs</div>
                  <div className="font-mono text-white font-bold mt-1">{state.masterDb.masterLogs.length} Events</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento */}
        <section id="capabilities" className="py-16">
          <h2 className="text-2xl font-bold font-display text-white mb-8">Comprehensive Institutional Capabilities</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <Database className="w-6 h-6 text-purple-400 mb-3" />
              <h3 className="text-lg font-bold text-white font-display">Multi-Tenant Database-per-Institution</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Master registry with automatic tenant creation: smart_crm_[username]_[timestamp].
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <FileCheck2 className="w-6 h-6 text-pink-400 mb-3" />
              <h3 className="text-lg font-bold text-white font-display">Multi-Class Assignments &amp; Reviews</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Accept, reject, grade, or reassign workflows with file attachment uploads.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
              <CalendarClock className="w-6 h-6 text-purple-400 mb-3" />
              <h3 className="text-lg font-bold text-white font-display">Conflict-Free Schedule</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                09:00 - 14:30 timetable with automatic teacher/room conflict prevention and lunch break.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Modal for Cross-DB Login & Registration */}
      {authModalMode !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white font-display">
                {authModalMode === 'login' ? 'Cross-Database Login' : 'Register New Institution'}
              </h3>
              <button onClick={() => setAuthModalMode('none')} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {authModalMode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Username or Email</label>
                  <input
                    type="text"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    placeholder="e.g., stxaviers, erostova, asharma"
                    className="w-full px-3.5 py-2 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  />
                </div>
                {loginFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs ${loginFeedback.type === 'error' ? 'bg-red-950/60 text-red-200' : 'bg-emerald-950/60 text-emerald-200'}`}>
                    {loginFeedback.text}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setAuthModalMode('none')} className="px-3 py-1.5 text-xs text-slate-300">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl">
                    Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <div className="p-2.5 rounded-xl bg-purple-950/30 text-xs font-mono text-purple-300">
                  Target DB: smart_crm_{previewSlug}_[timestamp]
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Institution Name</label>
                  <input
                    type="text"
                    required
                    value={instName}
                    onChange={(e) => setInstName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Admin Username</label>
                  <input
                    type="text"
                    required
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-xl text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={adminFullName}
                    onChange={(e) => setAdminFullName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  />
                </div>
                {regError && <div className="p-2 bg-red-950/60 text-xs text-red-200 rounded-lg">{regError}</div>}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setAuthModalMode('none')} className="px-3 py-1.5 text-xs text-slate-300">
                    Cancel
                  </button>
                  <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl">
                    Provision Database
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
