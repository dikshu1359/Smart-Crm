import express from 'express';
import { tenantAuth } from '../middleware/tenantAuth.js';

const router = express.Router();

/**
 * GET /api/analytics
 * Real-time institutional performance analytics:
 * - Student rankings & subject metrics
 * - Teacher performance, classes & grading turnaround
 * - Attendance correlations & grade distributions
 */
router.get('/', tenantAuth, async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id;

    const [
      assignments,
      allClasses,
      allUsers,
      allSubmissions,
      allQuizzes,
      allQuizAttempts,
      allAttendance,
    ] = await Promise.all([
      req.tenantDb.Assignment.find(),
      req.tenantDb.Class.find(),
      req.tenantDb.User.find(),
      req.tenantDb.Submission.find(),
      req.tenantDb.Quiz.find(),
      req.tenantDb.QuizAttempt.find(),
      req.tenantDb.Attendance.find(),
    ]);

    const students = allUsers.filter((u) => u.role === 'student');
    const teachers = allUsers.filter((u) => u.role === 'teacher');
    const classMap = new Map(allClasses.map((c) => [c._id.toString(), c]));
    const assignmentMap = new Map(assignments.map((a) => [a._id.toString(), a]));

    // Student performance aggregation
    const studentPerformance = students.map((st) => {
      const studentId = st._id.toString();
      const studentSubs = allSubmissions.filter((s) => s.studentId === studentId);
      const gradedSubs = studentSubs.filter((s) => s.status === 'graded' && typeof s.marksObtained === 'number');

      let totalPct = 0;
      gradedSubs.forEach((sub) => {
        const asgn = assignmentMap.get(sub.assignmentId);
        const maxMarks = asgn?.maxMarks || 100;
        totalPct += Math.round(((sub.marksObtained || 0) / maxMarks) * 100);
      });
      const avgAssignmentScore = gradedSubs.length > 0 ? Math.round(totalPct / gradedSubs.length) : 0;

      // Quiz attempts
      const attempts = allQuizAttempts.filter((a) => a.studentId === studentId);
      let quizPctTotal = 0;
      attempts.forEach((at) => {
        quizPctTotal += at.totalMarks > 0 ? Math.round((at.score / at.totalMarks) * 100) : 0;
      });
      const avgQuizScore = attempts.length > 0 ? Math.round(quizPctTotal / attempts.length) : 0;

      // Overall composite score
      const compositeScore =
        gradedSubs.length > 0 && attempts.length > 0
          ? Math.round((avgAssignmentScore + avgQuizScore) / 2)
          : gradedSubs.length > 0
          ? avgAssignmentScore
          : avgQuizScore;

      // Attendance rate for this student
      let totalAttendanceClasses = 0;
      let presentCount = 0;
      allAttendance.forEach((session) => {
        const rec = session.records.find((r) => r.studentId === studentId);
        if (rec) {
          totalAttendanceClasses += 1;
          if (rec.status === 'present') presentCount += 1;
        }
      });
      const attendanceRate =
        totalAttendanceClasses > 0 ? Math.round((presentCount / totalAttendanceClasses) * 100) : 100;

      const cls = classMap.get(st.assignedClassId);
      const className = cls ? `${cls.name} (${cls.gradeLevel}-${cls.section})` : 'Unassigned';

      let standing = 'Good';
      if (compositeScore >= 85 && attendanceRate >= 85) standing = 'Excellent';
      else if (compositeScore < 60 || attendanceRate < 75) standing = 'Needs Attention';
      else if (compositeScore >= 70) standing = 'Good';
      else standing = 'Average';

      return {
        id: studentId,
        studentId,
        fullName: st.fullName,
        username: st.username,
        rollNumber: st.rollNumber || 'N/A',
        classId: st.assignedClassId || '',
        className,
        assignedClassId: st.assignedClassId,
        assignmentAverage: avgAssignmentScore,
        quizAverage: avgQuizScore,
        compositeScore,
        attendanceRate,
        totalSubmissions: studentSubs.length,
        gradedSubmissions: gradedSubs.length,
        quizzesAttempted: attempts.length,
        quizzesPassed: attempts.filter((a) => a.passed).length,
        standing,
      };
    });

    // Teacher performance aggregation
    const teacherPerformance = teachers.map((tc) => {
      const teacherId = tc._id.toString();
      const teacherAssignments = assignments.filter((a) => a.teacherId === teacherId);
      const teacherAssignmentIds = new Set(teacherAssignments.map((a) => a._id.toString()));

      const teacherSubs = allSubmissions.filter((s) => teacherAssignmentIds.has(s.assignmentId));
      const reviewedSubs = teacherSubs.filter(
        (s) => s.status === 'graded' || s.status === 'accepted' || s.status === 'rejected'
      );
      const turnaroundRate =
        teacherSubs.length > 0 ? Math.round((reviewedSubs.length / teacherSubs.length) * 100) : 100;

      const teacherQuizzes = allQuizzes.filter((q) => q.teacherId === teacherId);
      const assignedClasses = tc.assignedClassIds || [];

      // Average score of students under this teacher
      const classScores = studentPerformance
        .filter((sp) => assignedClasses.includes(sp.classId))
        .map((sp) => sp.compositeScore);
      const avgStudentScore =
        classScores.length > 0
          ? Math.round(classScores.reduce((a, b) => a + b, 0) / classScores.length)
          : 0;

      return {
        id: teacherId,
        teacherId,
        fullName: tc.fullName,
        email: tc.email,
        specialization: tc.specialization || 'General',
        assignedClassCount: assignedClasses.length,
        assignmentsCreated: teacherAssignments.length,
        quizzesAuthored: teacherQuizzes.length,
        totalSubmissionsReceived: teacherSubs.length,
        submissionsReviewed: reviewedSubs.length,
        turnaroundRate,
        avgStudentScore,
      };
    });

    // Class performance comparison
    const classPerformance = allClasses.map((cls) => {
      const cid = cls._id.toString();
      const classStudents = studentPerformance.filter((sp) => sp.classId === cid);
      const avgScore =
        classStudents.length > 0
          ? Math.round(classStudents.reduce((a, b) => a + b.compositeScore, 0) / classStudents.length)
          : 0;
      const avgAttendance =
        classStudents.length > 0
          ? Math.round(classStudents.reduce((a, b) => a + b.attendanceRate, 0) / classStudents.length)
          : 100;

      return {
        classId: cid,
        name: cls.name,
        gradeLevel: cls.gradeLevel,
        section: cls.section,
        roomNumber: cls.roomNumber,
        studentCount: classStudents.length,
        averageScore: avgScore,
        attendanceRate: avgAttendance,
      };
    });

    // High and Low performing students
    const topStudents = [...studentPerformance]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, 5);

    const studentsNeedingAttention = studentPerformance.filter(
      (s) => s.standing === 'Needs Attention' || s.attendanceRate < 75 || s.compositeScore < 60
    );

    // Subject breakdown
    const subjectPerformance = assignments.map((asgn) => {
      const subs = allSubmissions.filter((s) => s.assignmentId === asgn._id.toString());
      const graded = subs.filter((s) => s.status === 'graded' && typeof s.marksObtained === 'number');
      const avg =
        graded.length > 0
          ? Math.round(graded.reduce((acc, s) => acc + ((s.marksObtained || 0) / asgn.maxMarks) * 100, 0) / graded.length)
          : 0;
      const comp =
        subs.length > 0
          ? Math.round(
              (subs.filter((s) => s.status === 'submitted' || s.status === 'accepted' || s.status === 'graded').length /
                subs.length) *
                100
            )
          : 0;

      return {
        name: asgn.subject,
        averageScore: avg,
        completionRate: comp,
      };
    });

    // Overall Institutional Metrics
    const avgOverallScore =
      studentPerformance.length > 0
        ? Math.round(studentPerformance.reduce((acc, s) => acc + s.compositeScore, 0) / studentPerformance.length)
        : 0;

    const avgAttendanceOverall =
      studentPerformance.length > 0
        ? Math.round(studentPerformance.reduce((acc, s) => acc + s.attendanceRate, 0) / studentPerformance.length)
        : 100;

    // Grade Distribution Bands
    const gradeDistribution = [
      { band: 'A+ (90-100%)', count: studentPerformance.filter((s) => s.compositeScore >= 90).length },
      { band: 'A (80-89%)', count: studentPerformance.filter((s) => s.compositeScore >= 80 && s.compositeScore < 90).length },
      { band: 'B (70-79%)', count: studentPerformance.filter((s) => s.compositeScore >= 70 && s.compositeScore < 80).length },
      { band: 'C (60-69%)', count: studentPerformance.filter((s) => s.compositeScore >= 60 && s.compositeScore < 70).length },
      { band: '< 60%', count: studentPerformance.filter((s) => s.compositeScore < 60).length },
    ];

    res.json({
      metrics: {
        averageScore: avgOverallScore,
        attendanceRate: avgAttendanceOverall,
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalClasses: allClasses.length,
        totalAssignments: assignments.length,
        totalSubmissions: allSubmissions.length,
        highPerformersCount: topStudents.filter((s) => s.compositeScore >= 85).length,
        needsAttentionCount: studentsNeedingAttention.length,
      },
      gradeDistribution,
      subjectPerformance,
      studentPerformance: role === 'student' ? studentPerformance.filter((s) => s.studentId === userId) : studentPerformance,
      teacherPerformance: role === 'teacher' ? teacherPerformance.filter((t) => t.teacherId === userId) : teacherPerformance,
      classPerformance,
      topStudents,
      studentsNeedingAttention,
    });
  } catch (err) {
    res.status(500).json({ error: 'AnalyticsError', message: err.message });
  }
});

export default router;
