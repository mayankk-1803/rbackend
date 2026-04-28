import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const TransactionsPieChart = ({ success = 0, pending = 0, failed = 0 }) => {
  const data = [
    { name: 'SUCCESS', value: success },
    { name: 'PENDING', value: pending },
    { name: 'FAILED', value: failed },
  ].filter(d => d.value > 0); // Only show non-zero statuses

  // If no data, show a placeholder
  if (data.length === 0) {
    return <div className="text-slate-400 text-xs font-medium">No transactions in last 7 days</div>;
  }

  const COLORS = {
    SUCCESS: '#22c55e', // Green
    PENDING: '#f59e0b', // Yellow
    FAILED: '#ef4444',  // Red
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
        >
          {data.map((entry, index) => (
             <Cell key={`cell-${index}`} fill={COLORS[entry.name]} />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => new Intl.NumberFormat('en-IN').format(value)}
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
        />
        <Legend verticalAlign="bottom" height={36}/>
      </PieChart>
    </ResponsiveContainer>
  );
};
