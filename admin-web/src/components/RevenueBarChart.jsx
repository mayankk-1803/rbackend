import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  
  return (
    <div className="bg-[var(--card-bg)] p-3 rounded-xl shadow-soft text-xs border border-[var(--border-soft)]">
      <p className="font-semibold text-[var(--text-primary)] mb-1">Date: {label}</p>
      <p className="text-[var(--color-primary)] font-bold">Revenue: ₹{new Intl.NumberFormat('en-IN').format(payload[0].value)}</p>
    </div>
  );
};

export const RevenueBarChart = ({ dailyRevenue = [] }) => {
  if (!dailyRevenue || dailyRevenue.length === 0) {
    return <div className="text-[var(--text-muted)] text-xs font-medium py-10 text-center">No revenue data in last 7 days</div>;
  }

  const formattedData = dailyRevenue.map(item => ({
    ...item,
    formattedDate: item.date ? format(parseISO(item.date), 'MMM dd') : '',
  }));

  return (
    <div className="w-full h-full min-h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={formattedData}
          margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
          <XAxis 
            dataKey="formattedDate" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} 
            dy={8} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} 
            tickFormatter={(value) => `₹${value}`} 
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--accent-hover)' }} />
          <Bar dataKey="revenue" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
