import React from 'react';
import { useApp } from '../context/AppContext';
import { UserCircle } from 'lucide-react';

export const ProfileView: React.FC = () => {
  const { activeTenant, currentUser } = useApp();
  if (!activeTenant || !currentUser) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Personal Profile &amp; Role Details</h1>
        <p className="text-xs text-slate-400 mt-1">Tenant database bindings and credentials.</p>
      </div>

      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-300 font-bold">
            <UserCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{currentUser.fullName}</h2>
            <div className="text-xs text-slate-400 font-mono">@{currentUser.username} &middot; {currentUser.email}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 text-xs">
          <div>
            <span className="text-slate-400 block">RBAC Role</span>
            <span className="font-semibold text-white uppercase font-mono">{currentUser.role}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Active Database</span>
            <span className="font-mono text-purple-300">{currentUser.databaseName}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Institution</span>
            <span className="text-white">{activeTenant.institutionName}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Phone</span>
            <span className="text-white font-mono">{currentUser.phone}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
