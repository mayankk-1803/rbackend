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
  }, []);

  useSocketEvent('recharge_success', (data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction?.transactionId) {
      setResult(prev => ({ ...prev, status: 'SUCCESS', details: data.transaction }));
      toast.success('Recharge successful');
    }
  });

  useSocketEvent('recharge_failed', (data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction?.transactionId) {
      setResult(prev => ({ ...prev, status: 'FAILED', details: data.transaction }));
      toast.error('Recharge failed');
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
      return [tx, ...prev].slice(0, 50);
    });
  };

  const handleTest = async (e) => {
    e.preventDefault();
    if (mobileNumber.length !== 10) return toast.error('Enter valid 10-digit number');

    const loadingToast = toast.loading("Processing recharge...");
    try {
      setLoading(true);
      setResult(null);
      const { data } = await api.post('/recharge', {
        mobile: mobileNumber,
        amount: 10,
        operator: 'Jio',
        providerCode: selectedProvider || null
      });
      
      setResult({ 
        status: 'PENDING', 
        message: data.message, 
        transactionId: data.data?.transactionId || data.data?._id, 
        details: data.data 
      });
      if(data.data) updateHistory(data.data);
      toast.success("Request sent successfully", { id: loadingToast });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setResult({ status: 'FAILED_API', message: msg });
      toast.error(msg, { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (mobileNumber.length !== 10) return toast.error('Enter valid 10-digit number');
    if (selectedForCompare.length === 0) return toast.error('Select providers to compare');

    const loadingToast = toast.loading("Benchmarking APIs...");
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
      
      setCompareResults(data.data);
      toast.success("Benchmark completed", { id: loadingToast });
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      toast.error(msg, { id: loadingToast });
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
    <div className="p-6 bg-[#F9FAFB] min-h-screen font-sans text-[#111827]">
      <header className="mb-8">
        <h1 className="text-xl font-semibold">API Tester</h1>
        <p className="text-sm text-gray-500 mt-1">Benchmark and test provider routing in real-time</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT PANEL: Trigger Recharge */}
        <div className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
            <h2 className="text-sm font-medium mb-4">Trigger Recharge</h2>
            <form onSubmit={handleTest} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Mobile Number</label>
                <input 
                  type="tel"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  maxLength={10}
                  placeholder="9876543210"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-150"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-medium">Provider Override</label>
                <select 
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:ring-2 focus:ring-blue-500 transition duration-150 bg-white"
                >
                  <option value="">Using: Active Provider (Smart Routing)</option>
                  {providers.map(p => (
                    <option key={p.code} value={p.code} disabled={p.isBlacklisted}>
                      Using: {p.name} {p.isBlacklisted ? '(Blacklisted)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <button 
                type="submit"
                disabled={loading || mobileNumber.length !== 10}
                className="w-full py-2 px-4 bg-[#2563EB] hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-md transition duration-150 shadow-sm"
              >
                {loading ? 'Processing...' : 'Trigger Recharge'}
              </button>
            </form>
          </section>

          {/* Quick Actions / Shortcuts */}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMobileNumber('9999999999')} className="text-xs py-2 px-3 border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-600">
              Mock Success No.
            </button>
            <button onClick={() => setMobileNumber('8888888888')} className="text-xs py-2 px-3 border border-gray-200 rounded-md hover:bg-gray-50 transition text-gray-600">
              Mock Failure No.
            </button>
          </div>

          {/* Result Card */}
          {result && (
            <div className="bg-white border border-gray-200 rounded-md p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium">Transaction Status</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                  result.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 
                  result.status === 'PENDING' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                }`}>
                  {result.status}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-4">{result.message}</p>
              {result.details && (
                <div className="bg-[#111827] p-3 rounded-md overflow-auto max-h-40">
                  <pre className="text-[10px] text-gray-300 font-mono">{JSON.stringify(result.details, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Compare APIs */}
        <div className="space-y-6">
          <section className="bg-white border border-gray-200 rounded-md p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium">Compare APIs</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sandbox</span>
                <input 
                  type="checkbox" 
                  checked={isTestMode} 
                  onChange={() => setIsTestMode(!isTestMode)}
                  className="w-3 h-3 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              {providers.map(p => (
                <button 
                  key={p.code}
                  onClick={() => !p.isBlacklisted && toggleCompareProvider(p.code)}
                  disabled={p.isBlacklisted}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition duration-150 border ${
                    selectedForCompare.includes(p.code) 
                      ? 'bg-[#2563EB] text-white border-[#2563EB]' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  } ${p.isBlacklisted ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {p.name}
                </button>
              ))}
            </div>

            <button 
              onClick={handleCompare}
              disabled={loading || mobileNumber.length !== 10 || selectedForCompare.length === 0}
              className="w-full py-2 px-4 bg-[#111827] hover:bg-black disabled:bg-gray-300 text-white text-sm font-medium rounded-md transition duration-150"
            >
              {loading ? 'Benchmarking...' : 'Run Comparison'}
            </button>

            {compareResults && (
              <div className="mt-6">
                <div className="overflow-hidden border border-gray-100 rounded-md">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Provider</th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase text-right">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {compareResults.results.map((res, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition duration-75">
                          <td className="px-3 py-2.5">
                            <div className="text-xs font-medium">{res.name}</div>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                              res.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {res.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <div className={`text-xs font-mono ${
                              bestProvider?.provider === res.provider ? 'text-green-600 font-semibold' : 'text-gray-500'
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
                  <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-md flex items-center gap-2">
                    <Zap className="w-4 h-4 text-green-600" />
                    <span className="text-xs text-green-800 font-medium">
                      ⚡ Fastest: {bestProvider.name} ({bestProvider.responseTime}ms)
                    </span>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Session History Table */}
          <section className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-sm font-medium">Session History</h2>
              <span className="text-[10px] font-semibold text-gray-400 uppercase">{history.length} Records</span>
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {history.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">No activity yet</div>
              ) : (
                <table className="w-full text-left">
                  <tbody className="divide-y divide-gray-50">
                    {history.map((tx) => (
                      <tr key={tx.transactionId || tx._id} className="hover:bg-gray-50 transition duration-75">
                        <td className="px-4 py-3">
                          <div className="text-xs font-medium">{tx.mobile}</div>
                          <div className="text-[10px] text-gray-400">{tx.provider || 'Smart Route'}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full uppercase ${
                            tx.status === 'success' || tx.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 
                            tx.status === 'pending' || tx.status === 'PENDING' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {tx.status}
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
