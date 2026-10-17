import React, { useState } from 'react';
import { Database, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { InstitutionRegistry, AuditLogEntry } from '../types/crm';

export const TenantDatabaseConsole: React.FC = () => {
  const { institutions, activeTenant, deleteTenant } = useApp();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Multi-Tenant Database Manager</h1>
        <p className="text-xs text-slate-400 mt-1">Master database registry tracking isolated tenant stores.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {institutions.map((inst: InstitutionRegistry) => {
          const isCurrent = activeTenant?.databaseName === inst.databaseName;
          return (
            <div key={inst.id} className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono text-purple-300">{inst.databaseName}</div>
                <h2 className="text-lg font-bold text-white mt-1">{inst.institutionName}</h2>
                <div className="text-xs text-slate-400 mt-1">Admin: {inst.adminName} (@{inst.adminUsername})</div>
                <div className="mt-4 pt-3 border-t border-white/10 text-xs font-mono text-slate-300">
                  Status: {inst.status} &middot; Created: {new Date(inst.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex justify-between items-center mt-6 pt-3 border-t border-white/10">
                <span className={`px-3 py-1 text-xs rounded-lg ${isCurrent ? 'bg-purple-600 text-white' : 'bg-white/10 text-slate-300'}`}>
                  {isCurrent ? 'Active DB' : 'Connected Registry'}
                </span>
                {institutions.length > 1 && (
                  <button
                    onClick={() => deleteTenant(inst.databaseName)}
                    className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    Delete DB
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AuditLogConsole: React.FC = () => {
  const { auditLogs } = useApp();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Activity &amp; Audit Logs</h1>
          <p className="text-xs text-slate-400 mt-1">Tracking operations and system audit records.</p>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-slate-400">
              <th className="py-2.5 pr-4">Timestamp</th>
              <th className="py-2.5 px-4">Actor</th>
              <th className="py-2.5 px-4">Action</th>
              <th className="py-2.5 pl-4 text-right">IP &amp; Client</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {auditLogs.map((log: AuditLogEntry, idx: number) => {
              const logKey = log.id || (log as any)._id || `log-${idx}`;
              return (
                <tr key={logKey}>
                  <td className="py-3 pr-4 font-mono text-slate-300">{new Date(log.timestamp).toLocaleTimeString()}</td>
                  <td className="py-3 px-4 font-medium text-white">{log.actorName}</td>
                  <td className="py-3 px-4 text-slate-200">[{log.actionCategory}] {log.description}</td>
                  <td className="py-3 pl-4 text-right font-mono text-slate-400">{log.ipAddress}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
