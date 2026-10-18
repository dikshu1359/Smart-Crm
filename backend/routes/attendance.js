import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/attendance
 * Fetch attendance logs filterable by classId, date, month, or studentId
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id || req.user?._id;
    const { classId, date, month } = req.query;

    let query = {};
    if (classId) query.classId = String(classId);
    if (date) query.date = date;
    if (month) query.date = { $regex: `^${month}` };

    if (role === 'student' && userId && userId !== 'system') {
      const student = await req.tenantDb.User.findById(userId);
      const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);
      if (studentClassId) {
        query.classId = String(studentClassId);
      }
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId);
      const assigned = teacher?.assignedClassIds || [];
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(userId) });
      const teacherClassIds = Array.from(new Set([...assigned, ...primaryClasses.map((c) => c._id.toString())]));

      if (teacherClassIds.length > 0 && !classId) {
        query.classId = { $in: teacherClassIds };
      }
    }

    const sessions = await req.tenantDb.Attendance.find(query).sort({ date: -1 });
    const allClasses = await req.tenantDb.Class.find();
    const classMap = new Map(allClasses.map((c) => [c._id ? c._id.toString() : c.id, c.name]));

    const formatted = sessions.map((s) => {
      const sObj = s.toObject ? s.toObject() : { ...s };
      sObj.id = s._id ? s._id.toString() : s.id;
      sObj.className = classMap.get(String(s.classId)) || `Class ${s.classId}`;

      // If student requested, isolate records and enrich with student's personal status
      if (role === 'student' && userId) {
        const studentRecord = (s.records || []).find((r) => String(r.studentId) === String(userId));
        sObj.personalStatus = studentRecord ? studentRecord.status : 'unmarked';
        sObj.personalRemarks = studentRecord ? studentRecord.remarks : '';
        sObj.records = studentRecord ? [studentRecord] : [];
      }

      return sObj;
    });

    res.json({ attendance: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchAttendanceError', message: err.message });
  }
});

/**
 * GET /api/attendance/summary
 * Comprehensive institution-wide or filtered attendance analytics
 */
router.get('/summary', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id || req.user?._id;

    const [allClasses, allStudents, allSessions] = await Promise.all([
      req.tenantDb.Class.find(),
      req.tenantDb.User.find({ role: 'student' }),
      req.tenantDb.Attendance.find().sort({ date: -1 }),
    ]);

    let targetSessions = allSessions;
    let targetStudents = allStudents;

    if (role === 'student' && userId && userId !== 'system') {
      const student = allStudents.find((s) => (s._id ? s._id.toString() : s.id) === String(userId));
      const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);
      targetSessions = allSessions.filter((s) => String(s.classId) === String(studentClassId));
      targetStudents = allStudents.filter((s) => (s._id ? s._id.toString() : s.id) === String(userId));
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId);
      const teacherClassIds = teacher?.assignedClassIds || [];
      if (teacherClassIds.length > 0) {
        targetSessions = allSessions.filter((s) => teacherClassIds.includes(String(s.classId)));
        targetStudents = allStudents.filter((s) => teacherClassIds.includes(String(s.assignedClassId)));
      }
    }

    // Total stats
    let totalRecordsCount = 0;
    let totalPresentCount = 0;
    let totalAbsentCount = 0;

    targetSessions.forEach((s) => {
      if (Array.isArray(s.records)) {
        totalRecordsCount += s.records.length;
        totalPresentCount += s.records.filter((r) => r.status === 'present').length;
        totalAbsentCount += s.records.filter((r) => r.status === 'absent').length;
      }
    });

    const overallRate = totalRecordsCount > 0 ? Math.round((totalPresentCount / totalRecordsCount) * 100) : 100;

    // Student individual attendance rates
    const studentAttendanceMap = new Map();
    targetStudents.forEach((st) => {
      const stId = st._id ? st._id.toString() : st.id;
      studentAttendanceMap.set(stId, {
        studentId: stId,
        studentName: st.fullName,
        rollNumber: st.rollNumber || 'N/A',
        classId: st.assignedClassId || '',
        totalClasses: 0,
        presentCount: 0,
        absentCount: 0,
      });
    });

    targetSessions.forEach((session) => {
      if (Array.isArray(session.records)) {
        session.records.forEach((r) => {
          const entry = studentAttendanceMap.get(String(r.studentId));
          if (entry) {
            entry.totalClasses += 1;
            if (r.status === 'present') entry.presentCount += 1;
            else if (r.status === 'absent') entry.absentCount += 1;
          }
        });
      }
    });

    const studentSummary = Array.from(studentAttendanceMap.values()).map((s) => {
      const pct = s.totalClasses > 0 ? Math.round((s.presentCount / s.totalClasses) * 100) : 100;
      return {
        ...s,
        percentage: pct,
        statusBadge: pct >= 85 ? 'Good' : pct >= 75 ? 'Average' : 'Low Warning',
      };
    });

    // Class breakdown
    const classMap = new Map(allClasses.map((c) => [c._id ? c._id.toString() : c.id, c]));
    const classSummary = allClasses.map((cls) => {
      const cId = cls._id ? cls._id.toString() : cls.id;
      const classSessions = targetSessions.filter((s) => String(s.classId) === cId);
      let cPresent = 0;
      let cTotal = 0;
      classSessions.forEach((s) => {
        cPresent += s.presentCount || 0;
        cTotal += s.totalStudents || 0;
      });
      const pct = cTotal > 0 ? Math.round((cPresent / cTotal) * 100) : 100;
      return {
        classId: cId,
        className: `${cls.name} (${cls.gradeLevel} - ${cls.section})`,
        totalSessions: classSessions.length,
        studentCount: cls.studentIds?.length || 0,
        attendanceRate: pct,
      };
    });

    const lowAttendanceStudents = studentSummary.filter((s) => s.totalClasses > 0 && s.percentage < 75);

    res.json({
      metrics: {
        overallRate,
        totalSessions: targetSessions.length,
        totalPresentCount,
        totalAbsentCount,
        lowAttendanceCount: lowAttendanceStudents.length,
      },
      classSummary,
      studentSummary,
      lowAttendanceStudents: role === 'student' ? [] : lowAttendanceStudents,
      recentSessions: targetSessions.slice(0, 10).map((s) => {
        const sObj = s.toObject ? s.toObject() : { ...s };
        const sId = s._id ? s._id.toString() : s.id;
        const cls = classMap.get(String(s.classId));
        const filteredRecords =
          role === 'student' && userId
            ? (s.records || []).filter((r) => String(r.studentId) === String(userId))
            : s.records || [];
        return {
          ...sObj,
          id: sId,
          className: cls ? cls.name : 'Class ' + s.classId,
          records: filteredRecords,
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ error: 'AttendanceSummaryError', message: err.message });
  }
});

