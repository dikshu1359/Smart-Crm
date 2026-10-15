import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useApp } from '../context/AppContext';

export const PerformanceAnalytics: React.FC = () => {
  const { activeTenant, currentUser } = useApp();

  const allSubs = activeTenant.assignments.flatMap((a) =>
    a.submissions
      .filter((s) => (currentUser.role === 'student' ? s.studentId === currentUser.id : true))
      .map((s) => ({
        ...s,
        percentage: typeof s.marksObtained === 'number' ? Math.round((s.marksObtained / a.maxMarks) * 100) : null,
      }))
  );

  const gradedSubs = allSubs.filter((s) => s.status === 'graded' && typeof s.percentage === 'number');

  const gradeBuckets = [
    { band: 'A+ (90-100%)', count: gradedSubs.filter((s) => (s.percentage || 0) >= 90).length },
    { band: 'A (80-89%)', count: gradedSubs.filter((s) => (s.percentage || 0) >= 80 && (s.percentage || 0) < 90).length },
    { band: 'B (70-79%)', count: gradedSubs.filter((s) => (s.percentage || 0) >= 70 && (s.percentage || 0) < 80).length },
    { band: '< 70%', count: gradedSubs.filter((s) => (s.percentage || 0) < 70).length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white font-display">Performance Analytics</h1>
        <p className="text-xs text-slate-400 mt-1">Grade distributions and academic completion tracking.</p>
      </div>

      <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10">
        <h2 className="text-base font-bold text-white mb-4">Grade Distribution</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gradeBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="band" stroke="#94A3B8" fontSize={11} />
              <YAxis stroke="#94A3B8" fontSize={11} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#141124',
                  borderColor: 'rgba(168,85,247,0.4)',
                  color: '#fff',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="count" fill="#A855F7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
