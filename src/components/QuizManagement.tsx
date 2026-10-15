import React, { useState } from 'react';
import {
  HelpCircle,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  Trash2,
  Eye,
  AlertCircle,
  X,
  Send,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Quiz, QuizQuestion } from '../types/crm';

export const QuizManagement: React.FC = () => {
  const {
    currentUser,
    quizzes,
    quizAttempts,
    classes,
    createQuiz,
    submitQuiz,
    togglePublishQuiz,
  } = useApp();

  const isFacultyOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'teacher';

  // Teacher Create Quiz Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [isPublished, setIsPublished] = useState(true);
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const [questions, setQuestions] = useState<
    { questionText: string; options: string[]; correctOptionIndex: number; marks: number }[]
  >([
    {
      questionText: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0,
      marks: 5,
    },
  ]);

  // Student Attempt Quiz Modal
  const [activeQuizToTake, setActiveQuizToTake] = useState<Quiz | null>(null);
  const [studentAnswers, setStudentAnswers] = useState<{ [qIndex: number]: number }>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [attemptResult, setAttemptResult] = useState<{ score: number; totalMarks: number; passed: boolean } | null>(
    null
  );

  // Teacher View Attempts Modal
  const [viewingQuizAttempts, setViewingQuizAttempts] = useState<Quiz | null>(null);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        questionText: '',
        options: ['', '', '', ''],
        correctOptionIndex: 0,
        marks: 5,
      },
    ]);
  };

  const handleRemoveQuestion = (idx: number) => {
    if (questions.length <= 1) return;
    setQuestions(questions.filter((_, i) => i !== idx));
  };

  const handleQuestionChange = (idx: number, field: string, value: any) => {
    const updated = [...questions];
    (updated[idx] as any)[field] = value;
    setQuestions(updated);
  };

  const handleOptionChange = (qIdx: number, optIdx: number, value: string) => {
    const updated = [...questions];
    updated[qIdx].options[optIdx] = value;
    setQuestions(updated);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');

    if (!title.trim() || !subject.trim() || targetClassIds.length === 0) {
      setCreateError('Title, subject, and at least one target class are required.');
      return;
    }

    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].questionText.trim()) {
        setCreateError(`Question #${i + 1} is empty.`);
        return;
      }
      for (let j = 0; j < 4; j++) {
        if (!questions[i].options[j]?.trim()) {
          setCreateError(`Option ${j + 1} for Question #${i + 1} is empty.`);
          return;
        }
      }
    }

    setCreateLoading(true);
    const res = await createQuiz({
      title: title.trim(),
      subject: subject.trim(),
      description: description.trim(),
      targetClassIds,
      durationMinutes,
      questions,
      isPublished,
    });
    setCreateLoading(false);

    if (res.ok) {
      setCreateModalOpen(false);
      setTitle('');
      setSubject('');
      setDescription('');
      setTargetClassIds([]);
      setQuestions([
        {
          questionText: '',
          options: ['', '', '', ''],
          correctOptionIndex: 0,
          marks: 5,
        },
      ]);
    } else {
      setCreateError(res.message || 'Failed to create quiz.');
    }
  };

  const handleStartQuiz = (quiz: Quiz) => {
    setActiveQuizToTake(quiz);
    setStudentAnswers({});
    setAttemptResult(null);
  };

  const handleStudentSubmitQuiz = async () => {
    if (!activeQuizToTake) return;
    setSubmitLoading(true);

    const formattedAnswers = Object.entries(studentAnswers).map(([qIdx, optIdx]) => ({
      questionIndex: Number(qIdx),
      selectedOptionIndex: optIdx,
    }));

    const res = await submitQuiz(activeQuizToTake._id || activeQuizToTake.id!, formattedAnswers);
    setSubmitLoading(false);

    if (res.ok) {
      const myAttempt = quizAttempts.find((a) => a.quizId === (activeQuizToTake._id || activeQuizToTake.id));
      if (myAttempt) {
        setAttemptResult({
          score: myAttempt.score,
          totalMarks: myAttempt.totalMarks,
          passed: myAttempt.passed,
        });
      } else {
        setActiveQuizToTake(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Academic Quizzes & Examinations</h1>
          <p className="text-xs text-slate-400">
            {isFacultyOrAdmin
              ? 'Author multiple-choice assessments, assign to classes, and review student attempt scores.'
              : 'Take online class quizzes, test your knowledge, and view immediate scores and evaluation.'}
          </p>
        </div>

        {isFacultyOrAdmin && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 transition-all shadow-md shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Quiz</span>
          </button>
        )}
      </div>

      {/* Quiz Grid */}
      {quizzes.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/10">
          <HelpCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-white mb-1">No Quizzes Available</h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {isFacultyOrAdmin
              ? 'Click "Create New Quiz" above to author your first assessment.'
              : 'No quizzes currently assigned for your enrolled classes.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quizzes.map((quiz) => {
            const quizId = quiz._id || quiz.id!;
            const myAttempt = quizAttempts.find((a) => a.quizId === quizId);
            const totalAttempts = quizAttempts.filter((a) => a.quizId === quizId).length;

            return (
              <div
                key={quizId}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-purple-500/30 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      {quiz.subject}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        {quiz.durationMinutes}m
                      </span>
                      {isFacultyOrAdmin && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            quiz.isPublished
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          {quiz.isPublished ? 'Published' : 'Draft'}
                        </span>
                      )}
                    </div>
                  </div>

                  <h2 className="text-base font-bold text-white mb-1.5">{quiz.title}</h2>
                  <p className="text-xs text-slate-400 line-clamp-2 mb-4">{quiz.description || 'No description provided.'}</p>

                  <div className="space-y-1.5 text-xs text-slate-300 mb-6">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Marks:</span>
                      <span className="font-semibold">{quiz.totalMarks} pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Pass Criteria:</span>
                      <span className="font-semibold">{quiz.passMarks} pts</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Questions:</span>
                      <span className="font-semibold">{quiz.questions?.length || 0} items</span>
                    </div>
                    {isFacultyOrAdmin && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Student Attempts:</span>
                        <span className="font-semibold text-purple-300">{totalAttempts}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-3">
                  {isFacultyOrAdmin ? (
                    <>
                      <button
                        onClick={() => togglePublishQuiz(quizId, !quiz.isPublished)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                          quiz.isPublished
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {quiz.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => setViewingQuizAttempts(quiz)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium flex items-center gap-1.5 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Results ({totalAttempts})</span>
                      </button>
                    </>
                  ) : myAttempt ? (
                    <div className="w-full flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg ${
                          myAttempt.passed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                        }`}
                      >
                        {myAttempt.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                        Score: {myAttempt.score} / {myAttempt.totalMarks}
                      </span>
                      <span className="text-[11px] text-slate-500">Completed</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartQuiz(quiz)}
                      className="w-full py-2 px-4 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 shadow-md shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Quiz Now</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Teacher Create Quiz Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#121124] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Create New Assessment Quiz</h2>
                  <p className="text-xs text-slate-400">Define quiz metadata, duration, and multiple-choice questions.</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Quiz Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Mid-Term Kinematics & Vectors"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Academic Subject *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Physics / Calculus"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Target Classes *</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10">
                    {classes.map((c) => {
                      const cId = c._id || c.id!;
                      const checked = targetClassIds.includes(cId);
                      return (
                        <label key={cId} className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              if (checked) {
                                setTargetClassIds(targetClassIds.filter((id) => id !== cId));
                              } else {
                                setTargetClassIds([...targetClassIds, cId]);
                              }
                            }}
                            className="rounded border-white/20 text-purple-600 focus:ring-0"
                          />
                          <span>{c.name} ({c.gradeLevel})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Duration (Minutes)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                  />
                  <div className="mt-4 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="publishImmediately"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="rounded border-white/20 text-purple-600 focus:ring-0"
                    />
                    <label htmlFor="publishImmediately" className="text-xs text-slate-300 cursor-pointer">
                      Publish immediately to enrolled students
                    </label>
                  </div>
                </div>
              </div>

              {/* Question Builder */}
              <div className="pt-4 border-t border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">Questions ({questions.length})</h3>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3 py-1.5 text-xs font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 rounded-lg flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                </div>

                {questions.map((q, qIdx) => (
                  <div key={qIdx} className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-purple-400">Question #{qIdx + 1}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-slate-400">Marks:</span>
                          <input
                            type="number"
                            min="1"
                            value={q.marks}
                            onChange={(e) => handleQuestionChange(qIdx, 'marks', Number(e.target.value))}
                            className="w-14 px-2 py-1 text-xs rounded bg-white/5 border border-white/10 text-white"
                          />
                        </div>
                        {questions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIdx)}
                            className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <input
                      type="text"
                      required
                      value={q.questionText}
                      onChange={(e) => handleQuestionChange(qIdx, 'questionText', e.target.value)}
                      placeholder="Type question prompt..."
                      className="w-full px-3 py-2 text-xs rounded-xl bg-black/40 border border-white/10 text-white focus:outline-none focus:border-purple-500"
                    />

                    <div className="space-y-2 pt-1">
                      <span className="text-[11px] text-slate-400">Answer Options (Select correct option):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-2 p-2 rounded-xl border ${
                              q.correctOptionIndex === optIdx
                                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                                : 'bg-black/20 border-white/10 text-slate-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`correct-${qIdx}`}
                              checked={q.correctOptionIndex === optIdx}
                              onChange={() => handleQuestionChange(qIdx, 'correctOptionIndex', optIdx)}
                              className="text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                            <input
                              type="text"
                              required
                              value={opt}
                              onChange={(e) => handleOptionChange(qIdx, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              className="w-full bg-transparent text-xs text-white focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {createError && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 shadow-md shadow-purple-600/30 cursor-pointer disabled:opacity-50"
                >
                  {createLoading ? 'Saving to Database...' : 'Save & Authorize Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Take Quiz Modal */}
      {activeQuizToTake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-[#121124] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            {attemptResult ? (
              <div className="text-center py-6 space-y-4">
                <div
                  className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${
                    attemptResult.passed
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}
                >
                  {attemptResult.passed ? <Award className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
                </div>
                <h3 className="text-2xl font-bold text-white">Quiz Evaluation Completed</h3>
                <p className="text-sm text-slate-300">
                  {attemptResult.passed
                    ? 'Congratulations! You successfully passed this assessment.'
                    : 'Your score was below the passing threshold. Review feedback with your instructor.'}
                </p>
                <div className="inline-block p-4 rounded-2xl bg-white/5 border border-white/10">
                  <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 font-display">
                    {attemptResult.score} / {attemptResult.totalMarks}
                  </span>
                  <p className="text-xs text-slate-400 mt-1">
                    {Math.round((attemptResult.score / attemptResult.totalMarks) * 100)}% Overall Score
                  </p>
                </div>
                <div>
                  <button
                    onClick={() => setActiveQuizToTake(null)}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all cursor-pointer"
                  >
                    Close Assessment
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div>
                    <span className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider">
                      {activeQuizToTake.subject}
                    </span>
                    <h3 className="text-lg font-bold text-white">{activeQuizToTake.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-bold">
                    <Clock className="w-4 h-4" />
                    <span>{activeQuizToTake.durationMinutes} Minutes</span>
                  </div>
                </div>

                <div className="space-y-6">
                  {activeQuizToTake.questions?.map((q, qIdx) => (
                    <div key={qIdx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-400">Question {qIdx + 1}</span>
                        <span className="text-xs text-slate-400">{q.marks} pts</span>
                      </div>
                      <p className="text-sm font-medium text-white">{q.questionText}</p>

                      <div className="space-y-2 pt-2">
                        {q.options?.map((opt, optIdx) => {
                          const isSelected = studentAnswers[qIdx] === optIdx;
                          return (
                            <button
                              key={optIdx}
                              type="button"
                              onClick={() => setStudentAnswers({ ...studentAnswers, [qIdx]: optIdx })}
                              className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center gap-3 cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-600/20 border-purple-500 text-white font-semibold'
                                  : 'bg-black/20 border-white/10 text-slate-300 hover:bg-white/5'
                              }`}
                            >
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected ? 'border-purple-400 bg-purple-500' : 'border-white/30'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              <span>{opt}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <button
                    onClick={() => setActiveQuizToTake(null)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Exit Without Submitting
                  </button>
                  <button
                    onClick={handleStudentSubmitQuiz}
                    disabled={submitLoading || Object.keys(studentAnswers).length === 0}
                    className="px-6 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl hover:opacity-95 shadow-md shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {submitLoading ? (
                      <span>Evaluating Answers...</span>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Final Answers</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Teacher View Attempts Modal */}
      {viewingQuizAttempts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#121124] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Student Quiz Attempts</h3>
                <p className="text-xs text-slate-400">{viewingQuizAttempts.title} ({viewingQuizAttempts.subject})</p>
              </div>
              <button
                onClick={() => setViewingQuizAttempts(null)}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {(() => {
              const qId = viewingQuizAttempts._id || viewingQuizAttempts.id!;
              const attempts = quizAttempts.filter((a) => a.quizId === qId);

              if (attempts.length === 0) {
                return (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No students have completed this quiz yet.
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  {attempts.map((att, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="text-sm font-semibold text-white">{att.studentName}</h4>
                        <p className="text-xs text-slate-400">
                          {att.rollNumber ? `Roll: ${att.rollNumber} • ` : ''}
                          Submitted {new Date(att.submittedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-md ${
                            att.passed
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {att.score} / {att.totalMarks} ({att.passed ? 'PASS' : 'FAIL'})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
export default QuizManagement;
