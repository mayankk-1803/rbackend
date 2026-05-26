import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  BarChart3, 
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import api from '../../services/api';

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  return (
    <div className="bg-[var(--card-bg)] p-3 rounded-xl shadow-medium text-xs border border-[var(--border-soft)]">
      <p className="font-bold text-[var(--text-primary)] mb-1">Date: {new Date(label).toLocaleDateString()}</p>
      <p className="text-[var(--color-primary)] font-bold">Requests: {payload[0].value}</p>
    </div>
  );
};

export default function ApiAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/developer/analytics');
        setData(res.data.data);
      } catch (err) {
        console.error("Failed to fetch analytics");
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="w-8 h-8 border-3 border-[var(--color-primary-glow)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
    </div>
  );

  const stats = [
    { name: 'Total Requests', value: data?.totalRequests || 0, icon: Activity, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary-glow)]' },
    { name: 'Success Rate', value: `${(data?.successRate || 100).toFixed(1)}%`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { name: 'Avg Latency', value: '124ms', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { name: 'Status: 2xx', value: data?.totalRequests || 0, icon: TrendingUp, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary-glow)]' }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border-soft)] shadow-soft"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded">+12.4%</div>
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">{stat.value}</h3>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{stat.name}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Traffic Chart */}
      <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
           <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">Traffic Overview</h3>
              <p className="text-[10px] text-[var(--text-secondary)] font-medium mt-0.5">Global API request volume over the last 7 days</p>
           </div>
           <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl self-start sm:self-auto">
              <Activity className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">Real-time Data</span>
           </div>
        </div>

        <div className="w-full h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.activity || []}>
              <defs>
                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
              <XAxis 
                dataKey="createdAt" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 600, fill: 'var(--text-secondary)' }} 
                tickFormatter={(str) => new Date(str).toLocaleDateString()}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 9, fontWeight: 600, fill: 'var(--text-secondary)' }} 
              />
              <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: 'var(--border-soft)', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area 
                type="monotone" 
                dataKey="_count.id" 
                stroke="#10B981" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#colorTraffic)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         {/* Success Rate Chart */}
         <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <h3 className="text-base font-bold text-[var(--text-primary)] mb-6">Performance Index</h3>
            <div className="w-full h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.activity || []}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" />
                   <XAxis 
                    dataKey="createdAt" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 8, fontWeight: 600, fill: 'var(--text-secondary)' }} 
                    tickFormatter={(str) => new Date(str).toLocaleDateString()}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 8, fontWeight: 600, fill: 'var(--text-secondary)' }} 
                  />
                  <Bar dataKey="_avg.latency" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider mt-4">
              Average response latency (ms) per interval
            </p>
         </div>

         {/* Security Alerts */}
         <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-base font-bold text-[var(--text-primary)]">Security Audit</h3>
               <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
            </div>
            <div className="space-y-3.5">
               {[
                 { msg: 'Unauthorized API attempt detected', time: '2 mins ago', level: 'HIGH' },
                 { msg: 'API Key rotation recommended', time: '1 hour ago', level: 'MEDIUM' },
                 { msg: 'Rate limit threshold reached', time: '5 hours ago', level: 'LOW' }
               ].map((audit, i) => (
                 <div key={i} className="flex items-center justify-between p-3.5 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--border-soft)]">
                    <div className="space-y-1">
                       <p className="text-xs font-bold text-[var(--text-primary)]">{audit.msg}</p>
                       <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{audit.time}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                      audit.level === 'HIGH' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' : 
                      audit.level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-soft)]'
                    }`}>
                      {audit.level}
                    </span>
                 </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}
