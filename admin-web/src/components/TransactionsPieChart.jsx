import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const TransactionsPieChart = ({ success = 0, pending = 0, failed = 0 }) => {
  const data = [
    { name: 'SUCCESS', value: success },
    { name: 'PENDING', value: pending },
    { name: 'FAILED', value: failed },
  ];

  // Specific colors mapped directly mapping to status
  const COLORS = {
    SUCCESS: '#22c55e', // Green
    PENDING: '#f59e0b', // Yellow
    FAILED: '#ef4444',  // Red
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 shadow-slate-200/50 w-full h-[400px]">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Transaction Status</h3>
      <ResponsiveContainer width="100%" height="80%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
               <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => new Intl.NumberFormat('en-IN').format(value)}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
