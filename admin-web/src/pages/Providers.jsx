import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ShieldCheck, Globe, CheckCircle2, AlertCircle, XCircle, Settings, ChevronRight } from 'lucide-react';

export const Providers = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [primaryProvider, setPrimaryProvider] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/providers');
      const fetchedProviders = Array.isArray(data?.data) ? data.data : [];
      setProviders(fetchedProviders);
      
      const active = fetchedProviders.filter(p => p.isActive).sort((a, b) => a.priority - b.priority);
      setSelectedProviders(active.map(p => p.code));
      if (active.length > 0) {
        setPrimaryProvider(active[0].code);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleToggleSelect = (code) => {
    let newSelected = [...selectedProviders];
    if (newSelected.includes(code)) {
      newSelected = newSelected.filter(c => c !== code);
      if (primaryProvider === code) {
        setPrimaryProvider(newSelected.length > 0 ? newSelected[0] : null);
      }
    } else {
      newSelected.push(code);
      if (!primaryProvider) setPrimaryProvider(code);
    }
    setSelectedProviders(newSelected);
  };

  const handleSetPrimary = (e, code) => {
    e.stopPropagation();
    if (!selectedProviders.includes(code)) {
      setSelectedProviders([...selectedProviders, code]);
    }
    setPrimaryProvider(code);
  };

  const handleSaveSelection = async () => {
    if (selectedProviders.length === 0) return toast.error("At least one provider must be selected");
    if (!primaryProvider) return toast.error("A Primary provider must be set");

    setSaving(true);
    const loadingToast = toast.loading("Deploying routing configuration...");
    try {
      await api.post('/admin/providers/set-active', { selectedProviders, primaryProvider });
      toast.success("Active cluster updated!", { id: loadingToast });
      fetchProviders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Deployment failed", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'DEGRADED': return <AlertCircle className="w-4 h-4 text-amber-400" />;
      case 'DOWN': return <XCircle className="w-4 h-4 text-rose-400" />;
      default: return <AlertCircle className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10"
    >
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white/5 backdrop-blur-2xl p-6 md:p-8 rounded-2xl md:rounded-[2.5rem] border border-white/10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-purple-500/5 to-transparent"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-4 h-4 md:w-5 md:h-5 text-purple-400" />
            <h1 className="text-xl md:text-3xl font-black text-white tracking-tighter uppercase italic">API Routing <span className="text-purple-400 text-shadow-glow">Engine</span></h1>
          </div>
          <p className="text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Configuring active failover and primary execution sequence</p>
        </div>
        <button 
          onClick={handleSaveSelection}
          disabled={saving || loading || selectedProviders.length === 0}
          className="relative z-10 w-full lg:w-auto bg-purple-500 hover:bg-purple-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:shadow-[0_0_30px_rgba(168,85,247,0.5)] transition-all px-8 py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
        >
          {saving ? 'Syncing...' : 'Save Configuration'}
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-white/5 animate-pulse rounded-[2.5rem] border border-white/5"></div>
          ))
        ) : (
          providers.map((prov) => {
            const isSelected = selectedProviders.includes(prov.code);
            const isPrimary = primaryProvider === prov.code;

            return (
              <motion.div 
                key={prov.id}
                whileHover={{ y: -5 }}
                onClick={() => handleToggleSelect(prov.code)}
                className={`relative cursor-pointer rounded-[2.5rem] border backdrop-blur-3xl transition-all duration-500 overflow-hidden flex flex-col justify-between group ${
                  isSelected 
                    ? 'bg-white/10 border-purple-500/30 shadow-[0_0_40px_rgba(139,92,246,0.1)]' 
                    : 'bg-white/[0.02] border-white/5 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 hover:bg-white/5'
                }`}
              >
                <div className="p-8">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                        isSelected ? 'bg-purple-500 border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-transparent border-slate-700'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2 group-hover:text-purple-400 transition-colors">
                          {prov.name}
                          {getStatusIcon(prov.healthStatus)}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-1">{prov.code}</p>
                      </div>
                    </div>
                    {isSelected && !isPrimary && (
                      <span className="px-3 py-1 bg-amber-500/10 text-amber-500 text-[8px] font-black rounded-lg border border-amber-500/20 uppercase tracking-widest">Backup</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5 group-hover:border-white/10 transition-colors">
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        Success
                      </div>
                      <div className="text-xl font-black text-white">{Number(prov.successRate || 0).toFixed(1)}%</div>
                    </div>
                    <div className="bg-black/40 rounded-2xl p-4 border border-white/5 group-hover:border-white/10 transition-colors">
                      <div className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                        Latency
                      </div>
                      <div className="text-xl font-black text-white">{prov.avgResponseTime || '120'}ms</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <span className="px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Secure</span>
                    <span className="px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">Global</span>
                  </div>
                </div>

                <div className={`px-8 py-6 border-t flex justify-between items-center transition-all ${
                  isSelected ? 'bg-white/5 border-purple-500/20' : 'bg-black/20 border-white/5'
                }`}>
                  {isSelected ? (
                    isPrimary ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full text-center py-3 bg-purple-500/20 text-purple-400 text-[9px] font-black tracking-[0.2em] uppercase rounded-xl border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                      >
                        🌟 Primary API
                      </motion.div>
                    ) : (
                      <button 
                        onClick={(e) => handleSetPrimary(e, prov.code)}
                        className="w-full text-center py-3 bg-white/5 border border-white/10 text-white text-[9px] font-black tracking-[0.2em] uppercase rounded-xl hover:bg-white/10 hover:border-purple-500/40 transition-all flex items-center justify-center gap-2"
                      >
                        Promote to Primary <ChevronRight className="w-3 h-3" />
                      </button>
                    )
                  ) : (
                    <div className="w-full text-center py-3 text-slate-700 text-[9px] font-black tracking-[0.2em] uppercase">
                      Inactive Node
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );
};
