import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/attendance
 * Fetch attendance logs filterable by classId, date, month, or studentId.
 * Strictly enforces teacher-class authorization and student isolation.
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id || req.user?._id;
    const { classId, date, month } = req.query;

    let query = {};
    if (date) query.date = date;
    if (month) query.date = { $regex: `^${month}` };

    if (role === 'student' && userId && userId !== 'system') {
      const student = await req.tenantDb.User.findById(userId);
      const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);
      if (!studentClassId) {
        return res.json({ attendance: [], count: 0 });
      }
      query.classId = String(studentClassId);
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId);
      const assigned = (teacher?.assignedClassIds || []).map(String);
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(userId) });
      const teacherClassIds = Array.from(new Set([...assigned, ...primaryClasses.map((c) => String(c._id || c.id))]));

      if (classId) {
        // Enforce backend authorization: teacher can only query their allocated classes
        if (!teacherClassIds.includes(String(classId))) {
          return res.status(403).json({
            error: 'UnauthorizedClass',
            message: 'Access Denied: You are not authorized to view attendance records for this class.',
          });
        }
        query.classId = String(classId);
      } else {
        query.classId = { $in: teacherClassIds };
      }
    } else if (classId) {
      query.classId = String(classId);
    }

    const sessions = await req.tenantDb.Attendance.find(query).sort({ date: -1 });
    const allClasses = await req.tenantDb.Class.find();
    const classMap = new Map(allClasses.map((c) => [c._id ? c._id.toString() : c.id, c.name]));

    const formatted = sessions.map((s) => {
      const sObj = s.toObject ? s.toObject() : { ...s };
      sObj.id = s._id ? s._id.toString() : s.id;
      sObj.className = classMap.get(String(s.classId)) || `Class ${s.classId}`;

      // If student requested, strictly isolate records to ONLY their personal status
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
 * Comprehensive institution-wide or teacher/student filtered attendance analytics
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
      const assigned = (teacher?.assignedClassIds || []).map(String);
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(userId) });
      const teacherClassIds = Array.from(new Set([...assigned, ...primaryClasses.map((c) => String(c._id || c.id))]));

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

    // Student individual attendance rates calculated from actual records
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
        statusBadge: pct >= 75 ? 'Good' : pct >= 60 ? 'Average' : 'Critical Low',
        badgeColor: pct >= 75 ? 'green' : pct >= 60 ? 'yellow' : 'red',
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
      recentSessions: targetSessions.slice(0, 15).map((s) => {
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
 * GET /api/attendance/teachers
 * Teacher Attendance Monitoring for Admin:
 * Displays which teachers are present and absent on a given date based on actual attendance records and logs.
 */
router.get('/teachers', async (req, res) => {
  try {
    const requestedDate = req.query.date || new Date().toISOString().split('T')[0];

    const [allTeachers, dateSessions, allClasses, explicitLogs] = await Promise.all([
      req.tenantDb.User.find({ role: 'teacher' }),
      req.tenantDb.Attendance.find({ date: requestedDate }),
      req.tenantDb.Class.find(),
      req.tenantDb.TeacherAttendance ? req.tenantDb.TeacherAttendance.find({ date: requestedDate }) : [],
    ]);

    const classMap = new Map(allClasses.map((c) => [c._id ? c._id.toString() : c.id, c.name]));

    const teacherRecords = allTeachers.map((t) => {
      const tId = t._id ? t._id.toString() : t.id;

      // Find sessions conducted by this teacher on this date
      const conducted = dateSessions.filter((s) => String(s.markedByTeacherId) === tId);

      // Check explicit TeacherAttendance log
      const explicit = (explicitLogs || []).find((l) => String(l.teacherId) === tId);

      // Classes allocated to teacher
      const assigned = (t.assignedClassIds || []).map(String);
      const primary = allClasses.filter((c) => String(c.primaryTeacherId) === tId).map((c) => (c._id ? c._id.toString() : c.id));
      const allocatedClassIds = Array.from(new Set([...assigned, ...primary]));
      const allocatedClassNames = allocatedClassIds.map((id) => classMap.get(id) || id);

      let status = 'absent';
      let checkInTime = null;
      let notes = 'No attendance sessions recorded on this date';
      let conductedClassNames = conducted.map((s) => classMap.get(String(s.classId)) || s.classId);

      if (explicit) {
        status = explicit.status;
        checkInTime = explicit.checkInTime || null;
        notes = explicit.notes || '';
      } else if (conducted.length > 0) {
        status = 'present';
        checkInTime = '08:45 AM';
        notes = `Present - Conducted ${conducted.length} class session(s): ${conductedClassNames.join(', ')}`;
      }

      return {
        id: tId,
        teacherId: tId,
        fullName: t.fullName,
        email: t.email,
        phone: t.phone || '',
        specialization: t.specialization || 'Academic Faculty',
        department: t.departmentBranch || 'Academic Instruction',
        qualification: t.qualification || 'Faculty Degree',
        photoUrl: t.photoUrl || '',
        allocatedClasses: allocatedClassNames,
        status,
        checkInTime,
        notes,
        sessionsConductedCount: conducted.length,
        conductedClasses: conductedClassNames,
        date: requestedDate,
      };
    });

    const presentCount = teacherRecords.filter((t) => t.status === 'present').length;
    const absentCount = teacherRecords.filter((t) => t.status === 'absent').length;
    const onLeaveCount = teacherRecords.filter((t) => t.status === 'on_leave').length;
    const totalTeachers = teacherRecords.length;
    const facultyAttendanceRate = totalTeachers > 0 ? Math.round((presentCount / totalTeachers) * 100) : 100;

    res.json({
      date: requestedDate,
      totalTeachers,
      presentCount,
      absentCount,
      onLeaveCount,
      facultyAttendanceRate,
      teachers: teacherRecords,
    });
  } catch (err) {
    res.status(500).json({ error: 'FetchTeacherAttendanceError', message: err.message });
  }
});

/**
 * POST /api/attendance/teachers
 * Admin logs or updates official Teacher Attendance record
 */
router.post('/teachers', authorizeRoles('admin'), async (req, res) => {
  try {
    const { teacherId, date, status, checkInTime, notes } = req.body;

    if (!teacherId || !date || !status) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'teacherId, date, and status (present/absent/on_leave) are required.',
      });
    }

    const teacher = await req.tenantDb.User.findById(teacherId);
    if (!teacher) {
      return res.status(404).json({ error: 'TeacherNotFound', message: 'Teacher record not found.' });
    }

    if (req.tenantDb.TeacherAttendance) {
      const existing = await req.tenantDb.TeacherAttendance.findOne({ teacherId: String(teacherId), date });
      if (existing) {
        existing.status = status;
        existing.checkInTime = checkInTime || existing.checkInTime;
        existing.notes = notes !== undefined ? notes : existing.notes;
        existing.recordedBy = req.user?.username || 'admin';
        existing.updatedAt = new Date();
        await existing.save();
      } else {
        await req.tenantDb.TeacherAttendance.create({
          teacherId: String(teacherId),
          teacherName: teacher.fullName,
          email: teacher.email,
          department: teacher.departmentBranch || 'Faculty',
          date,
          status,
          checkInTime: checkInTime || (status === 'present' ? '08:45 AM' : null),
          notes: notes || `Recorded by administrator`,
          recordedBy: req.user?.username || 'admin',
          createdAt: new Date(),
        });
      }
    }

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || 'Administrator',
      actorRole: 'admin',
      actionCategory: 'TEACHER_ATTENDANCE',
      description: `Updated attendance for faculty "${teacher.fullName}" on ${date}: ${status.toUpperCase()}`,
    });

    res.json({ success: true, message: `Teacher attendance marked as ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'SaveTeacherAttendanceError', message: err.message });
  }
});

/**
 * POST /api/attendance
 * Student Attendance Marking: STRICTLY RESTRICTED TO AUTHORIZED TEACHERS ONLY!
 * Admin cannot mark student attendance. Teachers can only mark their allocated classes.
 */
router.post('/', authorizeRoles('teacher'), async (req, res) => {
  try {
    const { classId, date, records } = req.body;
    const userId = req.user?.id || req.user?._id;

    if (!classId || !date || !Array.isArray(records)) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'classId, date (YYYY-MM-DD), and records array are required.',
      });
    }

    // Backend class authorization check: Teacher must be allocated to this class
    const teacher = await req.tenantDb.User.findById(userId);
    const assigned = (teacher?.assignedClassIds || []).map(String);
    const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(userId) });
    const teacherClassIds = Array.from(new Set([...assigned, ...primaryClasses.map((c) => String(c._id || c.id))]));

    if (!teacherClassIds.includes(String(classId))) {
      return res.status(403).json({
        error: 'UnauthorizedClass',
        message: 'Access Denied: You are not authorized to mark attendance for this class.',
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
      existingSession.markedByTeacherId = String(userId);
      existingSession.markedByTeacherName = req.user?.fullName || 'Faculty Instructor';
      existingSession.updatedAt = new Date();
      savedSession = await existingSession.save();
    } else {
      savedSession = await req.tenantDb.Attendance.create({
        classId: String(classId),
        date,
        markedByTeacherId: String(userId),
        markedByTeacherName: req.user?.fullName || 'Faculty Instructor',
        records,
        totalStudents: records.length,
        presentCount,
        absentCount,
        createdAt: new Date(),
      });
    }

    // Automatically record teacher presence in TeacherAttendance for this date
    if (req.tenantDb.TeacherAttendance) {
      const existingTeacherLog = await req.tenantDb.TeacherAttendance.findOne({
        teacherId: String(userId),
        date,
      });
      if (!existingTeacherLog) {
        const targetClass = await req.tenantDb.Class.findById(classId).catch(() => null);
        await req.tenantDb.TeacherAttendance.create({
          teacherId: String(userId),
          teacherName: req.user?.fullName || 'Teacher',
          email: req.user?.email || '',
          department: teacher?.departmentBranch || 'Faculty',
          date,
          status: 'present',
          checkInTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          notes: `Conducted class session for ${targetClass?.name || classId}`,
          recordedBy: 'system',
          createdAt: new Date(),
        });
      }
    }

    const targetClass = await req.tenantDb.Class.findById(classId).catch(() => null);

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user?.institutionName || '',
      actorName: req.user?.fullName || 'Teacher',
      actorRole: 'teacher',
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
