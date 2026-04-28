import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

export const RevenueBarChart = ({ dailyRevenue = [] }) => {
  // If no data, show a placeholder
  if (!dailyRevenue || dailyRevenue.length === 0) {
    return <div className="text-slate-400 text-xs font-medium">No revenue data in last 7 days</div>;
  }

  // Format the date strings to be more readable
  const formattedData = dailyRevenue.map(item => ({
    ...item,
    formattedDate: item.date ? format(parseISO(item.date), 'MMM dd') : '',
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={formattedData}
        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis 
          dataKey="formattedDate" 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 10 }} 
          dy={10} 
        />
        <YAxis 
          axisLine={false} 
          tickLine={false} 
          tick={{ fill: '#64748b', fontSize: 10 }} 
          tickFormatter={(value) => `₹${value}`} 
        />
        <Tooltip 
           formatter={(value) => [`₹${new Intl.NumberFormat('en-IN').format(value)}`, 'Revenue']}
           labelFormatter={(label) => `Date: ${label}`}
           cursor={{ fill: '#f8fafc' }}
           contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
        />
        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
      </BarChart>
    </ResponsiveContainer>
  );
};
