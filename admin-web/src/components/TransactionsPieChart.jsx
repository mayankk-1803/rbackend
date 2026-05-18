import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  
  return (
    <div className="bg-white p-3 rounded-lg shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1)] text-xs border border-slate-100">
      <p className="font-bold text-slate-700">{payload[0].name}</p>
      <p className="text-slate-600 mt-1">{new Intl.NumberFormat('en-IN').format(payload[0].value)}</p>
    </div>
  );
};

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
    <div className="w-full h-full min-h-[250px]">
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
          <Tooltip content={<CustomTooltip />} />
          <Legend verticalAlign="bottom" height={36}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
