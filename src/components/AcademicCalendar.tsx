import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Tag,
  AlertCircle,
  Edit2,
  Trash2,
  Filter,
  CheckCircle2,
  Info,
  CalendarDays,
  List,
  Columns,
  Sparkles,
  School,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CalendarEvent, CalendarEventCategory } from '../types/crm';

const CATEGORY_CONFIG: Record<
  CalendarEventCategory,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    dotColor: string;
    calendarBg: string;
    cardBorder: string;
    desc: string;
  }
> = {
  academic: {
    label: 'Academic Event',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-300',
    badgeBorder: 'border-blue-500/30',
    dotColor: 'bg-blue-400',
    calendarBg: 'bg-blue-500/20 text-blue-200 border-blue-500/40 hover:bg-blue-500/30',
    cardBorder: 'border-blue-500/30',
    desc: 'Exams, assessments, assignment deadlines, workshops & PTA meetings',
  },
  holiday: {
    label: 'National & Public Holiday',
    badgeBg: 'bg-emerald-500/15',
    badgeText: 'text-emerald-300',
    badgeBorder: 'border-emerald-500/30',
    dotColor: 'bg-emerald-400',
    calendarBg: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40 hover:bg-emerald-500/30',
    cardBorder: 'border-emerald-500/30',
    desc: 'National holidays, public holidays & official breaks',
  },
  special: {
    label: 'Special Event',
    badgeBg: 'bg-orange-500/15',
    badgeText: 'text-orange-300',
    badgeBorder: 'border-orange-500/30',
    dotColor: 'bg-orange-400',
    calendarBg: 'bg-orange-500/20 text-orange-200 border-orange-500/40 hover:bg-orange-500/30',
    cardBorder: 'border-orange-500/30',
    desc: 'Cultural, technical festivals, annual functions & sports tournaments',
  },
};

