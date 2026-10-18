import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Printer,
  User,
  GraduationCap,
  Building2,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Shield,
  FileText,
  X,
  AlertCircle,
  Eye,
  CheckCircle2,
  Pencil,
  Save,
  Lock,
  Briefcase,
  UserCheck,
  Users,
  Download,
  Loader2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TenantUser, SchoolClass } from '../types/crm';
import api from '../services/api';
import { exportProfileToPdf } from '../utils/exportProfilePdf';

export const StudentImportantInformation: React.FC = () => {
  const { activeTenant, currentUser, users, classes, refreshData, printUserForm } = useApp();

  if (!currentUser || !activeTenant) return null;

  const isAdmin = currentUser.role === 'admin';
  const isTeacher = currentUser.role === 'teacher';
  const isStudent = currentUser.role === 'student';

  // Search and filter states (for Admin & Teacher)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<TenantUser | null>(null);

  // Printing state
  const [printingStudent, setPrintingStudent] = useState<TenantUser | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  // Student Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form Fields - Section A: Personal Details
  const [formDataFullName, setFormDataFullName] = useState('');
  const [formDataEmail, setFormDataEmail] = useState('');
  const [formDataPhone, setFormDataPhone] = useState('');
  const [formDataDob, setFormDataDob] = useState('');
  const [formDataGender, setFormDataGender] = useState('');
  const [formDataAddress, setFormDataAddress] = useState('');
  const [formDataRollNumber, setFormDataRollNumber] = useState('');
  const [formDataAssignedClassId, setFormDataAssignedClassId] = useState('');
  const [formDataClassDivision, setFormDataClassDivision] = useState('');
  const [formDataGradeLevel, setFormDataGradeLevel] = useState('');
  const [formDataCasteCategory, setFormDataCasteCategory] = useState('');
  const [formDataDepartment, setFormDataDepartment] = useState('');
  const [formDataReligion, setFormDataReligion] = useState('');

  // Form Fields - Section B: Parent / Guardian Details
  const [formDataFatherName, setFormDataFatherName] = useState('');
  const [formDataFatherPhone, setFormDataFatherPhone] = useState('');
  const [formDataFatherOccupation, setFormDataFatherOccupation] = useState('');
  const [formDataFatherAddress, setFormDataFatherAddress] = useState('');
  const [formDataMotherName, setFormDataMotherName] = useState('');
  const [formDataMotherPhone, setFormDataMotherPhone] = useState('');
  const [formDataMotherOccupation, setFormDataMotherOccupation] = useState('');
  const [formDataMotherAddress, setFormDataMotherAddress] = useState('');
  const [formDataGuardianContact, setFormDataGuardianContact] = useState('');

  // Eligible students based on role permissions
  const eligibleStudents = useMemo(() => {
    if (isStudent) {
      // Student can ONLY query/view their own profile
      return users.filter(
        (u) => u.role === 'student' && (u.id === currentUser.id || (u as any)._id === currentUser.id)
      );
    }

    if (isTeacher) {
      // Teacher sees students belonging strictly to their assigned classes
      const teacherClassIds = new Set([
        ...(currentUser.assignedClassIds || []),
        ...classes
          .filter((c: SchoolClass) => c.primaryTeacherId === currentUser.id)
          .map((c) => c.id || (c as any)._id),
      ]);

      return users.filter((u: TenantUser) => {
        if (u.role !== 'student') return false;
        const studentClass = u.assignedClassId || (u.assignedClassIds && u.assignedClassIds[0]);
        return teacherClassIds.size > 0 ? teacherClassIds.has(String(studentClass)) : true;
      });
    }

    // Admin sees all students in institution
    return users.filter((u) => u.role === 'student');
  }, [users, classes, currentUser, isAdmin, isTeacher, isStudent]);

  // Filtered by search and class for teacher/admin directory
  const filteredStudents = useMemo(() => {
    return eligibleStudents.filter((st) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        st.fullName?.toLowerCase().includes(q) ||
        st.username?.toLowerCase().includes(q) ||
        st.rollNumber?.toLowerCase().includes(q) ||
        st.admissionId?.toLowerCase().includes(q) ||
        st.departmentBranch?.toLowerCase().includes(q) ||
        st.classDivision?.toLowerCase().includes(q) ||
        st.gradeLevel?.toLowerCase().includes(q);

      const matchClass =
        selectedClassFilter === 'all' ||
        st.assignedClassId === selectedClassFilter ||
        (st.assignedClassIds && st.assignedClassIds.includes(selectedClassFilter));

      return matchSearch && matchClass;
    });
  }, [eligibleStudents, searchQuery, selectedClassFilter]);

  // Automatically select student for student role
  const activeStudentToView: TenantUser | null = isStudent
    ? eligibleStudents[0] || (currentUser as TenantUser)
    : selectedStudent;

  // Initialize edit form with target student values
  const startEditProfile = (student: TenantUser) => {
    setFormDataFullName(student.fullName || '');
    setFormDataEmail(student.email || '');
    setFormDataPhone(student.phone || '');
    setFormDataDob(student.dateOfBirth || '');
    setFormDataGender(student.gender || 'Male');
    setFormDataAddress(student.residentialAddress || '');
    setFormDataRollNumber(student.rollNumber || '');
    setFormDataAssignedClassId(student.assignedClassId || '');
    setFormDataClassDivision(student.classDivision || '');
    setFormDataGradeLevel(student.gradeLevel || '');
    setFormDataCasteCategory(student.casteCategory || '');
    setFormDataDepartment(student.departmentBranch || '');
    setFormDataReligion(student.religion || '');

    setFormDataFatherName(student.fatherName || '');
    setFormDataFatherPhone(student.fatherContact || '');
    setFormDataFatherOccupation(student.fatherOccupation || '');
    setFormDataFatherAddress(student.fatherAddress || student.residentialAddress || '');
    setFormDataMotherName(student.motherName || '');
    setFormDataMotherPhone(student.motherContact || '');
    setFormDataMotherOccupation(student.motherOccupation || '');
    setFormDataMotherAddress(student.motherAddress || student.residentialAddress || '');
    setFormDataGuardianContact(student.guardianContact || student.fatherContact || '');

    setStatusMessage(null);
    setIsEditing(true);
  };

  const handleSaveProfile = async (targetStudentId: string) => {
    // 1. Validation
    if (!formDataFullName.trim()) {
      setStatusMessage({ type: 'error', text: 'Full Name is required.' });
      return;
    }
    if (!formDataEmail.trim() || !formDataEmail.includes('@')) {
      setStatusMessage({ type: 'error', text: 'A valid email address is required.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const payload: any = {
      fullName: formDataFullName.trim(),
      email: formDataEmail.trim(),
      phone: formDataPhone.trim(),
      dateOfBirth: formDataDob,
      gender: formDataGender,
      residentialAddress: formDataAddress.trim(),
      classDivision: formDataClassDivision.trim(),
      gradeLevel: formDataGradeLevel.trim(),
      casteCategory: formDataCasteCategory.trim(),
      departmentBranch: formDataDepartment.trim(),
      religion: formDataReligion.trim(),
      fatherName: formDataFatherName.trim(),
      fatherContact: formDataFatherPhone.trim(),
      fatherOccupation: formDataFatherOccupation.trim(),
      fatherAddress: formDataFatherAddress.trim(),
      motherName: formDataMotherName.trim(),
      motherContact: formDataMotherPhone.trim(),
      motherOccupation: formDataMotherOccupation.trim(),
      motherAddress: formDataMotherAddress.trim(),
      guardianContact: formDataGuardianContact.trim(),
    };

    // Admins can also update institutional fields
    if (isAdmin) {
      payload.rollNumber = formDataRollNumber.trim();
      if (formDataAssignedClassId) {
        payload.assignedClassId = formDataAssignedClassId;
      }
    }

    try {
      const res = await api.updateUser(activeTenant.databaseName, targetStudentId, payload);
      setIsSaving(false);

      if (res.success && res.user) {
        setStatusMessage({ type: 'success', text: 'Student profile updated and saved to database successfully!' });
        setIsEditing(false);
        if (selectedStudent) {
          setSelectedStudent({ ...selectedStudent, ...res.user });
        }
        await refreshData();
      } else {
        setStatusMessage({ type: 'error', text: res.message || 'Failed to update student profile.' });
      }
    } catch (err: any) {
      setIsSaving(false);
      setStatusMessage({ type: 'error', text: err.message || 'Network error saving student profile.' });
    }
  };

  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Safe Student / Teacher Profile PDF Export Handler
  const handleExportPdf = async (student: TenantUser) => {
    if (isExporting) return;
    setPrintError(null);
    setExportSuccess(null);

    // Verify authorization
    if (isTeacher) {
      const isAuthorized = eligibleStudents.some(
        (s) => s.id === student.id || (s as any)._id === student.id || (s as any)._id === (student as any)._id
      );
      if (!isAuthorized) {
        setPrintError('Unauthorized: You can only export records for students in your assigned cohorts.');
        return;
      }
    } else if (isStudent) {
      const uId = String(currentUser.id || (currentUser as any)._id);
      const stId = String(student.id || (student as any)._id);
      if (uId !== stId) {
        setPrintError('Unauthorized: You can only export your own student profile form.');
        return;
      }
    }

    const sId = student.id || (student as any)._id || 'active';
    setIsExporting(sId);

    try {
      const studentClass = currentClassForStudent(student);
      const filename = await exportProfileToPdf({
        user: student,
        institutionName: activeTenant.institutionName,
        campusCode: activeTenant.campusCode,
        className: studentClass ? `${studentClass.name} - ${studentClass.section}` : student.classDivision,
      });
      setExportSuccess(`Successfully generated and downloaded ${filename}`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err: any) {
      setPrintError(err.message || 'Failed to generate and download profile PDF.');
    } finally {
      setIsExporting(null);
    }
  };

  // Safe Teacher Print Form Handler (fallback)
  const handlePrint = (student: TenantUser) => {
    setPrintError(null);

    // Verify teacher authorization
    if (isTeacher) {
      const isAuthorized = eligibleStudents.some(
        (s) => s.id === student.id || (s as any)._id === student.id || (s as any)._id === (student as any)._id
      );
      if (!isAuthorized) {
        setPrintError('Unauthorized: You can only print records for students in your assigned cohorts.');
        return;
      }
    }

    setPrintingStudent(student);
    printUserForm(student);
  };

  const currentClassForStudent = (student: TenantUser) => {
    return classes.find(
      (c) => c.id === student.assignedClassId || (c as any)._id === student.assignedClassId
    );
  };

  return (
    <div className="space-y-6">
      {/* SCREEN UI - Hidden on Print */}
      <div className="no-print print:hidden space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-display">
              {isStudent ? 'My Student Profile & Enrolment Data' : 'Student Important Information & Records'}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              {isAdmin && 'Institution-wide student profiles with editable academic details, parent information, and printable admission forms.'}
              {isTeacher && 'Enrolled student records for your assigned classes. Authorized print form generator with database synchronization.'}
              {isStudent && 'Your complete official student profile. Keep your personal and parent/guardian contact information up-to-date.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isStudent && activeStudentToView && !isEditing && (
              <>
                <button
                  type="button"
                  onClick={() => startEditProfile(activeStudentToView)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  disabled={Boolean(isExporting)}
                  onClick={() => handleExportPdf(activeStudentToView)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-xl transition-all shadow-md shadow-pink-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isExporting === (activeStudentToView.id || (activeStudentToView as any)._id) ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Export My Form (PDF)</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Global Success / Error Alerts */}
        {exportSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{exportSuccess}</span>
          </div>
        )}
        {printError && (
          <div className="p-3.5 rounded-xl bg-red-950/50 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{printError}</span>
          </div>
        )}

        {/* Search & Filter Bar (Admins & Teachers Only) */}
        {!isStudent && (
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by student name, roll number, admission ID, department, class/division..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="w-full sm:w-64">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Authorized Classes</option>
                {classes.map((c) => (
                  <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>
                    {c.name} ({c.gradeLevel} - {c.section})
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STUDENT ROSTER DIRECTORY TABLE (Admins & Teachers Only) */}
        {/* ======================================================== */}
        {!isStudent && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 bg-white/[0.01]">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Class &amp; Division</th>
                    <th className="py-3 px-4">Grade Level</th>
                    <th className="py-3 px-4">Contact Phone</th>
                    <th className="py-3 px-4">Parent / Guardian</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500 text-xs">
                        No student records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st) => {
                      const studentClass = currentClassForStudent(st);

                      return (
                        <tr key={st.id || (st as any)._id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">
                            <div className="flex items-center gap-2.5">
                              {st.photoUrl ? (
                                <img
                                  src={st.photoUrl}
                                  alt={st.fullName}
                                  className="w-8 h-8 rounded-lg object-cover border border-white/20"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs">
                                  {st.fullName?.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="text-white font-medium">{st.fullName}</span>
                                <div className="text-[10px] text-slate-400 font-mono">@{st.username}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-semibold text-purple-300">
                            {st.rollNumber || '—'}
                          </td>

                          <td className="py-3 px-4 text-slate-300">
                            <div>{studentClass?.name || 'Class Cohort'}</div>
                            <span className="text-[10px] text-slate-400">{st.classDivision || studentClass?.section || '—'}</span>
                          </td>

                          <td className="py-3 px-4 text-emerald-300 font-medium">
                            {st.gradeLevel || '—'}
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-300">
                            {st.phone || '—'}
                          </td>

                          <td className="py-3 px-4 text-slate-300">
                            <div>{st.fatherName || st.motherName || '—'}</div>
                            <span className="text-[10px] text-slate-400 font-mono">{st.guardianContact || st.fatherContact || '—'}</span>
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedStudent(st)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View / Edit</span>
                              </button>
                              <button
                                type="button"
                                disabled={Boolean(isExporting)}
                                onClick={() => handleExportPdf(st)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-pink-300 hover:text-white bg-pink-950/40 hover:bg-pink-900/60 border border-pink-500/30 rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                {isExporting === (st.id || (st as any)._id) ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Exporting...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Export Form</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* STUDENT'S OWN DETAILED VIEW & EDIT (Student Mode)       */}
        {/* ======================================================== */}
        {isStudent && activeStudentToView && (
          <div className="space-y-6">
            {/* Feedback message */}
            {statusMessage && (
              <div
                className={`p-4 rounded-2xl flex items-center gap-3 text-xs ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/50 border border-red-500/40 text-red-200'
                }`}
              >
                {statusMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{statusMessage.text}</span>
              </div>
            )}

            {/* Profile Identity Card */}
            <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
              <div className="flex items-center gap-5">
                {activeStudentToView.photoUrl ? (
                  <img
                    src={activeStudentToView.photoUrl}
                    alt={activeStudentToView.fullName}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-purple-500/30 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                    {activeStudentToView.fullName?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-bold text-white font-display">{activeStudentToView.fullName}</h2>
                  <div className="text-xs text-purple-300 font-mono mt-0.5">
                    Roll #: <span className="font-bold">{activeStudentToView.rollNumber || 'CS-101'}</span> &middot; Admission ID: {activeStudentToView.admissionId || 'ADM-2024-01'}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-semibold">
                      {activeStudentToView.departmentBranch || 'Computer Engineering'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                      Grade: {activeStudentToView.gradeLevel || 'Year 3 / Semester 5'}
                    </span>
                    <span className="text-slate-500">&middot;</span>
                    <span className="font-mono text-slate-400">{activeStudentToView.classDivision || 'Division A'}</span>
                  </div>
                </div>
              </div>

              {!isEditing && (
                <div className="flex gap-2 self-end md:self-auto">
                  <button
                    type="button"
                    onClick={() => startEditProfile(activeStudentToView)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Edit Profile</span>
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(isExporting)}
                    onClick={() => handleExportPdf(activeStudentToView)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-xl transition-all shadow-md shadow-pink-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isExporting === (activeStudentToView.id || (activeStudentToView as any)._id) ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        <span>Export Form (PDF)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* If NOT Editing: Display Organised Profile (Sections A & B) */}
            {!isEditing && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SECTION A: PERSONAL DETAILS */}
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-purple-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Section A: Personal Details
                      </h3>
                    </div>
                    <span className="text-[10px] text-purple-300 font-mono">Student Records</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Full Legal Name</span>
                      <span className="text-white font-medium">{activeStudentToView.fullName}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Email Address</span>
                      <span className="text-white font-mono">{activeStudentToView.email}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Phone Number</span>
                      <span className="text-white font-mono">{activeStudentToView.phone || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Date of Birth</span>
                      <span className="text-white font-mono">{activeStudentToView.dateOfBirth || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
                        <span>Roll Number</span>
                        <Lock className="w-3 h-3 text-amber-400" />
                      </span>
                      <span className="text-purple-300 font-mono font-bold">{activeStudentToView.rollNumber || '—'}</span>
                      <span className="text-[9px] text-slate-500 block">Protected institutional field</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
                        <span>Assigned Cohort</span>
                        <Lock className="w-3 h-3 text-amber-400" />
                      </span>
                      <span className="text-white font-medium">
                        {currentClassForStudent(activeStudentToView)?.name || 'Computer Science Cohort'}
                      </span>
                      <span className="text-[9px] text-slate-500 block">Protected institutional field</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Division / Section</span>
                      <span className="text-white">{activeStudentToView.classDivision || 'Division A'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Grade Level</span>
                      <span className="text-emerald-400 font-semibold">{activeStudentToView.gradeLevel || 'Year 3 / Semester 5'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Caste / Category</span>
                      <span className="text-white">{activeStudentToView.casteCategory || 'General'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Department / Branch</span>
                      <span className="text-white">{activeStudentToView.departmentBranch || 'Computer Engineering'}</span>
                    </div>

                    <div className="sm:col-span-2">
                      <span className="text-slate-400 block mb-0.5">Residential Address</span>
                      <span className="text-white">{activeStudentToView.residentialAddress || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* SECTION B: PARENT / GUARDIAN DETAILS */}
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-pink-400" />
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                        Section B: Parent / Guardian Details
                      </h3>
                    </div>
                    <span className="text-[10px] text-pink-300 font-mono">Emergency &amp; Family</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Father's Name</span>
                      <span className="text-white font-medium">{activeStudentToView.fatherName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Father's Phone Number</span>
                      <span className="text-white font-mono">{activeStudentToView.fatherContact || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Father's Occupation</span>
                      <span className="text-white">{activeStudentToView.fatherOccupation || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Father's Address</span>
                      <span className="text-white">{activeStudentToView.fatherAddress || activeStudentToView.residentialAddress || '—'}</span>
                    </div>

                    <div className="pt-2 border-t border-white/5 sm:col-span-2" />

                    <div>
                      <span className="text-slate-400 block mb-0.5">Mother's Name</span>
                      <span className="text-white font-medium">{activeStudentToView.motherName || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Mother's Phone Number</span>
                      <span className="text-white font-mono">{activeStudentToView.motherContact || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Mother's Occupation</span>
                      <span className="text-white">{activeStudentToView.motherOccupation || '—'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-0.5">Mother's Address</span>
                      <span className="text-white">{activeStudentToView.motherAddress || activeStudentToView.residentialAddress || '—'}</span>
                    </div>

                    <div className="sm:col-span-2 pt-2 border-t border-white/5">
                      <span className="text-slate-400 block mb-0.5">Primary Emergency Guardian Contact</span>
                      <span className="text-pink-300 font-mono font-semibold">
                        {activeStudentToView.guardianContact || activeStudentToView.fatherContact || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* If EDITING: Render Edit Form with Sections A & B */}
            {isEditing && (
              <div className="p-6 rounded-3xl bg-white/[0.03] border border-purple-500/30 space-y-6 shadow-2xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div>
                    <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                      <Pencil className="w-4 h-4 text-purple-400" />
                      <span>Edit Student Profile Information</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Update your authorized personal and parent/guardian contact details.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* FORM SECTION A: PERSONAL DETAILS */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300 pb-2 border-b border-white/5">
                    <User className="w-4 h-4" />
                    <span>Section A: Personal Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Full Legal Name *</label>
                      <input
                        type="text"
                        required
                        value={formDataFullName}
                        onChange={(e) => setFormDataFullName(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
                      <input
                        type="email"
                        required
                        value={formDataEmail}
                        onChange={(e) => setFormDataEmail(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Contact Phone</label>
                      <input
                        type="text"
                        value={formDataPhone}
                        onChange={(e) => setFormDataPhone(e.target.value)}
                        placeholder="e.g. +91 98200 88991"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formDataDob}
                        onChange={(e) => setFormDataDob(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    {/* PROTECTED: Roll Number */}
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                        <span>Roll Number</span>
                        {!isAdmin && <span className="text-[10px] text-amber-400 font-normal">Locked (Admin Only)</span>}
                      </label>
                      <input
                        type="text"
                        disabled={!isAdmin}
                        value={formDataRollNumber}
                        onChange={(e) => setFormDataRollNumber(e.target.value)}
                        className={`w-full px-3.5 py-2 rounded-xl font-mono ${
                          !isAdmin
                            ? 'bg-white/5 border border-white/5 text-slate-400 cursor-not-allowed'
                            : 'bg-black/40 border border-white/15 text-white focus:border-purple-500'
                        }`}
                      />
                    </div>

                    {/* PROTECTED: Class / Cohort */}
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                        <span>Assigned Class</span>
                        {!isAdmin && <span className="text-[10px] text-amber-400 font-normal">Locked (Admin Only)</span>}
                      </label>
                      {isAdmin ? (
                        <select
                          value={formDataAssignedClassId}
                          onChange={(e) => setFormDataAssignedClassId(e.target.value)}
                          className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:border-purple-500"
                        >
                          <option value="">Select Class</option>
                          {classes.map((c) => (
                            <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>
                              {c.name} ({c.gradeLevel})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          disabled
                          value={currentClassForStudent(activeStudentToView)?.name || 'B.Tech Computer Science'}
                          className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/5 text-slate-400 cursor-not-allowed"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Division / Section</label>
                      <input
                        type="text"
                        value={formDataClassDivision}
                        onChange={(e) => setFormDataClassDivision(e.target.value)}
                        placeholder="e.g. Division A"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Grade Level</label>
                      <input
                        type="text"
                        list="edit-grade-levels"
                        value={formDataGradeLevel}
                        onChange={(e) => setFormDataGradeLevel(e.target.value)}
                        placeholder="e.g. Year 3 / Semester 5"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-purple-500/50 text-white focus:outline-none focus:border-purple-400"
                      />
                      <datalist id="edit-grade-levels">
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
                      <label className="block text-slate-300 font-semibold mb-1">Department / Branch</label>
                      <input
                        type="text"
                        value={formDataDepartment}
                        onChange={(e) => setFormDataDepartment(e.target.value)}
                        placeholder="e.g. Computer Engineering"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Caste / Category</label>
                      <input
                        type="text"
                        value={formDataCasteCategory}
                        onChange={(e) => setFormDataCasteCategory(e.target.value)}
                        placeholder="e.g. General, OBC, SC, ST"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-semibold mb-1">Residential Address</label>
                      <input
                        type="text"
                        value={formDataAddress}
                        onChange={(e) => setFormDataAddress(e.target.value)}
                        placeholder="Street Address, City, Postal Code"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* FORM SECTION B: PARENT / GUARDIAN DETAILS */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-pink-300 pb-2 border-b border-white/5">
                    <Users className="w-4 h-4" />
                    <span>Section B: Parent / Guardian Details</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Father's Full Name</label>
                      <input
                        type="text"
                        value={formDataFatherName}
                        onChange={(e) => setFormDataFatherName(e.target.value)}
                        placeholder="Father's Name"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Father's Phone Number</label>
                      <input
                        type="text"
                        value={formDataFatherPhone}
                        onChange={(e) => setFormDataFatherPhone(e.target.value)}
                        placeholder="e.g. +91 98200 11223"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Father's Occupation</label>
                      <input
                        type="text"
                        value={formDataFatherOccupation}
                        onChange={(e) => setFormDataFatherOccupation(e.target.value)}
                        placeholder="e.g. Senior Electrical Engineer"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Father's Address</label>
                      <input
                        type="text"
                        value={formDataFatherAddress}
                        onChange={(e) => setFormDataFatherAddress(e.target.value)}
                        placeholder="Residential or Office Address"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mother's Full Name</label>
                      <input
                        type="text"
                        value={formDataMotherName}
                        onChange={(e) => setFormDataMotherName(e.target.value)}
                        placeholder="Mother's Name"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mother's Phone Number</label>
                      <input
                        type="text"
                        value={formDataMotherPhone}
                        onChange={(e) => setFormDataMotherPhone(e.target.value)}
                        placeholder="e.g. +91 98200 11224"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mother's Occupation</label>
                      <input
                        type="text"
                        value={formDataMotherOccupation}
                        onChange={(e) => setFormDataMotherOccupation(e.target.value)}
                        placeholder="e.g. High School Lecturer"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Mother's Address</label>
                      <input
                        type="text"
                        value={formDataMotherAddress}
                        onChange={(e) => setFormDataMotherAddress(e.target.value)}
                        placeholder="Residential or Office Address"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-semibold mb-1">Primary Guardian Contact Phone</label>
                      <input
                        type="text"
                        value={formDataGuardianContact}
                        onChange={(e) => setFormDataGuardianContact(e.target.value)}
                        placeholder="e.g. +91 98200 11223"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => handleSaveProfile(activeStudentToView.id || (activeStudentToView as any)._id)}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving Changes...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Profile Updates</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* DETAILED MODAL (For Admin & Teachers in Directory View)  */}
        {/* ======================================================== */}
        {!isStudent && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 no-print">
            <div className="bg-[#141124] rounded-2xl max-w-3xl w-full p-6 border border-white/15 max-h-[90vh] overflow-y-auto space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <span>Student Enrolment Record &mdash; {selectedStudent.fullName}</span>
                </h2>
                <button
                  onClick={() => {
                    setSelectedStudent(null);
                    setIsEditing(false);
                  }}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Message */}
              {statusMessage && (
                <div
                  className={`p-3.5 rounded-xl flex items-center gap-2 text-xs ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/50 border border-red-500/40 text-red-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Header profile info */}
              <div className="flex items-center gap-4">
                {selectedStudent.photoUrl ? (
                  <img
                    src={selectedStudent.photoUrl}
                    alt={selectedStudent.fullName}
                    className="w-16 h-16 rounded-xl object-cover border border-white/20"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xl">
                    {selectedStudent.fullName.charAt(0)}
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold text-white">{selectedStudent.fullName}</h3>
                  <div className="text-xs text-slate-400 font-mono">
                    Roll: <strong className="text-purple-300">{selectedStudent.rollNumber || 'N/A'}</strong> &middot; ID: {selectedStudent.admissionId || 'N/A'}
                  </div>
                  <div className="text-xs text-emerald-400 mt-0.5">
                    Grade: <strong>{selectedStudent.gradeLevel || 'N/A'}</strong> &middot; Division: {selectedStudent.classDivision || 'A'}
                  </div>
                </div>
              </div>

              {/* View or Edit mode */}
              {!isEditing ? (
                <div className="space-y-5">
                  {/* Section A */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                      Section A: Personal Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-slate-400 block">Email Address:</span><span className="text-white font-mono">{selectedStudent.email}</span></div>
                      <div><span className="text-slate-400 block">Contact Phone:</span><span className="text-white font-mono">{selectedStudent.phone || '—'}</span></div>
                      <div><span className="text-slate-400 block">Date of Birth:</span><span className="text-white font-mono">{selectedStudent.dateOfBirth || '—'}</span></div>
                      <div><span className="text-slate-400 block">Department / Branch:</span><span className="text-white">{selectedStudent.departmentBranch || 'Computer Engineering'}</span></div>
                      <div className="col-span-2"><span className="text-slate-400 block">Residential Address:</span><span className="text-white">{selectedStudent.residentialAddress || '—'}</span></div>
                    </div>
                  </div>

                  {/* Section B */}
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
                    <h4 className="text-xs font-bold text-pink-300 uppercase tracking-wider">
                      Section B: Parent / Guardian Details
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-slate-400 block">Father's Name:</span><span className="text-white">{selectedStudent.fatherName || '—'}</span></div>
                      <div><span className="text-slate-400 block">Father's Contact:</span><span className="text-white font-mono">{selectedStudent.fatherContact || '—'}</span></div>
                      <div><span className="text-slate-400 block">Father's Occupation:</span><span className="text-white">{selectedStudent.fatherOccupation || '—'}</span></div>
                      <div><span className="text-slate-400 block">Father's Address:</span><span className="text-white">{selectedStudent.fatherAddress || '—'}</span></div>
                      <div><span className="text-slate-400 block">Mother's Name:</span><span className="text-white">{selectedStudent.motherName || '—'}</span></div>
                      <div><span className="text-slate-400 block">Mother's Contact:</span><span className="text-white font-mono">{selectedStudent.motherContact || '—'}</span></div>
                      <div><span className="text-slate-400 block">Mother's Occupation:</span><span className="text-white">{selectedStudent.motherOccupation || '—'}</span></div>
                      <div><span className="text-slate-400 block">Guardian Contact:</span><span className="text-white font-mono">{selectedStudent.guardianContact || '—'}</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Edit inputs */}
                  <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                    Edit Student Records
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 mb-1">Full Legal Name</label>
                      <input
                        type="text"
                        value={formDataFullName}
                        onChange={(e) => setFormDataFullName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">Email Address</label>
                      <input
                        type="email"
                        value={formDataEmail}
                        onChange={(e) => setFormDataEmail(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">Contact Phone</label>
                      <input
                        type="text"
                        value={formDataPhone}
                        onChange={(e) => setFormDataPhone(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={formDataDob}
                        onChange={(e) => setFormDataDob(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono"
                      />
                    </div>
                    {isAdmin && (
                      <div>
                        <label className="block text-slate-300 mb-1">Roll Number</label>
                        <input
                          type="text"
                          value={formDataRollNumber}
                          onChange={(e) => setFormDataRollNumber(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-slate-300 mb-1">Grade Level</label>
                      <input
                        type="text"
                        value={formDataGradeLevel}
                        onChange={(e) => setFormDataGradeLevel(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">Father's Name</label>
                      <input
                        type="text"
                        value={formDataFatherName}
                        onChange={(e) => setFormDataFatherName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">Father's Phone</label>
                      <input
                        type="text"
                        value={formDataFatherPhone}
                        onChange={(e) => setFormDataFatherPhone(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">Mother's Name</label>
                      <input
                        type="text"
                        value={formDataMotherName}
                        onChange={(e) => setFormDataMotherName(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 mb-1">Mother's Phone</label>
                      <input
                        type="text"
                        value={formDataMotherPhone}
                        onChange={(e) => setFormDataMotherPhone(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-300 mb-1">Residential Address</label>
                      <input
                        type="text"
                        value={formDataAddress}
                        onChange={(e) => setFormDataAddress(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Modal footer actions */}
              <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <div>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => startEditProfile(selectedStudent)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Student</span>
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleSaveProfile(selectedStudent.id || (selectedStudent as any)._id)}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStudent(null);
                      setIsEditing(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(isExporting)}
                    onClick={() => handleExportPdf(selectedStudent)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-pink-600/30 disabled:opacity-50"
                  >
                    {isExporting === (selectedStudent.id || (selectedStudent as any)._id) ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Generating PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Export Student Form (PDF)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PROFESSIONAL A4 PRINTABLE FORM (Rendered exclusively during browser print) */}
      {/* ========================================================================= */}
      {Boolean(printingStudent || (isStudent && activeStudentToView)) && (() => {
        const studentToPrint = (printingStudent || activeStudentToView) as TenantUser;
        const studentClass = currentClassForStudent(studentToPrint);

        return (
          <div className="hidden print:block printable-form font-sans text-black bg-white p-6 max-w-[210mm] mx-auto text-[11px] leading-relaxed">
            {/* Institution Header */}
            <div className="text-center pb-3 border-b-2 border-black mb-5">
              <h1 className="text-xl font-extrabold uppercase tracking-wider text-black">
                {activeTenant.institutionName}
              </h1>
              <p className="text-[11px] text-gray-800 font-semibold mt-0.5">
                Campus Code: {activeTenant.campusCode || 'CAMPUS-01'} &middot; Academic Administration &amp; Registrar Office
              </p>
              <div className="text-xs font-bold uppercase tracking-widest mt-2 bg-gray-100 py-1 border border-black text-black">
                Official Student Enrolment &amp; Admission Dossier
              </div>
            </div>

            {/* Identity & Photo Header Grid */}
            <div className="flex justify-between items-start gap-5 mb-5 pb-4 border-b border-gray-400">
              <div className="flex-1">
                <table className="w-full text-[11px] border-collapse">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-1 font-bold w-40 text-gray-900">Full Legal Name:</td>
                      <td className="py-1 font-bold text-black uppercase text-xs">{studentToPrint.fullName}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1 font-bold text-gray-900">Roll Number / Student ID:</td>
                      <td className="py-1 font-mono font-bold text-black">{studentToPrint.rollNumber || 'CS-101'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1 font-bold text-gray-900">Admission / Application ID:</td>
                      <td className="py-1 font-mono text-black">{studentToPrint.admissionId || 'ADM-2024-01'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1 font-bold text-gray-900">Academic Year:</td>
                      <td className="py-1 font-mono text-black">{studentToPrint.academicYear || '2025-2026'}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1 font-bold text-gray-900">Assigned Cohort / Class:</td>
                      <td className="py-1 text-black font-semibold">
                        {studentClass?.name || 'B.Tech Computer Science'} &mdash; {studentToPrint.classDivision || studentClass?.section || 'Section A'}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-1 font-bold text-gray-900">Department / Branch:</td>
                      <td className="py-1 text-black">{studentToPrint.departmentBranch || 'Computer Engineering'}</td>
                    </tr>
                    <tr>
                      <td className="py-1 font-bold text-gray-900">Grade Level:</td>
                      <td className="py-1 text-black font-bold">{studentToPrint.gradeLevel || 'Year 3 / Semester 5'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Passport Photo Box (Standard 35mm x 45mm proportion) */}
              <div className="w-32 h-40 border-2 border-black flex flex-col items-center justify-center p-1 shrink-0 bg-gray-50 text-center">
                {studentToPrint.photoUrl ? (
                  <img
                    src={studentToPrint.photoUrl}
                    alt={studentToPrint.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-[10px] text-gray-500 font-bold uppercase p-2 leading-tight">
                    Affix Recent Passport Photo Here
                    <span className="block text-[8px] font-normal mt-1">(35mm &times; 45mm)</span>
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 1: PERSONAL DETAILS */}
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase bg-gray-100 px-2 py-1 border border-black mb-2 text-black">
                1. Personal Particulars
              </h3>
              <table className="w-full text-[11px] border border-gray-300 border-collapse">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5 font-bold w-1/4 bg-gray-50 border-r border-gray-300">Date of Birth</td>
                    <td className="p-1.5 w-1/4 border-r border-gray-300 font-mono">{studentToPrint.dateOfBirth || '—'}</td>
                    <td className="p-1.5 font-bold w-1/4 bg-gray-50 border-r border-gray-300">Gender</td>
                    <td className="p-1.5 w-1/4">{studentToPrint.gender || '—'}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Primary Contact Phone</td>
                    <td className="p-1.5 border-r border-gray-300 font-mono">{studentToPrint.phone || '—'}</td>
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Email Address</td>
                    <td className="p-1.5 font-mono">{studentToPrint.email}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Religion</td>
                    <td className="p-1.5 border-r border-gray-300">{studentToPrint.religion || '—'}</td>
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Caste / Category</td>
                    <td className="p-1.5">{studentToPrint.casteCategory || 'General'}</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Residential Address</td>
                    <td colSpan={3} className="p-1.5">{studentToPrint.residentialAddress || '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION 2: PARENT / GUARDIAN DETAILS */}
            <div className="mb-4">
              <h3 className="text-xs font-bold uppercase bg-gray-100 px-2 py-1 border border-black mb-2 text-black">
                2. Parent / Guardian Details
              </h3>
              <table className="w-full text-[11px] border border-gray-300 border-collapse">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5 font-bold w-1/4 bg-gray-50 border-r border-gray-300">Father's Name</td>
                    <td className="p-1.5 w-1/4 border-r border-gray-300 font-semibold">{studentToPrint.fatherName || '—'}</td>
                    <td className="p-1.5 font-bold w-1/4 bg-gray-50 border-r border-gray-300">Father's Phone Number</td>
                    <td className="p-1.5 w-1/4 font-mono">{studentToPrint.fatherContact || '—'}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Father's Occupation</td>
                    <td className="p-1.5 border-r border-gray-300">{studentToPrint.fatherOccupation || '—'}</td>
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Father's Address</td>
                    <td className="p-1.5">{studentToPrint.fatherAddress || studentToPrint.residentialAddress || '—'}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Mother's Name</td>
                    <td className="p-1.5 border-r border-gray-300 font-semibold">{studentToPrint.motherName || '—'}</td>
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Mother's Phone Number</td>
                    <td className="p-1.5 font-mono">{studentToPrint.motherContact || '—'}</td>
                  </tr>
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Mother's Occupation</td>
                    <td className="p-1.5 border-r border-gray-300">{studentToPrint.motherOccupation || '—'}</td>
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Mother's Address</td>
                    <td className="p-1.5">{studentToPrint.motherAddress || studentToPrint.residentialAddress || '—'}</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Primary Emergency Contact</td>
                    <td colSpan={3} className="p-1.5 font-mono font-bold">
                      {studentToPrint.guardianContact || studentToPrint.fatherContact || '—'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION 3: ACADEMIC BACKGROUND */}
            <div className="mb-5">
              <h3 className="text-xs font-bold uppercase bg-gray-100 px-2 py-1 border border-black mb-2 text-black">
                3. Academic Background &amp; Institutional Standing
              </h3>
              <table className="w-full text-[11px] border border-gray-300 border-collapse">
                <tbody>
                  <tr className="border-b border-gray-300">
                    <td className="p-1.5 font-bold w-1/4 bg-gray-50 border-r border-gray-300">Previous Qualification</td>
                    <td className="p-1.5 w-1/4 border-r border-gray-300">{studentToPrint.previousQualification || 'HSC (12th Grade)'}</td>
                    <td className="p-1.5 font-bold w-1/4 bg-gray-50 border-r border-gray-300">Previous Institution</td>
                    <td className="p-1.5 w-1/4">{studentToPrint.previousInstitution || 'Board of Higher Secondary Education'}</td>
                  </tr>
                  <tr>
                    <td className="p-1.5 font-bold bg-gray-50 border-r border-gray-300">Qualifying Exam Details</td>
                    <td colSpan={3} className="p-1.5">{studentToPrint.previousExamDetails || 'Qualified with Distinction in Qualifying Examination'}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SECTION 4: DECLARATION AND SIGNATURES */}
            <div className="mt-6 pt-3 border-t-2 border-black">
              <p className="text-[10px] text-gray-800 leading-normal mb-8">
                I hereby solemnly affirm and declare that the particulars furnished in this student enrolment record are true, complete, and authentic to the best of my knowledge and belief. All original qualification documents have been verified by the institution.
              </p>

              <div className="grid grid-cols-3 gap-6 items-end text-center text-xs">
                {/* Student Signature */}
                <div>
                  <div className="h-12 flex items-center justify-center">
                    {studentToPrint.signatureUrl ? (
                      <img src={studentToPrint.signatureUrl} alt="Signature" className="h-8 object-contain" />
                    ) : (
                      <span className="text-[10px] text-gray-500 font-serif italic">(Signed on File)</span>
                    )}
                  </div>
                  <div className="border-t border-black pt-1 font-bold text-[11px]">Signature of Student</div>
                  <div className="text-[9px] text-gray-600">Date: {new Date().toLocaleDateString()}</div>
                </div>

                {/* Class Teacher Verification */}
                <div>
                  <div className="h-12 flex items-center justify-center">
                    <span className="text-[10px] text-gray-500 font-serif italic">Verified with Register</span>
                  </div>
                  <div className="border-t border-black pt-1 font-bold text-[11px]">Class Teacher / Tutor</div>
                  <div className="text-[9px] text-gray-600">Faculty In-Charge</div>
                </div>

                {/* Registrar Seal */}
                <div>
                  <div className="h-12 border border-dashed border-gray-400 flex items-center justify-center text-[9px] text-gray-400">
                    Institutional Seal &amp; Stamp
                  </div>
                  <div className="border-t border-black pt-1 font-bold text-[11px]">Principal / Registrar</div>
                  <div className="text-[9px] text-gray-600">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default StudentImportantInformation;
