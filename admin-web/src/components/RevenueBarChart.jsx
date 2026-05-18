import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  
  return (
    <div className="bg-white p-3 rounded-lg shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1)] text-xs border border-slate-100">
      <p className="font-bold text-slate-700 mb-1">Date: {label}</p>
      <p className="text-blue-500 font-medium">Revenue: ₹{new Intl.NumberFormat('en-IN').format(payload[0].value)}</p>
    </div>
  );
};

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
    <div className="w-full h-full min-h-[250px]">
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
