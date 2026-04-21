import React, { useState, useEffect } from 'react';
import { Server, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import api from '../services/api';

export const Providers = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/admin/providers');
        setProviders(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Provider Health</h1>
        <p className="text-slate-500 mt-1">Live routing performance</p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {loading ? (
          <div className="col-span-1 md:col-span-2 p-8 text-center text-slate-400">
            Loading providers...
          </div>

        ) : providers.length === 0 ? (
          <div className="col-span-1 md:col-span-2 p-8 text-center text-slate-400">
            No providers found.
          </div>

        ) : (
          providers.map((prov, idx) => (
            <div
              key={prov._id || prov.name || prov.provider || idx}
              className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden group"
            >
              
              {/* Top Section */}
              <div className="flex justify-between items-start mb-6">
                
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100 group-hover:scale-105 transition-transform">
                    <Server className="w-6 h-6" />
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-slate-800 uppercase tracking-wide">
                      {prov.name || prov.provider || 'UNKNOWN'}
                    </h3>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full inline-block mt-1 ${
                        prov.status === 'HEALTHY'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {prov.status || 'UNKNOWN'}
                    </span>
                  </div>
                </div>

                {/* Success Rate */}
                <div
                  className={`flex items-center text-sm font-bold ${
                    prov.trend === 'down'
                      ? 'text-red-500'
                      : 'text-emerald-500'
                  }`}
                >
                  {prov.trend === 'down' ? (
                    <ArrowDownRight className="w-4 h-4 mr-1" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 mr-1" />
                  )}
                  {Number(prov.successRate || 0).toFixed(2)}%
                </div>
              </div>

              {/* Latency */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
                <div className="flex items-center text-sm text-slate-500 font-medium">
                  <Activity className="w-4 h-4 mr-2" /> Live Latency
                </div>
                <span className="text-sm font-mono font-semibold text-slate-700">
                  {prov.latency || 'N/A'}
                </span>
              </div>

              {/* Background Glow */}
              <div
                className={`absolute -right-6 -bottom-6 w-32 h-32 rounded-full opacity-5 blur-2xl ${
                  prov.status === 'HEALTHY'
                    ? 'bg-emerald-500'
                    : 'bg-red-500'
                }`}
              ></div>
            </div>
          ))
        )}

      </div>
    </div>
  );
};