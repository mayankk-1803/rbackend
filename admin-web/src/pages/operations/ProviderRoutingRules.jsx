import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Activity, ShieldCheck, Heart, Award, DollarSign } from 'lucide-react';

export const ProviderRoutingRules = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  // Editing parameters
  const [priority, setPriority] = useState('0');
  const [costPerTxn, setCostPerTxn] = useState('0.00');
  const [isActive, setIsActive] = useState(true);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch('/api/admin/enterprise/providers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        setProviders(res.data);
      } else {
        toast.error(res.message || 'Failed to fetch providers');
      }
    } catch (err) {
      toast.error('Connection error fetching providers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleEditClick = (p) => {
    setEditingId(p.id);
    setPriority(p.priority.toString());
    setCostPerTxn(p.costPerTxn.toString());
    setIsActive(p.isActive);
  };

  const handleSave = async (id) => {
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch(`/api/admin/enterprise/providers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          priority: parseInt(priority),
          costPerTxn: parseFloat(costPerTxn),
          isActive
        })
      });

      const res = await response.json();
      if (res.success) {
        toast.success('Provider parameters updated successfully');
        setEditingId(null);
        fetchProviders();
      } else {
        toast.error(res.message || 'Failed to save');
      }
    } catch (err) {
      toast.error('Connection error saving parameters');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Provider Routing Rules</h1>
        <p className="text-sm text-[var(--text-secondary)]">Monitor gateway availability in real-time, modify costs, and set priority distribution weights.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-[var(--text-secondary)]">Loading provider nodes metrics...</div>
        ) : providers.map((p) => (
          <div key={p.id} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs relative overflow-hidden flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-[var(--text-primary)]">{p.name}</h3>
                  <span className="text-[10px] text-[var(--text-secondary)] font-mono uppercase font-semibold">Node Type: {p.providerType || 'RECHARGE'}</span>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  p.healthStatus === 'HEALTHY' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                  p.healthStatus === 'DEGRADED' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                  'bg-rose-500/10 text-rose-600 border-rose-500/20'
                }`}>
                  <Heart className="w-3 h-3 mr-1 fill-current" />
                  {p.healthStatus}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--border-soft)] text-center">
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Uptime</p>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">{p.successRate ? `${p.successRate.toFixed(1)}%` : '100%'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Latency</p>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">{p.avgResponseTime ? `${p.avgResponseTime.toFixed(0)}ms` : '120ms'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Priority</p>
                  <p className="font-semibold text-sm text-[var(--text-primary)]">{p.priority}</p>
                </div>
              </div>

              {editingId === p.id ? (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1">Priority Weight</label>
                    <input 
                      type="number" 
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-[var(--text-secondary)] uppercase mb-1">Cost per transaction (₹)</label>
                    <input 
                      type="number" 
                      value={costPerTxn}
                      onChange={(e) => setCostPerTxn(e.target.value)}
                      className="w-full px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-hidden"
                      step="0.01"
                    />
                  </div>
                  <div className="flex items-center gap-2 py-1">
                    <input 
                      type="checkbox" 
                      id={`isActive-${p.id}`}
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded border-[var(--border-soft)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <label htmlFor={`isActive-${p.id}`} className="text-xs font-semibold text-[var(--text-primary)]">Enabled and active for routing pool</label>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Txn Cost Limit:</span>
                    <span className="font-mono font-semibold text-[var(--text-primary)]">₹{p.costPerTxn ? Number(p.costPerTxn).toFixed(2) : '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Pool Status:</span>
                    <span className={`font-semibold ${p.isActive ? 'text-emerald-500' : 'text-[var(--text-secondary)]'}`}>
                      {p.isActive ? 'IN ROUTING POOL' : 'DISABLED'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-[var(--border-soft)] flex justify-end">
              {editingId === p.id ? (
                <div className="flex gap-2">
                  <button 
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1 text-xs border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-lg text-[var(--text-secondary)] font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleSave(p.id)}
                    className="px-3 py-1 text-xs bg-[var(--color-primary)] hover:opacity-90 rounded-lg text-white font-semibold cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => handleEditClick(p)}
                  className="px-3 py-1 text-xs bg-[var(--bg-tertiary)] hover:bg-[var(--accent-hover)] border border-[var(--border-soft)] rounded-lg text-[var(--text-secondary)] font-semibold cursor-pointer"
                >
                  Configure
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
