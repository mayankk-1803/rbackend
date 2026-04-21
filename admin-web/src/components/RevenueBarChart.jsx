import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

export const RevenueBarChart = ({ dailyRevenue = [] }) => {
  // Format the date strings to be more readable
  const formattedData = dailyRevenue.map(item => ({
    ...item,
    formattedDate: item.date ? format(parseISO(item.date), 'MMM dd') : '',
  }));

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 shadow-slate-200/50 w-full h-[400px]">
      <h3 className="text-lg font-bold text-slate-800 mb-4">Daily Revenue Trends</h3>
      <ResponsiveContainer width="100%" height="80%">
        <BarChart
          data={formattedData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="formattedDate" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b' }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b' }} 
            tickFormatter={(value) => `₹${value}`} 
          />
          <Tooltip 
             formatter={(value) => [`₹${new Intl.NumberFormat('en-IN').format(value)}`, 'Revenue']}
             labelFormatter={(label) => `Date: ${label}`}
             cursor={{ fill: '#f8fafc' }}
             contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
