import React, { useState } from 'react';
import {
  UserPlus,
  Trash2,
  Search,
  X,
  KeyRound,
  Check,
  Copy,
  Eye,
  EyeOff,
  Sparkles,
  ShieldAlert,
  GraduationCap,
  Building2,
  CheckCircle2,
  AlertCircle,
  Users,
  BookOpen,
  UploadCloud,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TenantUser, SchoolClass } from '../types/crm';
import { BulkUserImportModal } from './BulkUserImportModal';

export const UserManagement: React.FC = () => {
  const { activeTenant, users, classes, createUser, deleteUser, refreshData } = useApp();
  if (!activeTenant) return null;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'teacher' | 'student'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [specialization, setSpecialization] = useState('');
  const [qualification, setQualification] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [gradeLevel, setGradeLevel] = useState('First Year');
  const [departmentBranch, setDepartmentBranch] = useState('Computer Engineering');
  const [classDivision, setClassDivision] = useState('Section A');
  const [admissionId, setAdmissionId] = useState('');
  const [academicYear, setAcademicYear] = useState('2025-2026');
  const [assignedClassId, setAssignedClassId] = useState('');
  const [assignedClassIds, setAssignedClassIds] = useState<string[]>([]);

  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Success Credential Modal state
  const [createdCredentials, setCreatedCredentials] = useState<{
    fullName: string;
    username: string;
    email: string;
    role: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const generateRandomPassword = (targetRole: string) => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const prefix = targetRole === 'teacher' ? 'Faculty' : 'Student';
    return `${prefix}#${randomNum}`;
  };

  const handleOpenAddModal = () => {
    setFullName('');
    setUsername('');
    setEmail('');
    setRole('student');
    setPassword(generateRandomPassword('student'));
    setSpecialization('');
    setQualification('');
    setRollNumber('');
    setGradeLevel('First Year');
    setDepartmentBranch('Computer Engineering');
    setClassDivision('Section A');
    setAdmissionId(`ADM-${Date.now().toString().slice(-4)}`);
    setAcademicYear('2025-2026');
    setAssignedClassId('');
    setAssignedClassIds([]);
    setFormError('');
    setShowAddModal(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim() || !username.trim() || !email.trim()) {
      setFormError('Full Name, Username, and Email are required.');
      return;
    }

    if (password && password.trim().length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    setFormLoading(true);
    const pwdToSave = password.trim() || generateRandomPassword(role);

    const payload: any = {
      fullName: fullName.trim(),
      username: username.toLowerCase().trim(),
      email: email.trim().toLowerCase(),
      role,
      password: pwdToSave,
      phone: '+1 (555) 000-0000',
    };

    if (role === 'teacher') {
      payload.specialization = specialization.trim() || 'General Education';
      payload.qualification = qualification.trim() || 'B.Ed / M.Sc';
      payload.assignedClassIds = assignedClassIds;
    } else {
      payload.rollNumber = rollNumber.trim() || `STU-${Date.now().toString().slice(-4)}`;
      payload.gradeLevel = gradeLevel.trim();
      payload.departmentBranch = departmentBranch.trim();
      payload.classDivision = classDivision.trim();
      payload.admissionId = admissionId.trim();
      payload.academicYear = academicYear.trim();
      payload.assignedClassId = assignedClassId;
    }

    const res = await createUser(payload);
    setFormLoading(false);

    if (!res.ok) {
      setFormError(res.message || 'Failed to create user account.');
      return;
    }

    // Success: reveal credentials to Admin
    setShowAddModal(false);
    setCreatedCredentials({
      fullName: fullName.trim(),
      username: username.toLowerCase().trim(),
      email: email.trim().toLowerCase(),
      role,
      password: res.initialPassword || pwdToSave,
    });
  };

  const handleCopyCredentials = () => {
    if (!createdCredentials) return;
    const portalName = createdCredentials.role === 'teacher' ? 'Teacher / Faculty Portal' : 'Student Portal';
    const text = [
      `==============================`,
      `Smart Institutional CRM Credentials`,
      `==============================`,
      `Institution: ${activeTenant.institutionName}`,
      `Account Role: ${createdCredentials.role.toUpperCase()}`,
      `Authorized Portal: ${portalName}`,
      `Full Name: ${createdCredentials.fullName}`,
      `Username: ${createdCredentials.username}`,
      `Email: ${createdCredentials.email}`,
      `Initial Password: ${createdCredentials.password}`,
      `==============================`,
      `Note: Please change your password upon your first login.`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const teachers = users.filter((u: TenantUser) => u.role === 'teacher');
  const students = users.filter((u: TenantUser) => u.role === 'student');

  const filteredUsers = users.filter((u: TenantUser) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.rollNumber && u.rollNumber.toLowerCase().includes(q)) ||
      (u.specialization && u.specialization.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">User Directory &amp; RBAC Control</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage, provision, and issue login credentials for institutional faculty and students.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setShowBulkModal(true)}
            className="px-4 py-2.5 text-xs font-semibold text-purple-200 bg-white/[0.05] hover:bg-white/[0.1] border border-purple-500/30 hover:border-purple-500/60 rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <UploadCloud className="w-4 h-4 text-purple-400" />
            <span>Bulk Import Users</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Create User Account</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Role Segment Tabs */}
        <div className="flex rounded-xl bg-black/40 p-1 border border-white/10 text-xs">
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              roleFilter === 'all' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            All Accounts ({users.length})
          </button>
          <button
            onClick={() => setRoleFilter('teacher')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              roleFilter === 'teacher' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Teachers ({teachers.length})
          </button>
          <button
            onClick={() => setRoleFilter('student')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              roleFilter === 'student' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            Students ({students.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, username, roll #, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* User Table */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-white/[0.01]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Cohort / Specialization</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-500">
                    No matching users found in this institution. Click "+ Create User Account" to add one.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => {
                  const userKey = u.id || (u as any)._id || u.username || `user-${idx}`;
                  const studentClass = u.role === 'student' ? classes.find((c: SchoolClass) => c.id === u.assignedClassId) : null;

                  return (
                    <tr key={userKey} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] ${
                              u.role === 'admin'
                                ? 'bg-purple-600/30 text-purple-300'
                                : u.role === 'teacher'
                                ? 'bg-pink-600/30 text-pink-300'
                                : 'bg-blue-600/30 text-blue-300'
                            }`}
                          >
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <span>{u.fullName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`capitalize text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            u.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : u.role === 'teacher'
                              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-purple-300 font-mono text-[11px]">{u.username}</td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">{u.email}</td>
                      <td className="py-3.5 px-4 text-slate-300 text-[11px]">
                        {u.role === 'teacher' ? (
                          <span>{u.specialization || 'Faculty Member'}</span>
                        ) : u.role === 'student' ? (
                          <span>
                            {studentClass?.name || 'Unassigned'} {u.rollNumber ? `(${u.rollNumber})` : ''}
                          </span>
                        ) : (
                          <span className="text-slate-500">System Admin</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete account "${u.fullName}"?`)) {
                                deleteUser(userKey);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                            title="Delete user"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#141124] rounded-3xl max-w-lg w-full p-6 border border-white/15 shadow-2xl my-8">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-5">
              <div>
                <h3 className="text-base font-bold text-white font-display">Create Account &amp; Credentials</h3>
                <p className="text-[11px] text-slate-400">
                  Provision an official account within {activeTenant.institutionName}.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Role Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Account Role *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setRole('student');
                      setPassword(generateRandomPassword('student'));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      role === 'student'
                        ? 'bg-purple-600/20 border-purple-500 text-white'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <GraduationCap className={`w-5 h-5 ${role === 'student' ? 'text-purple-400' : 'text-slate-500'}`} />
                    <div>
                      <div className="text-xs font-bold">Student</div>
                      <div className="text-[10px] text-slate-400">Class &amp; Quiz Portal</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRole('teacher');
                      setPassword(generateRandomPassword('teacher'));
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      role === 'teacher'
                        ? 'bg-pink-600/20 border-pink-500 text-white'
                        : 'bg-black/30 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Building2 className={`w-5 h-5 ${role === 'teacher' ? 'text-pink-400' : 'text-slate-500'}`} />
                    <div>
                      <div className="text-xs font-bold">Teacher / Faculty</div>
                      <div className="text-[10px] text-slate-400">Grading &amp; Timetable</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Full Name & Username */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (!username) {
                        const clean = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, '_')
                          .slice(0, 16);
                        setUsername(clean);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Username (Login ID) *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. s_jenkins"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                    className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Official Email *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sarah.jenkins@institution.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Role-Specific Fields */}
              {role === 'teacher' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Department / Specialization
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Physics &amp; Mathematics"
                      value={specialization}
                      onChange={(e) => setSpecialization(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">Qualification</label>
                    <input
                      type="text"
                      placeholder="e.g. Ph.D., M.Sc."
                      value={qualification}
                      onChange={(e) => setQualification(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-3.5 rounded-2xl bg-white/[0.02] border border-white/10">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Roll / Student ID *</label>
                      <input
                        type="text"
                        placeholder="e.g. CS-101"
                        value={rollNumber}
                        onChange={(e) => setRollNumber(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Grade Level (Manual Entry) *
                      </label>
                      <input
                        type="text"
                        list="grade-level-presets"
                        placeholder="e.g. First Year, TY Computer Engineering"
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-black/40 border border-purple-500/40 rounded-xl text-white focus:outline-none focus:border-purple-400"
                      />
                      <datalist id="grade-level-presets">
                        <option value="First Year" />
                        <option value="Second Year" />
                        <option value="Third Year" />
                        <option value="Final Year" />
                        <option value="FY Computer Engineering" />
                        <option value="SY Computer Engineering" />
                        <option value="TY Computer Engineering" />
                        <option value="Grade 11" />
                        <option value="Grade 12" />
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Department / Branch</label>
                      <input
                        type="text"
                        list="department-presets"
                        placeholder="e.g. Computer Engineering"
                        value={departmentBranch}
                        onChange={(e) => setDepartmentBranch(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white"
                      />
                      <datalist id="department-presets">
                        <option value="Computer Engineering" />
                        <option value="Information Technology" />
                        <option value="Electronics & Telecommunication" />
                        <option value="Mechanical Engineering" />
                        <option value="Civil Engineering" />
                      </datalist>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Class / Division</label>
                      <input
                        type="text"
                        placeholder="e.g. Section A"
                        value={classDivision}
                        onChange={(e) => setClassDivision(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Admission ID</label>
                      <input
                        type="text"
                        placeholder="e.g. ADM-2025-010"
                        value={admissionId}
                        onChange={(e) => setAdmissionId(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Assign Class (Allotment)</label>
                      <select
                        value={assignedClassId}
                        onChange={(e) => setAssignedClassId(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white"
                      >
                        <option value="">-- No class allotted --</option>
                        {classes.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Password Setting & Generation */}
              <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-purple-200 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-pink-400" />
                    <span>Initial Login Password *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setPassword(generateRandomPassword(role))}
                    className="text-[11px] text-pink-400 hover:text-pink-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Auto-Generate</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full pl-3 pr-10 py-2 text-xs bg-black/50 border border-white/15 rounded-xl text-white font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Password will be hashed with bcrypt on the backend before being committed to MongoDB.
                </p>
              </div>

              {/* Error Banner */}
              {formError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {formLoading ? (
                    <span>Saving to Database...</span>
                  ) : (
                    <>
                      <span>Create Account &amp; Issue Credentials</span>
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Credentials Modal */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#141124] rounded-3xl max-w-md w-full p-6 border border-emerald-500/30 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">Account Provisioned in Database</h3>
                <p className="text-[11px] text-slate-400">
                  Login credentials have been generated and committed to the tenant database.
                </p>
              </div>
            </div>

            {/* Credential Card */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2.5 font-mono text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-white/10 text-[11px] text-slate-400">
                <span>PORTAL:</span>
                <span className="capitalize font-bold text-purple-300">
                  {createdCredentials.role === 'teacher' ? 'Teacher / Faculty Portal' : 'Student Portal'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">FULL NAME:</span>
                <span className="text-white font-sans font-semibold">{createdCredentials.fullName}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">USERNAME:</span>
                <span className="text-purple-300 font-bold">{createdCredentials.username}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-400">EMAIL:</span>
                <span className="text-slate-200">{createdCredentials.email}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/10">
                <span className="text-slate-400">PASSWORD:</span>
                <span className="text-pink-300 font-bold bg-pink-950/40 px-2 py-0.5 rounded border border-pink-500/30">
                  {createdCredentials.password}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              The user can now log into their dedicated{' '}
              <strong className="text-white capitalize">{createdCredentials.role} Dashboard</strong> using either their
              username (<span className="text-purple-300 font-mono">{createdCredentials.username}</span>) or email with this password.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-purple-600/30"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Login Credentials</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setCreatedCredentials(null)}
                className="py-2.5 px-4 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer border border-white/10"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk User Import Modal */}
      <BulkUserImportModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        databaseName={activeTenant.databaseName}
        institutionName={activeTenant.institutionName}
        classes={classes}
        existingUsers={users}
        onImportComplete={refreshData}
      />
    </div>
  );
};
