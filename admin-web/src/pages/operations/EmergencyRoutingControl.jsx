import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ShieldAlert, Zap, Radio, RefreshCw } from 'lucide-react';

export const EmergencyRoutingControl = () => {
  const [overrides, setOverrides] = useState({});
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [resOverrides, resProviders] = await Promise.all([
        fetch('/api/admin/enterprise/routing/emergency', { headers }).then(r => r.json()),
        fetch('/api/admin/enterprise/providers', { headers }).then(r => r.json())
      ]);

      if (resOverrides.success) setOverrides(resOverrides.data);
      if (resProviders.success) setProviders(resProviders.data);
    } catch (err) {
      toast.error('Failed to load emergency overrides settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleUpdateOverride = async (field, value) => {
    setSubmitting(true);
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const payload = {
        globalFreeze: field === 'globalFreeze' ? value : overrides.globalFreeze === 'true',
        forcedProvider: field === 'forcedProvider' ? value : overrides.forcedProvider || ''
      };

      const response = await fetch('/api/admin/enterprise/routing/emergency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (res.success) {
        toast.success('Emergency override configuration updated in Redis.');
        setOverrides(res.data);
      } else {
        toast.error(res.message || 'Failed to update overrides');
      }
    } catch (err) {
      toast.error('Error updating overrides');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRebuildCache = async () => {
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch('/api/admin/enterprise/routing/cache/rebuild', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        toast.success(res.message || 'Redis configurations sync completed.');
      } else {
        toast.error(res.message || 'Cache rebuild failed.');
      }
    } catch (err) {
      toast.error('Connection error rebuilding cache');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-4">
        <ShieldAlert className="w-10 h-10 text-rose-600 shrink-0 mt-0.5 animate-pulse" />
        <div>
          <h2 className="text-lg font-bold text-rose-800 uppercase tracking-tight">Super Admin Emergency Command Panel</h2>
          <p className="text-xs text-rose-700/80 mt-1 max-w-2xl">
            Modifications applied here will immediately bypass the standard routing engine logic. Use only during active provider outages, database drops, or emergency recovery cycles.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Override controls */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs space-y-6">
          <h3 className="font-bold text-base text-[var(--text-primary)]">Routing Override Configurations</h3>

          {loading ? (
            <div className="text-center text-[var(--text-secondary)] py-8">Loading state properties...</div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Global Routing Freeze</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Stops all transaction routing or fallbacks immediately.</p>
                </div>
                <button 
                  onClick={() => handleUpdateOverride('globalFreeze', overrides.globalFreeze !== 'true')}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    overrides.globalFreeze === 'true'
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  }`}
                >
                  {overrides.globalFreeze === 'true' ? 'FREEZE ACTIVE' : 'FREEZE INACTIVE'}
                </button>
              </div>

              <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl space-y-3">
                <div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">Forced Provider Gateway Override</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Forces all transactions to route through a single selected gateway.</p>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={overrides.forcedProvider || ''}
                    onChange={(e) => handleUpdateOverride('forcedProvider', e.target.value)}
                    disabled={submitting}
                    className="flex-1 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden font-semibold text-[var(--color-primary)]"
                  >
                    <option value="">No Active Forced Override</option>
                    {providers.map(p => <option key={p.id} value={p.code}>{p.name}</option>)}
                  </select>
                  {overrides.forcedProvider && (
                    <button 
                      onClick={() => handleUpdateOverride('forcedProvider', '')}
                      disabled={submitting}
                      className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-600 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Cache rebuild controls */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-bold text-base text-[var(--text-primary)]">Redis Cache Maintenance</h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              If the database configurations drift from cached Redis records, rebuild the cache namespace. This operation clears old hashes and repopulates all configs from the database dynamically.
            </p>
          </div>

          <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Radio className="w-6 h-6 text-[var(--color-primary)] shrink-0 animate-pulse" />
              <div>
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase">Redis Sync Status</h4>
                <p className="text-[10px] text-emerald-500 font-semibold uppercase tracking-wider mt-0.5">Active / In Sync</p>
              </div>
            </div>
            <button 
              onClick={handleRebuildCache}
              className="flex items-center px-4 py-2.5 bg-[var(--color-primary)] hover:opacity-90 rounded-xl text-xs font-bold text-white transition-opacity cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Sync Redis Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
