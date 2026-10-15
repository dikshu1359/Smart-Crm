import mongoose from 'mongoose';

export const QuestionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  questionText: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctOptionIndex: { type: Number, required: true },
  marks: { type: Number, default: 5 },
});

export const QuizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    description: { type: String, default: '' },
    targetClassIds: [{ type: String, required: true }],
    teacherId: { type: String, required: true },
    teacherName: { type: String, required: true },
    durationMinutes: { type: Number, default: 30 },
    totalMarks: { type: Number, default: 20 },
    passMarks: { type: Number, default: 10 },
    questions: [QuestionSchema],
    isPublished: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const QuizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: String, required: true },
    studentId: { type: String, required: true },
    studentName: { type: String, required: true },
    rollNumber: { type: String, default: '' },
    classId: { type: String, required: true },
    answers: [
      {
        questionId: { type: String, required: true },
        selectedOptionIndex: { type: Number, required: true },
      },
    ],
    score: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
