import React, { useState } from 'react';
import { Bell, Plus, CheckCircle2, Trash2, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const NoticeCommunication: React.FC = () => {
  const { activeTenant, currentUser, createNotice, deleteNotice, markNoticeRead } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const visibleNotices = activeTenant.notices.filter(
    (n) => currentUser.role === 'admin' || n.targetRole === 'all' || n.targetRole === currentUser.role
  );

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !content) return;
    createNotice({
      title,
      content,
      category: 'Institutional',
      targetRole: 'all',
    });
    setTitle('');
    setContent('');
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Notice &amp; Communication Broadcasts</h1>
          <p className="text-xs text-slate-400 mt-1">Role-targeted announcements with unread indicators.</p>
        </div>
        {(currentUser.role === 'admin' || currentUser.role === 'teacher') && (
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-500 cursor-pointer"
          >
            + Broadcast Notice
          </button>
        )}
      </div>

      <div className="space-y-4">
        {visibleNotices.map((n) => {
          const isRead = n.readByUserIds.includes(currentUser.id);
          return (
            <div key={n.id} className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-start gap-4">
              <div className="space-y-2 flex-1">
                <div className="text-xs text-purple-300 font-medium">
                  {n.category} &middot; By {n.authorName} &middot; {new Date(n.createdAt).toLocaleDateString()}
                  {!isRead && <span className="ml-2 text-pink-400 font-bold">(Unread)</span>}
                </div>
                <h2 className="text-base font-bold text-white">{n.title}</h2>
                <p className="text-xs text-slate-300">{n.content}</p>
              </div>
              <div className="flex items-center gap-2">
                {!isRead && (
                  <button
                    onClick={() => markNoticeRead(n.id)}
                    className="px-2.5 py-1 text-xs bg-purple-600/30 text-purple-200 rounded-lg"
                  >
                    Mark Read
                  </button>
                )}
                {currentUser.role === 'admin' && (
                  <button onClick={() => deleteNotice(n.id)} className="text-slate-400 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white">Broadcast Notice</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handlePublish} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Headline</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Content</label>
                <textarea
                  rows={3}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-3 py-1.5 text-xs text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl">
                  Publish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
