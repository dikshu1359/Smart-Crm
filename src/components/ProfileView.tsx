import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  UserCircle,
  Save,
  CheckCircle2,
  AlertCircle,
  Printer,
  GraduationCap,
  Building2,
  BookOpen,
  Phone,
  Mail,
  MapPin,
  Calendar,
} from 'lucide-react';
import api from '../services/api';

export const ProfileView: React.FC = () => {
  const { activeTenant, currentUser, refreshData, setActiveTab } = useApp();
  if (!activeTenant || !currentUser) return null;

  const isStudent = currentUser.role === 'student';
  const isTeacher = currentUser.role === 'teacher';
  const isAdmin = currentUser.role === 'admin';

  // Editable Profile States
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [gradeLevel, setGradeLevel] = useState(currentUser.gradeLevel || '');
  const [departmentBranch, setDepartmentBranch] = useState(currentUser.departmentBranch || '');
  const [classDivision, setClassDivision] = useState(currentUser.classDivision || '');
  const [rollNumber, setRollNumber] = useState(currentUser.rollNumber || '');
  const [guardianContact, setGuardianContact] = useState(currentUser.guardianContact || '');
  const [residentialAddress, setResidentialAddress] = useState(currentUser.residentialAddress || '');
  const [specialization, setSpecialization] = useState(currentUser.specialization || '');
  const [qualification, setQualification] = useState(currentUser.qualification || '');

  // Status states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    const userId = currentUser.id || (currentUser as any)._id;

    const payload: any = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      residentialAddress: residentialAddress.trim(),
    };

    if (isStudent) {
      payload.gradeLevel = gradeLevel.trim();
      payload.departmentBranch = departmentBranch.trim();
      payload.classDivision = classDivision.trim();
      payload.rollNumber = rollNumber.trim();
      payload.guardianContact = guardianContact.trim();
    }

    if (isTeacher) {
      payload.specialization = specialization.trim();
      payload.qualification = qualification.trim();
    }

    try {
      const res = await api.updateUser(activeTenant.databaseName, userId, payload);
      setIsSaving(false);

      if (res.success && res.user) {
        setSaveSuccess('Profile successfully updated and saved to database.');
        await refreshData();
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setSaveError(res.message || 'Failed to update profile record.');
      }
    } catch (err: any) {
      setIsSaving(false);
      setSaveError(err.message || 'An error occurred while saving profile changes.');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Personal Profile &amp; Role Details</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your institutional profile, academic credentials, and tenant database bindings.
          </p>
        </div>

        {isStudent && (
          <button
            type="button"
            onClick={() => setActiveTab('student-data')}
            className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>View &amp; Print Enrolment Form</span>
          </button>
        )}
      </div>

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Profile Card Header */}
        <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-5 border-b border-white/10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-xl shadow-lg">
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : <UserCircle className="w-7 h-7" />}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white">{currentUser.fullName}</h2>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                @{currentUser.username} &middot; {currentUser.email}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[11px] font-bold uppercase font-mono px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  {currentUser.role}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  DB: {currentUser.databaseName}
                </span>
              </div>
            </div>
          </div>

          {/* Quick System Information */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
              <span className="text-slate-400 block mb-0.5">Institution</span>
              <span className="text-white font-semibold truncate block">{activeTenant.institutionName}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
              <span className="text-slate-400 block mb-0.5">Campus Code</span>
              <span className="text-purple-300 font-mono">{activeTenant.campusCode || 'MAIN-01'}</span>
            </div>
            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
              <span className="text-slate-400 block mb-0.5">Account Status</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Verified
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
              <span className="text-slate-400 block mb-0.5">Joined Date</span>
              <span className="text-slate-300 font-mono">
                {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Active'}
              </span>
            </div>
          </div>

          {/* Student Specific Academic Fields (Manual Grade Level Entry) */}
          {isStudent && (
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                <GraduationCap className="w-4 h-4" />
                <span>Student Academic Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Roll Number */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Roll Number / Student ID
                  </label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. CS-101"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Grade Level - Manual Entry with Datalist Suggestions */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Grade Level (Manual Entry) *
                  </label>
                  <input
                    type="text"
                    list="profile-grade-presets"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    placeholder="e.g. First Year, TY Computer Engineering"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-purple-500/50 rounded-xl text-white font-medium focus:outline-none focus:border-purple-400"
                  />
                  <datalist id="profile-grade-presets">
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
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Freeform entry allowed. Type custom year or branch.
                  </span>
                </div>

                {/* Department / Branch */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Department / Branch
                  </label>
                  <input
                    type="text"
                    value={departmentBranch}
                    onChange={(e) => setDepartmentBranch(e.target.value)}
                    placeholder="e.g. Computer Engineering"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Class / Division */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Class / Division
                  </label>
                  <input
                    type="text"
                    value={classDivision}
                    onChange={(e) => setClassDivision(e.target.value)}
                    placeholder="e.g. Division A, Lab Group 2"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Guardian Contact */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Guardian Contact Phone
                  </label>
                  <input
                    type="text"
                    value={guardianContact}
                    onChange={(e) => setGuardianContact(e.target.value)}
                    placeholder="e.g. +91 9876543210"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Teacher Specific Academic Fields */}
          {isTeacher && (
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                <BookOpen className="w-4 h-4" />
                <span>Faculty Academic Profile</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Specialization / Subjects</label>
                  <input
                    type="text"
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Database Systems, OS"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Highest Qualification</label>
                  <input
                    type="text"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    placeholder="e.g. Ph.D. in Computer Science"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Personal & Contact Details */}
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-300">
              Personal &amp; Contact Information
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Residential Address</label>
              <input
                type="text"
                value={residentialAddress}
                onChange={(e) => setResidentialAddress(e.target.value)}
                placeholder="Street Address, City, Postal Code"
                className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>

          {/* Status Feedback */}
          {saveError && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccess}</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile Updates</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProfileView;
