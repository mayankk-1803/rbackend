import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Clock, 
  Activity, 
  CheckCircle2, 
  Copy,
  Braces,
  Terminal,
  ChevronDown,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Lock,
  Smartphone,
  Hash,
  MapPin
} from 'lucide-react';
import api from '../../api';
import { executeApiRequest } from '../../api/devClient';
import toast from 'react-hot-toast';

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-200 rounded-2xl ${className}`}></div>
);

// Standardized Operator List
const OPERATORS = [
  { label: "AIRTEL", value: "1" },
  { label: "VI", value: "2" },
  { label: "BSNL TOPUP", value: "3" },
  { label: "BSNL SPECIAL", value: "4" },
  { label: "JIO", value: "5" },
  { label: "VIDEOCON D2H", value: "6" },
  { label: "AIRTEL DTH", value: "7" },
  { label: "DISH TV", value: "8" },
  { label: "SUN DIRECT", value: "9" },
  { label: "TATA SKY", value: "10" }
];

const CIRCLES = [
  "Delhi", "UP East", "UP West", "Mumbai", "Maharashtra", "Karnataka", "Tamil Nadu", "Gujarat"
];

export default function ApiTester() {
  const [manifest, setManifest] = useState(null);
  const [loadingManifest, setLoadingManifest] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState(null);
  const [keys, setKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [apiSecret, setApiSecret] = useState('');
  
  // Custom Tester States
  const [mobile, setMobile] = useState('98**********');
  const [selectedOp, setSelectedOp] = useState(OPERATORS[4]); // JIO
  const [selectedCircle, setSelectedCircle] = useState(CIRCLES[0]);
  const [lastTxnId, setLastTxnId] = useState('');
  const [amount, setAmount] = useState(10);

  const fetchManifest = async () => {
    setLoadingManifest(true);
    try {
      const res = await api.get('/developer/manifest');
      const manifestData = res.data?.payload || res.data?.data || res.data;
      if (manifestData?.endpoints) {
        setManifest(manifestData);
        setSelectedEndpoint(manifestData.endpoints[0]);
      }
    } catch (err) {
      setError("Failed to load manifest");
    } finally {
      setLoadingManifest(false);
    }
  };

  const fetchKeys = async () => {
    try {
      const res = await api.get('/developer/keys');
      if (res.data?.success) {
        setKeys(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedKey(res.data.data[0]);
          setApiSecret(res.data.data[0].apiSecret || '');
        }
      }
    } catch (err) {}
  };

  useEffect(() => {
    fetchManifest();
    fetchKeys();
  }, []);

  useEffect(() => {
    if (selectedEndpoint) {
      let body = { ...selectedEndpoint.body };
      if (selectedEndpoint.id === 'initiate-recharge') {
        body = {
          mobile: mobile.trim(),
          operatorCode: selectedOp.value,
          amount: Number(amount)
        };
      }
      setRequestBody(JSON.stringify(body || {}, null, 2));
    }
  }, [selectedEndpoint, selectedOp, mobile, amount]);

  const validateRequest = () => {
    if (!mobile || mobile.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return false;
    }
    if (!selectedOp) {
      toast.error("Please select an operator");
      return false;
    }
    if (selectedEndpoint.id === 'initiate-recharge' && (!amount || amount <= 0)) {
      toast.error("Please enter a valid amount");
      return false;
    }
    return true;
  };

  const executeRequest = async () => {
    if (!validateRequest()) return;
    if (!selectedKey) return toast.error("Select API context");

    setLoading(true);
    setResponse(null);

    try {
      let finalPath = selectedEndpoint.path;
      let finalParams = {};

      // Path Param Handling
      if (selectedEndpoint.id === 'txn-status') {
        const idToUse = lastTxnId || '1'; // Fallback to 1 if no last txn
        finalPath = finalPath.replace('{id}', idToUse);
      } else if (selectedEndpoint.id === 'operator-detect') {
        finalPath = finalPath.replace('{mobile}', mobile);
      }

      // Query Param Handling
      if (selectedEndpoint.id === 'get-plans') {
        finalParams = { mobile, operatorCode: selectedOp.value, circle: selectedCircle };
      }

      const result = await executeApiRequest({
        method: selectedEndpoint.method,
        path: finalPath,
        params: finalParams,
        data: selectedEndpoint.method === 'POST' ? JSON.parse(requestBody) : undefined,
        headers: { 'x-api-key': selectedKey.apiKey }
      });

      setResponse({
        endpoint: `${selectedEndpoint.method} ${finalPath}`,
        payload: selectedEndpoint.method === 'POST' ? JSON.parse(requestBody) : finalParams,
        status: result?.status || 500,
        data: result?.data || { message: "Network failure" }
      });

      // Store transaction ID if successful recharge
      if (selectedEndpoint.id === 'initiate-recharge' && result?.data?.data?.transactionId) {
        setLastTxnId(result.data.data.transactionId.toString());
        toast.success(`Txn ID ${result.data.data.transactionId} saved for status check`);
      }

      setLatency(result?.latency || 0);
    } catch (err) {
      toast.error("Execution error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingManifest) return <div className="p-10 space-y-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-[2.5rem] p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black italic uppercase">API <span className="text-cyan-600">Tester</span></h2>
            <div className="px-3 py-1 bg-cyan-50 text-cyan-600 rounded-full text-[10px] font-black uppercase tracking-widest">v1.2 Prod</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Operator</label>
              <div className="relative">
                <select 
                  value={selectedOp.value}
                  onChange={(e) => setSelectedOp(OPERATORS.find(o => o.value === e.target.value))}
                  className="w-full pl-4 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold appearance-none cursor-pointer"
                >
                  {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile</label>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Circle</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select 
                  value={selectedCircle}
                  onChange={(e) => setSelectedCircle(e.target.value)}
                  className="w-full pl-10 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold appearance-none cursor-pointer"
                >
                  {CIRCLES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount</label>
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[11px] font-bold"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Endpoint</label>
            <div className="grid grid-cols-1 gap-2">
              {manifest?.endpoints.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => setSelectedEndpoint(ep)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    selectedEndpoint?.id === ep.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 border-slate-100 text-slate-600'
                  }`}
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">{ep.name}</span>
                  <span className="text-[8px] opacity-50 font-black">{ep.method} {ep.path}</span>
                </button>
              ))}
            </div>
          </div>

          {selectedEndpoint?.id === 'txn-status' && (
            <div className="p-4 bg-cyan-50 border border-cyan-100 rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[9px] font-black text-cyan-600 uppercase tracking-widest">Transaction ID</label>
                {lastTxnId && <span className="text-[8px] font-bold text-cyan-500">LAST TXN: {lastTxnId}</span>}
              </div>
              <input 
                type="text"
                value={lastTxnId}
                onChange={(e) => setLastTxnId(e.target.value)}
                placeholder="Enter ID (e.g. 56)"
                className="w-full px-4 py-3 bg-white border border-cyan-100 rounded-xl text-[11px] font-bold outline-none"
              />
            </div>
          )}

          <button 
            onClick={executeRequest}
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-3"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Execute Request</>}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-900 rounded-[2.5rem] flex flex-col h-full min-h-[600px] border border-white/10 overflow-hidden">
          <div className="p-6 bg-white/5 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-3 text-white">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-black uppercase tracking-widest">Live Output</span>
            </div>
            {response && <span className="text-[9px] font-black text-slate-400">{latency}ms | Status: {response.status}</span>}
          </div>

          <div className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              {response ? (
                <motion.div key="res" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Request Details</p>
                    <div className="p-4 bg-white/5 rounded-2xl">
                      <p className="text-cyan-400 font-mono text-[10px] mb-2">{response.endpoint}</p>
                      <pre className="text-cyan-400 font-mono text-[10px] whitespace-pre-wrap overflow-hidden">
                        {JSON.stringify(response.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Response Body</p>
                    <div className="p-4 bg-white/5 rounded-2xl overflow-hidden">
                      <pre className="text-cyan-400 font-mono text-[10px] whitespace-pre-wrap">
                        {JSON.stringify(response.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-4 opacity-50">
                  <Activity className="w-10 h-10 animate-pulse" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Waiting for Request...</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
