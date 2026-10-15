import React, { useState } from 'react';
import { Plus, FileText, CheckCircle2, XCircle, RotateCcw, Award, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Assignment, FileAttachment, StudentSubmission, SubmissionStatus } from '../types/crm';

export const TeacherAssignments: React.FC = () => {
  const { activeTenant, currentUser, createAssignment, reviewSubmission } = useApp();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    activeTenant.assignments[0]?.id || ''
  );

  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [targetClassIds, setTargetClassIds] = useState<string[]>(
    activeTenant.classes[0] ? [activeTenant.classes[0].id] : []
  );
  const [dueDate, setDueDate] = useState('2026-10-30');
  const [maxMarks, setMaxMarks] = useState(100);

  const [reviewingTarget, setReviewingTarget] = useState<{
    assignment: Assignment;
    submission: StudentSubmission;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [marksInput, setMarksInput] = useState<number>(90);

  const selectedAssignment =
    activeTenant.assignments.find((a) => a.id === selectedAssignmentId) ||
    activeTenant.assignments[0];

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subject.trim()) return;
    createAssignment({
      title: title.trim(),
      subject: subject.trim(),
      description: description.trim() || 'Complete assigned problems.',
      targetClassIds,
      dueDate: new Date(dueDate).toISOString(),
      maxMarks: Number(maxMarks) || 100,
      attachments: [],
    });
    setTitle('');
    setSubject('');
    setShowCreateModal(false);
  };

  const handleApplyReview = (status: SubmissionStatus) => {
    if (!reviewingTarget) return;
    reviewSubmission({
      assignmentId: reviewingTarget.assignment.id,
      studentId: reviewingTarget.submission.studentId,
      status,
      teacherReviewNotes: reviewNotes || (status === 'graded' ? 'Graded and approved.' : status),
      marksObtained: status === 'graded' ? Number(marksInput) : undefined,
    });
    setReviewingTarget(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Assignment Management Workflow</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-class assignment creation, file reviews, and grading.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-500 cursor-pointer"
        >
          + Create Assignment
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-3">
          {activeTenant.assignments.map((asgn) => (
            <button
              key={asgn.id}
              onClick={() => setSelectedAssignmentId(asgn.id)}
              className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                selectedAssignment?.id === asgn.id
                  ? 'bg-purple-600/20 border-purple-400'
                  : 'bg-white/[0.03] border-white/10 hover:border-white/20'
              }`}
            >
              <div className="text-xs text-purple-300 font-medium">{asgn.subject}</div>
              <div className="text-sm font-bold text-white mt-1">{asgn.title}</div>
              <div className="text-xs text-slate-400 mt-1 font-mono">Max Marks: {asgn.maxMarks}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-8 p-6 rounded-2xl bg-white/[0.03] border border-white/10">
          {selectedAssignment ? (
            <div className="space-y-6">
              <div>
                <div className="text-xs text-purple-300 font-medium">{selectedAssignment.subject}</div>
                <h2 className="text-xl font-bold text-white mt-1">{selectedAssignment.title}</h2>
                <p className="text-xs text-slate-300 mt-2">{selectedAssignment.description}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Student Submissions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="py-2.5 pr-4">Student</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-4 text-right">Marks</th>
                        <th className="py-2.5 pl-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {selectedAssignment.submissions.map((sub) => (
                        <tr key={sub.studentId}>
                          <td className="py-3 pr-4 text-white font-medium">{sub.studentName}</td>
                          <td className="py-3 px-4 capitalize text-purple-300">{sub.status}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-400">
                            {sub.marksObtained !== undefined ? `${sub.marksObtained}/${selectedAssignment.maxMarks}` : '-'}
                          </td>
                          <td className="py-3 pl-4 text-right">
                            <button
                              onClick={() => {
                                setReviewingTarget({ assignment: selectedAssignment, submission: sub });
                                setReviewNotes(sub.teacherReviewNotes || '');
                                setMarksInput(sub.marksObtained || 90);
                              }}
                              className="px-2.5 py-1 text-xs bg-white/10 hover:bg-purple-600 rounded-lg text-white"
                            >
                              Review / Grade
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400 py-12">No assignment selected.</div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {reviewingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Review: {reviewingTarget.submission.studentName}</h3>
              <button onClick={() => setReviewingTarget(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Score (Out of {reviewingTarget.assignment.maxMarks})</label>
              <input
                type="number"
                value={marksInput}
                onChange={(e) => setMarksInput(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Feedback / Notes</label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleApplyReview('accepted')}
                className="py-2 text-xs bg-purple-600/30 text-purple-200 rounded-xl"
              >
                Accept Work
              </button>
              <button
                type="button"
                onClick={() => handleApplyReview('reassigned')}
                className="py-2 text-xs bg-amber-600/30 text-amber-200 rounded-xl"
              >
                Reassign Work
              </button>
              <button
                type="button"
                onClick={() => handleApplyReview('rejected')}
                className="py-2 text-xs bg-red-600/30 text-red-200 rounded-xl"
              >
                Reject Work
              </button>
              <button
                type="button"
                onClick={() => handleApplyReview('graded')}
                className="py-2 text-xs font-semibold bg-purple-600 text-white rounded-xl"
              >
                Finalize Grade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white">Create Multi-Class Assignment</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-3 py-1.5 text-xs text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl">
                  Publish Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
