import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  
  return (
    <div className="bg-[var(--card-bg)] p-3 rounded-xl shadow-soft text-xs border border-[var(--border-soft)]">
      <p className="font-semibold text-[var(--text-primary)]">{payload[0].name}</p>
      <p className="text-[var(--text-secondary)] mt-1 font-bold">{new Intl.NumberFormat('en-IN').format(payload[0].value)} txns</p>
    </div>
  );
};

export const TransactionsPieChart = ({ success = 0, pending = 0, failed = 0 }) => {
  const data = [
    { name: 'SUCCESS', value: success },
    { name: 'PENDING', value: pending },
    { name: 'FAILED', value: failed },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return <div className="text-[var(--text-muted)] text-xs font-medium py-10 text-center">No transactions in last 7 days</div>;
  }

  const COLORS = {
    SUCCESS: '#10B981', // Mint green
    PENDING: '#F59E0B', // Amber
    FAILED: '#EF4444',  // Red
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
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
               <Cell key={`cell-${index}`} fill={COLORS[entry.name]} stroke="var(--card-bg)" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            verticalAlign="bottom" 
            height={36} 
            formatter={(value) => <span className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-wider">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};
