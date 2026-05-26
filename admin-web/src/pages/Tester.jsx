import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { Zap, Activity, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const Tester = () => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [providers, setOperators] = useState([]);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [compareResults, setCompareResults] = useState(null);
  const [amount, setAmount] = useState('10');
  const [operator, setOperator] = useState('Jio');
  const [isTestMode, setIsTestMode] = useState(true);
  const [showAll, setShowAll] = useState(false);
  
  const { useSocketEvent } = useSocket();
  const abortRef = React.useRef(null);

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const { data } = await api.get('/admin/providers');
        setOperators(data.data || []);
      } catch (err) {
        console.error('Failed to fetch providers', err);
      }
    };
    fetchOperators();

    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const updateHistory = React.useCallback((tx) => {
    if (!tx) return;
    setHistory(prev => {
      const map = new Map(prev.map(t => [t.id || t.transactionId, t]));
      map.set(tx.id || tx.transactionId, tx);
      return Array.from(map.values())
        .sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()))
        .reverse()
        .slice(0, 50);
    });
  }, []);

  const onRechargeSuccess = React.useCallback((data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction?.transactionId) {
      setResult(prev => ({ ...prev, status: 'success', details: data.transaction }));
      toast.success('Recharge successful');
    }
  }, [result, updateHistory]);

  const onRechargeFailed = React.useCallback((data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction?.transactionId) {
      setResult(prev => ({ ...prev, status: 'failed', details: data.transaction }));
      toast.error('Recharge failed');
    }
  }, [result, updateHistory]);

  useSocketEvent('recharge_success', onRechargeSuccess);
  useSocketEvent('recharge_failed', onRechargeFailed);

  const handleTest = async (e) => {
    e.preventDefault();
    if (loading) return;
    
    // Cancel previous if exists
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    if (mobileNumber.length !== 10) return toast.error('Enter valid 10-digit number');
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error('Enter valid amount');
    if (amt > 5000) return toast.error('Max testing limit is ₹5000');

    const loadingToast = toast.loading("Processing recharge...");
    try {
      setLoading(true);
      setResult({ status: 'Awaiting Response...', message: 'Firing request to provider gateway...' });
      const { data } = await api.post('/recharge', {
        mobile: mobileNumber,
        amount: Number(amount),
        operator: operator,
        testOperators: selectedOperators.length > 0 ? selectedOperators : undefined
      }, { signal: abortRef.current.signal });
      
      setResult({ 
        status: 'pending', 
        message: data.message, 
        transactionId: data.data?.transactionId || data.data?.id, 
        details: data.data 
      });
      if(data.data) updateHistory(data.data);
      toast.success("Request sent successfully", { id: loadingToast });
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      const msg = err.response?.data?.message || err.message;
      setResult({ status: 'failed_api', message: msg, details: { attempts: [{ provider: 'API Gateway', status: 'ERROR', reason: msg }] } });
      toast.error(msg, { id: loadingToast });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const handleTopUp = async () => {
    const loadingToast = toast.loading("Adding balance...");
    try {
      await api.post('/admin/topup', { amount: 1000 });
      toast.success("₹1000 added to your wallet", { id: loadingToast });
    } catch (err) {
      toast.error(err.response?.data?.message || "Top-up failed", { id: loadingToast });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">Recharge Engine</h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Benchmark and debug provider routing in real-time</p>
        </div>
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleTopUp()}
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary-glow)] border border-[var(--border-soft)] text-[var(--color-primary)] text-xs font-semibold rounded-xl hover:opacity-90 transition-all shadow-sm uppercase tracking-wider cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            + ₹1000 Credits
          </motion.button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT PANEL: Inputs (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 shadow-soft relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Activity className="w-12 h-12 text-[var(--color-primary)]" />
            </div>
            
            <h2 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-[var(--color-primary)] rounded-full animate-pulse"></span>
              Request Parameters
            </h2>

            <form onSubmit={handleTest} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Target Mobile</label>
                <input 
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={10}
                  placeholder="98********"
                  className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl text-xs font-medium tracking-wider outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] transition-all placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Amount (₹)</label>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10"
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] transition-all placeholder:text-[var(--text-muted)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Operator</label>
                  <select 
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-[var(--text-primary)] rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] transition-all"
                  >
                    <option value="Jio">Jio</option>
                    <option value="Airtel">Airtel</option>
                    <option value="VI">VI</option>
                    <option value="BSNL">BSNL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3.5 pt-2">
                <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Priority Routing</label>
                <div className="space-y-2.5">
                  <label className={`flex items-center p-3.5 border rounded-xl cursor-pointer transition-all ${selectedOperators.length === 0 ? 'bg-[var(--color-primary-glow)] border-[var(--border-soft)]' : 'bg-[var(--bg-secondary)] border-[var(--border-soft)]'}`}>
                    <input 
                      type="checkbox" 
                      checked={selectedOperators.length === 0} 
                      onChange={() => setSelectedOperators([])}
                      className="hidden"
                    />
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all ${selectedOperators.length === 0 ? 'border-[var(--color-primary)] bg-[var(--color-primary)]' : 'border-[var(--text-muted)]'}`}>
                      {selectedOperators.length === 0 && <div className="w-1.5 h-1.5 bg-[var(--bg-primary)] rounded-full"></div>}
                    </div>
                    <span className="ml-3 text-xs font-semibold text-[var(--text-primary)] uppercase tracking-wider">Smart Failover</span>
                    <span className="ml-auto text-[8px] bg-[var(--color-primary)] text-[var(--bg-primary)] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">AI Driven</span>
                  </label>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    {providers.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => setSelectedOperators(prev => prev.includes(p.code) ? prev.filter(c => c !== p.code) : [...prev, p.code])}
                        className={`p-2.5 text-[10px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                          selectedOperators.includes(p.code) 
                          ? 'bg-[var(--color-primary-glow)] border-[var(--border-soft)] text-[var(--color-primary)]' 
                          : 'bg-[var(--bg-secondary)] border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--color-primary)]/30'
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || mobileNumber.length !== 10}
                className="w-full py-3 bg-[var(--color-primary)] text-[var(--bg-primary)] text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {loading ? (
                  <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full"></span>
                ) : <Zap className="w-4 h-4" />}
                {loading ? 'Executing...' : 'Fire Recharge'}
              </motion.button>
            </form>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setMobileNumber('9999999999')} className="text-[10px] py-2.5 px-4 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-[var(--text-primary)] font-bold uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-all cursor-pointer">Mock Success</button>
            <button onClick={() => setMobileNumber('8888888888')} className="text-[10px] py-2.5 px-4 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-[var(--text-primary)] font-bold uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-all cursor-pointer">Mock Failure</button>
          </div>
        </div>

        {/* RIGHT PANEL: Debug Console + Session History */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl h-[450px] flex flex-col shadow-soft relative overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[var(--border-soft)] flex items-center justify-between bg-[var(--bg-tertiary)]/30">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500/40"></div>
                  <div className="w-2 h-2 rounded-full bg-amber-500/40"></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500/40"></div>
                </div>
                <span className="ml-3 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Debug Console</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 font-mono space-y-5 custom-scrollbar text-xs">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                  <Clock className="w-10 h-10 text-[var(--text-secondary)]" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">Awaiting Signal...</p>
                </div>
              )}

              {loading && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[var(--color-primary)]">
                    <span className="animate-pulse">▶</span>
                    <span>Initializing transaction sequence...</span>
                  </div>
                </div>
              )}

              {result && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
                  <div className={`p-5 rounded-xl border ${result.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <h3 className={`text-base font-bold uppercase tracking-wider ${result.status === 'success' ? 'text-emerald-500' : 'text-rose-500'}`}>{result.status}</h3>
                      <div className="text-right">
                        <p className="text-[9px] font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">Total Time</p>
                        <p className="text-base font-bold text-[var(--text-primary)]">{result.details?.attempts?.reduce((acc, curr) => acc + (curr.latency || 0), 0) || 0}ms</p>
                      </div>
                    </div>
                    <div className="space-y-2 border-t border-[var(--border-soft)] pt-3">
                      <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider">
                        <span className="text-[var(--text-secondary)]">Final Operator</span>
                        <span className="text-[var(--color-primary)]">{result.details?.provider || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <h4 className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Failover Trace</h4>
                    <div className="space-y-2">
                      {result.details?.attempts?.map((step, i) => (
                        <div key={i} className="flex items-center gap-3 bg-[var(--bg-primary)] p-3 rounded-lg border border-[var(--border-soft)]">
                          <div className="w-5.5 h-5.5 rounded bg-[var(--bg-secondary)] flex items-center justify-center text-[9px] text-[var(--text-secondary)] font-bold">{i+1}</div>
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">{step.provider}</p>
                            <p className="text-[8px] text-[var(--text-secondary)] font-medium">{step.reason || `Latency: ${step.latency}ms`}</p>
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${step.status === 'SUCCESS' ? 'text-emerald-500' : 'text-rose-500'}`}>{step.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </section>

          {/* Session History Table */}
          <section className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/50">
              <h2 className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Session History</h2>
              <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase">{history.length} Records</span>
            </div>
            <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
              {history.length === 0 ? (
                <div className="p-6 text-center text-[var(--text-secondary)] text-[10px] font-bold uppercase tracking-wider">No activity yet</div>
              ) : (
                <table className="w-full text-left">
                  <tbody className="divide-y divide-[var(--border-soft)]">
                    {history.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-[var(--accent-hover)] transition-all">
                        <td className="px-5 py-3">
                          <div className="text-xs font-bold text-[var(--text-primary)]">{tx.mobile}</div>
                          <div className="text-[8px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider">{tx.provider || 'Smart Route'}</div>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                            tx.status?.toLowerCase() === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                          }`}>
                            {tx.status?.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
