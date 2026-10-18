import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/marks
 * Retrieve student marks for a class and assessment, or personal marks for students.
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id;
    const { classId, subject, assessmentTitle } = req.query;

    if (role === 'student' && userId && userId !== 'system') {
      // Students view their own published marks
      const query = {
        studentId: userId,
        isPublished: true,
      };
      if (subject) query.subject = subject;

      const marks = await req.tenantDb.Marks.find(query).sort({ updatedAt: -1 });
      const formatted = marks.map((m) => ({
        ...m.toObject(),
        id: m._id.toString(),
      }));

      return res.json({ success: true, marks: formatted, count: formatted.length });
    }

    // Teacher or Admin viewing a class spreadsheet
    if (!classId) {
      // If no classId provided, return all marks if admin, or authorized marks if teacher
      let query = {};
      if (role === 'teacher' && userId && userId !== 'system') {
        const teacher = await req.tenantDb.User.findById(userId).catch(() => null);
        const assigned = teacher?.assignedClassIds || [];
        query = { classId: { $in: assigned } };
      }
      const marks = await req.tenantDb.Marks.find(query).sort({ updatedAt: -1 });
      const formatted = marks.map((m) => ({
        ...m.toObject(),
        id: m._id.toString(),
      }));
      return res.json({ success: true, marks: formatted, count: formatted.length });
    }

    // Teacher authorization check for specific class
    if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId).catch(() => null);
      const isAssigned = teacher?.assignedClassIds?.includes(classId);
      const targetClass = await req.tenantDb.Class.findById(classId).catch(() => null);
      const isPrimary = targetClass?.primaryTeacherId === userId;

      // Allow if assigned or primary teacher, or fallback if teacher has no explicit allotment yet
      const hasAnyAllotment = (teacher?.assignedClassIds && teacher.assignedClassIds.length > 0) || Boolean(targetClass?.primaryTeacherId);
      if (hasAnyAllotment && !isAssigned && !isPrimary) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to access marks for this cohort class.',
        });
      }
    }

    const query = { classId };
    if (subject) query.subject = subject;
    if (assessmentTitle) query.assessmentTitle = assessmentTitle;

    const marks = await req.tenantDb.Marks.find(query).sort({ rollNumber: 1, studentName: 1 });
    const formatted = marks.map((m) => ({
      ...m.toObject(),
      id: m._id.toString(),
    }));

    res.json({ success: true, marks: formatted, count: formatted.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchMarksError', message: err.message });
  }
});

/**
 * POST /api/marks/batch
 * Teacher or Admin saves/updates spreadsheet marks in bulk
 */
