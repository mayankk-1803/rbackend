import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import toast from 'react-hot-toast';
import { Zap, Activity, Clock, ChevronRight } from 'lucide-react';

export const Tester = () => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [compareResults, setCompareResults] = useState(null);
  const [amount, setAmount] = useState('10');
  const [isTestMode, setIsTestMode] = useState(true);
  const [showAll, setShowAll] = useState(false);
  
  const { useSocketEvent } = useSocket();

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const { data } = await api.get('/admin/providers');
        setProviders(data.data || []);
      } catch (err) {
        console.error('Failed to fetch providers', err);
      }
    };
    fetchProviders();
  }, []);

  useSocketEvent('recharge_success', (data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction?.transactionId) {
      setResult(prev => ({ ...prev, status: 'success', details: data.transaction }));
      toast.success('Recharge successful');
    }
  });

  useSocketEvent('recharge_failed', (data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction?.transactionId) {
      setResult(prev => ({ ...prev, status: 'failed', details: data.transaction }));
      toast.error('Recharge failed');
    }
  });

  const updateHistory = (tx) => {
    if (!tx) return;
    setHistory(prev => {
      const map = new Map(prev.map(t => [t.id || t.transactionId, t]));
      map.set(tx.id || tx.transactionId, tx);
      return Array.from(map.values())
        .sort((a, b) => new Date(b.createdAt || Date.now()) - new Date(a.createdAt || Date.now()))
        .reverse()
        .slice(0, 50);
    });
  };

  const handleTest = async (e) => {
    e.preventDefault();
    if (mobileNumber.length !== 10) return toast.error('Enter valid 10-digit number');
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error('Enter valid amount');
    if (amt > 5000) return toast.error('Max testing limit is ₹5000');

    const loadingToast = toast.loading("Processing recharge...");
    try {
      setLoading(true);
      setResult(null);
      const { data } = await api.post('/recharge', {
        mobile: mobileNumber,
        amount: Number(amount),
        operator: 'Jio'
      });
      
      setResult({ 
        status: 'pending', 
        message: data.message, 
        transactionId: data.data?.transactionId || data.data?.id, 
        details: data.data 
      });
      if(data.data) updateHistory(data.data);
      toast.success("Request sent successfully", { id: loadingToast });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setResult({ status: 'failed_api', message: msg });
      toast.error(msg, { id: loadingToast });
    } finally {
      setLoading(false);
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

  const toggleCompareProvider = (code) => {
    setSelectedForCompare(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const getBestProvider = (results) => {
    if (!results || results.length === 0) return null;
    const successOnly = results.filter(r => r.status === 'SUCCESS');
    if (successOnly.length === 0) return null;
    return successOnly.reduce((prev, curr) => prev.responseTime < curr.responseTime ? prev : curr);
  };

  const bestProvider = compareResults ? getBestProvider(compareResults.results) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">API Tester</h1>
        <div className="flex justify-between items-center mt-0.5">
          <p className="text-sm text-[#64748B]">Benchmark and test provider routing in real-time</p>
          <button 
            onClick={() => handleTopUp()}
            className="flex items-center gap-1.5 px-3 py-1 bg-[#F3E8FF] text-[#6D28D9] text-[10px] font-bold rounded-md hover:bg-[#E9D5FF] transition"
          >
            <Zap className="w-3 h-3 fill-current" />
            + ₹1000 Balance
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT PANEL: Trigger Recharge */}
        <div className="space-y-6">
          <section className="bg-white border border-[#E2E8F0] rounded-md p-5 shadow-sm">
            <h2 className="text-sm font-bold text-[#0F172A] mb-4">Trigger Recharge</h2>
            <form onSubmit={handleTest} className="space-y-4">
              <div>
                <label className="block text-xs text-[#64748B] mb-1.5 font-bold uppercase tracking-wider">Mobile Number</label>
                <input 
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={10}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-md outline-none focus:ring-2 focus:ring-[#2563EB]/10 focus:border-[#2563EB] transition duration-150"
                />
              </div>

              <div>
                <label className="block text-xs text-[#64748B] mb-1.5 font-bold uppercase tracking-wider">Amount (₹)</label>
                <input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="10"
                  className="w-full px-3 py-2 text-sm border border-[#E2E8F0] rounded-md outline-none focus:ring-2 focus:ring-[#2563EB]/10 focus:border-[#2563EB] transition duration-150"
                />
              </div>

              <div>
                <label className="block text-xs text-[#64748B] mb-3 font-bold uppercase tracking-wider">Provider Override</label>
                <div className="space-y-2">
                  <label className={`flex items-center p-3 border rounded-md cursor-pointer transition ${!selectedProvider ? 'border-[#6D28D9] bg-[#F3E8FF]' : 'border-[#E5E7EB] hover:border-[#C4B5FD]'}`}>
                    <input 
                      type="radio" 
                      name="provider" 
                      value="" 
                      checked={selectedProvider === ""} 
                      onChange={(e) => setSelectedProvider(e.target.value)}
                      className="w-4 h-4 text-[#6D28D9] border-gray-300 focus:ring-[#6D28D9]"
                    />
                    <span className="ml-3 text-sm font-bold text-[#0F172A]">Smart Routing</span>
                    <span className="ml-auto text-[10px] bg-[#E5E7EB] text-[#64748B] px-2 py-0.5 rounded-full font-bold">Recommended</span>
                  </label>
                  
                  {(showAll ? providers : providers.slice(0, 4)).map((provider) => (
                    <label 
                      key={provider.code} 
                      className={`flex items-center p-3 border rounded-md cursor-pointer transition ${
                        provider.isBlacklisted ? 'opacity-50 cursor-not-allowed' : ''
                      } ${selectedProvider === provider.code ? 'border-[#6D28D9] bg-[#F3E8FF]' : 'border-[#E5E7EB] hover:border-[#C4B5FD]'}`}
                    >
                      <input 
                        type="radio" 
                        name="provider" 
                        value={provider.code} 
                        checked={selectedProvider === provider.code} 
                        onChange={(e) => setSelectedProvider(e.target.value)}
                        disabled={provider.isBlacklisted}
                        className="w-4 h-4 text-[#6D28D9] border-gray-300 focus:ring-[#6D28D9] disabled:bg-gray-200"
                      />
                      <div className="ml-3 flex justify-between w-full items-center">
                        <span className="text-sm font-medium text-[#0F172A]">{provider.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#64748B] font-mono">{provider.latency || 300}ms</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                             provider.isBlacklisted ? 'bg-[#FEF2F2] text-[#DC2626]' : 
                             provider.successRate < 80 ? 'bg-[#FEF3C7] text-[#D97706]' : 'bg-[#ECFDF5] text-[#16A34A]'
                          }`}>
                            {provider.isBlacklisted ? 'Blacklisted' : 'Healthy'}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                  
                  {providers.length > 4 && (
                    <button 
                      type="button" 
                      onClick={() => setShowAll(!showAll)}
                      className="w-full py-2 text-xs font-semibold text-[#64748B] hover:text-[#0F172A] border border-dashed border-[#E5E7EB] hover:border-[#C4B5FD] rounded-md transition"
                    >
                      {showAll ? 'Show Less' : `Show More (${providers.length} APIs)`}
                    </button>
                  )}
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading || mobileNumber.length !== 10}
                className="w-full py-2 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-300 text-white text-sm font-bold rounded-md transition duration-150 shadow-sm"
              >
                {loading ? 'Processing...' : 'Trigger Recharge'}
              </button>
            </form>
          </section>

          {/* Quick Actions / Shortcuts */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMobileNumber('9999999999')} className="text-xs py-2 px-3 border border-[#E2E8F0] rounded-md hover:bg-[#F1F5F9] transition text-[#64748B] font-medium">
              Mock Success No.
            </button>
            <button onClick={() => setMobileNumber('8888888888')} className="text-xs py-2 px-3 border border-[#E2E8F0] rounded-md hover:bg-[#F1F5F9] transition text-[#64748B] font-medium">
              Mock Failure No.
            </button>
          </div>

          {/* Result Card */}
          {result && (
            <div className="bg-white border border-[#E2E8F0] rounded-md p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#0F172A]">Transaction Status</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  result.status?.toLowerCase() === 'success' ? 'bg-[#ECFDF5] text-[#16A34A]' : 
                  result.status?.toLowerCase() === 'pending' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-[#FEF2F2] text-[#DC2626]'
                }`}>
                  {result.status?.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[#64748B] mb-4">{result.message}</p>
              {result.details && (
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 rounded-md overflow-auto max-h-40">
                  <pre className="text-[10px] text-[#64748B] font-mono">{JSON.stringify(result.details, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Compare APIs */}
        <div className="space-y-6">
          <section className="bg-white border border-[#E2E8F0] rounded-md p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-[#0F172A]">Compare APIs</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider">Sandbox</span>
                <input 
                  type="checkbox" 
                  checked={isTestMode} 
                  onChange={() => setIsTestMode(!isTestMode)}
                  className="w-3 h-3 text-[#2563EB] rounded border-[#E2E8F0] focus:ring-[#2563EB]"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {providers.map(p => (
                <button 
                  key={p.code}
                  onClick={() => !p.isBlacklisted && toggleCompareProvider(p.code)}
                  disabled={p.isBlacklisted}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition duration-150 border ${
                    selectedForCompare.includes(p.code) 
                      ? 'bg-[#2563EB] text-white border-[#2563EB]' 
                      : 'bg-white text-[#64748B] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                  } ${p.isBlacklisted ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <button 
              onClick={handleCompare}
              disabled={loading || mobileNumber.length !== 10 || selectedForCompare.length === 0}
              className="w-full py-2 px-4 bg-[#0F172A] hover:bg-black disabled:bg-gray-300 text-white text-sm font-bold rounded-md transition duration-150"
            >
              {loading ? 'Benchmarking...' : 'Run Comparison'}
            </button>

            {compareResults && (
              <div className="mt-6">
                <div className="overflow-hidden border border-[#E2E8F0] rounded-md">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <th className="px-3 py-2 text-[10px] font-bold text-[#64748B] uppercase">Provider</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-[#64748B] uppercase">Status</th>
                        <th className="px-3 py-2 text-[10px] font-bold text-[#64748B] uppercase text-right">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E2E8F0]">
                      {compareResults.results.map((res, idx) => (
                        <tr key={idx} className="hover:bg-[#F1F5F9] transition duration-75">
                          <td className="px-3 py-2.5">
                            <div className="text-xs font-bold text-[#0F172A]">{res.name}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              res.status?.toLowerCase() === 'success' ? 'bg-[#ECFDF5] text-[#16A34A]' : 'bg-[#FEF2F2] text-[#DC2626]'
                            }`}>
                              {res.status?.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className={`text-xs font-mono font-bold ${
                              bestProvider?.provider === res.provider ? 'text-[#16A34A]' : 'text-[#64748B]'
                            }`}>
                              {res.responseTime}ms
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {bestProvider && (
                  <div className="mt-4 p-3 bg-[#ECFDF5] border border-[#D1FAE5] rounded-md flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#16A34A] fill-current" />
                    <span className="text-xs text-[#065F46] font-bold">
                      ⚡ Fastest: {bestProvider.name} ({bestProvider.responseTime}ms)
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Session History Table */}
          <section className="bg-white border border-[#E2E8F0] rounded-md shadow-sm overflow-hidden">
            <div className="p-4 border-b border-[#E2E8F0] flex justify-between items-center bg-[#F8FAFC]">
              <h2 className="text-sm font-bold text-[#0F172A]">Session History</h2>
              <span className="text-[10px] font-bold text-[#94A3B8] uppercase">{history.length} Records</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-8 text-center text-[#94A3B8] text-xs">No activity yet</div>
              ) : (
                <table className="w-full text-left">
                  <tbody className="divide-y divide-[#E2E8F0]">
                    {history.map((tx, idx) => (
                      <tr key={`${tx.id || tx.transactionId || idx}-${idx}`} className="hover:bg-[#F1F5F9] transition duration-75">
                        <td className="px-4 py-3">
                          <div className="text-xs font-bold text-[#0F172A]">{tx.mobile}</div>
                          <div className="text-[10px] text-[#94A3B8] font-bold uppercase tracking-tight">{tx.provider || 'Smart Route'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                            tx.status?.toLowerCase() === 'success' ? 'bg-[#ECFDF5] text-[#16A34A]' : 
                            tx.status?.toLowerCase() === 'pending' ? 'bg-[#EFF6FF] text-[#2563EB]' : 'bg-[#FEF2F2] text-[#DC2626]'
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
