import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Assignment, StudentSubmission } from '../types/crm';
import { Award, CheckCircle2, RotateCcw, AlertTriangle, X } from 'lucide-react';

export const StudentAssignments: React.FC = () => {
  const { activeTenant, currentUser, assignments, submitAssignment } = useApp();
  if (!activeTenant || !currentUser) return null;
  const [activeUploadAsgn, setActiveUploadAsgn] = useState<Assignment | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string; dataUrl: string; mimeType: string } | null>(null);

  const cohortAssignments = assignments.filter((a: Assignment) => {
    const studentCls = currentUser.assignedClassId || (currentUser.assignedClassIds && currentUser.assignedClassIds[0]);
    if (!studentCls) return true;
    return a.targetClassIds && a.targetClassIds.some((id) => String(id) === String(studentCls));
  });

  const handleStudentFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile({
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        mimeType: file.type || 'application/pdf',
        dataUrl: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUploadAsgn) return;
    const attachments = selectedFile
      ? [
          {
            id: `att-${Date.now()}`,
            name: selectedFile.name,
            size: selectedFile.size,
            mimeType: selectedFile.mimeType,
            uploadedAt: new Date().toISOString(),
            contentPreview: `Solution uploaded by ${currentUser.fullName}`,
            dataUrl: selectedFile.dataUrl,
          },
        ]
      : [
          {
            id: `att-${Date.now()}`,
            name: `${currentUser.username}_solution.pdf`,
            size: '1.2 MB',
            mimeType: 'application/pdf',
            uploadedAt: new Date().toISOString(),
            contentPreview: `Solution submitted by ${currentUser.fullName}`,
          },
        ];

    submitAssignment(activeUploadAsgn.id, {
      studentNotes: notes || 'Completed and submitted.',
      attachments,
    });
    setActiveUploadAsgn(null);
    setNotes('');
    setSelectedFile(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">My Academic Assignments</h1>
        <p className="text-xs text-slate-400 mt-1">Submit files, track overdue deadlines, and review feedback.</p>
      </div>

      <div className="space-y-4">
        {cohortAssignments.map((asgn, idx) => {
          const asgnKey = asgn.id || (asgn as any)._id || asgn.title || `asgn-${idx}`;
          const mySub = asgn.submissions?.find((s: StudentSubmission) => s.studentId === currentUser.id);
          const status = mySub?.status || 'pending';
          const isOverdue = status === 'pending' && new Date(asgn.dueDate) < new Date();

          return (
            <div key={asgnKey} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-start gap-4">
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
              <div>
                <label className="block text-xs text-slate-300 mb-1">Attach Solution File (PDF, Word, Code, Image)</label>
                <input
                  type="file"
                  onChange={handleStudentFile}
                  accept=".pdf,.doc,.docx,.txt,.zip,image/*"
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600/30 file:text-purple-200 hover:file:bg-purple-600/50"
                />
                {selectedFile && (
                  <p className="text-[11px] text-emerald-400 mt-1">
                    Selected: {selectedFile.name} ({selectedFile.size})
                  </p>
                )}
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