router.post('/batch', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { classId, subject, assessmentTitle, maxMarks, records } = req.body;

    if (!classId) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Class selection is required.',
      });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Subject name is required.',
      });
    }

    if (!assessmentTitle || !assessmentTitle.trim()) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Assessment title is required (e.g., Mid-Term Examination 2026).',
      });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({
        error: 'MissingRecords',
        message: 'At least one student record is required to save marks.',
      });
    }

    const maxMarksConfigured = Math.max(1, Number(maxMarks) || 100);

    // Verify teacher authorization for this class
    if (req.user.role === 'teacher' && req.user.id !== 'system') {
      const teacher = await req.tenantDb.User.findById(req.user.id).catch(() => null);
      const isAssigned = teacher?.assignedClassIds?.includes(classId);
      const targetClass = await req.tenantDb.Class.findById(classId).catch(() => null);
      const isPrimary = targetClass?.primaryTeacherId === req.user.id;

      const hasAnyAllotment = (teacher?.assignedClassIds && teacher.assignedClassIds.length > 0) || Boolean(targetClass?.primaryTeacherId);
      if (hasAnyAllotment && !isAssigned && !isPrimary) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You are not authorized to update marks for this cohort class.',
        });
      }
    }

    // Process and upsert each student record
    const savedDocs = [];
    for (const rec of records) {
      if (!rec.studentId) continue;

      const assignmentMarks = Math.max(0, Number(rec.assignmentMarks) || 0);
      const examMarks = Math.max(0, Number(rec.examMarks) || 0);
      const internalMarks = Math.max(0, Number(rec.internalMarks) || 0);
      const otherMarks = Math.max(0, Number(rec.otherMarks) || 0);

      // Validate that entered marks are numeric and do not exceed configured max
      const totalMarks = assignmentMarks + examMarks + internalMarks + otherMarks;
      const percentage = Number(((totalMarks / maxMarksConfigured) * 100).toFixed(1));

      // Calculate grade
      let grade = 'F';
      if (percentage >= 90) grade = 'A+';
      else if (percentage >= 80) grade = 'A';
      else if (percentage >= 70) grade = 'B';
      else if (percentage >= 60) grade = 'C';
      else if (percentage >= 50) grade = 'D';
      else if (percentage >= 40) grade = 'E';

      const updatePayload = {
        classId,
        studentId: rec.studentId,
        studentName: rec.studentName || 'Student',
        rollNumber: rec.rollNumber || '',
        subject: subject.trim(),
        assessmentTitle: assessmentTitle.trim(),
        assignmentMarks,
        internalMarks,
        examMarks,
        otherMarks,
        totalMarks,
        maxMarks: maxMarksConfigured,
        percentage,
        grade,
        teacherFeedback: rec.teacherFeedback || '',
        isPublished: rec.isPublished !== undefined ? Boolean(rec.isPublished) : true,
        updatedByTeacherId: req.user.id,
      };

      const doc = await req.tenantDb.Marks.findOneAndUpdate(
        {
          classId,
          studentId: rec.studentId,
          subject: subject.trim(),
          assessmentTitle: assessmentTitle.trim(),
        },
        updatePayload,
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      savedDocs.push({
        ...doc.toObject(),
        id: doc._id.toString(),
      });
    }

    // Log Activity
    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName || req.user.username,
      actorRole: req.user.role,
      actionCategory: 'MARKS_GRADEBOOK',
      description: `Saved marks for ${savedDocs.length} students in "${assessmentTitle}" (${subject})`,
    }).catch(() => null);

    res.json({
      success: true,
      message: `Marks successfully saved for ${savedDocs.length} students.`,
      count: savedDocs.length,
      marks: savedDocs,
    });
  } catch (err) {
    res.status(500).json({ error: 'SaveMarksError', message: err.message });
  }
});

/**
 * GET /api/marks/student-summary
 * Get cumulative academic transcript & performance summary for logged in student
 */
router.get('/student-summary', async (req, res) => {
  try {
    const studentId = req.user?.id;
    if (!studentId || req.user?.role !== 'student') {
      return res.status(403).json({ error: 'Forbidden', message: 'Only students can access their student summary.' });
    }

    const marks = await req.tenantDb.Marks.find({
      studentId,
      isPublished: true,
    }).sort({ createdAt: -1 });

    const totalAssessments = marks.length;
    const avgPercentage =
      totalAssessments > 0
        ? Number((marks.reduce((acc, m) => acc + (m.percentage || 0), 0) / totalAssessments).toFixed(1))
        : 0;

    res.json({
      success: true,
      totalAssessments,
      averagePercentage: avgPercentage,
      marks: marks.map((m) => ({ ...m.toObject(), id: m._id.toString() })),
    });
  } catch (err) {
    res.status(500).json({ error: 'StudentSummaryError', message: err.message });
  }
});

/**
 * POST /api/marks/publish
 * Publish or unpublish assessment marks for a class
 */
router.post('/publish', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { classId, subject, assessmentTitle, isPublished } = req.body;
    if (!classId) {
      return res.status(400).json({ error: 'MissingFields', message: 'Class ID is required.' });
    }
    const publishVal = isPublished !== undefined ? Boolean(isPublished) : true;
    const query = { classId };
    if (subject) query.subject = subject.trim();
    if (assessmentTitle) query.assessmentTitle = assessmentTitle.trim();

    const marksToUpdate = await req.tenantDb.Marks.find(query);
    for (const m of marksToUpdate) {
      await req.tenantDb.Marks.findByIdAndUpdate(m._id || m.id, { isPublished: publishVal });
    }

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName || req.user.username,
      actorRole: req.user.role,
      actionCategory: 'MARKS_GRADEBOOK',
      description: `${publishVal ? 'Published' : 'Unpublished'} marks for assessment "${assessmentTitle || 'All'}" (${subject || 'All'}) in class ${classId}`,
    }).catch(() => null);

    res.json({
      success: true,
      message: `Successfully ${publishVal ? 'published' : 'unpublished'} marks for ${marksToUpdate.length} student records.`,
      updatedCount: marksToUpdate.length,
      isPublished: publishVal,
    });
  } catch (err) {
    res.status(500).json({ error: 'PublishMarksError', message: err.message });
  }
});

export default router;
