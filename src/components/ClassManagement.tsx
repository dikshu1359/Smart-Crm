import React, { useState, useMemo } from 'react';
import {
  Users,
  X,
  Search,
  Filter,
  CheckSquare,
  Square,
  UserCheck,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SchoolClass, TenantUser } from '../types/crm';

export const ClassManagement: React.FC = () => {
  const {
    activeTenant,
    currentUser,
    classes,
    users,
    createClass,
    deleteClass,
    allotStudent,
    bulkAllotStudents,
    setActiveTab,
  } = useApp();

  if (!activeTenant || !currentUser) return null;

  // Class Creation Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Grade 12');
  const [section, setSection] = useState('Section A');
  const [roomNumber, setRoomNumber] = useState('Room 204');
  const [capacity, setCapacity] = useState(30);

  // Bulk Allotment Panel State
  const [targetClassId, setTargetClassId] = useState<string>(classes[0]?.id || (classes[0] as any)?._id || '');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [bulkFilterStatus, setBulkFilterStatus] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const teacherList = useMemo(() => users.filter((u: TenantUser) => u.role === 'teacher'), [users]);
  const studentList = useMemo(() => users.filter((u: TenantUser) => u.role === 'student'), [users]);
  const [primaryTeacherId, setPrimaryTeacherId] = useState(teacherList[0]?.id || '');

  // Filtered students for allotment view
  const filteredStudents = useMemo(() => {
    return studentList.filter((stu: TenantUser) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        stu.fullName?.toLowerCase().includes(q) ||
        stu.rollNumber?.toLowerCase().includes(q) ||
        stu.email?.toLowerCase().includes(q);

      const isUnassigned = !stu.assignedClassId;
      const matchesFilter =
        bulkFilterStatus === 'all' ||
        (bulkFilterStatus === 'unassigned' && isUnassigned) ||
        (bulkFilterStatus === 'assigned' && !isUnassigned);

      return matchesSearch && matchesFilter;
    });
  }, [studentList, searchQuery, bulkFilterStatus]);

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.includes(s.id || (s as any)._id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      // Unselect all currently filtered
      const filteredIds = new Set(filteredStudents.map((s) => s.id || (s as any)._id));
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredIds.has(id)));
    } else {
      // Select all currently filtered
      const filteredIds = filteredStudents.map((s) => s.id || (s as any)._id);
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const toggleStudent = (stuId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(stuId) ? prev.filter((id) => id !== stuId) : [...prev, stuId]
    );
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await createClass({
      name: name.trim(),
      gradeLevel,
      section,
      roomNumber,
      capacity: Number(capacity) || 30,
      primaryTeacherId: primaryTeacherId || teacherList[0]?.id || '',
      subjects: ['Mathematics', 'Physics', 'Computing'],
    });
    if (res.ok) {
      setName('');
      setShowCreateModal(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!targetClassId) {
      setBulkFeedback({ type: 'error', message: 'Please select a destination class.' });
      return;
    }
    if (selectedStudentIds.length === 0) {
      setBulkFeedback({ type: 'error', message: 'Please select at least one student to assign.' });
      return;
    }

    setIsSubmittingBulk(true);
    setBulkFeedback(null);

    const targetCls = classes.find((c: SchoolClass) => (c.id || (c as any)._id) === targetClassId);
    const res = await bulkAllotStudents(targetClassId, selectedStudentIds);

    setIsSubmittingBulk(false);
    if (res.ok) {
      setBulkFeedback({
        type: 'success',
        message: `Successfully allotted ${res.allottedCount ?? selectedStudentIds.length} student(s) to ${targetCls?.name || 'the class'}.`,
      });
      setSelectedStudentIds([]);
    } else {
      setBulkFeedback({ type: 'error', message: res.message || 'Failed to allot students.' });
    }
  };

  const handleBulkUnassign = async () => {
    if (selectedStudentIds.length === 0) return;
    setIsSubmittingBulk(true);
    setBulkFeedback(null);

    const res = await bulkAllotStudents('unassigned', selectedStudentIds);
    setIsSubmittingBulk(false);

    if (res.ok) {
      setBulkFeedback({
        type: 'success',
        message: `Successfully unassigned ${selectedStudentIds.length} student(s) from their classes.`,
      });
      setSelectedStudentIds([]);
    } else {
      setBulkFeedback({ type: 'error', message: res.message || 'Failed to unassign students.' });
    }
  };

  const selectedTargetClassObj = classes.find(
    (c: SchoolClass) => (c.id || (c as any)._id) === targetClassId
  );

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Class &amp; Student Allotment</h1>
          <p className="text-xs text-slate-400 mt-1">
            Create academic cohorts, assign primary faculty, and allot student rosters in bulk or individually.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setActiveTab('roster')}
            className="px-4 py-2 text-xs font-semibold text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>Upload Student Roster</span>
          </button>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-500 cursor-pointer shadow-md shadow-purple-600/30"
            >
              + Create Class
            </button>
          )}
        </div>
      </div>

      {/* Class Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls: SchoolClass, idx: number) => {
          const clsKey = cls.id || (cls as any)._id || cls.name || `cls-${idx}`;
          const teacher = users.find((u: TenantUser) => (u.id || (u as any)._id) === cls.primaryTeacherId);
          const enrolledCount = cls.studentIds?.length || 0;
          const isSelectedTarget = targetClassId === clsKey;

          return (
            <div
              key={clsKey}
              onClick={() => currentUser.role === 'admin' && setTargetClassId(clsKey)}
              className={`p-6 rounded-2xl bg-white/[0.03] border transition-all flex flex-col justify-between cursor-pointer ${
                isSelectedTarget
                  ? 'border-purple-500/60 ring-2 ring-purple-500/20 bg-purple-500/[0.03]'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-purple-300">
                    {cls.gradeLevel} &middot; {cls.roomNumber}
                  </span>
                  {isSelectedTarget && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Active Target
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-white mt-1.5 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-400" />
                  {cls.name}
                </h2>
                <div className="text-xs text-slate-400 mt-2">
                  Faculty: <span className="text-slate-200">{teacher?.fullName || 'Unassigned'}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex justify-between text-xs font-mono text-slate-300 mb-1.5">
                    <span>Enrollment</span>
                    <span>
                      {enrolledCount} / {cls.capacity} Students
                    </span>
                  </div>
                  {/* Capacity Bar */}
                  <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        enrolledCount >= cls.capacity ? 'bg-amber-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(100, (enrolledCount / (cls.capacity || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {currentUser.role === 'admin' && (
                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetClassId(clsKey);
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 font-medium"
                  >
                    Select for Allotment &rarr;
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteClass(clsKey);
                    }}
                    className="text-xs text-slate-400 hover:text-red-400 cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* EASY BULK CLASS ALLOTMENT SECTION (Admin & Teachers) */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs text-purple-300 mb-2 font-mono">
              <Layers className="w-3.5 h-3.5" />
              <span>Easy Bulk Allotment Workflow</span>
            </div>
            <h2 className="text-lg font-bold text-white">Allot Students to Class</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select one or multiple students, choose a destination cohort (e.g. Class A or Class B), and assign them all at once.
            </p>
          </div>

          {currentUser.role === 'admin' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300 font-medium whitespace-nowrap">Target Class:</span>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="px-3 py-2 text-xs bg-black/60 border border-purple-500/40 rounded-xl text-white font-medium focus:outline-none focus:border-purple-400"
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((c: SchoolClass, cIdx: number) => {
                    const cKey = c.id || (c as any)._id || c.name || `sel-cls-${cIdx}`;
                    return (
                      <option key={cKey} value={cKey}>
                        {c.name} ({c.studentIds?.length || 0}/{c.capacity} enrolled)
                      </option>
                    );
                  })}
                </select>
              </div>

              <button
                type="button"
                onClick={handleBulkAssign}
                disabled={isSubmittingBulk || selectedStudentIds.length === 0 || !targetClassId}
                className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center gap-2 shadow-md shadow-purple-600/30 transition-all cursor-pointer"
              >
                <UserCheck className="w-4 h-4" />
                <span>
                  Assign {selectedStudentIds.length > 0 ? `(${selectedStudentIds.length})` : ''} to{' '}
                  {selectedTargetClassObj?.name || 'Class'}
                </span>
              </button>

              {selectedStudentIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleBulkUnassign}
                  disabled={isSubmittingBulk}
                  className="px-3 py-2 text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all cursor-pointer"
                  title="Remove selected students from their current class"
                >
                  Unassign Selected ({selectedStudentIds.length})
                </button>
              )}
            </div>
          )}
        </div>

        {/* Feedback alert */}
        {bulkFeedback && (
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
              bulkFeedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {bulkFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{bulkFeedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setBulkFeedback(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name or roll..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setBulkFilterStatus('all')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  bulkFilterStatus === 'all'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All ({studentList.length})
              </button>
              <button
                type="button"
                onClick={() => setBulkFilterStatus('unassigned')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  bulkFilterStatus === 'unassigned'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Unassigned ({studentList.filter((s) => !s.assignedClassId).length})
              </button>
              <button
                type="button"
                onClick={() => setBulkFilterStatus('assigned')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  bulkFilterStatus === 'assigned'
                    ? 'bg-purple-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Assigned ({studentList.filter((s) => !!s.assignedClassId).length})
              </button>
            </div>

            {currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 border border-white/10 rounded-xl flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                {allFilteredSelected ? (
                  <>
                    <CheckSquare className="w-3.5 h-3.5 text-purple-400" />
                    <span>Deselect All</span>
                  </>
                ) : (
                  <>
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                    <span>Select All Filtered</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Student Allotment Table */}
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 bg-white/[0.02]">
                {currentUser.role === 'admin' && (
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAll}
                      className="accent-purple-600 rounded cursor-pointer"
                    />
                  </th>
                )}
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Roll Number</th>
                <th className="py-3 px-4">Current Class Assignment</th>
                <th className="py-3 px-4 text-right">Individual Reassign</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td
                    colSpan={currentUser.role === 'admin' ? 5 : 4}
                    className="py-8 text-center text-slate-500 italic"
                  >
                    No students match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((stu: TenantUser, idx: number) => {
                  const stuKey = stu.id || (stu as any)._id || stu.username || `stu-${idx}`;
                  const assignedCls = classes.find(
                    (c: SchoolClass) => (c.id || (c as any)._id) === stu.assignedClassId
                  );
                  const isSelected = selectedStudentIds.includes(stuKey);

                  return (
                    <tr
                      key={stuKey}
                      className={`transition-colors ${
                        isSelected ? 'bg-purple-500/[0.08]' : 'hover:bg-white/[0.02]'
                      }`}
                    >
                      {currentUser.role === 'admin' && (
                        <td className="py-3 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStudent(stuKey)}
                            className="accent-purple-600 rounded cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{stu.fullName}</div>
                        <div className="text-[11px] text-slate-400">{stu.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-purple-300">
                        {stu.rollNumber || 'N/A'}
                      </td>
                      <td className="py-3 px-4">
                        {assignedCls ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            <GraduationCap className="w-3 h-3" />
                            {assignedCls.name} ({assignedCls.roomNumber || assignedCls.gradeLevel})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {currentUser.role === 'admin' ? (
                          <select
                            value={stu.assignedClassId || ''}
                            onChange={(e) => allotStudent(e.target.value, stuKey)}
                            className="px-2.5 py-1 text-xs bg-black/60 border border-white/15 rounded-lg text-white focus:outline-none focus:border-purple-500"
                          >
                            <option value="">-- Unassign --</option>
                            {classes.map((c: SchoolClass, cIdx: number) => {
                              const cKey = c.id || (c as any)._id || c.name || `opt-cls-${cIdx}`;
                              return (
                                <option key={cKey} value={cKey}>
                                  {c.name}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <span className="text-slate-400">{assignedCls?.roomNumber || '-'}</span>
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

      {/* Modal: Create Class */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-purple-400" />
                <span>Create New Class Cohort</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Class Name * (e.g. Class A, Class B)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Class A"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Grade Level</label>
                  <input
                    type="text"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Section</label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Room Number</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Student Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Primary Faculty / Teacher</label>
                <select
                  value={primaryTeacherId}
                  onChange={(e) => setPrimaryTeacherId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                >
                  {teacherList.map((t: TenantUser) => (
                    <option key={t.id || (t as any)._id} value={t.id || (t as any)._id}>
                      {t.fullName} ({t.specialization || 'Faculty'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-2 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-500 cursor-pointer shadow-md shadow-purple-600/30"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
