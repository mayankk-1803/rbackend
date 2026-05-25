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

  const handleCompare = async () => {
    if (mobileNumber.length !== 10) return toast.error('Enter valid 10-digit number');
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error('Enter valid amount');
    if (selectedForCompare.length === 0) return toast.error('Select providers to compare');

    const loadingToast = toast.loading("Benchmarking APIs...");
    try {
      setLoading(true);
      setCompareResults(null);
      const { data } = await api.post('/admin/compare-recharge', {
        mobile: mobileNumber,
        amount: amt,
        operator: 'Jio',
        providers: selectedForCompare,
        testMode: isTestMode
      });
      
      setCompareResults(data.data);
      toast.success("Benchmark completed", { id: loadingToast });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(msg, { id: loadingToast });
    } finally {
      setLoading(false);
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

  const toggleCompareOperator = (code) => {
    setSelectedForCompare(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const getBestOperator = (results) => {
    if (!results || results.length === 0) return null;
    const successOnly = results.filter(r => r.status === 'SUCCESS');
    if (successOnly.length === 0) return null;
    return successOnly.reduce((prev, curr) => prev.responseTime < curr.responseTime ? prev : curr);
  };

  const bestOperator = compareResults ? getBestOperator(compareResults.results) : null;

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--text-color)] tracking-tight drop-shadow-sm uppercase italic">RECHARGE <span className="text-cyan-600">Engine</span></h1>
          <p className="text-[10px] md:text-sm text-[var(--text-secondary)] mt-1 font-bold uppercase tracking-widest">Benchmark and debug provider routing in real-time</p>
        </div>
        <div className="flex items-center gap-4">
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleTopUp()}
            className="w-full lg:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-[10px] font-black rounded-xl hover:bg-purple-500/20 transition-all shadow-sm uppercase tracking-[0.2em]"
          >
            <Zap className="w-4 h-4 fill-current" />
            + ₹1000 Credits
          </motion.button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
        {/* LEFT PANEL: Inputs (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <section className="glass-card border border-[var(--glass-border)] rounded-2xl p-8 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Activity className="w-12 h-12 text-cyan-600" />
            </div>
            
            <h2 className="text-sm font-black text-[var(--text-muted)] uppercase tracking-widest mb-8 flex items-center gap-3">
              <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,211,238,0.8)]"></span>
              Request Parameters
            </h2>

            <form onSubmit={handleTest} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Target Mobile</label>
                <input 
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={10}
                  placeholder="98********"
                  className="w-full px-4 py-3 glass-input text-[var(--text-color)] font-bold tracking-widest outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all placeholder:text-[var(--text-muted)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Amount (₹)</label>
                  <input 
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="10"
                    className="w-full px-4 py-3 glass-input text-[var(--text-color)] font-bold outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-500 transition-all placeholder:text-[var(--text-muted)]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Operator</label>
                  <select 
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full px-4 py-3 glass-input text-[var(--text-color)] font-bold outline-none focus:ring-2 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all"
                  >
                    <option value="Jio">Jio</option>
                    <option value="Airtel">Airtel</option>
                    <option value="VI">VI</option>
                    <option value="BSNL">BSNL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <label className="block text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Priority Routing</label>
                <div className="space-y-3">
                  <label className={`flex items-center p-4 border rounded-xl cursor-pointer transition-all ${selectedOperators.length === 0 ? 'bg-cyan-500/10 border-cyan-500/30 shadow-sm' : 'bg-[var(--bg-tertiary)] border-[var(--glass-border)] hover:border-[var(--glass-border-hover)]'}`}>
                    <input 
                      type="checkbox" 
                      checked={selectedOperators.length === 0} 
                      onChange={() => setSelectedOperators([])}
                      className="hidden"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selectedOperators.length === 0 ? 'border-cyan-600 bg-cyan-600' : 'border-[var(--text-muted)]'}`}>
                      {selectedOperators.length === 0 && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                    </div>
                    <span className="ml-4 text-xs font-black text-[var(--text-color)] uppercase tracking-widest">Smart Failover</span>
                    <span className="ml-auto text-[8px] bg-cyan-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">AI Driven</span>
                  </label>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {providers.map((p) => (
                      <button
                        key={p.code}
                        type="button"
                        onClick={() => setSelectedOperators(prev => prev.includes(p.code) ? prev.filter(c => c !== p.code) : [...prev, p.code])}
                        className={`p-3 text-[10px] font-black uppercase tracking-widest border rounded-xl transition-all ${
                          selectedOperators.includes(p.code) 
                          ? 'bg-purple-500/10 border-purple-500/30 text-purple-400 shadow-sm' 
                          : 'bg-[var(--bg-tertiary)] border-[var(--glass-border)] text-[var(--text-muted)] hover:border-[var(--glass-border-hover)]'
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
                className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-cyan-600/10 disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : <Zap className="w-4 h-4 fill-current" />}
                {loading ? 'Executing...' : 'Fire Recharge'}
              </motion.button>
            </form>
          </section>

          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setMobileNumber('9999999999')} className="text-[10px] py-3 px-4 bg-[var(--bg-tertiary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-color)] font-black uppercase tracking-widest hover:bg-[var(--glass-button-bg)] transition-all shadow-sm">Mock Success</button>
            <button onClick={() => setMobileNumber('8888888888')} className="text-[10px] py-3 px-4 bg-[var(--bg-tertiary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-color)] font-black uppercase tracking-widest hover:bg-[var(--glass-button-bg)] transition-all shadow-sm">Mock Failure</button>
          </div>
        </div>

        {/* RIGHT PANEL: Debug Console + Session History */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-slate-900 rounded-2xl h-[450px] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></div>
                </div>
                <span className="ml-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Debug Console</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 font-mono space-y-6 custom-scrollbar">
              {!result && !loading && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                  <Clock className="w-12 h-12 text-slate-400" />
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Awaiting Signal...</p>
                </div>
              )}

              {loading && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-cyan-400 text-xs">
                    <span className="animate-pulse">▶</span>
                    <span>Initializing transaction sequence...</span>
                  </div>
                </div>
              )}

              {result && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className={`p-6 rounded-2xl border ${result.status === 'success' ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'bg-rose-500/5 border-rose-500/30'}`}>
                    <div className="flex justify-between items-start mb-6">
                      <h3 className={`text-xl font-black uppercase tracking-tighter ${result.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>{result.status}</h3>
                      <div className="text-right">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Time</p>
                        <p className="text-lg font-black text-white">{result.details?.attempts?.reduce((acc, curr) => acc + (curr.latency || 0), 0) || 0}ms</p>
                      </div>
                    </div>
                    <div className="space-y-3 border-t border-white/5 pt-4">
                      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                        <span className="text-slate-500">Final Operator</span>
                        <span className="text-cyan-400">{result.details?.provider || 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Failover Trace</h4>
                    <div className="space-y-2">
                      {result.details?.attempts?.map((step, i) => (
                        <div key={i} className="flex items-center gap-4 bg-white/[0.02] p-3 rounded-xl border border-white/5">
                          <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[10px] text-slate-500 font-black">{i+1}</div>
                          <div className="flex-1">
                            <p className="text-[10px] font-black text-white uppercase tracking-widest">{step.provider}</p>
                            <p className="text-[8px] text-slate-500 font-medium">{step.reason || `Latency: ${step.latency}ms`}</p>
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-widest ${step.status === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}`}>{step.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </section>

          {/* Session History Table */}
          <section className="glass-card border border-[var(--glass-border)] rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--glass-border)] flex justify-between items-center bg-[var(--bg-tertiary)]">
              <h2 className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">Session History</h2>
              <span className="text-[8px] font-black text-[var(--text-muted)] uppercase">{history.length} Records</span>
            </div>
            <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
              {history.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-color)] text-[10px] font-black uppercase tracking-widest">No activity yet</div>
              ) : (
                <table className="w-full text-left">
                  <tbody className="divide-y divide-[var(--glass-border)]">
                    {history.map((tx, idx) => (
                      <tr key={idx} className="hover:bg-[var(--glass-button-bg)] transition-all">
                        <td className="px-6 py-4">
                          <div className="text-xs font-black text-[var(--text-color)]">{tx.mobile}</div>
                          <div className="text-[8px] text-[var(--text-muted)] font-black uppercase tracking-tighter">{tx.provider || 'Smart Route'}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase ${
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


