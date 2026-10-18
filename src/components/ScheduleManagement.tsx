import React, { useState, useMemo } from 'react';
import {
  CalendarClock,
  Plus,
  Coffee,
  X,
  Pencil,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  BookOpen,
  User,
  Building,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DayOfWeek, TimeSlotInterval, TenantUser, SchoolClass, ScheduleSlot } from '../types/crm';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const DEFAULT_STANDARD_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 12:45',
  '12:45 - 13:45',
  '13:45 - 14:45',
];

function parseTimeToMinutes(tStr: string): number {
  if (!tStr) return 0;
  const parts = tStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

function parseSlotRange(timeSlot: string) {
  if (!timeSlot || !timeSlot.includes('-')) return { start: 0, end: 0, startStr: '09:00', endStr: '10:00' };
  const parts = timeSlot.split('-').map((s) => s.trim());
  return {
    start: parseTimeToMinutes(parts[0]),
    end: parseTimeToMinutes(parts[1]),
    startStr: parts[0],
    endStr: parts[1],
  };
}

export const ScheduleManagement: React.FC = () => {
  const {
    activeTenant,
    currentUser,
    classes,
    users,
    schedules,
    addScheduleSlot,
    updateScheduleSlot,
    deleteScheduleSlot,
    refreshData,
  } = useApp();

  if (!activeTenant || !currentUser) return null;

  const isAdmin = currentUser.role === 'admin';
  const isTeacher = currentUser.role === 'teacher';
  const isStudent = currentUser.role === 'student';

  // Selected Class state
  const [selectedClassId, setSelectedClassId] = useState<string>(
    isStudent && currentUser.assignedClassId
      ? currentUser.assignedClassId
      : classes[0]?.id || (classes[0] as any)?._id || ''
  );

  // Modal states
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [isBreakMode, setIsBreakMode] = useState(false);

  // Form Fields
  const [slotDay, setSlotDay] = useState<DayOfWeek>('Monday');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [subject, setSubject] = useState('');
  const [teacherId, setTeacherId] = useState(users.find((u: TenantUser) => u.role === 'teacher')?.id || '');
  const [roomNumber, setRoomNumber] = useState('Lab 304');
  const [breakTitle, setBreakTitle] = useState('Institutional Lunch Break');
  const [targetClassScope, setTargetClassScope] = useState<'all' | 'selected'>('all');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const teachers = useMemo(() => users.filter((u: TenantUser) => u.role === 'teacher'), [users]);

  // Dynamically derive all active time intervals (combining standard intervals and saved custom slots)
  const allTimeIntervals = useMemo(() => {
    const intervalsSet = new Set<string>(DEFAULT_STANDARD_SLOTS);

    schedules.forEach((s) => {
      if (s.timeSlot) {
        intervalsSet.add(s.timeSlot);
      }
    });

    return Array.from(intervalsSet).sort((a, b) => {
      const aRange = parseSlotRange(a);
      const bRange = parseSlotRange(b);
      return aRange.start - bRange.start || aRange.end - bRange.end;
    });
  }, [schedules]);

  // Open modal to add a regular class session
  const openAddClassSlot = (presetDay?: DayOfWeek, presetTimeSlot?: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setEditingSlotId(null);
    setIsBreakMode(false);
    setSlotDay(presetDay || 'Monday');

    if (presetTimeSlot) {
      const range = parseSlotRange(presetTimeSlot);
      setStartTime(range.startStr);
      setEndTime(range.endStr);
    } else {
      setStartTime('09:00');
      setEndTime('10:00');
    }

    const firstSubject = classes.find((c) => (c.id || (c as any)._id) === selectedClassId)?.subjects?.[0] || 'Core Subject';
    setSubject(firstSubject);
    setTeacherId(teachers[0]?.id || (teachers[0] as any)?._id || '');
    setRoomNumber('Lab 304');
    setShowSlotModal(true);
  };

  // Open modal to configure an institutional break
  const openConfigureBreak = (presetSlot?: ScheduleSlot) => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsBreakMode(true);

    if (presetSlot) {
      setEditingSlotId(presetSlot.id || (presetSlot as any)._id || null);
      setSlotDay((presetSlot.day as DayOfWeek) || 'Monday');
      const range = parseSlotRange(presetSlot.timeSlot);
      setStartTime(range.startStr);
      setEndTime(range.endStr);
      setBreakTitle(presetSlot.breakTitle || presetSlot.subject || 'Institutional Lunch Break');
      setTargetClassScope(presetSlot.classId === 'all' ? 'all' : 'selected');
    } else {
      setEditingSlotId(null);
      setSlotDay('Monday');
      setStartTime('12:00');
      setEndTime('12:45');
      setBreakTitle('Institutional Lunch Break');
      setTargetClassScope('all');
    }

    setShowSlotModal(true);
  };

  // Open modal to edit an existing slot
  const openEditSlot = (slot: ScheduleSlot) => {
    setErrorMsg('');
    setSuccessMsg('');
    setEditingSlotId(slot.id || (slot as any)._id || null);

    if (slot.isBreak) {
      setIsBreakMode(true);
      setSlotDay((slot.day as DayOfWeek) || 'Monday');
      const range = parseSlotRange(slot.timeSlot);
      setStartTime(range.startStr);
      setEndTime(range.endStr);
      setBreakTitle(slot.breakTitle || slot.subject || 'Institutional Lunch Break');
      setTargetClassScope(slot.classId === 'all' ? 'all' : 'selected');
    } else {
      setIsBreakMode(false);
      setSlotDay((slot.day as DayOfWeek) || 'Monday');
      const range = parseSlotRange(slot.timeSlot);
      setStartTime(range.startStr);
      setEndTime(range.endStr);
      setSubject(slot.subject);
      setTeacherId(slot.teacherId || '');
      setRoomNumber(slot.roomNumber || 'Room 101');
    }

    setShowSlotModal(true);
  };

  // Form submission handler
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    // 1. Time range validation: End time strictly later than start time
    const startMin = parseTimeToMinutes(startTime);
    const endMin = parseTimeToMinutes(endTime);

    if (endMin <= startMin) {
      setErrorMsg(`Invalid Time Interval: End time (${endTime}) must be strictly later than start time (${startTime}).`);
      return;
    }

    const calculatedTimeSlot = `${startTime} - ${endTime}`;
    setIsSubmitting(true);

    try {
      if (isBreakMode) {
        // Break period
        const payload = {
          day: slotDay,
          timeSlot: calculatedTimeSlot,
          startTime,
          endTime,
          isBreak: true,
          breakTitle: breakTitle.trim() || 'Institutional Break',
          subject: breakTitle.trim() || 'Institutional Break',
          classId: targetClassScope === 'all' ? 'all' : selectedClassId,
        };

        let res;
        if (editingSlotId) {
          res = await updateScheduleSlot(editingSlotId, payload);
        } else {
          res = await addScheduleSlot(payload);
        }

        setIsSubmitting(false);
        if (res.ok) {
          setShowSlotModal(false);
          await refreshData();
        } else {
          setErrorMsg(res.message || 'Failed to save break schedule.');
        }
      } else {
        // Academic class session
        if (!subject.trim()) {
          setIsSubmitting(false);
          setErrorMsg('Subject name is required.');
          return;
        }

        if (!teacherId) {
          setIsSubmitting(false);
          setErrorMsg('Assigned teacher/faculty member is required.');
          return;
        }

        const payload = {
          day: slotDay,
          timeSlot: calculatedTimeSlot,
          startTime,
          endTime,
          classId: selectedClassId,
          subject: subject.trim(),
          teacherId,
          roomNumber: roomNumber.trim() || 'Room 101',
          isBreak: false,
        };

        let res;
        if (editingSlotId) {
          res = await updateScheduleSlot(editingSlotId, payload);
        } else {
          res = await addScheduleSlot(payload);
        }

        setIsSubmitting(false);
        if (res.ok) {
          setShowSlotModal(false);
          await refreshData();
        } else {
          setErrorMsg(res.message || 'Conflict detected. Please review scheduled sessions.');
        }
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Error processing schedule request.');
    }
  };

  // Delete slot handler
  const handleDeleteSlot = async (slotId: string) => {
    if (!window.confirm('Are you sure you want to remove this timetable entry?')) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await deleteScheduleSlot(slotId);
      setIsSubmitting(false);
      if (res.ok) {
        setShowSlotModal(false);
        await refreshData();
      } else {
        setErrorMsg(res.message || 'Failed to delete schedule slot.');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Error deleting slot.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Cohort Selection */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Conflict-Free Academic Timetable</h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete Monday to Saturday institutional schedule with configurable break and lunch periods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Class Cohort Filter */}
          {!isStudent && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Cohort:</span>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="px-3.5 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500 font-medium"
              >
                {classes.map((c: SchoolClass, cIdx: number) => {
                  const cKey = c.id || (c as any)._id || `class-opt-${cIdx}`;
                  return (
                    <option key={cKey} value={cKey}>
                      {c.name} ({c.gradeLevel} - {c.section})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* Admin Management Buttons */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openAddClassSlot()}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Class Slot</span>
              </button>
              <button
                type="button"
                onClick={() => openConfigureBreak()}
                className="px-3.5 py-1.5 text-xs font-semibold text-pink-300 hover:text-white bg-pink-950/40 hover:bg-pink-900/60 border border-pink-500/30 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Coffee className="w-3.5 h-3.5 text-pink-400" />
                <span>Configure Break</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Global Status / Error Message */}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Timetable Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs p-3 rounded-2xl bg-white/[0.02] border border-white/5">
        <div className="flex items-center gap-2 text-slate-300">
          <span className="w-3 h-3 rounded-md bg-purple-600/30 border border-purple-500/40" />
          <span>Scheduled Academic Lecture / Lab</span>
        </div>
        <div className="flex items-center gap-2 text-pink-300">
          <span className="w-3 h-3 rounded-md bg-pink-500/20 border border-pink-500/40" />
          <span>Configurable Institutional Break (Lunch / Recess)</span>
        </div>
        <div className="text-[11px] text-slate-400 ml-auto hidden sm:block">
          {isAdmin ? 'Click any cell or slot to create, edit, or configure periods.' : 'Synced with institutional master timetable.'}
        </div>
      </div>

      {/* Complete Monday-to-Saturday Timetable Grid */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 overflow-x-auto shadow-xl">
        <table className="w-full text-left text-xs border-collapse min-w-[850px]">
          <thead>
            <tr className="border-b border-white/10 text-slate-400 bg-white/[0.01]">
              <th className="py-3 px-4 w-36 font-mono font-semibold text-slate-300">Time Interval</th>
              {DAYS_OF_WEEK.map((d: DayOfWeek) => (
                <th key={d} className="py-3 px-3 font-bold text-white text-center">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {allTimeIntervals.map((slotTime) => {
              // Check if this time interval is marked as a break across schedules
              const breakSlot = schedules.find(
                (s: ScheduleSlot) =>
                  s.timeSlot === slotTime &&
                  s.isBreak &&
                  (s.classId === 'all' || s.classId === selectedClassId)
              );

              // 1. Render Configurable Break Period Row
              if (breakSlot) {
                const breakName = breakSlot.breakTitle || breakSlot.subject || 'Institutional Lunch Break';
                return (
                  <tr key={slotTime} className="bg-pink-950/20 hover:bg-pink-950/30 transition-colors">
                    <td className="py-3.5 px-4 font-mono text-pink-300 font-bold whitespace-nowrap">
                      {slotTime}
                    </td>
                    <td
                      colSpan={DAYS_OF_WEEK.length}
                      className="py-3 px-4 text-center text-pink-200 font-semibold"
                    >
                      <div className="flex items-center justify-center gap-3">
                        <Coffee className="w-4 h-4 text-pink-400 shrink-0" />
                        <span>{breakName} ({slotTime})</span>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5 ml-3">
                            <button
                              type="button"
                              onClick={() => openConfigureBreak(breakSlot)}
                              className="px-2 py-0.5 text-[10px] rounded-md bg-pink-500/20 hover:bg-pink-500/40 text-pink-200 border border-pink-500/40 cursor-pointer flex items-center gap-1"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSlot(breakSlot.id || (breakSlot as any)._id)}
                              className="px-2 py-0.5 text-[10px] rounded-md bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 border border-rose-500/40 cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }

              // 2. Render Academic Session Cells for Each Day
              return (
                <tr key={slotTime} className="hover:bg-white/[0.01] transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-300 whitespace-nowrap font-medium">
                    {slotTime}
                  </td>
                  {DAYS_OF_WEEK.map((d: DayOfWeek) => {
                    const slot = schedules.find(
                      (s: ScheduleSlot) =>
                        s.day === d &&
                        s.timeSlot === slotTime &&
                        (s.classId === selectedClassId || s.classId === 'all') &&
                        !s.isBreak
                    );

                    const teacher = slot ? users.find((u: TenantUser) => u.id === slot.teacherId) : null;

                    return (
                      <td key={d} className="py-2.5 px-2">
                        {slot ? (
                          <div
                            onClick={() => isAdmin && openEditSlot(slot)}
                            className={`p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/25 transition-all ${
                              isAdmin ? 'cursor-pointer hover:border-purple-400 hover:bg-purple-900/40 shadow-sm' : ''
                            }`}
                          >
                            <div className="font-bold text-white line-clamp-1">{slot.subject}</div>
                            <div className="text-[11px] text-purple-300 mt-0.5 flex items-center gap-1">
                              <User className="w-3 h-3 text-purple-400 shrink-0" />
                              <span className="truncate">{teacher?.fullName || 'Faculty'}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                              <Building className="w-3 h-3 text-slate-500 shrink-0" />
                              <span>{slot.roomNumber || 'Room 101'}</span>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => isAdmin && openAddClassSlot(d, slotTime)}
                            className={`p-3 text-center text-slate-600 border border-dashed border-white/5 rounded-xl transition-all ${
                              isAdmin ? 'cursor-pointer hover:border-purple-500/40 hover:text-purple-300 hover:bg-white/[0.02]' : ''
                            }`}
                          >
                            {isAdmin ? <span className="text-[10px]">+ Slot</span> : <span>&mdash;</span>}
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

      {/* ======================================================== */}
      {/* ADMIN SCHEDULE / BREAK CONFIGURATION MODAL               */}
      {/* ======================================================== */}
      {showSlotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-lg w-full p-6 border border-white/15 space-y-5 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-purple-400" />
                <span>
                  {editingSlotId
                    ? isBreakMode
                      ? 'Edit Break Period'
                      : 'Edit Timetable Session'
                    : isBreakMode
                    ? 'Configure Break Period'
                    : 'Schedule Academic Session'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setShowSlotModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Toggle (Session vs Break) if creating new */}
            {!editingSlotId && (
              <div className="grid grid-cols-2 p-1 bg-black/40 border border-white/10 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setIsBreakMode(false)}
                  className={`py-2 rounded-lg transition-all ${
                    !isBreakMode ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Academic Lecture / Lab
                </button>
                <button
                  type="button"
                  onClick={() => setIsBreakMode(true)}
                  className={`py-2 rounded-lg transition-all ${
                    isBreakMode ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Break / Lunch Period
                </button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveSlot} className="space-y-4 text-xs">
              {/* Day Selector (Monday to Saturday) */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Day of Week *</label>
                <select
                  value={slotDay}
                  onChange={(e) => setSlotDay(e.target.value as DayOfWeek)}
                  className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Time & End Time inputs with validation */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Start Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">End Time (HH:MM) *</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Break specific fields */}
              {isBreakMode ? (
                <div className="space-y-3 p-3 rounded-xl bg-pink-950/20 border border-pink-500/25">
                  <div>
                    <label className="block text-pink-200 font-semibold mb-1">Break Title / Description *</label>
                    <input
                      type="text"
                      required
                      value={breakTitle}
                      onChange={(e) => setBreakTitle(e.target.value)}
                      placeholder="e.g. Institutional Lunch Break, Tea Break, Recess"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-pink-500/40 text-white focus:outline-none focus:border-pink-400"
                    />
                  </div>

                  <div>
                    <label className="block text-pink-200 font-semibold mb-1">Cohort Scope</label>
                    <select
                      value={targetClassScope}
                      onChange={(e) => setTargetClassScope(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-pink-500/40 text-white focus:outline-none focus:border-pink-400"
                    >
                      <option value="all">All Institutional Cohorts (Campus-Wide)</option>
                      <option value="selected">Selected Cohort Only</option>
                    </select>
                  </div>
                </div>
              ) : (
                /* Academic Session specific fields */
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Subject Name *</label>
                    <input
                      type="text"
                      required
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Operating Systems, Advanced Calculus"
                      className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Assigned Teacher *</label>
                      <select
                        value={teacherId}
                        onChange={(e) => setTeacherId(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white focus:outline-none focus:border-purple-500"
                      >
                        {teachers.map((t) => (
                          <option key={t.id || (t as any)._id} value={t.id || (t as any)._id}>
                            {t.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Room / Lab Number</label>
                      <input
                        type="text"
                        value={roomNumber}
                        onChange={(e) => setRoomNumber(e.target.value)}
                        placeholder="e.g. Lab 304, LH-201"
                        className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-white/15 text-white font-mono focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {editingSlotId ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteSlot(editingSlotId)}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSlotModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 shadow-md shadow-purple-600/30 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Timetable Slot</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagement;
