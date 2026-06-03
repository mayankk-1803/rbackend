import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  RefreshCw, 
  Key, 
  Settings, 
  ToggleLeft, 
  ToggleRight, 
  ShieldAlert, 
  AlertTriangle, 
  UserCheck, 
  UserX,
  Sliders,
  Zap,
  Lock
} from 'lucide-react';

export const ApiCustomers = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // Modals / Inputs state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [newRateLimit, setNewRateLimit] = useState(60);
  const [newEnvironment, setNewEnvironment] = useState("PRODUCTION");
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/admin/api-access/partners');
      if (response.data?.success) {
        setData(response.data);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleToggleState = async (userId) => {
    try {
      const response = await api.put('/admin/api-access/toggle-active', { targetUserId: userId });
      if (response.data?.success) {
        toast.success(response.data.message || "Credential status toggled!");
        fetchCustomers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to toggle status");
    }
  };

  const handleRotateKey = async (userId) => {
    if (!window.confirm("WARNING: Rotating the API secret will instantly invalidate the old secret. Are you sure you want to proceed?")) return;
    try {
      const response = await api.post('/admin/api-access/rotate', { targetUserId: userId });
      if (response.data?.success) {
        toast.success("API secret rotated! New secret: " + response.data.apiSecret, { duration: 10000 });
        fetchCustomers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to rotate credentials");
    }
  };

  const openConfigModal = (user) => {
    const access = user.apiAccesses?.[0] || {};
    setSelectedUser(user);
    setNewRateLimit(access.rateLimit || 60);
    setNewEnvironment(access.environment || "PRODUCTION");
    setShowConfigModal(true);
  };

  const handleUpdateConfig = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      // 1. Update Rate Limit
      await api.put('/admin/api-access/rate-limit', { 
        targetUserId: selectedUser.id, 
        rateLimit: Number(newRateLimit) 
      });

      // 2. Update Environment
      await api.put('/admin/api-access/environment', { 
        targetUserId: selectedUser.id, 
        environment: newEnvironment 
      });

      toast.success("Developer credentials updated successfully!");
      setShowConfigModal(false);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update developer configuration");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-[var(--bg-secondary)] rounded-md shimmer-element"></div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-96 shimmer-element"></div>
        <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">Loading data...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Unable to load data.</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
          Marketplace customer registry is currently offline.
        </p>
        <button
          onClick={fetchCustomers}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  const approvedUsers = data.approvedUsers || [];
  const pendingRequests = data.pendingRequests || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Developer Consumers</h1>
          <p className="text-sm text-[var(--text-secondary)]">Manage public API customer credentials, client sharding rate-limits, and routing environments.</p>
        </div>
        <button
          onClick={fetchCustomers}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh State
        </button>
      </div>

      {/* Pending Approval Section */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4" /> Pending Developer Upgrades Request Queue
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map((req) => (
              <div key={req.id} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] p-4 rounded-xl flex flex-col justify-between gap-3 text-xs">
                <div>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-[var(--text-primary)]">{req.user?.name}</span>
                    <span className="inline-flex px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[9px] font-bold">PENDING_CHECKER</span>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{req.user?.email} | {req.user?.phone}</p>
                </div>
                <div className="text-[10px] text-[var(--text-secondary)] border-t border-[var(--border-soft)] pt-2 flex items-center justify-between">
                  <span>Requested: {new Date(req.createdAt).toLocaleString()}</span>
                  <span className="text-[var(--color-primary)] font-bold">Pending Admin Checker approval</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved API Users Table */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[var(--border-soft)]">
          <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Active Developer Consumers Matrix</h3>
        </div>
        
        {approvedUsers.length === 0 ? (
          <div className="text-center py-10 text-xs text-[var(--text-secondary)]">No records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-extrabold uppercase">
                  <th className="px-6 py-4">Developer</th>
                  <th className="px-6 py-4">API Key Credentials</th>
                  <th className="px-6 py-4">Environment</th>
                  <th className="px-6 py-4">Rate-limit</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)] font-medium">
                {approvedUsers.map((user) => {
                  const access = user.apiAccesses?.[0] || {};
                  const isActive = access.isActive || false;
                  
                  return (
                    <tr key={user.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-bold block">{user.name}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{user.email}</span>
                      </td>
                      <td className="px-6 py-4 font-mono text-[11px]">
                        {access.apiKey ? (
                          <span className="bg-[var(--bg-tertiary)] border border-[var(--border-soft)] px-2 py-1 rounded block w-fit">
                            {access.apiKey.substring(0, 10)}...{access.apiKey.substring(access.apiKey.length - 6)}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-bold">Unassigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          access.environment === 'PRODUCTION' 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                        }`}>
                          {access.environment || 'SANDBOX'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-xs">
                        {access.rateLimit || 60} req/min
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggleState(user.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase border cursor-pointer ${
                            isActive 
                              ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          }`}
                        >
                          {isActive ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                          {isActive ? 'ACTIVE' : 'SUSPENDED'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openConfigModal(user)}
                          className="px-2.5 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Settings className="w-3 h-3" /> Config
                        </button>
                        <button
                          onClick={() => handleRotateKey(user.id)}
                          className="px-2.5 py-1.5 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Key className="w-3 h-3" /> Rotate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      <AnimatePresence>
        {showConfigModal && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfigModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />
            
            <motion.div 
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl shadow-medium overflow-hidden z-10"
            >
              <div className="px-6 py-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-tertiary)]/50">
                <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Configure Developer Access</h3>
                <button 
                  onClick={() => setShowConfigModal(false)}
                  className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  Close
                </button>
              </div>
              
              <form onSubmit={handleUpdateConfig} className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Developer Name</label>
                  <p className="text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-tertiary)]/30 border border-[var(--border-soft)] rounded-lg p-2.5">{selectedUser.name}</p>
                </div>
                
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Rate Limit (req/min)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newRateLimit}
                    onChange={(e) => setNewRateLimit(e.target.value)}
                    className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Fintech Routing Environment</label>
                  <select
                    value={newEnvironment}
                    onChange={(e) => setNewEnvironment(e.target.value)}
                    className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                  >
                    <option value="PRODUCTION">PRODUCTION</option>
                    <option value="SANDBOX">SANDBOX</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-[var(--color-primary)] text-[var(--bg-primary)] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving Configuration...' : 'Save Configuration'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
