import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TenantUser, SchoolClass } from '../types/crm';
import api from '../services/api';

export const StudentImportantInformation: React.FC = () => {
  const { activeTenant, currentUser, users, classes, refreshData } = useApp();

  if (!currentUser || !activeTenant) return null;

  const isAdmin = currentUser.role === 'admin';
  const isTeacher = currentUser.role === 'teacher';
  const isStudent = currentUser.role === 'student';

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<TenantUser | null>(null);

  // Edit states for modal
  const [isEditing, setIsEditing] = useState(false);
  const [editGradeLevel, setEditGradeLevel] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editClassDivision, setEditClassDivision] = useState('');
  const [editRollNumber, setEditRollNumber] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const startEditing = (st: TenantUser) => {
    setEditGradeLevel(st.gradeLevel || '');
    setEditDepartment(st.departmentBranch || '');
    setEditClassDivision(st.classDivision || '');
    setEditRollNumber(st.rollNumber || '');
    setEditError(null);
    setEditSuccess(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async (studentId: string) => {
    setIsSavingEdit(true);
    setEditError(null);
    try {
      const res = await api.updateUser(activeTenant.databaseName, studentId, {
        gradeLevel: editGradeLevel.trim(),
        departmentBranch: editDepartment.trim(),
        classDivision: editClassDivision.trim(),
        rollNumber: editRollNumber.trim(),
      });
      setIsSavingEdit(false);
      if (res.success && res.user) {
        setEditSuccess('Student details updated.');
        setIsEditing(false);
        if (selectedStudent) {
          setSelectedStudent({ ...selectedStudent, ...res.user });
        }
        await refreshData();
      } else {
        setEditError(res.message || 'Failed to update student details.');
      }
    } catch (err: any) {
      setIsSavingEdit(false);
      setEditError(err.message || 'Error updating student record.');
    }
  };

  // Eligible students based on role permissions
  const eligibleStudents = useMemo(() => {
    if (isStudent) {
      // Student can ONLY view their own profile
      return users.filter(
        (u) => u.role === 'student' && (u.id === currentUser.id || (u as any)._id === currentUser.id)
      );
    }

    if (isTeacher) {
      // Teacher sees students belonging to their assigned classes
      const teacherClassIds = new Set([
        ...(currentUser.assignedClassIds || []),
        ...classes
          .filter((c: SchoolClass) => c.primaryTeacherId === currentUser.id)
          .map((c) => c.id || (c as any)._id),
      ]);

      return users.filter((u: TenantUser) => {
        if (u.role !== 'student') return false;
        const studentClass = u.assignedClassId || (u.assignedClassIds && u.assignedClassIds[0]);
        // Allow if in assigned class, or if teacher has no specific class allotted, show cohort
        return teacherClassIds.size > 0 ? teacherClassIds.has(String(studentClass)) : true;
      });
    }

    // Admin sees all students in institution
    return users.filter((u) => u.role === 'student');
  }, [users, classes, currentUser, isAdmin, isTeacher, isStudent]);

  // Filtered by search and class
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
  const activeStudentToView = isStudent ? eligibleStudents[0] || currentUser : selectedStudent;

  // Print Form Handler
  const handlePrint = (student: TenantUser) => {
    setSelectedStudent(student);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="space-y-6">
      {/* Screen View (Hidden when printing) */}
      <div className="print:hidden space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white font-display">Student Important Information &amp; Data</h1>
            <p className="text-xs text-slate-400 mt-1">
              {isAdmin && 'Institutional student directory with search, admission records, and print verification.'}
              {isTeacher && 'Enrolled student profiles for your assigned classes with privacy-governed records.'}
              {isStudent && 'Your complete official student record and printable institutional enrolment form.'}
            </p>
          </div>
          {isStudent && activeStudentToView && (
            <button
              onClick={() => handlePrint(activeStudentToView)}
              className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print My Student Form</span>
            </button>
          )}
        </div>

        {/* Search & Filter Toolbar (for Admin & Teachers) */}
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

            <div className="w-full sm:w-56">
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Assigned Cohorts</option>
                {classes.map((c) => (
                  <option key={c.id || (c as any)._id} value={c.id || (c as any)._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Student Records List / Table */}
        {!isStudent && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 bg-white/[0.01]">
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Admission ID</th>
                    <th className="py-3 px-4">Grade Level (Manual)</th>
                    <th className="py-3 px-4">Department / Branch</th>
                    <th className="py-3 px-4">Class / Division</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-500 text-xs">
                        No student records found matching the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st) => {
                      const studentClass = classes.find(
                        (c) => c.id === st.assignedClassId || (c as any)._id === st.assignedClassId
                      );

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
                                <div className="w-8 h-8 rounded-lg bg-blue-600/30 text-blue-300 font-bold flex items-center justify-center text-xs">
                                  {st.fullName?.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span>{st.fullName}</span>
                                <div className="text-[10px] text-slate-400 font-mono">@{st.username}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4 font-mono font-semibold text-purple-300">
                            {st.rollNumber || '—'}
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-300">
                            {st.admissionId || '—'}
                          </td>

                          <td className="py-3 px-4 text-emerald-300 font-medium">
                            {st.gradeLevel || '—'}
                          </td>

                          <td className="py-3 px-4 text-slate-300">
                            {st.departmentBranch || studentClass?.name || '—'}
                          </td>

                          <td className="py-3 px-4 text-slate-300 font-mono">
                            {st.classDivision || (studentClass ? studentClass.section : '—')}
                          </td>

                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedStudent(st)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Data</span>
                              </button>
                              <button
                                onClick={() => handlePrint(st)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-pink-300 hover:text-white bg-pink-950/40 hover:bg-pink-900/60 border border-pink-500/30 rounded-lg flex items-center gap-1 cursor-pointer"
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print Form</span>
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

        {/* Student's Own Detailed View (When viewed by student) */}
        {isStudent && activeStudentToView && (
          <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6 pb-6 border-b border-white/10">
              {activeStudentToView.photoUrl ? (
                <img
                  src={activeStudentToView.photoUrl}
                  alt={activeStudentToView.fullName}
                  className="w-24 h-24 rounded-2xl object-cover border border-white/20 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 text-3xl font-bold">
                  {activeStudentToView.fullName?.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-white">{activeStudentToView.fullName}</h2>
                <div className="text-xs text-purple-300 font-mono">
                  Roll #: {activeStudentToView.rollNumber || 'Not Allocated'} &middot; Admission ID: {activeStudentToView.admissionId || 'ADM-2025-01'}
                </div>
                <div className="text-xs text-slate-400">
                  {activeStudentToView.departmentBranch || 'Computer Engineering'} &middot; Grade Level: <span className="text-emerald-400 font-semibold">{activeStudentToView.gradeLevel || 'First Year'}</span>
                </div>
              </div>
            </div>

            {/* Information Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
              <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                <h3 className="font-bold text-purple-300 uppercase tracking-wider text-[11px]">Academic &amp; Enrolment</h3>
                <div><span className="text-slate-400 block">Institution</span><span className="text-white font-medium">{activeTenant.institutionName}</span></div>
                <div><span className="text-slate-400 block">Grade Level</span><span className="text-emerald-400 font-semibold">{activeStudentToView.gradeLevel || '—'}</span></div>
                <div><span className="text-slate-400 block">Department / Branch</span><span className="text-white">{activeStudentToView.departmentBranch || '—'}</span></div>
                <div><span className="text-slate-400 block">Class / Division</span><span className="text-white">{activeStudentToView.classDivision || '—'}</span></div>
                <div><span className="text-slate-400 block">Academic Year</span><span className="text-white font-mono">{activeStudentToView.academicYear || '2025-2026'}</span></div>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                <h3 className="font-bold text-purple-300 uppercase tracking-wider text-[11px]">Personal Information</h3>
                <div><span className="text-slate-400 block">Email Address</span><span className="text-white font-mono">{activeStudentToView.email}</span></div>
                <div><span className="text-slate-400 block">Contact Number</span><span className="text-white font-mono">{activeStudentToView.phone || '—'}</span></div>
                <div><span className="text-slate-400 block">Date of Birth</span><span className="text-white font-mono">{activeStudentToView.dateOfBirth || '—'}</span></div>
                <div><span className="text-slate-400 block">Gender</span><span className="text-white">{activeStudentToView.gender || '—'}</span></div>
                <div><span className="text-slate-400 block">Residential Address</span><span className="text-white">{activeStudentToView.residentialAddress || '—'}</span></div>
              </div>

              <div className="space-y-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
                <h3 className="font-bold text-purple-300 uppercase tracking-wider text-[11px]">Parent / Guardian Information</h3>
                <div><span className="text-slate-400 block">Father's Name</span><span className="text-white">{activeStudentToView.fatherName || '—'}</span></div>
                <div><span className="text-slate-400 block">Father's Contact</span><span className="text-white font-mono">{activeStudentToView.fatherContact || '—'}</span></div>
                <div><span className="text-slate-400 block">Mother's Name</span><span className="text-white">{activeStudentToView.motherName || '—'}</span></div>
                <div><span className="text-slate-400 block">Guardian Contact</span><span className="text-white font-mono">{activeStudentToView.guardianContact || '—'}</span></div>
              </div>
            </div>

            {/* Signature Preview */}
            {activeStudentToView.signatureUrl && (
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Enrolled Digital Signature</span>
                  <img
                    src={activeStudentToView.signatureUrl}
                    alt="Signature"
                    className="h-12 border border-white/20 rounded-lg p-1 bg-white/5"
                  />
                </div>
                <button
                  onClick={() => handlePrint(activeStudentToView)}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-500 cursor-pointer flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Official Enrolment Form</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Detailed Modal for Admin / Teachers */}
        {!isStudent && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-[#141124] rounded-2xl max-w-2xl w-full p-6 border border-white/15 max-h-[90vh] overflow-y-auto space-y-6">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-4 h-4 text-purple-400" />
                  <span>Student Record — {selectedStudent.fullName}</span>
                </h2>
                <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

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
                <div className="flex-1">
                  <h3 className="text-base font-bold text-white">{selectedStudent.fullName}</h3>
                  <div className="text-xs text-slate-400 font-mono">
                    Roll #: {selectedStudent.rollNumber || 'N/A'} &middot; Admission ID: {selectedStudent.admissionId || 'N/A'}
                  </div>
                  <div className="text-xs text-emerald-400 mt-0.5">
                    Grade Level: <strong>{selectedStudent.gradeLevel || 'N/A'}</strong>
                  </div>
                </div>
              </div>

              {/* Status alerts */}
              {editError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}
              {editSuccess && (
                <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {isEditing ? (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-purple-500/30 space-y-3">
                  <div className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                    Edit Academic &amp; Class Allocation
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Grade Level (Manual Entry) *</label>
                      <input
                        type="text"
                        list="modal-grade-presets"
                        value={editGradeLevel}
                        onChange={(e) => setEditGradeLevel(e.target.value)}
                        placeholder="e.g. First Year, TY Computer Engineering"
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-purple-500/50 text-white focus:outline-none focus:border-purple-400"
                      />
                      <datalist id="modal-grade-presets">
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
                      <label className="block text-slate-300 font-semibold mb-1">Roll Number</label>
                      <input
                        type="text"
                        value={editRollNumber}
                        onChange={(e) => setEditRollNumber(e.target.value)}
                        placeholder="e.g. CS-101"
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Department / Branch</label>
                      <input
                        type="text"
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        placeholder="e.g. Computer Engineering"
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Class / Division</label>
                      <input
                        type="text"
                        value={editClassDivision}
                        onChange={(e) => setEditClassDivision(e.target.value)}
                        placeholder="e.g. Division A"
                        className="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div><span className="text-slate-400 block">Department / Branch</span><span className="text-white">{selectedStudent.departmentBranch || '—'}</span></div>
                  <div><span className="text-slate-400 block">Class / Division</span><span className="text-white">{selectedStudent.classDivision || '—'}</span></div>
                  <div><span className="text-slate-400 block">Email</span><span className="text-white font-mono">{selectedStudent.email}</span></div>
                  <div><span className="text-slate-400 block">Contact Number</span><span className="text-white font-mono">{selectedStudent.phone || '—'}</span></div>
                  <div><span className="text-slate-400 block">Date of Birth</span><span className="text-white font-mono">{selectedStudent.dateOfBirth || '—'}</span></div>
                  <div><span className="text-slate-400 block">Gender</span><span className="text-white">{selectedStudent.gender || '—'}</span></div>
                  <div><span className="text-slate-400 block">Address</span><span className="text-white">{selectedStudent.residentialAddress || '—'}</span></div>

                  {isAdmin && (
                    <>
                      <div><span className="text-slate-400 block">Religion</span><span className="text-white">{selectedStudent.religion || '—'}</span></div>
                      <div><span className="text-slate-400 block">Caste / Category</span><span className="text-white">{selectedStudent.casteCategory || '—'}</span></div>
                      <div><span className="text-slate-400 block">Father's Name</span><span className="text-white">{selectedStudent.fatherName || '—'}</span></div>
                      <div><span className="text-slate-400 block">Father's Contact</span><span className="text-white font-mono">{selectedStudent.fatherContact || '—'}</span></div>
                      <div><span className="text-slate-400 block">Mother's Name</span><span className="text-white">{selectedStudent.motherName || '—'}</span></div>
                      <div><span className="text-slate-400 block">Guardian Contact</span><span className="text-white font-mono">{selectedStudent.guardianContact || '—'}</span></div>
                    </>
                  )}
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t border-white/10">
                <div>
                  {isAdmin && !isEditing && (
                    <button
                      type="button"
                      onClick={() => startEditing(selectedStudent)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/30 rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Student</span>
                    </button>
                  )}
                  {isEditing && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={() => handleSaveEdit(selectedStudent.id || (selectedStudent as any)._id)}
                        className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
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
                    onClick={() => handlePrint(selectedStudent)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-pink-600 hover:bg-pink-500 rounded-xl flex items-center gap-2 cursor-pointer shadow-md shadow-pink-600/30"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Student Form</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* PRINT-ONLY FORM LAYOUT (Rendered exclusively during print) */}
      {/* ========================================================= */}
      {selectedStudent && (
        <div className="hidden print:block font-sans text-black bg-white p-8 max-w-[210mm] mx-auto text-xs leading-normal">
          {/* Institution Header */}
          <div className="text-center pb-4 border-b-2 border-black mb-6">
            <h1 className="text-xl font-bold uppercase tracking-wider">{activeTenant.institutionName}</h1>
            <p className="text-[11px] text-gray-700">Campus Code: {activeTenant.campusCode || 'CAMPUS-01'} &middot; Academic Administration</p>
            <h2 className="text-sm font-bold uppercase tracking-widest mt-2 bg-gray-200 py-1 border border-black">
              Official Student Enrolment &amp; Admission Record
            </h2>
          </div>

          {/* Identity & Photo Header */}
          <div className="flex justify-between items-start gap-4 mb-6 pb-4 border-b border-gray-400">
            <div className="space-y-1.5 flex-1">
              <div className="grid grid-cols-2 gap-y-1 text-xs">
                <div><strong>Full Name:</strong> {selectedStudent.fullName}</div>
                <div><strong>Application/Admission ID:</strong> {selectedStudent.admissionId || 'ADM-2025-01'}</div>
                <div><strong>Roll Number:</strong> {selectedStudent.rollNumber || 'N/A'}</div>
                <div><strong>Academic Year:</strong> {selectedStudent.academicYear || '2025-2026'}</div>
                <div><strong>Grade Level:</strong> {selectedStudent.gradeLevel || 'First Year'}</div>
                <div><strong>Department / Branch:</strong> {selectedStudent.departmentBranch || 'Computer Engineering'}</div>
                <div><strong>Class / Division:</strong> {selectedStudent.classDivision || 'Section A'}</div>
                <div><strong>Status:</strong> Active Enrolled Student</div>
              </div>
            </div>

            <div className="w-28 h-32 border border-black flex flex-col items-center justify-center p-1 shrink-0 bg-gray-50 text-center">
              {selectedStudent.photoUrl ? (
                <img
                  src={selectedStudent.photoUrl}
                  alt={selectedStudent.fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-[10px] text-gray-500 uppercase font-semibold">Affix Student Photo Here</div>
              )}
            </div>
          </div>

          {/* 1. Personal Information */}
          <div className="mb-5">
            <h3 className="text-xs font-bold uppercase bg-gray-100 p-1.5 border border-black mb-2">
              1. Personal Information
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
              <div><strong>Date of Birth:</strong> {selectedStudent.dateOfBirth || '—'}</div>
              <div><strong>Gender:</strong> {selectedStudent.gender || '—'}</div>
              <div><strong>Email Address:</strong> {selectedStudent.email}</div>
              <div><strong>Contact Number:</strong> {selectedStudent.phone || '—'}</div>
              <div className="col-span-2"><strong>Residential Address:</strong> {selectedStudent.residentialAddress || '—'}</div>
              {(isAdmin || isStudent) && selectedStudent.religion && (
                <div><strong>Religion:</strong> {selectedStudent.religion}</div>
              )}
              {(isAdmin || isStudent) && selectedStudent.casteCategory && (
                <div><strong>Caste / Category:</strong> {selectedStudent.casteCategory}</div>
              )}
            </div>
          </div>

          {/* 2. Parent / Guardian Details */}
          {(isAdmin || isStudent) && (
            <div className="mb-5">
              <h3 className="text-xs font-bold uppercase bg-gray-100 p-1.5 border border-black mb-2">
                2. Parent / Guardian Details
              </h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
                <div><strong>Father's Name:</strong> {selectedStudent.fatherName || '—'}</div>
                <div><strong>Father's Contact:</strong> {selectedStudent.fatherContact || '—'}</div>
                <div><strong>Mother's Name:</strong> {selectedStudent.motherName || '—'}</div>
                <div><strong>Mother's Contact:</strong> {selectedStudent.motherContact || '—'}</div>
                <div className="col-span-2"><strong>Guardian Contact / Info:</strong> {selectedStudent.guardianContact || selectedStudent.guardianInfo || '—'}</div>
              </div>
            </div>
          )}

          {/* 3. Previous Academic Records */}
          <div className="mb-6">
            <h3 className="text-xs font-bold uppercase bg-gray-100 p-1.5 border border-black mb-2">
              3. Previous Academic Background
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-2">
              <div><strong>Previous Qualification:</strong> {selectedStudent.previousQualification || 'Higher Secondary (12th Grade)'}</div>
              <div><strong>Previous Institution:</strong> {selectedStudent.previousInstitution || 'Board of Secondary Education'}</div>
              <div className="col-span-2"><strong>Examination Details / Aggregate:</strong> {selectedStudent.previousExamDetails || 'Qualified with Distinction'}</div>
            </div>
          </div>

          {/* 4. Declaration and Signatures */}
          <div className="mt-8 pt-4 border-t border-black">
            <p className="text-[10px] text-gray-700 leading-tight mb-8">
              I hereby declare that all particulars stated in this institutional enrolment record are true, correct, and verified with original academic documents presented to the administration.
            </p>

            <div className="grid grid-cols-3 gap-6 items-end text-center text-xs">
              <div>
                <div className="h-14 flex items-center justify-center">
                  {selectedStudent.signatureUrl && (
                    <img src={selectedStudent.signatureUrl} alt="Signature" className="h-10 object-contain" />
                  )}
                </div>
                <div className="border-t border-black pt-1 font-semibold">Student's Signature</div>
                <div className="text-[10px] text-gray-500">Date: {new Date().toLocaleDateString()}</div>
              </div>

              <div>
                <div className="h-14 border border-dashed border-gray-400 flex items-center justify-center text-[9px] text-gray-400">
                  Institutional Seal
                </div>
                <div className="border-t border-black pt-1 font-semibold">Campus Stamp</div>
              </div>

              <div>
                <div className="h-14" />
                <div className="border-t border-black pt-1 font-semibold">Principal / Registrar Signature</div>
                <div className="text-[10px] text-gray-500">Authorized Officer</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentImportantInformation;
