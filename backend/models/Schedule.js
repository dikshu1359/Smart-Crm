/**
 * Schedule Model
 * Time slot management across 09:00 AM - 02:30 PM with dedicated 12:00-12:30 lunch break
 * and conflict detection for teacher and classroom allocations.
 */
export const TIME_SLOTS = [
  '09:00 - 10:00',
  '10:00 - 11:00',
  '11:00 - 12:00',
  '12:00 - 12:30', // Institutional Lunch Break
  '12:30 - 13:30',
  '13:30 - 14:30',
];

export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const ScheduleSchema = {
  id: String,
  day: {
    type: String,
    enum: DAYS_OF_WEEK,
    required: true,
  },
  timeSlot: {
    type: String,
    required: true,
  },
  classId: { type: String, required: true },
  subject: { type: String, required: true },
  teacherId: { type: String },
  roomNumber: { type: String },
  isBreak: { type: Boolean, default: false },
  breakTitle: { type: String },
};

export class ScheduleSlot {
  constructor(data) {
    this.id = data.id || `sch-${Date.now()}`;
    this.day = data.day;
    this.timeSlot = data.timeSlot;
    this.classId = data.classId;
    this.subject = data.subject;
    this.teacherId = data.teacherId;
    this.roomNumber = data.roomNumber;
  }
}

export default ScheduleSlot;
