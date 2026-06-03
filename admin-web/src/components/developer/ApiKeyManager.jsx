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
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function ApiKeyManager() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSecret, setShowSecret] = useState({});

  const fetchKeys = async () => {
    try {
      const res = await api.get('/admin/developer/keys');
      setKeys(res.data.data);
    } catch (err) {
      toast.error("Failed to fetch keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const generateNewKey = async () => {
    try {
      const res = await api.post('/admin/developer/keys/generate');
      setKeys(prev => [...prev, res.data.data]);
      toast.success("API Keys generated successfully");
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
      await api.put(`/admin/developer/keys/${clientId}/toggle`);
      fetchKeys();
      toast.success("Status updated");
    } catch (err) {
      toast.error("Update failed");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <div className="w-8 h-8 border-3 border-[var(--color-primary-glow)] border-t-[var(--color-primary)] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Manage Credentials</h2>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Securely manage your API access client tokens</p>
        </div>
        <button 
          onClick={generateNewKey}
          disabled={keys.length >= 2}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm border border-[var(--border-soft)]"
        >
          <Plus className="w-4 h-4" />
          Generate New Keys
        </button>
      </div>

      <div className="grid gap-6">
        {keys.map((key, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl overflow-hidden shadow-soft"
          >
            <div className="p-4 border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--color-primary-glow)] rounded-lg flex items-center justify-center">
                  <Key className="w-4 h-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Production Key #{idx + 1}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                     <span className={`w-1.5 h-1.5 rounded-full ${key.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
                     <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                       {key.isActive ? 'Active' : 'Deactivated'}
                     </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                  onClick={() => toggleStatus(key.clientId)}
                  className={`px-3 py-1.5 rounded-xl text-[9px] font-bold uppercase tracking-wider border transition-all cursor-pointer ${
                    key.isActive 
                      ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20' 
                      : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                  }`}
                 >
                   {key.isActive ? 'Disable' : 'Enable'}
                 </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Client ID */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Client ID</label>
                <div className="flex items-center gap-3 p-3 bg-[var(--admin-input-bg)] rounded-xl border border-[var(--border-soft)]">
                  <Lock className="w-4 h-4 text-[var(--text-secondary)]" />
                  <code className="flex-1 text-xs font-mono font-bold text-[var(--text-primary)] break-all">{key.clientId}</code>
                  <button onClick={() => copyToClipboard(key.clientId, 'Client ID')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-lg transition-all cursor-pointer border border-transparent hover:border-[var(--border-soft)]">
                    <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                </div>
              </div>

              {/* API Key */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">API Key</label>
                <div className="flex items-center gap-3 p-3 bg-[var(--admin-input-bg)] rounded-xl border border-[var(--border-soft)]">
                  <Zap className="w-4 h-4 text-[var(--text-secondary)]" />
                  <code className="flex-1 text-xs font-mono font-bold text-[var(--text-primary)] break-all">
                    {showSecret[key.clientId] ? key.apiKey : '••••••••••••••••••••••••••••••••'}
                  </code>
                  <button onClick={() => setShowSecret(prev => ({ ...prev, [key.clientId]: !prev[key.clientId] }))} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-lg transition-all cursor-pointer border border-transparent hover:border-[var(--border-soft)]">
                    {showSecret[key.clientId] ? <EyeOff className="w-4 h-4 text-[var(--text-secondary)]" /> : <Eye className="w-4 h-4 text-[var(--text-secondary)]" />}
                  </button>
                  <button onClick={() => copyToClipboard(key.apiKey, 'API Key')} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-lg transition-all cursor-pointer border border-transparent hover:border-[var(--border-soft)]">
                    <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                  </button>
                </div>
              </div>

               {/* Meta Info */}
               <div className="pt-4 flex items-center gap-6 border-t border-[var(--border-soft)]">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                    <span className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                      Last Used: {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}
                    </span>
                  </div>
               </div>
            </div>
          </motion.div>
        ))}

        {keys.length === 0 && (
          <div className="p-12 border border-dashed border-[var(--border-soft)] rounded-xl flex flex-col items-center justify-center text-center gap-4 bg-[var(--card-bg)] shadow-soft">
             <div className="w-12 h-12 bg-rose-500/10 rounded-full flex items-center justify-center border border-rose-500/20">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
             </div>
             <div className="space-y-1">
                <p className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">No API Keys Generated</p>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium">Generate keys to start building your API integration</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
