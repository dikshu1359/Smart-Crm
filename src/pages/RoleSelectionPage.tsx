import React, { useState } from 'react';
import {
  Building2,
  Lock,
  GraduationCap,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Database,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types/crm';
import navbarLogo from '../assets/logo.png';

interface RoleSelectionProps {
  initialRole?: UserRole | null;
}

export const RoleSelectionPage: React.FC<RoleSelectionProps> = ({ initialRole }) => {
  const { login, registerInstitution, logout, setCurrentView, institutions } = useApp();

  const [role, setRole] = useState<UserRole | null>(initialRole || null);
  const [adminMode, setAdminMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedDb, setSelectedDb] = useState('');
  const [adminInstitutionName, setAdminInstitutionName] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('smart_crm_registered_institution') || '' : '';
  });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin registration form state
  const [instName, setInstName] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [campusCode, setCampusCode] = useState('');
  const [regError, setRegError] = useState('');
  const [regLoading, setRegLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim() || !password.trim()) {
      setLoginError('Please enter both your username/email and password.');
      return;
    }

    setLoginLoading(true);
    const targetScope = role === 'admin' ? (adminInstitutionName.trim() || undefined) : (selectedDb || undefined);
    const res = await login(username.trim(), password.trim(), targetScope);
    setLoginLoading(false);

    if (!res.ok) {
      setLoginError(res.message || 'Invalid credentials. Please verify your username/email and password.');
      return;
    }

    // Role portal validation: ensure credentials match the role portal selected
    if (role && res.user && res.user.role !== role) {
      logout();
      const correctPortal =
        res.user.role === 'admin'
          ? 'Administrator Portal'
          : res.user.role === 'teacher'
          ? 'Teacher / Faculty Portal'
          : 'Student Portal';
      setLoginError(`Access Denied: This account is registered with the role "${res.user.role}". Please switch to the ${correctPortal} to sign in.`);
      return;
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!instName.trim() || !adminUser.trim() || !adminName.trim() || !adminEmail.trim() || !regPassword.trim()) {
      setRegError('All institution registration fields are required.');
      return;
    }

    if (regPassword.length < 6) {
      setRegError('Password must be at least 6 characters long.');
      return;
    }

    if (regPassword !== confirmPassword) {
      setRegError('Passwords do not match.');
      return;
    }

    setRegLoading(true);
    const res = await registerInstitution({
      institutionName: instName.trim(),
      adminUsername: adminUser.trim(),
      adminName: adminName.trim(),
      adminEmail: adminEmail.trim(),
      password: regPassword,
      campusCode: campusCode.trim() || 'CAMPUS-01',
    });
    setRegLoading(false);

    if (!res.ok) {
      setRegError(res.message);
    } else {
      const savedInstName = (res as any).tenant?.institutionName || instName.trim();
      setAdminInstitutionName(savedInstName);
      if (typeof window !== 'undefined') {
        localStorage.setItem('smart_crm_registered_institution', savedInstName);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0A14] text-slate-100 flex flex-col justify-between p-6 relative overflow-x-hidden">
      {/* Ambient Lighting & Floating Animated Shapes */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0 select-none">
        <div className="absolute -top-40 -left-40 w-80 h-80 rounded-full bg-purple-600/15 blur-[120px] pulse-ambient" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 rounded-full bg-pink-600/15 blur-[140px] pulse-ambient" />
        <div className="absolute bottom-10 left-1/4 w-80 h-80 rounded-full bg-cyan-600/10 blur-[130px] pulse-ambient" />

        <div className="absolute top-20 right-[20%] w-10 h-10 rounded-xl border border-purple-500/20 bg-purple-500/5 float-drift-1" />
        <div className="absolute bottom-28 left-[15%] w-12 h-12 rounded-full border border-pink-500/20 bg-pink-500/5 float-drift-2" />
        <div className="absolute top-1/2 left-[10%] w-2 h-2 rounded-full bg-purple-400/30 float-drift-3" />
        <div className="absolute top-2/3 right-[12%] w-2.5 h-2.5 rounded-full bg-cyan-400/40 float-drift-1" />
      </div>

      {/* Top Bar with Back Button */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between mb-8 relative z-10">
        <button
          onClick={() => {
            if (role) {
              setRole(null);
            } else {
              setCurrentView('landing');
            }
          }}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{role ? 'Change Role' : 'Back to Home'}</span>
        </button>

        <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
          <div className="w-6 h-6 rounded-lg overflow-hidden border border-purple-500/30 bg-[#0d0c1d] shrink-0">
            <img src={navbarLogo} alt="Logo" className="w-full h-full object-cover" />
          </div>
          <span className="font-semibold text-white">Smart Institutional CRM</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-2xl w-full mx-auto my-auto">
        {!role ? (
          /* Step 1: Select Role */
          <div>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-white mb-2 font-display">
                Select Your Institutional Role
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                Choose your role to access your dedicated institutional workspace.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Admin Card */}
              <button
                onClick={() => setRole('admin')}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/60 hover:shadow-xl hover:shadow-purple-500/15 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 text-left group cursor-pointer backdrop-blur-md"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-105 group-hover:bg-purple-500/20 transition-all">
                  <Building2 className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-white mb-1">Administrator</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Register new institution or login to manage academic operations.
                </p>
                <span className="text-[11px] font-semibold text-purple-400 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Login & Register <ArrowRight className="w-3 h-3" />
                </span>
              </button>

              {/* Teacher Card */}
              <button
                onClick={() => setRole('teacher')}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-pink-500/60 hover:shadow-xl hover:shadow-pink-500/15 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 text-left group cursor-pointer backdrop-blur-md"
              >
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4 group-hover:scale-105 group-hover:bg-pink-500/20 transition-all">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-white mb-1">Teacher / Faculty</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Access classes, assignments, grading, quizzes, and timetable.
                </p>
                <span className="text-[11px] font-semibold text-pink-400 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Teacher Login <ArrowRight className="w-3 h-3" />
                </span>
              </button>

              {/* Student Card */}
              <button
                onClick={() => setRole('student')}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-cyan-500/60 hover:shadow-xl hover:shadow-cyan-500/15 hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 text-left group cursor-pointer backdrop-blur-md"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 group-hover:bg-cyan-500/20 transition-all">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-white mb-1">Student</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Access assignments, timetables, quizzes, results, and teacher chat.
                </p>
                <span className="text-[11px] font-semibold text-cyan-400 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Student Login <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Role Authentication Form */
          <div className="bg-white/[0.03] border border-white/10 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* Header info */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    role === 'admin'
                      ? 'bg-purple-500/20 text-purple-300'
                      : role === 'teacher'
                      ? 'bg-pink-500/20 text-pink-300'
                      : 'bg-purple-500/20 text-purple-300'
                  }`}
                >
                  {role === 'admin' && <Building2 className="w-5 h-5" />}
                  {role === 'teacher' && <Lock className="w-5 h-5" />}
                  {role === 'student' && <GraduationCap className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white capitalize">{role} Portal</h2>
                  <p className="text-xs text-slate-400">
                    {role === 'admin'
                      ? 'Institutional Administration & Provisioning'
                      : role === 'teacher'
                      ? 'Faculty Workspace (Login Only)'
                      : 'Student Academic Workspace (Login Only)'}
                  </p>
                </div>
              </div>

              {role === 'admin' && (
                <div className="flex rounded-lg bg-black/40 p-1 border border-white/10 text-xs">
                  <button
                    onClick={() => {
                      setAdminMode('login');
                      setLoginError('');
                    }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      adminMode === 'login' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setAdminMode('register');
                      setRegError('');
                    }}
                    className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                      adminMode === 'register' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Register Institution
                  </button>
                </div>
              )}
            </div>

            {/* Strict Notice for Teacher / Student regarding no self-registration */}
            {role !== 'admin' && (
              <div className="mb-6 p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                <p>
                  <strong>Notice:</strong> {role === 'teacher' ? 'Faculty' : 'Student'} accounts are created and
                  provisioned exclusively by your institution administrator. Contact your administration office for
                  your login credentials.
                </p>
              </div>
            )}

            {/* Admin Registration Form */}
            {role === 'admin' && adminMode === 'register' ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Institution Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={instName}
                      onChange={(e) => setInstName(e.target.value)}
                      placeholder="e.g. Apex Academy of Technology"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Campus Code
                    </label>
                    <input
                      type="text"
                      value={campusCode}
                      onChange={(e) => setCampusCode(e.target.value)}
                      placeholder="e.g. CAMPUS-01"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Administrator Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Dr. Alex Mercer"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Administrator Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="e.g. alex.mercer@apex.edu"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Admin Username (Unique Slug) *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminUser}
                    onChange={(e) => setAdminUser(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                    placeholder="e.g. apexadmin"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                  {adminUser && (
                    <p className="text-[11px] text-slate-400 mt-1 font-mono">
                      Isolated Database: smart_crm_{adminUser.slice(0, 16)}_[timestamp]
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Password (min 6 chars) *
                    </label>
                    <input
                      type="password"
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {regError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{regError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={regLoading}
                  className="w-full py-3 px-4 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {regLoading ? (
                    <span>Provisioning Isolated Database on MongoDB...</span>
                  ) : (
                    <>
                      <span>Register Institution & Provision Database</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Login Form (Admin, Teacher, or Student) */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Username or Registered Email *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={
                      role === 'admin'
                        ? 'admin@smartcrm.local or administrator username'
                        : role === 'teacher'
                        ? 'e.g. jdoe or john.doe@institution.edu'
                        : 'e.g. student_id or student@institution.edu'
                    }
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                  {role === 'admin' && (
                    <p className="text-[11px] text-purple-300/80 mt-1">
                      Predefined identifier: <code className="text-purple-200 font-mono">admin@smartcrm.local</code> (or registered administrator account).
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {role === 'admin' ? (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Institution Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={adminInstitutionName}
                      onChange={(e) => setAdminInstitutionName(e.target.value)}
                      placeholder="e.g. VCET or your registered institution name"
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Provide institution name if known, or leave blank to auto-detect across registered tenants.
                    </p>
                  </div>
                ) : (
                  institutions.length > 0 && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                        Institution (Optional Target Scope)
                      </label>
                      <select
                        value={selectedDb}
                        onChange={(e) => setSelectedDb(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                      >
                        <option value="">Auto-Detect via Cross-Database Auth</option>
                        {institutions.map((inst) => (
                          <option key={inst.databaseName} value={inst.databaseName}>
                            {inst.institutionName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                )}

                {loginError && (
                  <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className={`w-full py-3 px-4 text-xs font-semibold text-white rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 ${
                    role === 'teacher'
                      ? 'bg-pink-600 hover:bg-pink-500 shadow-pink-600/30'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 shadow-purple-600/30'
                  }`}
                >
                  {loginLoading ? (
                    <span>Verifying Credentials...</span>
                  ) : (
                    <>
                      <span>Sign In to {role.toUpperCase()} Workspace</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 py-4">
        Multi-Tenant Institutional CRM — Data Isolated Per Educational Institution
      </footer>
    </div>
  );
};
export default RoleSelectionPage;
