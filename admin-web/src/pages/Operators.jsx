import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ShieldCheck, Globe, CheckCircle2, AlertCircle, XCircle, Settings, ChevronRight } from 'lucide-react';

export const Operators = () => {
  const [providers, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [primaryOperator, setPrimaryOperator] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchOperators = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/providers');
      const fetchedOperators = Array.isArray(data?.data) ? data.data : [];
      setOperators(fetchedOperators);
      
      const active = fetchedOperators.filter(p => p.isActive).sort((a, b) => a.priority - b.priority);
      setSelectedOperators(active.map(p => p.code));
      if (active.length > 0) {
        setPrimaryOperator(active[0].code);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const handleToggleSelect = (code) => {
    let newSelected = [...selectedOperators];
    if (newSelected.includes(code)) {
      newSelected = newSelected.filter(c => c !== code);
      if (primaryOperator === code) {
        setPrimaryOperator(newSelected.length > 0 ? newSelected[0] : null);
      }
    } else {
      newSelected.push(code);
      if (!primaryOperator) setPrimaryOperator(code);
    }
    setSelectedOperators(newSelected);
  };

  const handleSetPrimary = (e, code) => {
    e.stopPropagation();
    if (!selectedOperators.includes(code)) {
      setSelectedOperators([...selectedOperators, code]);
    }
    setPrimaryOperator(code);
  };

  const handleSaveSelection = async () => {
    if (selectedOperators.length === 0) return toast.error("At least one provider must be selected");
    if (!primaryOperator) return toast.error("A Primary provider must be set");

    setSaving(true);
    const loadingToast = toast.loading("Deploying routing configuration...");
    try {
      await api.post('/admin/providers/set-active', { selectedOperators, primaryOperator });
      toast.success("Active cluster updated!", { id: loadingToast });
      fetchOperators();
    } catch (err) {
      toast.error(err.response?.data?.message || "Deployment failed", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'HEALTHY': return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case 'DEGRADED': return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      case 'DOWN': return <XCircle className="w-3.5 h-3.5 text-rose-500" />;
      default: return <AlertCircle className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Settings className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">API Routing <span className="text-[var(--color-primary)]">Engine</span></h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Configuring active failover and primary execution sequence</p>
        </div>
        <button 
          onClick={handleSaveSelection}
          disabled={saving || loading || selectedOperators.length === 0}
          className="w-full lg:w-auto bg-[var(--color-primary)] text-[var(--bg-primary)] shadow-sm transition-all px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-30 cursor-pointer"
        >
          {saving ? 'Syncing...' : 'Save Configuration'}
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="h-64 bg-[var(--bg-secondary)] animate-pulse rounded-xl border border-[var(--border-soft)]"></div>
          ))
        ) : (
          providers.map((prov) => {
            const isSelected = selectedOperators.includes(prov.code);
            const isPrimary = primaryOperator === prov.code;

            return (
              <motion.div 
                key={prov.id}
                whileHover={{ y: -2 }}
                onClick={() => handleToggleSelect(prov.code)}
                className={`cursor-pointer rounded-xl border transition-all duration-300 overflow-hidden flex flex-col justify-between group ${
                  isSelected 
                    ? 'bg-[var(--card-bg)] border-[var(--color-primary)] shadow-soft' 
                    : 'bg-[var(--bg-secondary)]/50 border-[var(--border-soft)] opacity-40 grayscale hover:opacity-90 hover:grayscale-0 hover:bg-[var(--card-bg)]'
                }`}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-all ${
                        isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)] shadow-sm' : 'bg-transparent border-[var(--border-soft)]'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--bg-primary)]" />}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-1.5 group-hover:text-[var(--color-primary)] transition-colors">
                          {prov.name}
                          {getStatusIcon(prov.healthStatus)}
                        </h3>
                        <p className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider mt-0.5">{prov.code}</p>
                      </div>
                    </div>
                    {isSelected && !isPrimary && (
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[8px] font-bold rounded border border-amber-500/20 uppercase tracking-wider">Backup</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-[var(--bg-secondary)]/40 rounded-xl p-3 border border-[var(--border-soft)]">
                      <div className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-1">
                        Success
                      </div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{Number(prov.successRate || 0).toFixed(1)}%</div>
                    </div>
                    <div className="bg-[var(--bg-secondary)]/40 rounded-xl p-3 border border-[var(--border-soft)]">
                      <div className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-1">
                        Latency
                      </div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{prov.avgResponseTime || '120'}ms</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-[var(--color-primary-glow)] rounded-xl p-3 border border-[var(--border-soft)]">
                      <div className="text-[9px] text-[var(--color-primary)] font-semibold uppercase tracking-wider mb-1">
                        Balance
                      </div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">₹{Number(prov.balance || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
                      <div className="text-[9px] text-rose-500 font-semibold uppercase tracking-wider mb-1">
                        Failures
                      </div>
                      <div className="text-lg font-bold text-[var(--text-primary)]">{prov.failureCount || 0}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Secure</span>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-soft)]">Global</span>
                  </div>
                </div>

                <div className={`px-6 py-4 border-t border-[var(--border-soft)] flex justify-between items-center transition-all ${
                  isSelected ? 'bg-[var(--bg-secondary)]/30' : 'bg-[var(--bg-secondary)]'
                }`}>
                  {isSelected ? (
                    isPrimary ? (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full text-center py-2 bg-[var(--color-primary-glow)] text-[var(--color-primary)] text-[9px] font-bold tracking-wider uppercase rounded-xl border border-[var(--border-soft)]"
                      >
                        🌟 Primary API
                      </motion.div>
                    ) : (
                      <button 
                        onClick={(e) => handleSetPrimary(e, prov.code)}
                        className="w-full text-center py-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] text-[var(--text-primary)] text-[9px] font-bold tracking-wider uppercase rounded-xl hover:bg-[var(--accent-hover)] transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        Promote to Primary <ChevronRight className="w-3 h-3 text-[var(--color-primary)]" />
                      </button>
                    )
                  ) : (
                    <div className="w-full text-center py-2 text-[var(--text-muted)] text-[9px] font-bold tracking-wider uppercase">
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
