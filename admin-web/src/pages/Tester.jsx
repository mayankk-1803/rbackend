import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useSocket } from '../hooks/useSocket';
import { Play, RotateCcw, CheckCircle2, XCircle, Clock } from 'lucide-react';

export const Tester = () => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const { useSocketEvent } = useSocket();

  // Handle standard real-time updates for history
  useSocketEvent('recharge_success', (data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction.transactionId) {
      setResult(prev => ({ ...prev, status: 'SUCCESS', details: data.transaction }));
    }
  });

  useSocketEvent('recharge_failed', (data) => {
    updateHistory(data.transaction);
    if(result && result.transactionId === data.transaction.transactionId) {
      setResult(prev => ({ ...prev, status: 'FAILED', details: data.transaction }));
    }
  });

  const updateHistory = (tx) => {
    setHistory(prev => {
      const idx = prev.findIndex(t => t.transactionId === tx.transactionId);
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
        mobileNumber,
        amount: 10,
        provider: 'TEST_PROVIDER'
      });
      
      setResult({ status: 'PENDING', message: data.message, transactionId: data.transaction?.transactionId, details: data.transaction });
      if(data.transaction) updateHistory(data.transaction);
      
    } catch (err) {
      setResult({ status: 'FAILED_API', message: err.response?.data?.message || err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (txId) => {
    try {
      setLoading(true);
      await api.post(`/recharge/retry/${txId}`);
      // UI will update via socket when retry processes
    } catch (err) {
      alert(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
      <div className="lg:col-span-1 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">API Tester</h1>
          <p className="text-slate-500 mt-1">Simulate recharge workflows</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <form onSubmit={handleTest} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
              <input 
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={10}
                placeholder="e.g. 9876543210"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium text-slate-700"
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMobileNumber('9999999999')} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 transition-colors focus:outline-none">Success Test</button>
              <button type="button" onClick={() => setMobileNumber('0000000000')} className="px-3 py-1 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200 transition-colors focus:outline-none">Fail Test</button>
            </div>
            <button 
              type="submit"
              disabled={loading || mobileNumber.length !== 10}
              className="w-full flex items-center justify-center py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors focus:outline-none"
            >
              {loading ? <RotateCcw className="w-5 h-5 animate-spin" /> : <><Play className="w-4 h-4 mr-2" /> Trigger Recharge</>}
            </button>
          </form>
        </div>

        {result && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800 mb-4">Latest Result</h3>
            <div className="p-4 rounded-xl mb-4 text-sm font-medium border
              {result.status.includes('FAILED') ? 'bg-red-50 text-red-700 border-red-100' : ''}
              {result.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ''}
              {result.status === 'PENDING' ? 'bg-amber-50 text-amber-700 border-amber-100' : ''}
            ">
              {result.status === 'PENDING' && <Clock className="w-5 h-5 inline mr-2 text-amber-600" />}
              {result.status === 'SUCCESS' && <CheckCircle2 className="w-5 h-5 inline mr-2 text-emerald-600" />}
              {result.status.includes('FAILED') && <XCircle className="w-5 h-5 inline mr-2 text-red-600" />}
              {result.message || result.status}
            </div>
            {result.details && (
              <div className="bg-slate-50 p-4 rounded-xl text-xs text-slate-600 font-mono overflow-auto max-h-48 border border-slate-200">
                <pre>{JSON.stringify(result.details, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 h-full flex flex-col">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-800">Test History</h2>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full font-medium">{history.length} Session Records</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {history.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No recent tests in this session.</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {history.map((tx) => (
                  <li key={tx.transactionId || tx._id} className="p-4 hover:bg-slate-50 transition-colors rounded-xl mx-2 my-1 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-800 text-sm">{tx.mobileNumber} <span className="text-slate-400 ml-2 font-normal text-xs">₹{tx.amount}</span></div>
                      <div className="text-xs text-slate-500 mt-1">{tx.transactionId}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider
                        ${tx.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-700' : ''}
                        ${tx.status === 'FAILED' ? 'bg-red-100 text-red-700' : ''}
                        ${tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : ''}
                      `}>
                        {tx.status}
                      </span>
                      {tx.status === 'FAILED' && tx.retryCount < 3 && (
                        <button onClick={() => handleRetry(tx.transactionId || tx._id)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-colors" title="Retry">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
