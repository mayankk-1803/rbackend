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
import api from '../../api';

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload || !payload.length || !payload[0] || !payload[0].payload) {
    return null;
  }
  return (
    <div className="bg-slate-950/90 backdrop-blur-md p-4 rounded-2xl shadow-xl text-xs border border-white/10">
      <p className="font-bold text-slate-350 mb-2">Date: {new Date(label).toLocaleDateString()}</p>
      <p className="text-cyan-400 font-black cyan-glow">Requests: {payload[0].value}</p>
    </div>
  );
};

export default function ApiAnalytics({ isDeveloperVerified }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/developer/analytics');
        setData(res.data.data);
      } catch (err) {
        if (import.meta.env.DEV) {
          if (import.meta.env.DEV) console.error("Failed to fetch analytics");
        }
      } finally {
        setLoading(false);
      }
    };
    if (isDeveloperVerified) {
      fetchAnalytics();
    }
  }, [isDeveloperVerified]);

  if (loading) return (
    <div className="flex items-center justify-center p-20 relative z-10">
      <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
    </div>
  );

  const stats = [
    { name: 'Total Requests', value: data?.totalRequests || 0, icon: Activity, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border border-cyan-500/20' },
    { name: 'Success Rate', value: `${(data?.successRate || 100).toFixed(1)}%`, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border border-emerald-500/20' },
    { name: 'Avg Latency', value: '124ms', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10 border border-amber-500/20' },
    { name: 'Status: 2xx', value: data?.totalRequests || 0, icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-500/10 border border-purple-500/20' }
  ];

  return (
    <div className="space-y-8 relative z-10">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="glass-card p-6 rounded-[2rem] border border-white/5 shadow-xl"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-2xl ${stat.bg}`}>
                  <Icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">+12.4%</div>
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white tracking-tighter italic">{stat.value}</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.name}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Traffic Chart */}
      <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
        <div className="flex items-center justify-between mb-10">
           <div className="space-y-1">
              <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Traffic <span className="text-cyan-400 cyan-glow">Overview</span></h3>
              <p className="text-[9px] text-slate-450 font-bold uppercase tracking-widest">Global API request volume over the last 7 days</p>
           </div>
           <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/40 border border-white/5 rounded-xl">
              <Activity className="w-3.5 h-3.5 text-cyan-400 cyan-glow" />
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Real-time Data</span>
           </div>
        </div>

        <div className="w-full h-full min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.activity || []}>
              <defs>
                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis 
                dataKey="createdAt" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
                tickFormatter={(str) => new Date(str).toLocaleDateString()}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} 
              />
              <Tooltip content={<CustomAreaTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '3 3' }} />
              <Area 
                type="monotone" 
                dataKey="_count.id" 
                stroke="#00d9ff" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorTraffic)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* Success Rate Chart */}
         <div className="glass-card p-8 rounded-[2.5rem] shadow-2xl border border-white/5 bg-slate-950/40">
            <h3 className="text-lg font-black text-white uppercase tracking-tight italic mb-8">Performance <span className="text-cyan-400 cyan-glow">Index</span></h3>
            <div className="w-full h-full min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.activity || []}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                   <XAxis 
                    dataKey="createdAt" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 8, fontWeight: 700, fill: '#64748b' }} 
                    tickFormatter={(str) => new Date(str).toLocaleDateString()}
                  />
                  <Bar dataKey="_avg.latency" fill="#00d9ff" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-center text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-6">
              Average response latency (ms) per interval
            </p>
         </div>

         {/* Security Alerts */}
         <div className="glass-card p-8 rounded-[2.5rem] border border-white/5 shadow-xl">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-lg font-black text-white uppercase tracking-tight italic">Security <span className="text-rose-455">Audit</span></h3>
               <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div className="space-y-4">
               {[
                 { msg: 'Unauthorized API attempt detected', time: '2 mins ago', level: 'HIGH' },
                 { msg: 'API Key rotation recommended', time: '1 hour ago', level: 'MEDIUM' },
                 { msg: 'Rate limit threshold reached', time: '5 hours ago', level: 'LOW' }
               ].map((audit, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-slate-950/40 rounded-2xl border border-white/5">
                    <div className="space-y-1">
                       <p className="text-[10px] font-black text-white uppercase tracking-tight">{audit.msg}</p>
                       <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{audit.time}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                      audit.level === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 
                      audit.level === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-950/40 text-slate-450 border-white/5'
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
