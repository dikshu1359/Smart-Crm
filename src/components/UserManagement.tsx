import React, { useState } from 'react';
import { UserPlus, Trash2, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const UserManagement: React.FC = () => {
  const { activeTenant, createUser, deleteUser } = useApp();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'teacher' | 'student'>('student');

  const filteredUsers = activeTenant.users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return !q || u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q);
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !username || !email) return;
    createUser({
      fullName,
      username: username.toLowerCase().trim(),
      email,
      role,
      phone: '+1 (555) 000-0000',
    });
    setFullName('');
    setUsername('');
    setEmail('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">User Directory &amp; RBAC</h1>
          <p className="text-xs text-slate-400 mt-1">Manage institutional faculty and students.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-500 cursor-pointer"
        >
          + Add User
        </button>
      </div>

      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="py-2.5 pr-4">User</th>
              <th className="py-2.5 px-4">Role</th>
              <th className="py-2.5 px-4">Email</th>
              <th className="py-2.5 pl-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td className="py-3 pr-4 font-semibold text-white">{u.fullName}</td>
                <td className="py-3 px-4 uppercase text-purple-300 font-mono">{u.role}</td>
                <td className="py-3 px-4 text-slate-300 font-mono">{u.email}</td>
                <td className="py-3 pl-4 text-right">
                  <button onClick={() => deleteUser(u.id)} className="text-slate-400 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#141124] rounded-2xl max-w-md w-full p-6 border border-white/15">
            <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
              <h3 className="text-base font-bold text-white">Add User</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['student', 'teacher'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-1.5 text-xs capitalize rounded-xl ${role === r ? 'bg-purple-600 text-white' : 'bg-black/40 text-slate-400'}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-black/40 border border-white/15 rounded-xl text-white"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-3 py-1.5 text-xs text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-xl">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