export const AcademicCalendar: React.FC = () => {
  const {
    currentUser,
    activeTenant,
    classes,
    calendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
  } = useApp();

  const isAdmin = currentUser?.role === 'admin';

  // Navigation state (view date)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'list'>('month');

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & form state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedEventDetails, setSelectedEventDetails] = useState<CalendarEvent | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<CalendarEventCategory>('academic');
  const [formDescription, setFormDescription] = useState('');
  const [formDate, setFormDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [formStartTime, setFormStartTime] = useState('09:00');
  const [formEndTime, setFormEndTime] = useState('17:00');
  const [formTargetScope, setFormTargetScope] = useState<'all' | 'class'>('all');
  const [formTargetClassIds, setFormTargetClassIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [overlapNotice, setOverlapNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Year & Month calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return calendarEvents.filter((ev) => {
      if (selectedCategory !== 'all' && ev.category !== selectedCategory) return false;
      if (selectedClassId !== 'all') {
        if (ev.targetScope === 'class' && !ev.targetClassIds.includes(selectedClassId)) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = ev.title.toLowerCase().includes(q);
        const matchDesc = ev.description.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [calendarEvents, selectedCategory, selectedClassId, searchQuery]);

  // Month grid days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    const prevMonthLastDate = new Date(year, month, 0).getDate();

    const days: {
      dayNumber: number;
      dateString: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthLastDate - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const dateString = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateString,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDate; d++) {
      const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateString,
        isCurrentMonth: true,
        isToday: dateString === todayStr,
      });
    }

    // Next month padding to fill complete grid of 35 or 42 cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      const dateString = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNumber: d,
        dateString,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
      });
    }

    return days;
  }, [year, month]);

  // Week view calculation
  const currentWeekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const first = curr.getDate() - curr.getDay(); // First day is Sunday
    const week = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 7; i++) {
      const d = new Date(curr.setDate(first + i));
      const dateString = d.toISOString().split('T')[0];
      week.push({
        dayNumber: d.getDate(),
        dayName: daysOfWeek[d.getDay()],
        dateString,
        isToday: dateString === todayStr,
      });
    }
    return week;
  }, [currentDate]);

  // Open creation modal
  const handleOpenCreateModal = (prefillDate?: string) => {
    setEditingEvent(null);
    setFormTitle('');
    setFormCategory('academic');
    setFormDescription('');
    setFormDate(prefillDate || new Date().toISOString().split('T')[0]);
    setFormStartTime('09:00');
    setFormEndTime('17:00');
    setFormTargetScope('all');
    setFormTargetClassIds([]);
    setFormError(null);
    setOverlapNotice(null);
    setIsCreateModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormTitle(event.title);
    setFormCategory(event.category);
    setFormDescription(event.description || '');
    setFormDate(event.date);
    setFormStartTime(event.startTime || '09:00');
    setFormEndTime(event.endTime || '17:00');
    setFormTargetScope(event.targetScope || 'all');
    setFormTargetClassIds(event.targetClassIds || []);
    setFormError(null);
    setOverlapNotice(null);
    setIsCreateModalOpen(true);
  };

  // Submit form (create or edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setOverlapNotice(null);

    if (!formTitle.trim()) {
      setFormError('Please enter an event title.');
      return;
    }
    if (!formDate.trim()) {
      setFormError('Please select a valid event date.');
      return;
    }
    if (formStartTime >= formEndTime) {
      setFormError('Start time must be earlier than end time.');
      return;
    }
    if (formTargetScope === 'class' && formTargetClassIds.length === 0) {
      setFormError('Please select at least one class for class-specific events.');
      return;
    }

    setSubmitting(true);
    const payload = {
      title: formTitle.trim(),
      category: formCategory,
      description: formDescription.trim(),
      date: formDate.trim(),
      startTime: formStartTime,
      endTime: formEndTime,
      targetScope: formTargetScope,
      targetClassIds: formTargetClassIds,
    };

    try {
      if (editingEvent) {
        const res = await updateCalendarEvent(editingEvent.id || (editingEvent as any)._id, payload);
        if (!res.ok) {
          setFormError(res.message || 'Failed to update calendar event.');
        } else {
          setIsCreateModalOpen(false);
          setEditingEvent(null);
        }
      } else {
        const res = await createCalendarEvent(payload);
        if (!res.ok) {
          setFormError(res.message || 'Failed to create calendar event.');
        } else {
          if (res.overlapWarning) {
            setOverlapNotice(res.overlapWarning);
          }
          setIsCreateModalOpen(false);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete event
  const handleDeleteEvent = async (id: string) => {
    const res = await deleteCalendarEvent(id);
    if (res.ok) {
      setDeleteConfirmId(null);
      if (selectedEventDetails?.id === id) {
        setSelectedEventDetails(null);
      }
    } else {
      alert(res.message || 'Failed to delete event');
    }
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-purple-400">
            <CalendarIcon className="w-4 h-4 text-purple-400" />
            <span>Academic Schedule &amp; Institutional Milestones</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-white mt-1">
            Academic Calendar
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            {isAdmin
              ? 'Organize examinations, public holidays, and institutional festivals with color-coded classification and class allotment.'
              : 'View all upcoming exams, official holidays, and special institutional festivals relevant to your class.'}
          </p>
        </div>

        {isAdmin && (
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-600/30 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Calendar Event</span>
          </button>
        )}
      </div>

      {/* Category Legend Bar (3 Distinct Colors) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-white/[0.02] border border-white/10">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/25">
          <div className="w-3.5 h-3.5 rounded-full bg-blue-400 shrink-0 shadow-sm shadow-blue-400/50" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-blue-300">A. Academic Events (Blue)</div>
            <div className="text-[11px] text-blue-200/70 truncate">Exams, Assessments, Deadlines, PTA</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400/50" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-emerald-300">B. National Holidays (Green)</div>
            <div className="text-[11px] text-emerald-200/70 truncate">Public holidays &amp; official closures</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/25">
          <div className="w-3.5 h-3.5 rounded-full bg-orange-400 shrink-0 shadow-sm shadow-orange-400/50" />
          <div className="min-w-0">
            <div className="text-xs font-bold text-orange-300">C. Special Events (Orange)</div>
            <div className="text-[11px] text-orange-200/70 truncate">Festivals, Technical events &amp; Sports</div>
          </div>
        </div>
      </div>

      {/* Controls: Navigation, View Mode, Filters */}
      <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        {/* Month Navigation */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h2 className="text-lg font-bold font-display text-white whitespace-nowrap">
            {monthNames[month]} {year}
          </h2>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Month</span>
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Week</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Upcoming</span>
            </button>
          </div>
        </div>

        {/* Filtering Options */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="all" className="bg-[#141124]">All Categories</option>
            <option value="academic" className="bg-[#141124]">Blue: Academic Events</option>
            <option value="holiday" className="bg-[#141124]">Green: Public Holidays</option>
            <option value="special" className="bg-[#141124]">Orange: Special Events</option>
          </select>

          {/* Class Filter */}
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="all" className="bg-[#141124]">All Classes &amp; Institution</option>
            {classes.map((c) => (
              <option key={c.id || (c as any)._id} value={c.id || (c as any)._id} className="bg-[#141124]">
                {c.name} ({c.gradeLevel} - {c.section})
              </option>
            ))}
          </select>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 w-36 sm:w-44"
          />
        </div>
      </div>

      {/* VIEW: MONTHLY GRID */}
      {viewMode === 'month' && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden shadow-xl">
          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
            {daysOfWeek.map((day) => (
              <div
                key={day}
                className="py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-400"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-white/5">
            {calendarDays.map((d, idx) => {
              const dayEvents = filteredEvents.filter((ev) => ev.date === d.dateString);
              return (
                <div
                  key={`${d.dateString}-${idx}`}
                  onClick={() => {
                    if (isAdmin && dayEvents.length === 0) {
                      handleOpenCreateModal(d.dateString);
                    }
                  }}
                  className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors ${
                    d.isCurrentMonth ? 'bg-transparent' : 'bg-white/[0.01] opacity-40'
                  } ${d.isToday ? 'ring-1 ring-inset ring-purple-500/50 bg-purple-500/[0.04]' : ''} hover:bg-white/[0.02] cursor-pointer`}
                >
                  {/* Date badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-xs font-mono font-semibold rounded-md px-1.5 py-0.5 ${
                        d.isToday
                          ? 'bg-purple-600 text-white'
                          : d.isCurrentMonth
                          ? 'text-slate-300'
                          : 'text-slate-600'
                      }`}
                    >
                      {d.dayNumber}
                    </span>

                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCreateModal(d.dateString);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 text-slate-400 hover:text-white rounded"
                        title="Add event on this date"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Event Chips */}
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[85px] no-scrollbar">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.academic;
                      return (
                        <div
                          key={ev.id || (ev as any)._id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEventDetails(ev);
                          }}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium border truncate cursor-pointer transition-all ${cfg.calendarBg}`}
                          title={`${ev.title} (${ev.startTime || '09:00'} - ${ev.endTime || '17:00'})`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} shrink-0`} />
                            <span className="truncate">{ev.title}</span>
                          </div>
                        </div>
                      );
                    })}

                    {dayEvents.length > 3 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventDetails(dayEvents[0]);
                        }}
                        className="text-[10px] text-purple-400 font-semibold hover:underline block text-left px-1"
                      >
                        +{dayEvents.length - 3} more events
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: WEEKLY COLUMN VIEW */}
      {viewMode === 'week' && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden shadow-xl">
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
            {currentWeekDays.map((d) => (
              <div
                key={d.dateString}
                className={`p-3 text-center border-r border-white/5 last:border-r-0 ${
                  d.isToday ? 'bg-purple-500/10' : ''
                }`}
              >
                <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  {d.dayName}
                </div>
                <div
                  className={`text-base font-bold font-mono mt-0.5 inline-block px-2 py-0.5 rounded-lg ${
                    d.isToday ? 'bg-purple-600 text-white' : 'text-slate-200'
                  }`}
                >
                  {d.dayNumber}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 divide-x divide-white/5 min-h-[360px] p-2">
            {currentWeekDays.map((d) => {
              const dayEvents = filteredEvents.filter((ev) => ev.date === d.dateString);
              return (
                <div key={d.dateString} className="p-2 space-y-2">
                  {dayEvents.map((ev) => {
                    const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.academic;
                    return (
                      <div
                        key={ev.id || (ev as any)._id}
                        onClick={() => setSelectedEventDetails(ev)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${cfg.badgeBg} ${cfg.cardBorder} hover:scale-[1.02]`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`w-2 h-2 rounded-full ${cfg.dotColor}`} />
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.badgeText}`}>
                            {ev.category}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-white line-clamp-2">{ev.title}</div>
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{ev.startTime} - {ev.endTime}</span>
                        </div>
                      </div>
                    );
                  })}

                  {dayEvents.length === 0 && (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-600 font-mono py-8">
                      No events
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW: UPCOMING CHRONOLOGICAL LIST */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/10">
              <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">No calendar events found</p>
              <p className="text-xs text-slate-500 mt-1">Adjust filters or create a new event.</p>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const cfg = CATEGORY_CONFIG[ev.category] || CATEGORY_CONFIG.academic;
              return (
                <div
                  key={ev.id || (ev as any)._id}
                  onClick={() => setSelectedEventDetails(ev)}
                  className={`p-4 rounded-2xl bg-white/[0.03] border transition-all hover:bg-white/[0.05] cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${cfg.cardBorder}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Date badge */}
                    <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] uppercase font-bold text-purple-400">
                        {new Date(ev.date + 'T00:00:00').toLocaleString('default', { month: 'short' })}
                      </span>
                      <span className="text-lg font-bold font-mono text-white">
                        {ev.date.split('-')[2]}
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                        >
                          {cfg.label}
                        </span>
                        {ev.targetScope === 'class' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            Class Specific
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-300 border border-slate-500/20">
                            Entire Institution
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white">{ev.title}</h3>
                      {ev.description && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{ev.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right text-xs font-mono text-slate-400">
                      <div className="flex items-center gap-1.5 justify-end">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{ev.startTime} - {ev.endTime}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Author: {ev.authorName}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1.5 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(ev);
                          }}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                          title="Edit Event"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(ev.id || (ev as any)._id);
                          }}
                          className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* EVENT DETAILS MODAL */}
      {selectedEventDetails && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141124] border border-white/10 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setSelectedEventDetails(null)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {(() => {
              const cfg = CATEGORY_CONFIG[selectedEventDetails.category] || CATEGORY_CONFIG.academic;
              return (
                <>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${cfg.badgeBg} ${cfg.badgeText} ${cfg.badgeBorder}`}
                    >
                      {cfg.label}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {selectedEventDetails.date}
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold font-display text-white">
                      {selectedEventDetails.title}
                    </h2>
                    {selectedEventDetails.description && (
                      <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/5">
                        {selectedEventDetails.description}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Time Window</span>
                      <span className="text-slate-200 font-mono font-medium">
                        {selectedEventDetails.startTime} - {selectedEventDetails.endTime}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Target Audience</span>
                      <span className="text-slate-200 font-medium capitalize">
                        {selectedEventDetails.targetScope === 'class' ? 'Specific Classes' : 'Entire Institution'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
                    <span>Published by {selectedEventDetails.authorName} ({selectedEventDetails.authorRole})</span>

                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const ev = selectedEventDetails;
                            setSelectedEventDetails(null);
                            handleOpenEditModal(ev);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-medium cursor-pointer"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            const id = selectedEventDetails.id || (selectedEventDetails as any)._id;
                            setSelectedEventDetails(null);
                            setDeleteConfirmId(id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* CREATE / EDIT EVENT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141124] border border-white/10 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-xs uppercase tracking-wider font-semibold text-purple-400">
                {editingEvent ? 'Modify Existing Event' : 'Create New Calendar Entry'}
              </div>
              <h2 className="text-xl font-bold font-display text-white mt-1">
                {editingEvent ? 'Edit Academic Calendar Event' : 'New Academic Calendar Event'}
              </h2>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {overlapNotice && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{overlapNotice}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-4">
              {/* Event Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mid-Term Semester Examinations, Independence Day, Tech Fest 2026"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Event Category (3 distinct colors) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Category (Color Representation) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['academic', 'holiday', 'special'] as CalendarEventCategory[]).map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat];
                    const selected = formCategory === cat;
                    return (
                      <button
                        type="button"
                        key={cat}
                        onClick={() => setFormCategory(cat)}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          selected
                            ? `${cfg.badgeBg} ${cfg.cardBorder} ring-2 ring-purple-500/50`
                            : 'bg-white/[0.02] border-white/10 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${cfg.dotColor}`} />
                          <span className={`text-xs font-bold ${cfg.badgeText}`}>
                            {cat === 'academic' && 'Academic (Blue)'}
                            {cat === 'holiday' && 'Holiday (Green)'}
                            {cat === 'special' && 'Special (Orange)'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{cfg.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date, Start Time, End Time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Event Date (YYYY-MM-DD) *
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formStartTime}
                    onChange={(e) => setFormStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formEndTime}
                    onChange={(e) => setFormEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Scope & Class Allotment */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Institutional Scope &amp; Class Allotment
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="targetScope"
                      checked={formTargetScope === 'all'}
                      onChange={() => setFormTargetScope('all')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>Entire Institution (All Cohorts)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="targetScope"
                      checked={formTargetScope === 'class'}
                      onChange={() => setFormTargetScope('class')}
                      className="text-purple-600 focus:ring-purple-500"
                    />
                    <span>Selected Classes Only</span>
                  </label>
                </div>

                {formTargetScope === 'class' && (
                  <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 space-y-2 max-h-36 overflow-y-auto">
                    <div className="text-[11px] text-slate-400 mb-1">Select participating classes:</div>
                    {classes.map((cls) => {
                      const cid = cls.id || (cls as any)._id;
                      const isChecked = formTargetClassIds.includes(cid);
                      return (
                        <label key={cid} className="flex items-center gap-2 text-xs text-white cursor-pointer hover:bg-white/5 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormTargetClassIds([...formTargetClassIds, cid]);
                              } else {
                                setFormTargetClassIds(formTargetClassIds.filter((id) => id !== cid));
                              }
                            }}
                            className="rounded text-purple-600 focus:ring-purple-500"
                          />
                          <span>{cls.name} ({cls.gradeLevel} - {cls.section})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description &amp; Guidelines (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide instructions, venue details, syllabus scope, or celebration notes..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Form Actions */}
              <div className="pt-3 border-t border-white/10 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 shadow-md shadow-purple-600/30 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving to Database...' : editingEvent ? 'Save Changes' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141124] border border-white/10 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-2xl text-center">
            <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Delete Calendar Event</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to remove this academic event from the database? This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteEvent(deleteConfirmId)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/30"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AcademicCalendar;
