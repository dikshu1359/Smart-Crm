import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Assignment } from '../types/crm';
import { Award, CheckCircle2, RotateCcw, AlertTriangle, X } from 'lucide-react';

export const StudentAssignments: React.FC = () => {
  const { activeTenant, currentUser, submitAssignment } = useApp();
  const [activeUploadAsgn, setActiveUploadAsgn] = useState<Assignment | null>(null);
  const [notes, setNotes] = useState('');

  const cohortAssignments = activeTenant.assignments.filter((a) =>
    currentUser.assignedClassId ? a.targetClassIds.includes(currentUser.assignedClassId) : true
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUploadAsgn) return;
    submitAssignment({
      assignmentId: activeUploadAsgn.id,
      studentId: currentUser.id,
      studentNotes: notes || 'Completed and submitted.',
      attachments: [
        {
          id: `att-${Date.now()}`,
          name: `${currentUser.username}_solution.pdf`,
          size: '1.2 MB',
          mimeType: 'application/pdf',
          uploadedAt: new Date().toISOString(),
          contentPreview: `Solution submitted by ${currentUser.fullName}`,
        },
      ],
    });
    setActiveUploadAsgn(null);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">My Academic Assignments</h1>
        <p className="text-xs text-slate-400 mt-1">Submit files, track overdue deadlines, and review feedback.</p>
      </div>

      <div className="space-y-4">
        {cohortAssignments.map((asgn) => {
          const mySub = asgn.submissions.find((s) => s.studentId === currentUser.id);
          const status = mySub?.status || 'pending';
          const isOverdue = status === 'pending' && new Date(asgn.dueDate) < new Date();

          return (
            <div key={asgn.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-start gap-4">
              <div className="space-y-2 flex-1">
                <div className="text-xs text-purple-300 font-medium">
                  {asgn.subject} &middot; Due: {new Date(asgn.dueDate).toLocaleDateString()}
                </div>
                <h2 className="text-lg font-bold text-white font-display">{asgn.title}</h2>
                <p className="text-xs text-slate-300">{asgn.description}</p>
                {mySub?.teacherReviewNotes && (
                  <div className="p-3 bg-purple-950/30 rounded-xl text-xs text-purple-200">
                    Teacher Feedback: {mySub.teacherReviewNotes}
                  </div>
                )}
              </div>

              <div className="text-right shrink-0 space-y-3">
                <div className="text-xs">
                  {isOverdue && <span className="text-red-400 font-bold">Overdue</span>}
                  {!isOverdue && status === 'graded' && (
                    <span className="text-emerald-400 font-bold font-mono">
                      Graded: {mySub?.marksObtained} / {asgn.maxMarks}
                    </span>
                  )}
                  {!isOverdue && status !== 'graded' && (
                    <span className="capitalize text-slate-300 font-medium">{status}</span>
                  )}
                </div>

                {status !== 'graded' && (
                  <button
                    onClick={() => {
                      setActiveUploadAsgn(asgn);
                      setNotes(mySub?.studentNotes || '');
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl cursor-pointer"
                  >
                    {status === 'reassigned' ? 'Resubmit Work' : status === 'submitted' ? 'Update Work' : 'Submit Work'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activeUploadAsgn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">Submit: {activeUploadAsgn.title}</h3>
              <button onClick={() => setActiveUploadAsgn(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Submission Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                  placeholder="Detail your solution work..."
                />
              </div>
              <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl text-xs text-purple-200">
                Attachment: {currentUser.username}_solution.pdf (Auto-Generated Worksheet PDF)
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setActiveUploadAsgn(null)} className="px-3 py-1.5 text-xs text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl">
                  Upload &amp; Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
