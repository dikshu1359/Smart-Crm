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
  Lock,
  Users,
  Briefcase,
  User,
} from 'lucide-react';
import api from '../services/api';

export const ProfileView: React.FC = () => {
  const { activeTenant, currentUser, refreshData, setActiveTab, classes } = useApp();
  if (!activeTenant || !currentUser) return null;

  const isStudent = currentUser.role === 'student';
  const isTeacher = currentUser.role === 'teacher';
  const isAdmin = currentUser.role === 'admin';

  // Section A: Personal Details
  const [fullName, setFullName] = useState(currentUser.fullName || '');
  const [email, setEmail] = useState(currentUser.email || '');
  const [phone, setPhone] = useState(currentUser.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(currentUser.dateOfBirth || '');
  const [gender, setGender] = useState(currentUser.gender || 'Male');
  const [residentialAddress, setResidentialAddress] = useState(currentUser.residentialAddress || '');
  const [rollNumber, setRollNumber] = useState(currentUser.rollNumber || '');
  const [gradeLevel, setGradeLevel] = useState(currentUser.gradeLevel || '');
  const [departmentBranch, setDepartmentBranch] = useState(currentUser.departmentBranch || '');
  const [classDivision, setClassDivision] = useState(currentUser.classDivision || '');
  const [casteCategory, setCasteCategory] = useState(currentUser.casteCategory || 'General');
  const [religion, setReligion] = useState(currentUser.religion || '');

  // Section B: Parent / Guardian Details
  const [fatherName, setFatherName] = useState(currentUser.fatherName || '');
  const [fatherContact, setFatherContact] = useState(currentUser.fatherContact || '');
  const [fatherOccupation, setFatherOccupation] = useState(currentUser.fatherOccupation || '');
  const [fatherAddress, setFatherAddress] = useState(currentUser.fatherAddress || currentUser.residentialAddress || '');
  const [motherName, setMotherName] = useState(currentUser.motherName || '');
  const [motherContact, setMotherContact] = useState(currentUser.motherContact || '');
  const [motherOccupation, setMotherOccupation] = useState(currentUser.motherOccupation || '');
  const [motherAddress, setMotherAddress] = useState(currentUser.motherAddress || currentUser.residentialAddress || '');
  const [guardianContact, setGuardianContact] = useState(currentUser.guardianContact || currentUser.fatherContact || '');

  // Teacher specific
  const [specialization, setSpecialization] = useState(currentUser.specialization || '');
  const [qualification, setQualification] = useState(currentUser.qualification || '');

  // Status states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const assignedClass = classes.find(
    (c) => c.id === currentUser.assignedClassId || (c as any)._id === currentUser.assignedClassId
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validations
    if (!fullName.trim()) {
      setSaveError('Full legal name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setSaveError('A valid email address is required.');
      return;
    }

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
      payload.dateOfBirth = dateOfBirth;
      payload.gender = gender;
      payload.gradeLevel = gradeLevel.trim();
      payload.departmentBranch = departmentBranch.trim();
      payload.classDivision = classDivision.trim();
      payload.casteCategory = casteCategory.trim();
      payload.religion = religion.trim();

      // Parent Details
      payload.fatherName = fatherName.trim();
      payload.fatherContact = fatherContact.trim();
      payload.fatherOccupation = fatherOccupation.trim();
      payload.fatherAddress = fatherAddress.trim();
      payload.motherName = motherName.trim();
      payload.motherContact = motherContact.trim();
      payload.motherOccupation = motherOccupation.trim();
      payload.motherAddress = motherAddress.trim();
      payload.guardianContact = guardianContact.trim();
    }

    if (isAdmin) {
      payload.rollNumber = rollNumber.trim();
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
        setTimeout(() => setSaveSuccess(null), 5000);
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
            Manage your official institutional profile, personal particulars, and parent/guardian contact information.
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
        <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-5 border-b border-white/10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
              {currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : <UserCircle className="w-8 h-8" />}
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
              <span className="text-slate-400 block mb-0.5">Cohort Assignment</span>
              <span className="text-slate-200 truncate block">
                {assignedClass?.name || 'Computer Science Cohort'}
              </span>
            </div>
          </div>

          {/* SECTION A: PERSONAL DETAILS */}
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
              <User className="w-4 h-4" />
              <span>Section A: Personal Details</span>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98200 88991"
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Protected Roll Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Roll Number</span>
                  {!isAdmin && <span className="text-[10px] text-amber-400 font-normal">Protected</span>}
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="e.g. CS-101"
                  className={`w-full px-3.5 py-2 text-xs font-mono rounded-xl ${
                    !isAdmin
                      ? 'bg-white/5 border border-white/5 text-slate-400 cursor-not-allowed'
                      : 'bg-black/40 border border-white/15 text-white focus:border-purple-500'
                  }`}
                />
              </div>

              {/* Protected Class */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center justify-between">
                  <span>Class</span>
                  {!isAdmin && <span className="text-[10px] text-amber-400 font-normal">Protected</span>}
                </label>
                <input
                  type="text"
                  disabled
                  value={assignedClass?.name || 'B.Tech Computer Science'}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-white/5 border border-white/5 text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Division / Section</label>
                <input
                  type="text"
                  value={classDivision}
                  onChange={(e) => setClassDivision(e.target.value)}
                  placeholder="e.g. Division A"
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Grade Level</label>
                <input
                  type="text"
                  list="profile-grade-presets"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="e.g. Year 3 / Semester 5"
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-purple-500/50 rounded-xl text-white font-medium focus:outline-none focus:border-purple-400"
                />
                <datalist id="profile-grade-presets">
                  <option value="First Year" />
                  <option value="Second Year" />
                  <option value="Third Year" />
                  <option value="Final Year" />
                  <option value="Year 3 / Semester 5" />
                  <option value="Year 3 / Semester 6" />
                  <option value="Grade 11" />
                  <option value="Grade 12" />
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Caste / Category</label>
                <input
                  type="text"
                  value={casteCategory}
                  onChange={(e) => setCasteCategory(e.target.value)}
                  placeholder="e.g. General, OBC, SC, ST"
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Department / Branch</label>
                <input
                  type="text"
                  value={departmentBranch}
                  onChange={(e) => setDepartmentBranch(e.target.value)}
                  placeholder="e.g. Computer Engineering"
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
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
          </div>

          {/* SECTION B: PARENT / GUARDIAN DETAILS (For Students) */}
          {isStudent && (
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-300">
                <Users className="w-4 h-4" />
                <span>Section B: Parent / Guardian Details</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Father's Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    placeholder="Father's Name"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Father's Phone Number</label>
                  <input
                    type="text"
                    value={fatherContact}
                    onChange={(e) => setFatherContact(e.target.value)}
                    placeholder="e.g. +91 98200 11223"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Father's Occupation</label>
                  <input
                    type="text"
                    value={fatherOccupation}
                    onChange={(e) => setFatherOccupation(e.target.value)}
                    placeholder="e.g. Electrical Engineer"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Father's Address</label>
                  <input
                    type="text"
                    value={fatherAddress}
                    onChange={(e) => setFatherAddress(e.target.value)}
                    placeholder="Residential or Office Address"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mother's Name</label>
                  <input
                    type="text"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    placeholder="Mother's Name"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mother's Phone Number</label>
                  <input
                    type="text"
                    value={motherContact}
                    onChange={(e) => setMotherContact(e.target.value)}
                    placeholder="e.g. +91 98200 11224"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mother's Occupation</label>
                  <input
                    type="text"
                    value={motherOccupation}
                    onChange={(e) => setMotherOccupation(e.target.value)}
                    placeholder="e.g. Lecturer"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mother's Address</label>
                  <input
                    type="text"
                    value={motherAddress}
                    onChange={(e) => setMotherAddress(e.target.value)}
                    placeholder="Residential or Office Address"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Primary Guardian Contact Phone</label>
                  <input
                    type="text"
                    value={guardianContact}
                    onChange={(e) => setGuardianContact(e.target.value)}
                    placeholder="e.g. +91 98200 11223"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Teacher Academic Profile */}
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
