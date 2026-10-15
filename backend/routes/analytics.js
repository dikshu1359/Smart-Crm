import express from 'express';
import { tenantAuth } from '../middleware/tenantAuth.js';

const router = express.Router();

/**
 * GET /api/analytics
 * Real-time performance analytics calculated from actual database submissions and quiz attempts
 */
router.get('/', tenantAuth, async (req, res) => {
  try {
    const assignments = await req.tenantDb.Assignment.find();
    let subQuery = {};

    if (req.user.role === 'student') {
      subQuery.studentId = req.user.id;
    }

    const allSubs = await req.tenantDb.Submission.find(subQuery);

    const gradedSubs = allSubs.filter((s) => s.status === 'graded' && typeof s.marksObtained === 'number');
    const assignmentMap = new Map(assignments.map((a) => [a._id.toString(), a]));

    const subsWithPercentages = gradedSubs.map((sub) => {
      const parent = assignmentMap.get(sub.assignmentId);
      const maxMarks = parent?.maxMarks || 100;
      return {
        ...sub.toObject(),
        percentage: Math.round(((sub.marksObtained || 0) / maxMarks) * 100),
      };
    });

    const avgScore =
      subsWithPercentages.length > 0
        ? Math.round(subsWithPercentages.reduce((acc, s) => acc + s.percentage, 0) / subsWithPercentages.length)
        : 0;

    const completedSubs = allSubs.filter(
      (s) => s.status === 'submitted' || s.status === 'accepted' || s.status === 'graded'
    );
    const completionRate =
      allSubs.length > 0 ? Math.round((completedSubs.length / allSubs.length) * 100) : 0;

    const gradeDistribution = [
      { band: 'A+ (90-100%)', count: subsWithPercentages.filter((s) => s.percentage >= 90).length },
      { band: 'A (80-89%)', count: subsWithPercentages.filter((s) => s.percentage >= 80 && s.percentage < 90).length },
      { band: 'B (70-79%)', count: subsWithPercentages.filter((s) => s.percentage >= 70 && s.percentage < 80).length },
      { band: 'C (60-69%)', count: subsWithPercentages.filter((s) => s.percentage >= 60 && s.percentage < 70).length },
      { band: '< 60%', count: subsWithPercentages.filter((s) => s.percentage < 60).length },
    ];

    const subjectPerformance = assignments.map((asgn) => {
      const subs = allSubs.filter((s) => s.assignmentId === asgn._id.toString());
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

    res.json({
      metrics: {
        averageScore: avgScore,
        completionRate,
        totalSubmissions: allSubs.length,
        gradedCount: gradedSubs.length,
        pendingCount: Math.max(0, allSubs.length - completedSubs.length),
      },
      gradeDistribution,
      subjectPerformance,
    });
  } catch (err) {
    res.status(500).json({ error: 'AnalyticsError', message: err.message });
  }
});

export default router;
