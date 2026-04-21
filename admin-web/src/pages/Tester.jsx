import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { Play, RotateCcw, CheckCircle2, XCircle, Clock, Zap, BarChart2, ShieldCheck, History } from 'lucide-react';

export const Tester = () => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [compareResults, setCompareResults] = useState(null);
  const [compareHistory, setCompareHistory] = useState([]);
  const [isTestMode, setIsTestMode] = useState(true);
  
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
    
    // Load compare history from localStorage
    const saved = localStorage.getItem('compare_history');
    if (saved) setCompareHistory(JSON.parse(saved));
  }, []);

  // Handle standard real-time updates for history
  useSocketEvent('recharge_success', (data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction?.transactionId) {
      setResult(prev => ({ ...prev, status: 'SUCCESS', details: data.transaction }));
    }
  });

  useSocketEvent('recharge_failed', (data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction?.transactionId) {
      setResult(prev => ({ ...prev, status: 'FAILED', details: data.transaction }));
    }
  });

  const updateHistory = (tx) => {
    if (!tx) return;
    setHistory(prev => {
      const idx = prev.findIndex(t => (t.transactionId === tx.transactionId) || (t._id === tx._id));
      if (idx > -1) {
        const newHist = [...prev];
        newHist[idx] = tx;
        return newHist;
      }
      return [tx, ...prev].slice(0, 50); // keep last 50
    });
  };

  const handleTest = async (e) => {
    e.preventDefault();
    if (mobileNumber.length !== 10) return alert('Enter valid 10-digit number');

    try {
      setLoading(true);
      setResult(null);
      const { data } = await api.post('/recharge', {
        mobile: mobileNumber,
        amount: 10,
        operator: 'Jio',
        providerCode: selectedProvider || null
      });
      
      setResult({ status: 'PENDING', message: data.message, transactionId: data.data?.transactionId || data.data?._id, details: data.data });
      if(data.data) updateHistory(data.data);
      
    } catch (err) {
      setResult({ status: 'FAILED_API', message: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (mobileNumber.length !== 10) return alert('Enter valid 10-digit number');
    if (selectedForCompare.length === 0) return alert('Select at least one provider to compare');

    try {
      setLoading(true);
      setCompareResults(null);
      const { data } = await api.post('/admin/compare-recharge', {
        mobile: mobileNumber,
        amount: 10,
        operator: 'Jio',
        providers: selectedForCompare,
        testMode: isTestMode
      });
      
      const newResults = data.data;
      setCompareResults(newResults);
      
      const updatedHistory = [newResults, ...compareHistory].slice(0, 10);
      setCompareHistory(updatedHistory);
      localStorage.setItem('compare_history', JSON.stringify(updatedHistory));
      
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
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
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Advanced API Tester</h1>
        <p className="text-slate-500 mt-1">Simulate recharge workflows, override providers, and benchmark APIs</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
              <Play className="w-4 h-4 mr-2 text-blue-500" /> Trigger Single Recharge
            </h3>
            <form onSubmit={handleTest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Mobile Number</label>
                <input 
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Provider Override</label>
                <select 
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700 bg-white"
                >
                  <option value="">Use Active Provider (Default)</option>
                  {providers.map(p => (
                    <option key={p.code} value={p.code} disabled={p.isBlacklisted}>
                      {p.name} {p.isBlacklisted ? '(Blacklisted)' : ''}
                    </option>
                  ))}
                </select>
                {selectedProvider && (
                  <p className="mt-2 text-[10px] text-blue-600 font-bold flex items-center">
                    <Zap className="w-3 h-3 mr-1" /> OVERRIDE ACTIVE: {providers.find(p => p.code === selectedProvider)?.name}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setMobileNumber('9999999999')} className="flex-1 py-2 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase rounded-lg hover:bg-slate-100 transition-colors">Success Test</button>
                <button type="button" onClick={() => setMobileNumber('8888888888')} className="flex-1 py-2 bg-slate-50 text-slate-600 text-[10px] font-bold uppercase rounded-lg hover:bg-slate-100 transition-colors">Fail Test</button>
              </div>

              <button 
                type="submit"
                disabled={loading || mobileNumber.length !== 10}
                className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"
              >
                {loading ? <RotateCcw className="w-5 h-5 animate-spin" /> : <><Play className="w-4 h-4 mr-2" /> Trigger Recharge</>}
              </button>
            </form>
          </div>

          {result && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 animate-in slide-in-from-top duration-300">
              <h3 className="text-sm font-bold text-slate-800 mb-4">Latest Result</h3>
              <div className={`p-4 rounded-xl mb-4 text-sm font-bold border flex items-center
                ${result.status.includes('FAILED') ? 'bg-red-50 text-red-700 border-red-100' : ''}
                ${result.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ''}
                ${result.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
              `}>
                {result.status === 'PENDING' && <Clock className="w-5 h-5 mr-2 text-amber-600 animate-pulse" />}
                {result.status === 'SUCCESS' && <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" />}
                {result.status.includes('FAILED') && <XCircle className="w-5 h-5 mr-2 text-red-600" />}
                {result.message || result.status}
              </div>
              {result.details && (
                <div className="bg-slate-900 p-4 rounded-xl text-[10px] text-slate-300 font-mono overflow-auto max-h-48 border border-slate-800 shadow-inner">
                  <pre>{JSON.stringify(result.details, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-sm font-bold text-slate-800 flex items-center">
                <BarChart2 className="w-4 h-4 mr-2 text-indigo-500" /> Compare APIs & Benchmarking
              </h3>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-1 rounded ${isTestMode ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                  {isTestMode ? 'SANDBOX MODE' : 'LIVE MODE'}
                </span>
                <button 
                  onClick={() => setIsTestMode(!isTestMode)}
                  className="p-1 rounded hover:bg-slate-100 transition-colors"
                  title="Toggle Test Mode"
                >
                  <ShieldCheck className={`w-4 h-4 ${isTestMode ? 'text-slate-400' : 'text-red-500'}`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {providers.map(p => (
                <div 
                  key={p.code}
                  onClick={() => !p.isBlacklisted && toggleCompareProvider(p.code)}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer select-none
                    ${selectedForCompare.includes(p.code) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}
                    ${p.isBlacklisted ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                  `}
                >
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{p.code}</div>
                  <div className="text-xs font-bold text-slate-700 truncate">{p.name}</div>
                </div>
              ))}
            </div>

            <button 
              onClick={handleCompare}
              disabled={loading || mobileNumber.length !== 10 || selectedForCompare.length === 0}
              className="w-full flex items-center justify-center py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
            >
              {loading ? <RotateCcw className="w-5 h-5 animate-spin" /> : <><Zap className="w-4 h-4 mr-2" /> Compare Selected APIs</>}
            </button>

            {compareResults && (
              <div className="mt-8 space-y-4 animate-in fade-in duration-500">
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Provider</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Latency</th>
                        <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {compareResults.results.map((res, idx) => (
                        <tr key={idx} className={bestProvider?.provider === res.provider ? 'bg-emerald-50/30' : ''}>
                          <td className="px-4 py-3">
                            <div className="text-xs font-bold text-slate-700">{res.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{res.provider}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              res.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {res.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className={`text-xs font-mono font-bold ${
                              bestProvider?.provider === res.provider ? 'text-emerald-600' : 'text-slate-600'
                            }`}>
                              {res.responseTime}ms
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[10px] text-slate-500 max-w-[150px] truncate">
                            {res.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {bestProvider && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center">
                      <Zap className="w-5 h-5 text-emerald-600 mr-3" />
                      <div>
                        <div className="text-xs font-bold text-emerald-800">Best Performance: {bestProvider.name}</div>
                        <div className="text-[10px] text-emerald-600">Fastest response time of {bestProvider.responseTime}ms detected.</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-800 flex items-center">
                <History className="w-4 h-4 mr-2 text-slate-500" /> Test History
              </h2>
              <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold uppercase">{history.length} Records</span>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">No recent tests in this session.</div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {history.map((tx) => (
                    <li key={tx.transactionId || tx._id} className="p-4 hover:bg-slate-50 transition-colors flex justify-between items-center">
                      <div>
                        <div className="font-bold text-slate-800 text-xs">{tx.mobile} <span className="text-slate-400 ml-2 font-normal">₹{tx.amount}</span></div>
                        <div className="text-[10px] text-slate-400 mt-1 font-mono uppercase">{tx.provider || 'ROUTED'} • {tx.operator}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider
                          ${tx.status === 'success' || tx.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : ''}
                          ${tx.status === 'failed' || tx.status === 'FAILED' ? 'bg-red-100 text-red-700' : ''}
                          ${tx.status === 'pending' || tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : ''}
                        `}>
                          {tx.status}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
