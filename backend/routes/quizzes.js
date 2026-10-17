import express from 'express';
import { tenantAuth, authorizeRoles } from '../middleware/tenantAuth.js';
import dbManager from '../utils/DatabaseManager.js';

const router = express.Router();
router.use(tenantAuth);

/**
 * GET /api/quizzes
 * List quizzes for current user
 * - Teacher: quizzes created by teacher
 * - Student: published quizzes targeting student's class
 * - Admin: all quizzes
 */
router.get('/', async (req, res) => {
  try {
    const role = req.user?.role || 'admin';
    const userId = req.user?.id;
    let query = {};

    if (role === 'student' && userId && userId !== 'system') {
      const student = await req.tenantDb.User.findById(userId);
      if (!student?.assignedClassId) {
        return res.json({ quizzes: [], attempts: [] });
      }
      query = {
        targetClassIds: student.assignedClassId,
        isPublished: true,
      };
    } else if (role === 'teacher' && userId && userId !== 'system') {
      query = { teacherId: userId };
    }

    const quizzes = await req.tenantDb.Quiz.find(query).sort({ createdAt: -1 });

    // Fetch attempts
    let attempts = [];
    if (role === 'student' && userId && userId !== 'system') {
      attempts = await req.tenantDb.QuizAttempt.find({ studentId: userId });
    } else {
      const quizIds = quizzes.map((q) => q._id.toString());
      attempts = await req.tenantDb.QuizAttempt.find({ quizId: { $in: quizIds } });
    }

    // For students, sanitize correctOptionIndex if quiz is active and not submitted
    const formattedQuizzes = quizzes.map((q) => {
      const qObj = q.toObject();
      qObj.id = q._id.toString();
      if (role === 'student') {
        const studentAttempt = attempts.find((a) => a.quizId === q._id.toString());
        if (!studentAttempt) {
          // Hide correct answers prior to attempt completion
          qObj.questions = qObj.questions.map((ques) => ({
            _id: ques._id,
            id: ques._id?.toString(),
            questionText: ques.questionText,
            options: ques.options,
            marks: ques.marks,
          }));
        }
      }
      return qObj;
    });

    const formattedAttempts = attempts.map((a) => ({
      ...(a.toObject ? a.toObject() : a),
      id: a._id?.toString() || a.id,
    }));

    res.json({ quizzes: formattedQuizzes, attempts: formattedAttempts });
  } catch (err) {
    res.status(500).json({ error: 'FetchQuizzesError', message: err.message });
  }
});

/**
 * POST /api/quizzes
 * Teacher or Admin creates a new quiz
 */
router.post('/', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { title, subject, description, targetClassIds, durationMinutes, questions, isPublished } = req.body;

    if (!title || !subject || !targetClassIds || targetClassIds.length === 0 || !questions || questions.length === 0) {
      return res.status(400).json({
        error: 'MissingFields',
        message: 'Title, subject, target class(es), and at least one question are required.',
      });
    }

    const totalMarks = questions.reduce((sum, q) => sum + (Number(q.marks) || 5), 0);
    const passMarks = Math.ceil(totalMarks * 0.4);

    const quiz = await req.tenantDb.Quiz.create({
      title: title.trim(),
      subject: subject.trim(),
      description: description || '',
      targetClassIds,
      teacherId: req.user.id,
      teacherName: req.user.fullName,
      durationMinutes: Number(durationMinutes) || 30,
      totalMarks,
      passMarks,
      questions,
      isPublished: Boolean(isPublished),
    });

    if (quiz.isPublished) {
      await req.tenantDb.Notice.create({
        title: `New Quiz: ${quiz.title}`,
        content: `A new quiz has been published for ${quiz.subject}. Duration: ${quiz.durationMinutes} mins. Total Marks: ${quiz.totalMarks}.`,
        category: 'Examination',
        targetRole: 'student',
        authorName: req.user.fullName,
        authorRole: req.user.role,
      });
    }

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: req.user.role,
      actionCategory: 'QUIZ',
      description: `Created quiz "${quiz.title}" with ${questions.length} questions`,
    });

    res.status(201).json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ error: 'CreateQuizError', message: err.message });
  }
});

/**
 * POST /api/quizzes/:id/submit
 * Student attempts and submits a quiz
 */
router.post('/:id/submit', authorizeRoles('student'), async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // array of { questionIndex, selectedOptionIndex }

    const quiz = await req.tenantDb.Quiz.findById(id);
    if (!quiz) return res.status(404).json({ error: 'QuizNotFound', message: 'Quiz not found.' });

    const student = await req.tenantDb.User.findById(req.user.id);
    if (!student || !quiz.targetClassIds.includes(student.assignedClassId)) {
      return res.status(403).json({ error: 'Forbidden', message: 'You are not assigned to this quiz cohort.' });
    }

    // Check if already attempted
    const existing = await req.tenantDb.QuizAttempt.findOne({ quizId: id, studentId: req.user.id });
    if (existing) {
      return res.status(400).json({ error: 'AlreadyAttempted', message: 'You have already completed this quiz.' });
    }

    // Calculate score
    let score = 0;
    quiz.questions.forEach((ques, idx) => {
      const studentAns = answers?.find((a) => a.questionIndex === idx);
      if (studentAns && studentAns.selectedOptionIndex === ques.correctOptionIndex) {
        score += ques.marks || 5;
      }
    });

    const passed = score >= quiz.passMarks;

    const attempt = await req.tenantDb.QuizAttempt.create({
      quizId: id,
      studentId: req.user.id,
      studentName: req.user.fullName,
      rollNumber: student.rollNumber || '',
      classId: student.assignedClassId,
      answers: answers || [],
      score,
      totalMarks: quiz.totalMarks,
      passed,
      submittedAt: new Date(),
    });

    await dbManager.logActivity({
      databaseName: req.databaseName,
      institutionName: req.user.institutionName,
      actorName: req.user.fullName,
      actorRole: 'student',
      actionCategory: 'QUIZ',
      description: `Student ${req.user.fullName} completed quiz "${quiz.title}" with score ${score}/${quiz.totalMarks}`,
    });

    res.status(201).json({ success: true, attempt });
  } catch (err) {
    res.status(500).json({ error: 'SubmitQuizError', message: err.message });
  }
});

/**
 * PUT /api/quizzes/:id/publish
 * Teacher or Admin toggles quiz published state
 */
router.put('/:id/publish', authorizeRoles('admin', 'teacher'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;

    const quiz = await req.tenantDb.Quiz.findByIdAndUpdate(id, { isPublished: Boolean(isPublished) }, { new: true });
    if (!quiz) return res.status(404).json({ error: 'QuizNotFound', message: 'Quiz not found.' });

    res.json({ success: true, quiz });
  } catch (err) {
    res.status(500).json({ error: 'PublishQuizError', message: err.message });
  }
});

export default router;
