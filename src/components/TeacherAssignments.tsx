import React, { useState, useMemo } from 'react';
import {
  Plus,
  FileText,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Award,
  X,
  Upload,
  Calendar,
  AlertCircle,
  Search,
  Check,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Assignment, FileAttachment, StudentSubmission, SubmissionStatus, SchoolClass } from '../types/crm';

export const TeacherAssignments: React.FC = () => {
  const { activeTenant, currentUser, assignments, classes, createAssignment, deleteAssignment, reviewSubmission } = useApp();
  if (!activeTenant || !currentUser) return null;

  // Active assignment selection
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(
    assignments[0]?.id || (assignments[0] as any)?._id || ''
  );

  // Modal & form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');

  // Default dates
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const defaultDueStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  }, []);

  const [issueDate, setIssueDate] = useState(todayStr);
  const [dueDate, setDueDate] = useState(defaultDueStr);
  const [maxMarks, setMaxMarks] = useState<number>(100);
  const [targetClassIds, setTargetClassIds] = useState<string[]>([]);
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  // Submission / Loading / Error / Success states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Review states
  const [reviewingTarget, setReviewingTarget] = useState<{
    assignment: Assignment;
    submission: StudentSubmission;
  } | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [marksInput, setMarksInput] = useState<number>(90);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Filter classes authorized for this teacher
  const authorizedClasses = useMemo(() => {
    if (currentUser.role === 'admin') return classes;
    const filtered = classes.filter((c: SchoolClass) => {
      const cId = c.id || (c as any)._id;
      const isPrimary = c.primaryTeacherId === currentUser.id;
      const isAssigned = currentUser.assignedClassIds?.includes(cId);
      return isPrimary || isAssigned;
    });
    // Fallback to all classes if teacher has no explicit class allotment yet
    return filtered.length > 0 ? filtered : classes;
  }, [classes, currentUser]);

  // Filtered classes by search term
  const searchedClasses = useMemo(() => {
    if (!classSearchQuery.trim()) return authorizedClasses;
    const q = classSearchQuery.toLowerCase();
    return authorizedClasses.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.gradeLevel.toLowerCase().includes(q) ||
      (c.section && c.section.toLowerCase().includes(q))
    );
  }, [authorizedClasses, classSearchQuery]);

  // Selected assignment object
  const selectedAssignment =
    assignments.find((a: Assignment) => (a.id || (a as any)._id) === selectedAssignmentId) ||
    assignments[0];

  // Open modal with pre-initialized class selection
  const handleOpenCreateModal = () => {
    setFormError(null);
    setTitle('');
    setSubject('');
    setDescription('');
    setIssueDate(todayStr);
    setDueDate(defaultDueStr);
    setMaxMarks(100);
    setAttachments([]);
    setClassSearchQuery('');
    // Auto-select first authorized class if available
    if (authorizedClasses.length > 0) {
      const firstId = authorizedClasses[0].id || (authorizedClasses[0] as any)._id;
      setTargetClassIds(firstId ? [firstId] : []);
    } else {
      setTargetClassIds([]);
    }
    setShowCreateModal(true);
  };

  // Toggle class selection
  const handleToggleClass = (classId: string) => {
    setTargetClassIds((prev) =>
      prev.includes(classId) ? prev.filter((id) => id !== classId) : [...prev, classId]
    );
  };

  // Select all authorized classes
  const handleSelectAllClasses = () => {
    const allIds = authorizedClasses.map((c) => c.id || (c as any)._id).filter(Boolean);
    setTargetClassIds(allIds);
  };

  // Clear all selected classes
  const handleClearAllClasses = () => {
    setTargetClassIds([]);
  };

  // Handle file attachment upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Size check (max 10MB per file)
      if (file.size > 10 * 1024 * 1024) {
        setFormError(`File "${file.name}" exceeds the 10MB limit.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const newAttachment: FileAttachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          mimeType: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          contentPreview: `Attachment: ${file.name}`,
          dataUrl: result,
        };
        setAttachments((prev) => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    }
    // Reset file input
    e.target.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Form submit handler with validation and persistence
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!title.trim()) {
      setFormError('Please enter an assignment title.');
      return;
    }
    if (!subject.trim()) {
      setFormError('Please specify the academic subject.');
      return;
    }
    if (targetClassIds.length === 0) {
      setFormError('Please select at least one target class for this assignment.');
      return;
    }
    if (!dueDate) {
      setFormError('Please select a deadline / due date.');
      return;
    }
    if (new Date(dueDate) < new Date(issueDate)) {
      setFormError('Deadline cannot be earlier than the issue date.');
      return;
    }
    if (!maxMarks || maxMarks <= 0) {
      setFormError('Maximum marks must be greater than 0.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await createAssignment({
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim() || 'Complete the assigned questions and submit your solution.',
        targetClassIds,
        issueDate: new Date(issueDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        maxMarks: Number(maxMarks) || 100,
        attachments,
      });

      if (!res.ok) {
        setFormError(res.message || 'Failed to publish assignment. Please try again.');
        setIsSubmitting(false);
        return;
      }

      // Success
      setIsSubmitting(false);
      setShowCreateModal(false);
      setSuccessToast(`Assignment "${title.trim()}" published successfully to ${targetClassIds.length} classes.`);

      if (res.assignment?.id) {
        setSelectedAssignmentId(res.assignment.id);
      }

      // Auto dismiss toast
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      setIsSubmitting(false);
      setFormError(err.message || 'An unexpected error occurred while saving.');
    }
  };

  // Review submission handler
  const handleApplyReview = async (status: SubmissionStatus) => {
    if (!reviewingTarget) return;
    setReviewLoading(true);
    const actionMap: Record<SubmissionStatus, 'accept' | 'reject' | 'reassign' | 'grade'> = {
      accepted: 'accept',
      rejected: 'reject',
      reassigned: 'reassign',
      graded: 'grade',
      submitted: 'accept',
      pending: 'accept',
      under_review: 'accept',
    };
    await reviewSubmission(
      reviewingTarget.assignment.id,
      reviewingTarget.submission.studentId,
      actionMap[status] || 'grade',
      status === 'graded' ? Number(marksInput) : undefined,
      reviewNotes || (status === 'graded' ? 'Graded and approved.' : status)
    );
    setReviewLoading(false);
    setReviewingTarget(null);
  };

  // Delete assignment
  const handleDeleteAssignment = async (id: string, asgnTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete assignment "${asgnTitle}"?`)) return;
    await deleteAssignment(id);
    if (selectedAssignmentId === id) {
      const remaining = assignments.filter((a) => (a.id || (a as any)._id) !== id);
      setSelectedAssignmentId(remaining[0]?.id || (remaining[0] as any)?._id || '');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Assignment Management Workflow</h1>
          <p className="text-xs text-slate-400 mt-1">Multi-class assignment authoring, deadline scheduling, attachments, and submissions grading.</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Assignment</span>
        </button>
      </div>

      {/* Main View Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Assignment List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1 pb-1">
            <span className="font-semibold uppercase tracking-wider">Active Assignments ({assignments.length})</span>
          </div>

          {assignments.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/10 text-center">
              <FileText className="w-8 h-8 text-slate-500 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No assignments created yet.</p>
              <button
                onClick={handleOpenCreateModal}
                className="mt-3 px-3 py-1.5 text-xs text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 rounded-lg border border-purple-500/30 cursor-pointer"
              >
                Create your first assignment
              </button>
            </div>
          ) : (
            assignments.map((asgn: Assignment, idx: number) => {
              const asgnKey = asgn.id || (asgn as any)._id || asgn.title || `asgn-${idx}`;
              const isSelected = (selectedAssignment?.id || (selectedAssignment as any)?._id) === asgnKey;
              const subCount = asgn.submissions?.length || 0;
              const gradedCount = asgn.submissions?.filter((s) => s.status === 'graded').length || 0;

              return (
                <div
                  key={asgnKey}
                  onClick={() => setSelectedAssignmentId(asgnKey)}
                  className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer relative group ${
                    isSelected
                      ? 'bg-purple-600/20 border-purple-400/80 shadow-md shadow-purple-600/10'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs text-purple-300 font-medium px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                      {asgn.subject}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Due: {new Date(asgn.dueDate).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mt-2 line-clamp-1">{asgn.title}</h3>

                  <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2.5 border-t border-white/5 font-mono">
                    <span>Max Marks: {asgn.maxMarks}</span>
                    <span className="text-purple-300">
                      {subCount} Submissions {gradedCount > 0 && `(${gradedCount} Graded)`}
                    </span>
                  </div>

                  {/* Target Classes Count */}
                  <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span>Assigned to {asgn.targetClassIds?.length || 0} class(es)</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Selected Assignment Details & Student Submissions */}
        <div className="lg:col-span-8 p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-6">
          {selectedAssignment ? (
            <div className="space-y-6">
              {/* Assignment Overview Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-5 border-b border-white/10">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-300 font-medium px-2.5 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30">
                      {selectedAssignment.subject}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Published: {selectedAssignment.issueDate ? new Date(selectedAssignment.issueDate).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white mt-2">{selectedAssignment.title}</h2>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed">{selectedAssignment.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Maximum Score</div>
                    <div className="text-lg font-bold font-mono text-emerald-400">{selectedAssignment.maxMarks} Pts</div>
                  </div>
                  <button
                    onClick={() => handleDeleteAssignment(selectedAssignment.id || (selectedAssignment as any)._id, selectedAssignment.title)}
                    className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
                    title="Delete Assignment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Class Distribution & Attached Files Badges */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                  <div className="text-xs font-semibold text-slate-400">Target Cohorts / Classes</div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedAssignment.targetClassIds?.map((cId) => {
                      const matched = classes.find((c) => (c.id || (c as any)._id) === cId);
                      return (
                        <span key={cId} className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-purple-200">
                          {matched ? `${matched.name} (${matched.gradeLevel})` : cId}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-black/30 border border-white/5 space-y-2">
                  <div className="text-xs font-semibold text-slate-400">Attachments ({selectedAssignment.attachments?.length || 0})</div>
                  {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedAssignment.attachments.map((att, aIdx) => (
                        <a
                          key={att.id || aIdx}
                          href={att.dataUrl || '#'}
                          download={att.name}
                          className="inline-flex items-center gap-1.5 text-[11px] text-purple-300 bg-purple-500/10 hover:bg-purple-500/20 px-2 py-1 rounded border border-purple-500/20 transition-all cursor-pointer"
                        >
                          <Paperclip className="w-3 h-3" />
                          <span className="truncate max-w-[140px]">{att.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({att.size})</span>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No attachments provided.</div>
                  )}
                </div>
              </div>

              {/* Student Submissions Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">Student Submissions &amp; Grades</h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {selectedAssignment.submissions?.length || 0} Records
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400 bg-white/[0.02]">
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Submission Status</th>
                        <th className="py-3 px-4">Submitted File</th>
                        <th className="py-3 px-4 text-right">Marks Awarded</th>
                        <th className="py-3 px-4 text-right">Review Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10">
                      {selectedAssignment.submissions && selectedAssignment.submissions.length > 0 ? (
                        selectedAssignment.submissions.map((sub: StudentSubmission, sIdx: number) => {
                          const subKey = sub.id || (sub as any)._id || sub.studentId || `sub-${sIdx}`;
                          return (
                            <tr key={subKey} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 text-white font-medium">
                                <div>{sub.studentName}</div>
                                {sub.studentNotes && (
                                  <div className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-1">
                                    "{sub.studentNotes}"
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`capitalize px-2 py-0.5 rounded text-[11px] font-medium ${
                                    sub.status === 'graded'
                                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                      : sub.status === 'reassigned'
                                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                      : sub.status === 'rejected'
                                      ? 'bg-red-500/15 text-red-300 border border-red-500/30'
                                      : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                  }`}
                                >
                                  {sub.status}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {sub.attachments && sub.attachments.length > 0 ? (
                                  <a
                                    href={sub.attachments[0].dataUrl || '#'}
                                    download={sub.attachments[0].name}
                                    className="text-purple-300 hover:underline flex items-center gap-1"
                                  >
                                    <Paperclip className="w-3 h-3 shrink-0" />
                                    <span className="truncate max-w-[120px]">{sub.attachments[0].name}</span>
                                  </a>
                                ) : (
                                  <span className="text-slate-500 text-[11px]">No file attached</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                                {sub.marksObtained !== undefined
                                  ? `${sub.marksObtained} / ${selectedAssignment.maxMarks}`
                                  : '-'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => {
                                    setReviewingTarget({ assignment: selectedAssignment, submission: sub });
                                    setReviewNotes(sub.teacherReviewNotes || '');
                                    setMarksInput(sub.marksObtained || selectedAssignment.maxMarks);
                                  }}
                                  className="px-2.5 py-1 text-xs font-semibold bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white rounded-lg transition-all cursor-pointer"
                                >
                                  Review &amp; Grade
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                            No student submissions recorded for this assignment yet. Students enrolled in target classes can view and submit assignments from their portal.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-xs text-slate-400 py-16">
              <FileText className="w-10 h-10 text-slate-500 mx-auto mb-3" />
              <p>Select an assignment from the list on the left to review submissions and grading.</p>
            </div>
          )}
        </div>
      </div>

      {/* Review & Grade Modal */}
      {reviewingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-bold text-white">Review Student Submission</h3>
                <p className="text-xs text-slate-400 mt-0.5">{reviewingTarget.submission.studentName}</p>
              </div>
              <button
                onClick={() => setReviewingTarget(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Marks Awarded (Out of {reviewingTarget.assignment.maxMarks})
              </label>
              <input
                type="number"
                min="0"
                max={reviewingTarget.assignment.maxMarks}
                value={marksInput}
                onChange={(e) => setMarksInput(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Teacher Feedback &amp; Review Remarks</label>
              <textarea
                rows={3}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Provide constructive feedback or revision requirements..."
                className="w-full px-3 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleApplyReview('accepted')}
                className="py-2 text-xs font-medium bg-purple-600/25 hover:bg-purple-600/40 text-purple-200 border border-purple-500/30 rounded-xl cursor-pointer"
              >
                Accept Work
              </button>
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleApplyReview('reassigned')}
                className="py-2 text-xs font-medium bg-amber-600/25 hover:bg-amber-600/40 text-amber-200 border border-amber-500/30 rounded-xl cursor-pointer"
              >
                Reassign Work
              </button>
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleApplyReview('rejected')}
                className="py-2 text-xs font-medium bg-red-600/25 hover:bg-red-600/40 text-red-200 border border-red-500/30 rounded-xl cursor-pointer"
              >
                Reject Work
              </button>
              <button
                type="button"
                disabled={reviewLoading}
                onClick={() => handleApplyReview('graded')}
                className="py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                {reviewLoading ? 'Saving...' : 'Finalize Grade'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Assignment Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-[#121124] rounded-2xl max-w-2xl w-full p-6 sm:p-7 border border-white/15 shadow-2xl my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-white/10 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-display">Create Multi-Class Assignment</h3>
                <p className="text-xs text-slate-400 mt-0.5">Author assignments, configure target classes, attachments, and deadlines.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Title & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assignment Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Newton's Laws Problem Set"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Academic Subject *</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Physics / Calculus"
                    className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Target Classes Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Target Cohorts / Classes * <span className="text-purple-400">({targetClassIds.length} selected)</span>
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <button
                      type="button"
                      onClick={handleSelectAllClasses}
                      className="text-purple-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-600">|</span>
                    <button
                      type="button"
                      onClick={handleClearAllClasses}
                      className="text-slate-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Selected Classes Chips */}
                {targetClassIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2.5 p-2 rounded-xl bg-purple-950/20 border border-purple-500/20 max-h-24 overflow-y-auto">
                    {targetClassIds.map((cId) => {
                      const cls = authorizedClasses.find((c) => (c.id || (c as any)._id) === cId);
                      return (
                        <span
                          key={cId}
                          className="inline-flex items-center gap-1 text-[11px] bg-purple-600/30 border border-purple-400/40 text-purple-200 px-2 py-0.5 rounded-lg"
                        >
                          <span>{cls ? `${cls.name} (${cls.gradeLevel})` : cId}</span>
                          <button
                            type="button"
                            onClick={() => handleToggleClass(cId)}
                            className="hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search Bar for Classes */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={classSearchQuery}
                    onChange={(e) => setClassSearchQuery(e.target.value)}
                    placeholder="Search classes by name or grade..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-black/40 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                {/* Classes Scrollable Checkbox List */}
                <div className="max-h-36 overflow-y-auto p-2 rounded-xl bg-black/40 border border-white/10 space-y-1">
                  {searchedClasses.length > 0 ? (
                    searchedClasses.map((cls) => {
                      const cId = cls.id || (cls as any)._id;
                      const isChecked = targetClassIds.includes(cId);
                      return (
                        <div
                          key={cId}
                          onClick={() => handleToggleClass(cId)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isChecked
                              ? 'bg-purple-600/20 text-white font-medium'
                              : 'text-slate-300 hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {}} // handled by parent div
                              className="rounded border-white/20 text-purple-600 focus:ring-0"
                            />
                            <span>{cls.name}</span>
                            <span className="text-[11px] text-slate-400">({cls.gradeLevel} - {cls.section || 'General'})</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {cls.studentIds?.length || 0} students
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-3 text-xs text-slate-500">
                      No matching classes found.
                    </div>
                  )}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assignment Instructions / Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Provide instructions, rubric, and problem questions for the students..."
                  className="w-full px-3.5 py-2 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* Dates & Maximum Marks */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Deadline / Due Date *</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Maximum Marks *</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs bg-black/40 border border-white/15 rounded-xl text-white font-mono focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* File Attachment Uploader */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Attach Documents / Reference Material</label>
                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-medium text-purple-300 cursor-pointer flex items-center gap-2 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Attachment</span>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.zip,image/*"
                    />
                  </label>
                  <span className="text-[11px] text-slate-500">Supports PDF, Word, Excel, Images (Max 10MB)</span>
                </div>

                {attachments.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="inline-flex items-center gap-2 text-xs bg-black/40 border border-white/10 text-white px-3 py-1.5 rounded-xl"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate max-w-[150px]">{att.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">({att.size})</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="text-slate-400 hover:text-red-400 ml-1"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end items-center gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl hover:bg-white/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Publishing Assignment...</span>
                    </>
                  ) : (
                    <span>Publish Assignment</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