/**
 * POST /api/attendance
 * Teacher marks or updates attendance for a class on a given date.
 * Enforces duplicate prevention: updates existing session for same class & date.
 */
router.post('/', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { classId, date, records } = req.body;

    if (!classId || !date || !Array.isArray(records)) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'classId, date (YYYY-MM-DD), and records array are required.',
      });
    }

    // Validate that no records are unmarked
    const unmarkedRecords = records.filter((r) => !r.status || (r.status !== 'present' && r.status !== 'absent'));
    if (unmarkedRecords.length > 0) {
      return res.status(400).json({
        error: 'IncompleteAttendance',
        message: `Validation Error: ${unmarkedRecords.length} student(s) remain unmarked. Please mark all students Present or Absent before saving.`,
      });
    }

    const presentCount = records.filter((r) => r.status === 'present').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;

    // Duplicate check & upsert for the same class and date
    const existingSession = await req.tenantDb.Attendance.findOne({ classId: String(classId), date });

    let savedSession;
    if (existingSession) {
      existingSession.records = records;
      existingSession.totalStudents = records.length;
      existingSession.presentCount = presentCount;
      existingSession.absentCount = absentCount;
      existingSession.markedByTeacherId = req.user?.id || req.user?._id || 'teacher';
      existingSession.markedByTeacherName = req.user?.fullName || 'Faculty Instructor';
      existingSession.updatedAt = new Date();
      savedSession = await existingSession.save();
    } else {
      savedSession = await req.tenantDb.Attendance.create({
        classId: String(classId),
        date,
        markedByTeacherId: req.user?.id || req.user?._id || 'teacher',
        markedByTeacherName: req.user?.fullName || 'Faculty Instructor',
        records,
        totalStudents: records.length,
        presentCount,
        absentCount,
        createdAt: new Date(),
      });
    }

    const targetClass = await req.tenantDb.Class.findById(classId).catch(() => null);

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || 'Teacher',
      actorRole: req.user?.role || 'teacher',
      actionCategory: 'ATTENDANCE',
      description: `Saved attendance for "${targetClass?.name || classId}" on ${date}: ${presentCount} Present, ${absentCount} Absent`,
    });

    const resObj = savedSession.toObject ? savedSession.toObject() : { ...savedSession };
    resObj.id = savedSession._id ? savedSession._id.toString() : savedSession.id;

    res.status(201).json({ success: true, attendance: resObj });
  } catch (err) {
    res.status(500).json({ error: 'MarkAttendanceError', message: err.message });
  }
});

export default router;
