import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/assignments
 * List assignments for current user
 * - Admin: all assignments
 * - Teacher: assignments created by teacher or targeting assigned classes
 * - Student: assignments targeting student's assigned class
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id;
    let query = {};

    if (role === 'student' && userId && userId !== 'system') {
      const student = await req.tenantDb.User.findById(userId).catch(() => null);
      const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student?.assignedClassIds[0]);
      if (!studentClassId) {
        return res.json({ assignments: [], count: 0 });
      }
      query = { targetClassIds: studentClassId };
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId).catch(() => null);
      const assignedClasses = teacher?.assignedClassIds || [];
      query = {
        $or: [
          { teacherId: userId },
          { teacherName: req.user?.fullName },
          ...(assignedClasses.length > 0 ? [{ targetClassIds: { $in: assignedClasses } }] : []),
        ],
      };
    }

    const assignments = await req.tenantDb.Assignment.find(query).sort({ createdAt: -1 });

    // Fetch submissions for these assignments
    const assignmentIds = assignments.map((a) => a._id.toString());
    const submissions = await req.tenantDb.Submission.find({
      assignmentId: { $in: assignmentIds },
    });

    const populated = assignments.map((a) => {
      const aObj = a.toObject();
      const subs = submissions.filter((s) => s.assignmentId === a._id.toString());
      return {
        ...aObj,
        id: a._id.toString(),
        submissions: subs.map((s) => ({ ...s.toObject(), id: s._id.toString() })),
        submissionCount: subs.length,
      };
    });

    res.json({ assignments: populated, count: populated.length });
  } catch (err) {
    res.status(500).json({ error: 'FetchAssignmentsError', message: err.message });
  }
});

/**
 * POST /api/assignments
 * Teacher or Admin creates an assignment
 */
router.post('/', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { title, subject, description, targetClassIds, dueDate, issueDate, maxMarks, attachments } = req.body;

    const classIds = Array.isArray(targetClassIds)
      ? targetClassIds.filter((id) => Boolean(id && String(id).trim()))
      : targetClassIds ? [String(targetClassIds).trim()] : [];

    if (!title || !title.trim()) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Assignment title is required.',
      });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Academic subject is required.',
      });
    }

    if (classIds.length === 0) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Please select at least one target class for this assignment.',
      });
    }

    if (!dueDate) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Assignment deadline / due date is required.',
      });
    }

    // Validate classes exist in tenant
    const matchedClasses = await req.tenantDb.Class.find({
      $or: [{ _id: { $in: classIds.filter((id) => id.match(/^[0-9a-fA-F]{24}$/)) } }, { id: { $in: classIds } }],
    });

    const validatedClassIds = matchedClasses.length > 0 ? matchedClasses.map((c) => c._id.toString()) : classIds;

    const newAssignment = await req.tenantDb.Assignment.create({
      title: title.trim(),
      subject: subject.trim(),
      description: description ? description.trim() : 'Complete the assigned questions and submit your solution.',
      targetClassIds: validatedClassIds,
      teacherId: req.user.id,
      teacherName: req.user.fullName || req.user.username || 'Faculty',
      issueDate: issueDate || new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      maxMarks: Math.max(1, Number(maxMarks) || 100),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    // Create automatic notification for students
    await req.tenantDb.Notice.create({
      title: `New Assignment: ${newAssignment.title}`,
      content: `A new assignment has been posted for ${newAssignment.subject}. Due: ${new Date(newAssignment.dueDate).toLocaleDateString()}. Maximum Marks: ${newAssignment.maxMarks}.`,
      category: 'Assignment',
      targetRole: 'student',
      authorName: req.user.fullName || 'Faculty',
      authorRole: req.user.role || 'teacher',
    }).catch(() => null);

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName || req.user.username,
      actorRole: req.user.role,
      actionCategory: 'ASSIGNMENT',
      description: `Published assignment "${newAssignment.title}" (${newAssignment.subject}) for ${validatedClassIds.length} classes`,
    }).catch(() => null);

    const formattedAssignment = {
      ...newAssignment.toObject(),
      id: newAssignment._id.toString(),
      submissions: [],
      submissionCount: 0,
    };

    res.status(201).json({ success: true, assignment: formattedAssignment });
  } catch (err) {
    res.status(500).json({ error: 'CreateAssignmentError', message: err.message });
  }
});

