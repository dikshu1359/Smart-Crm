import React, { useState } from 'react';
import { Plus, Trash2, Users, BookOpen, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { SchoolClass, TenantUser } from '../types/crm';

export const ClassManagement: React.FC = () => {
  const { activeTenant, currentUser, classes, users, createClass, deleteClass, allotStudent, setActiveTab } = useApp();
  if (!activeTenant || !currentUser) return null;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('Grade 12');
  const [section, setSection] = useState('Section A');
  const [roomNumber, setRoomNumber] = useState('Room 204');
  const [capacity, setCapacity] = useState(30);

  const teacherList = users.filter((u: TenantUser) => u.role === 'teacher');
  const studentList = users.filter((u: TenantUser) => u.role === 'student');
  const [primaryTeacherId, setPrimaryTeacherId] = useState(teacherList[0]?.id || '');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createClass({
      name: name.trim(),
      gradeLevel,
      section,
      roomNumber,
      capacity: Number(capacity) || 30,
      primaryTeacherId: primaryTeacherId || teacherList[0]?.id || '',
      subjects: ['Mathematics', 'Physics', 'Computing'],
    });
    setName('');
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Class &amp; Student Allotment Management</h1>
          <p className="text-xs text-slate-400 mt-1">Create cohorts, assign faculty, and allot student rosters.</p>
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
              className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-500 cursor-pointer"
            >
              + Create Class
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls: SchoolClass, idx: number) => {
          const clsKey = cls.id || (cls as any)._id || cls.name || `cls-${idx}`;
          const teacher = users.find((u: TenantUser) => (u.id || (u as any)._id) === cls.primaryTeacherId);
          return (
            <div key={clsKey} className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
              <div>
                <div className="text-xs text-purple-300 font-medium">
                  {cls.gradeLevel} &middot; {cls.roomNumber}
                </div>
                <h2 className="text-lg font-bold text-white mt-1">{cls.name}</h2>
                <div className="text-xs text-slate-400 mt-2">Primary Faculty: {teacher?.fullName || 'Unassigned'}</div>
                <div className="text-xs font-mono text-slate-300 mt-3 pt-3 border-t border-white/10">
                  Enrollment: {cls.studentIds?.length || 0} / {cls.capacity} Students
                </div>
              </div>
              {currentUser.role === 'admin' && (
                <div className="pt-4 mt-4 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => deleteClass(clsKey)}
                    className="text-xs text-slate-400 hover:text-red-400 cursor-pointer"
                  >
                    Delete Class
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Student Allotment Table */}
      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
        <h2 className="text-base font-bold text-white mb-4">Student Allotment Roster</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="py-2.5 pr-4">Student</th>
                <th className="py-2.5 px-4">Roll Number</th>
                <th className="py-2.5 px-4">Current Cohort</th>
                <th className="py-2.5 pl-4 text-right">Reassign Class</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {studentList.map((stu: TenantUser, idx: number) => {
                const stuKey = stu.id || (stu as any)._id || stu.username || `stu-${idx}`;
                const assignedCls = classes.find((c: SchoolClass) => (c.id || (c as any)._id) === stu.assignedClassId);
                return (
                  <tr key={stuKey}>
                    <td className="py-3 pr-4 text-white font-medium">{stu.fullName}</td>
                    <td className="py-3 px-4 font-mono text-purple-300">{stu.rollNumber || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-300">{assignedCls?.name || 'Unassigned'}</td>
                    <td className="py-3 pl-4 text-right">
                      {currentUser.role === 'admin' ? (
                        <select
                          value={stu.assignedClassId || ''}
                          onChange={(e) => allotStudent(e.target.value, stuKey)}
                          className="px-2.5 py-1 text-xs bg-black/50 border border-white/15 rounded-lg text-white"
                        >
                          <option value="">-- Unassigned --</option>
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
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white">Create Class</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Class Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Grade Level</label>
                  <input
                    type="text"
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Section</label>
                  <input
                    type="text"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
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
                    className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Capacity</label>
                  <input
                    type="number"
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Primary Teacher</label>
                <select
                  value={primaryTeacherId}
                  onChange={(e) => setPrimaryTeacherId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                >
                  {teacherList.map((t: TenantUser) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 text-xs text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl">
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
