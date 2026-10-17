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
    const userId = req.user?.id;
    const { classId, date, month } = req.query;

    let query = {};
    if (classId) query.classId = classId;
    if (date) query.date = date;
    if (month) query.date = { $regex: `^${month}` };

    if (role === 'student' && userId && userId !== 'system') {
      const student = await req.tenantDb.User.findById(userId);
      if (student?.assignedClassId) {
        query.classId = student.assignedClassId;
      }
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId);
      const assigned = teacher?.assignedClassIds || [];
      if (assigned.length > 0 && !classId) {
        query.classId = { $in: assigned };
      }
    }

    const sessions = await req.tenantDb.Attendance.find(query).sort({ date: -1 });
    const formatted = sessions.map((s) => ({
      ...s.toObject(),
      id: s._id.toString(),
    }));

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
    const userId = req.user?.id;

    const [allClasses, allStudents, allSessions] = await Promise.all([
      req.tenantDb.Class.find(),
      req.tenantDb.User.find({ role: 'student' }),
      req.tenantDb.Attendance.find().sort({ date: -1 }),
    ]);

    let targetSessions = allSessions;
    let targetStudents = allStudents;

    if (role === 'student' && userId && userId !== 'system') {
      const student = allStudents.find((s) => s._id.toString() === userId);
      const studentClassId = student?.assignedClassId;
      targetSessions = allSessions.filter((s) => s.classId === studentClassId);
      targetStudents = allStudents.filter((s) => s._id.toString() === userId);
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId);
      const teacherClassIds = teacher?.assignedClassIds || [];
      if (teacherClassIds.length > 0) {
        targetSessions = allSessions.filter((s) => teacherClassIds.includes(s.classId));
        targetStudents = allStudents.filter((s) => teacherClassIds.includes(s.assignedClassId));
      }
    }

    // Total stats
    let totalRecordsCount = 0;
    let totalPresentCount = 0;
    let totalAbsentCount = 0;

    targetSessions.forEach((s) => {
      totalRecordsCount += s.records.length;
      totalPresentCount += s.records.filter((r) => r.status === 'present').length;
      totalAbsentCount += s.records.filter((r) => r.status === 'absent').length;
    });

    const overallRate = totalRecordsCount > 0 ? Math.round((totalPresentCount / totalRecordsCount) * 100) : 100;

    // Student individual attendance rates
    const studentAttendanceMap = new Map();
    targetStudents.forEach((st) => {
      studentAttendanceMap.set(st._id.toString(), {
        studentId: st._id.toString(),
        studentName: st.fullName,
        rollNumber: st.rollNumber || 'N/A',
        classId: st.assignedClassId || '',
        totalClasses: 0,
        presentCount: 0,
        absentCount: 0,
      });
    });

    targetSessions.forEach((session) => {
      session.records.forEach((r) => {
        const entry = studentAttendanceMap.get(r.studentId);
        if (entry) {
          entry.totalClasses += 1;
          if (r.status === 'present') entry.presentCount += 1;
          else if (r.status === 'absent') entry.absentCount += 1;
        }
      });
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
    const classMap = new Map(allClasses.map((c) => [c._id.toString(), c]));
    const classSummary = allClasses.map((cls) => {
      const classSessions = targetSessions.filter((s) => s.classId === cls._id.toString());
      let cPresent = 0;
      let cTotal = 0;
      classSessions.forEach((s) => {
        cPresent += s.presentCount;
        cTotal += s.totalStudents;
      });
      const pct = cTotal > 0 ? Math.round((cPresent / cTotal) * 100) : 100;
      return {
        classId: cls._id.toString(),
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
      lowAttendanceStudents,
      recentSessions: targetSessions.slice(0, 10).map((s) => ({
        ...s.toObject(),
        id: s._id.toString(),
        className: classMap.get(s.classId)?.name || 'Class ' + s.classId,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'AttendanceSummaryError', message: err.message });
  }
});

/**
 * POST /api/attendance
 * Admin or Teacher marks or updates attendance for a class on a given date
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

    const presentCount = records.filter((r) => r.status === 'present').length;
    const absentCount = records.filter((r) => r.status === 'absent').length;

    const existingSession = await req.tenantDb.Attendance.findOne({ classId, date });

    let savedSession;
    if (existingSession) {
      existingSession.records = records;
      existingSession.totalStudents = records.length;
      existingSession.presentCount = presentCount;
      existingSession.absentCount = absentCount;
      existingSession.markedByTeacherId = req.user?.id || 'admin';
      existingSession.markedByTeacherName = req.user?.fullName || 'Administrator';
      savedSession = await existingSession.save();
    } else {
      savedSession = await req.tenantDb.Attendance.create({
        classId,
        date,
        markedByTeacherId: req.user?.id || 'admin',
        markedByTeacherName: req.user?.fullName || 'Administrator',
        records,
        totalStudents: records.length,
        presentCount,
        absentCount,
      });
    }

    let targetClass = null;
    if (classId) {
      if (classId.match(/^[0-9a-fA-F]{24}$/)) {
        targetClass = await req.tenantDb.Class.findById(classId).catch(() => null);
      } else {
        targetClass = await req.tenantDb.Class.findOne({ id: classId }).catch(() => null);
      }
    }

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || 'Admin',
      actorRole: req.user?.role || 'admin',
      actionCategory: 'ATTENDANCE',
      description: `Recorded attendance for class "${targetClass?.name || classId}" on ${date}: ${presentCount} present, ${absentCount} absent`,
    });

    const resObj = savedSession.toObject();
    resObj.id = savedSession._id.toString();

    res.status(201).json({ success: true, attendance: resObj });
  } catch (err) {
    res.status(500).json({ error: 'MarkAttendanceError', message: err.message });
  }
});

export default router;