/**
 * POST /api/assignments/:id/submit
 * Student uploads a submission with file attachment and notes
 */
router.post('/:id/submit', authorizeRoles('student'), async (req, res) => {
  try {
    const { id } = req.params;
    const { studentNotes, attachments } = req.body;

    const assignment = await req.tenantDb.Assignment.findById(id);
    if (!assignment) return res.status(404).json({ error: 'AssignmentNotFound', message: 'Assignment not found.' });

    const student = await req.tenantDb.User.findById(req.user.id);
    if (!student || !assignment.targetClassIds.includes(student.assignedClassId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not assigned to this class assignment.' });
    }

    // Upsert or update submission
    let submission = await req.tenantDb.Submission.findOne({ assignmentId: id, studentId: req.user.id });

    if (submission) {
      submission.status = 'submitted';
      submission.studentNotes = studentNotes || submission.studentNotes;
      if (attachments && attachments.length > 0) {
        submission.attachments = attachments;
      }
      submission.submittedAt = new Date();
      await submission.save();
    } else {
      submission = await req.tenantDb.Submission.create({
        assignmentId: id,
        studentId: req.user.id,
        studentName: req.user.fullName,
        rollNumber: student.rollNumber || '',
        classId: student.assignedClassId,
        status: 'submitted',
        studentNotes: studentNotes || '',
        attachments: attachments || [],
        submittedAt: new Date(),
      });
    }

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: 'student',
      actionCategory: 'ASSIGNMENT',
      description: `Student ${req.user.fullName} uploaded submission for "${assignment.title}"`,
    });

    res.status(201).json({ success: true, submission });
  } catch (err) {
    res.status(500).json({ error: 'SubmissionError', message: err.message });
  }
});

/**
 * PUT /api/assignments/:id/submissions/:studentId/review
 * Teacher accepts, rejects, reassigns, or grades a submission
 */
router.put('/:id/submissions/:studentId/review', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { action, marksObtained, feedback } = req.body;

    const submission = await req.tenantDb.Submission.findOne({ assignmentId: id, studentId });
    if (!submission) {
      return res.status(404).json({ error: 'SubmissionNotFound', message: 'Student submission not found.' });
    }

    const assignment = await req.tenantDb.Assignment.findById(id);

    if (action === 'accept') {
      submission.status = 'accepted';
      submission.teacherReviewNotes = feedback || 'Submission accepted.';
    } else if (action === 'reject') {
      submission.status = 'rejected';
      submission.teacherReviewNotes = feedback || 'Submission rejected.';
    } else if (action === 'reassign') {
      submission.status = 'reassigned';
      submission.teacherReviewNotes = feedback || 'Resubmission requested.';
    } else if (action === 'grade') {
      if (marksObtained === undefined || marksObtained === null) {
        return res.status(400).json({ error: 'MissingMarks', message: 'Marks are required for grading.' });
      }
      const marks = Number(marksObtained);
      if (marks < 0 || (assignment && marks > assignment.maxMarks)) {
        return res.status(400).json({
          error: 'InvalidMarks',
          message: `Marks must be between 0 and maximum possible marks (${assignment?.maxMarks || 100}).`,
        });
      }
      submission.status = 'graded';
      submission.marksObtained = marks;
      submission.teacherReviewNotes = feedback || 'Graded by instructor.';
      submission.gradedAt = new Date();
    } else {
      return res.status(400).json({ error: 'InvalidAction', message: 'Action must be accept, reject, reassign, or grade.' });
    }

    await submission.save();

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'ASSIGNMENT',
      description: `Reviewed submission for student ${submission.studentName} with action: ${action.toUpperCase()}`,
    });

    res.json({ success: true, submission });
  } catch (err) {
    res.status(500).json({ error: 'ReviewError', message: err.message });
  }
});

/**
 * DELETE /api/assignments/:id
 */
router.delete('/:id', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await req.tenantDb.Assignment.findByIdAndDelete(id);
    if (!assignment) return res.status(404).json({ error: 'AssignmentNotFound', message: 'Assignment not found.' });

    // Clean up related submissions
    await req.tenantDb.Submission.deleteMany({ assignmentId: id });

    res.json({ success: true, message: `Assignment "${assignment.title}" deleted.` });
  } catch (err) {
    res.status(500).json({ error: 'DeleteAssignmentError', message: err.message });
  }
});

export default router;
