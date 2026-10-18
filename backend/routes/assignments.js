import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/assignments
 * List assignments for current user
 * - Teacher: assignments created by teacher or targeting assigned classes
 * - Student: assignments targeting student's assigned class
 * - Admin: all assignments
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id || req.user?._id;
    let query = {};

    if (role === 'student' && userId && userId !== 'system') {
      const student = await req.tenantDb.User.findById(userId).catch(() => null);
      const studentClassId = student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]);
      if (!studentClassId) {
        return res.json({ assignments: [], count: 0 });
      }
      query = { targetClassIds: String(studentClassId) };
    } else if (role === 'teacher' && userId && userId !== 'system') {
      const teacher = await req.tenantDb.User.findById(userId).catch(() => null);
      const assignedClasses = teacher?.assignedClassIds || [];
      const primaryClasses = await req.tenantDb.Class.find({ primaryTeacherId: String(userId) });
      const teacherClassIds = Array.from(new Set([...assignedClasses, ...primaryClasses.map((c) => c._id.toString())]));

      query = {
        $or: [
          { teacherId: String(userId) },
          { teacherName: req.user?.fullName },
          ...(teacherClassIds.length > 0 ? [{ targetClassIds: { $in: teacherClassIds } }] : []),
        ],
      };
    }

    const assignments = await req.tenantDb.Assignment.find(query).sort({ createdAt: -1 });

    // Fetch submissions for these assignments
    const assignmentIds = assignments.map((a) => (a._id ? a._id.toString() : a.id));
    const submissions = await req.tenantDb.Submission.find({
      assignmentId: { $in: assignmentIds },
    });

    const populated = assignments.map((a) => {
      const aObj = a.toObject ? a.toObject() : { ...a };
      const aId = a._id ? a._id.toString() : a.id;
      const subs = submissions.filter((s) => s.assignmentId === aId);
      return {
        ...aObj,
        id: aId,
        submissions: subs.map((s) => {
          const sObj = s.toObject ? s.toObject() : { ...s };
          return { ...sObj, id: s._id ? s._id.toString() : s.id };
        }),
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
 * Teacher creates an assignment targeting selected classes
 */
router.post('/', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { title, subject, description, targetClassIds, issueDate, dueDate, maxMarks, attachments } = req.body;

    const classIds = Array.isArray(targetClassIds) ? targetClassIds : targetClassIds ? [targetClassIds] : [];

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

    // Validate classes exist in tenant by matching either _id or id
    const allTenantClasses = await req.tenantDb.Class.find();
    const existingClassIds = new Set(allTenantClasses.map((c) => String(c._id || c.id)));
    const validatedClassIds = classIds.filter((cid) => existingClassIds.has(String(cid)));

    if (validatedClassIds.length === 0) {
      return res.status(400).json({
        error: 'InvalidClasses',
        message: 'Selected target classes were not found in this institution.',
      });
    }

    const newAssignment = await req.tenantDb.Assignment.create({
      title: title.trim(),
      subject: subject.trim(),
      description: description ? description.trim() : 'Complete the assigned questions and submit your solution.',
      targetClassIds: validatedClassIds,
      teacherId: req.user.id || req.user._id,
      teacherName: req.user.fullName || req.user.username || 'Faculty',
      issueDate: issueDate || new Date().toISOString(),
      dueDate: new Date(dueDate).toISOString(),
      maxMarks: Math.max(1, Number(maxMarks) || 100),
      attachments: Array.isArray(attachments) ? attachments : [],
      createdAt: new Date(),
    });

    // Create notification for targeted students
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

    const aObj = newAssignment.toObject ? newAssignment.toObject() : { ...newAssignment };
    const formattedAssignment = {
      ...aObj,
      id: newAssignment._id ? newAssignment._id.toString() : newAssignment.id,
      submissions: [],
      submissionCount: 0,
    };

    res.status(201).json({ success: true, assignment: formattedAssignment });
  } catch (err) {
    res.status(500).json({ error: 'CreateAssignmentError', message: err.message });
  }
});

/**
 * PUT /api/assignments/:id
 * Teacher updates an assignment and its target classes
 */
router.put('/:id', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, description, targetClassIds, issueDate, dueDate, maxMarks, attachments } = req.body;

    const existing = await req.tenantDb.Assignment.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'AssignmentNotFound', message: 'Assignment not found.' });
    }

    const updates = {};
    if (title && title.trim()) updates.title = title.trim();
    if (subject && subject.trim()) updates.subject = subject.trim();
    if (description !== undefined) updates.description = description.trim();
    if (issueDate) updates.issueDate = new Date(issueDate).toISOString();
    if (dueDate) updates.dueDate = new Date(dueDate).toISOString();
    if (maxMarks) updates.maxMarks = Math.max(1, Number(maxMarks) || 100);
    if (Array.isArray(attachments)) updates.attachments = attachments;

    if (targetClassIds) {
      const classIds = Array.isArray(targetClassIds) ? targetClassIds : [targetClassIds];
      const allTenantClasses = await req.tenantDb.Class.find();
      const existingClassIds = new Set(allTenantClasses.map((c) => String(c._id || c.id)));
      const validatedClassIds = classIds.filter((cid) => existingClassIds.has(String(cid)));
      if (validatedClassIds.length > 0) {
        updates.targetClassIds = validatedClassIds;
      }
    }

    const updated = await req.tenantDb.Assignment.findByIdAndUpdate(id, updates, { new: true });

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName || 'Faculty',
      actorRole: req.user.role || 'teacher',
      actionCategory: 'ASSIGNMENT',
      description: `Updated assignment details for "${updated.title}"`,
    }).catch(() => null);

    const aObj = updated.toObject ? updated.toObject() : { ...updated };
    aObj.id = updated._id ? updated._id.toString() : updated.id;

    res.json({ success: true, assignment: aObj });
  } catch (err) {
    res.status(500).json({ error: 'UpdateAssignmentError', message: err.message });
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
    const studentClassId = String(student?.assignedClassId || (student?.assignedClassIds && student.assignedClassIds[0]));
    const targetClasses = (assignment.targetClassIds || []).map(String);

    if (!student || !targetClasses.includes(studentClassId)) {
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
        classId: studentClassId,
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
 * PUT /api/assignments/:id
 * Teacher or Admin updates an existing assignment details (title, subject, description, targetClassIds, dates, maxMarks, attachments)
 */
router.put('/:id', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subject, description, targetClassIds, issueDate, dueDate, maxMarks, attachments } = req.body;

    const assignment = await req.tenantDb.Assignment.findById(id);
    if (!assignment) {
      return res.status(404).json({ error: 'AssignmentNotFound', message: 'Assignment not found.' });
    }

    if (title) assignment.title = title.trim();
    if (subject) assignment.subject = subject.trim();
    if (description !== undefined) assignment.description = description.trim();
    if (Array.isArray(targetClassIds) && targetClassIds.length > 0) {
      assignment.targetClassIds = targetClassIds;
    }
    if (issueDate) assignment.issueDate = issueDate;
    if (dueDate) assignment.dueDate = dueDate;
    if (maxMarks !== undefined) assignment.maxMarks = Number(maxMarks);
    if (Array.isArray(attachments)) assignment.attachments = attachments;

    await assignment.save();

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'ASSIGNMENT',
      description: `Updated assignment "${assignment.title}"`,
    });

    const asgnObj = assignment.toObject ? assignment.toObject() : { ...assignment };
    asgnObj.id = assignment._id ? assignment._id.toString() : assignment.id;

    res.json({ success: true, assignment: asgnObj });
  } catch (err) {
    res.status(500).json({ error: 'UpdateAssignmentError', message: err.message });
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
