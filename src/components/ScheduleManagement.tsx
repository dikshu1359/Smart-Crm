import React, { useState } from 'react';
import { CalendarClock, Plus, Coffee, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DAYS_OF_WEEK, TIME_SLOTS } from '../data/seedMultiTenant';
import { DayOfWeek, TimeSlotInterval, TenantUser, SchoolClass, ScheduleSlot } from '../types/crm';

export const ScheduleManagement: React.FC = () => {
  const { activeTenant, currentUser, classes, users, schedules, addScheduleSlot } = useApp();
  if (!activeTenant || !currentUser) return null;
  const [selectedClassId, setSelectedClassId] = useState(
    currentUser.role === 'student' && currentUser.assignedClassId
      ? currentUser.assignedClassId
      : classes[0]?.id || ''
  );

  const [showAddModal, setShowAddModal] = useState(false);
  const [day, setDay] = useState<DayOfWeek>('Monday');
  const [timeSlot, setTimeSlot] = useState<TimeSlotInterval>('09:00 - 10:00');
  const [subject, setSubject] = useState('Calculus');
  const [teacherId, setTeacherId] = useState(users.find((u: TenantUser) => u.role === 'teacher')?.id || '');
  const [roomNumber, setRoomNumber] = useState('Lab 304');
  const [errorMsg, setErrorMsg] = useState('');

  const teachers = users.filter((u: TenantUser) => u.role === 'teacher');

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await addScheduleSlot({
      day,
      timeSlot,
      classId: selectedClassId,
      subject,
      teacherId,
      roomNumber,
    });
    if (!res.ok) {
      setErrorMsg(res.message || 'Conflict detected.');
    } else {
      setShowAddModal(false);
      setErrorMsg('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Conflict-Free Weekly Timetable</h1>
          <p className="text-xs text-slate-400 mt-1">09:00 - 14:30 schedule with 12:00-12:30 lunch break.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white"
          >
            {classes.map((c: SchoolClass, cIdx: number) => {
              const cKey = c.id || (c as any)._id || `class-opt-${cIdx}`;
              return (
                <option key={cKey} value={cKey}>
                  {c.name}
                </option>
              );
            })}
          </select>
          {currentUser.role === 'admin' && (
            <button
              onClick={() => {
                setErrorMsg('');
                setShowAddModal(true);
              }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-500 cursor-pointer"
            >
              + Add Slot
            </button>
          )}
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="py-2.5 pr-4 w-32 font-mono">Time Interval</th>
              {DAYS_OF_WEEK.map((d: string) => (
                <th key={d} className="py-2.5 px-3 font-semibold text-white">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {TIME_SLOTS.map((slotTime) => {
              if (slotTime === '12:00 - 12:30') {
                return (
                  <tr key={slotTime} className="bg-purple-950/30">
                    <td className="py-3 pr-4 font-mono text-pink-300 font-semibold">{slotTime}</td>
                    <td colSpan={5} className="py-3 px-3 text-center text-pink-200 font-medium">
                      <Coffee className="w-4 h-4 inline mr-2 text-pink-400" />
                      Institutional Lunch Break (12:00 PM – 12:30 PM)
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={slotTime}>
                  <td className="py-3 pr-4 font-mono text-slate-300">{slotTime}</td>
                  {DAYS_OF_WEEK.map((d: string) => {
                    const slot = schedules.find(
                      (s: ScheduleSlot) => s.day === d && s.timeSlot === slotTime && s.classId === selectedClassId
                    );
                    const teacher = slot ? users.find((u: TenantUser) => u.id === slot.teacherId) : null;
                    return (
                      <td key={d} className="py-2.5 px-2.5">
                        {slot ? (
                          <div className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/20">
                            <div className="font-semibold text-white">{slot.subject}</div>
                            <div className="text-[11px] text-purple-300 mt-0.5">{teacher?.fullName}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{slot.roomNumber}</div>
                          </div>
                        ) : (
                          <div className="p-2.5 text-center text-slate-600 border border-dashed border-white/5 rounded-xl">
                            -
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white">Schedule Class Slot</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSlot} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Day</label>
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value as DayOfWeek)}
                    className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Time Slot</label>
                  <select
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value as TimeSlotInterval)}
                    className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white font-mono"
                  >
                    {TIME_SLOTS.filter((t) => t !== '12:00 - 12:30').map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Teacher</label>
                <select
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                >
                  {teachers.map((t, tIdx) => {
                    const tKey = t.id || (t as any)._id || t.username || `teacher-opt-${tIdx}`;
                    return (
                      <option key={tKey} value={tKey}>
                        {t.fullName}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Subject</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-300 mb-1">Room</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  />
                </div>
              </div>
              {errorMsg && <div className="p-2 bg-red-950/60 border border-red-500/40 text-xs text-red-200 rounded-xl">{errorMsg}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-xs text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl">
                  Schedule Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
