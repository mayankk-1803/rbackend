import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, 
  Copy, 
  RefreshCw, 
  ShieldAlert, 
  Check, 
  Plus, 
  Trash2, 
  Eye, 
  EyeOff,
  Lock,
  Calendar,
  Zap
} from 'lucide-react';
import api from '../../api';
import toast from 'react-hot-toast';

export default function ApiKeyManager({ isDeveloperVerified }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState({});

  const fetchKeys = async () => {
    try {
      const res = await api.get('/developer/keys');
      setKeys(res.data.data);
    } catch (err) {
      toast.error("Failed to fetch keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isDeveloperVerified) return;
    fetchKeys();
  }, [isDeveloperVerified]);

  const generateNewKey = async () => {
    try {
      const res = await api.post('/developer/keys/generate');
      setKeys(prev => [...prev, res.data.data]);
      toast.success("API Key generated successfully");
    } catch (err) {
      toast.error(err.response?.data?.message || "Generation failed");
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const toggleStatus = async (clientId) => {
    try {
      await api.put(`/developer/keys/${clientId}/toggle`);
      fetchKeys();
      toast.success("Status updated");
    } catch (err) {
      toast.error("Update failed");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20 relative z-10">
      <div className="w-8 h-8 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6 relative z-10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Manage <span className="text-cyan-400 cyan-glow">Credentials</span></h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Securely manage your API access tokens</p>
        </div>
        <button 
          onClick={generateNewKey}
          disabled={keys.length >= 1}
          className="flex items-center gap-2 px-6 py-3 bg-cyan-400 text-slate-950 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Generate New Key
        </button>
      </div>

      <div className="grid gap-6">
        {keys.map((key, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card border border-white/5 rounded-[2rem] overflow-hidden shadow-xl"
          >
            <div className="p-6 border-b border-white/5 bg-slate-950/20 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-950/60 border border-white/10 rounded-2xl flex items-center justify-center">
                  <Key className="w-5 h-5 text-cyan-450" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-widest">Production Key</h3>
                  <div className="flex items-center gap-2">
                     <span className={`w-1.5 h-1.5 rounded-full ${key.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                     <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                       {key.isActive ? 'Active' : 'Deactivated'}
                     </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => toggleStatus(key.clientId)}
                  className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                    key.isActive 
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                  }`}
                 >
                   {key.isActive ? 'Disable' : 'Enable'}
                 </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {/* Client ID */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Client ID</label>
                <div className="flex items-center gap-3 p-4 bg-slate-950/40 rounded-2xl border border-white/5">
                  <Lock className="w-4 h-4 text-slate-500" />
                  <code className="flex-1 text-[11px] font-bold text-white font-mono break-all">{key.clientId}</code>
                  <button onClick={() => copyToClipboard(key.clientId, 'Client ID')} className="p-2 hover:bg-white/5 rounded-lg transition-all cursor-pointer">
                    <Copy className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">API Key</label>
                <div className="flex items-center gap-3 p-4 bg-slate-950/40 rounded-2xl border border-white/5">
                  <Zap className="w-4 h-4 text-slate-500" />
                  <code className="flex-1 text-[11px] font-bold text-white font-mono break-all">
                    {showSecret[key.clientId] ? key.apiKey : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <button onClick={() => setShowSecret(prev => ({ ...prev, [key.clientId]: !prev[key.clientId] }))} className="p-2 hover:bg-white/5 rounded-lg transition-all cursor-pointer">
                    {showSecret[key.clientId] ? <EyeOff className="w-4 h-4 text-slate-400" /> : <Eye className="w-4 h-4 text-slate-400" />}
                  </button>
                  <button onClick={() => copyToClipboard(key.apiKey, 'API Key')} className="p-2 hover:bg-white/5 rounded-lg transition-all cursor-pointer">
                    <Copy className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>

               {/* Meta Info */}
               <div className="pt-4 flex items-center gap-6 border-t border-white/5">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500 animate-spin-slow" />
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                      Last Used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
               </div>
            </div>
          </motion.div>
        ))}

        {keys.length === 0 && (
          <div className="p-12 border border-dashed border-white/10 rounded-[2.5rem] flex flex-col items-center justify-center text-center gap-4 bg-slate-950/20">
             <div className="w-16 h-16 bg-slate-950/60 border border-white/10 rounded-full flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-slate-500" />
             </div>
             <div className="space-y-1">
                <p className="text-xs font-black text-white uppercase tracking-widest">No API Keys Generated</p>
                <p className="text-[9px] text-slate-550 font-bold uppercase tracking-[0.2em]">Generate keys to start building your integration</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
