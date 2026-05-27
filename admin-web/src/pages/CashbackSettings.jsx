import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { motion } from 'framer-motion';
import { 
  Zap, 
  Save, 
  RefreshCcw, 
  ToggleLeft, 
  ToggleRight, 
  Percent, 
  Dices, 
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  Clock,
  Calendar,
  Layers,
  Smartphone
} from 'lucide-react';
import toast from 'react-hot-toast';

export const CashbackSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    cashbackEnabled: true,
    rewardMode: 'PERCENTAGE',
    coinConversionRate: 100,
    minRechargeAmount: 10,
    maxCashbackPerRecharge: 50,
    dailyCashbackLimit: 500,
    cooldownSeconds: 0,
    globalPercentage: 1.0,
    operatorWiseCashback: {},
    slabWiseCashback: [],
    cashbackExpiryDays: 0
  });

  const [previewAmount, setPreviewAmount] = useState(100);
  const [operatorJsonStr, setOperatorJsonStr] = useState('{}');
  const [slabJsonStr, setSlabJsonStr] = useState('[]');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    if (!sessionStorage.getItem('dizipay_admin_token')) {
      setLoading(false);
      return;
    }
    try {
      const response = await api.get('/admin/cashback/settings');
      if (response.data.success) {
        const data = response.data.data;
        setSettings(data);
        setOperatorJsonStr(JSON.stringify(data.operatorWiseCashback || {}, null, 2));
        setSlabJsonStr(JSON.stringify(data.slabWiseCashback || [], null, 2));
      }
    } catch (err) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!sessionStorage.getItem('dizipay_admin_token')) return;
    setSaving(true);
    try {
      const response = await api.patch('/admin/cashback/settings', settings);
      if (response.data.success) {
        toast.success("Settings updated successfully");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const calculatePreview = () => {
    if (!settings.cashbackEnabled) return 0;
    const amount = parseFloat(previewAmount) || 0;
    const minAmount = parseFloat(settings.minRechargeAmount) || 0;
    const maxReward = parseFloat(settings.maxCashbackPerRecharge) || 0;
    
    if (amount < minAmount) return 0;
    
    let reward = 0;
    const percentage = parseFloat(settings.globalPercentage) || 0;

    if (settings.rewardMode === 'PERCENTAGE') {
      reward = (amount * percentage) / 100;
    } else {
      reward = (amount * percentage) / 100;
    }

    return Math.min(reward, maxReward);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="animate-spin h-8 w-8 border-3 border-[var(--border-soft)] border-t-[var(--color-primary)] rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            Reward <span className="text-[var(--color-primary)]">Engine</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">Configure global cashback and incentive algorithms</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-[var(--bg-primary)] rounded-xl font-bold uppercase tracking-wider text-xs hover:opacity-90 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
        >
          {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving Configuration..." : "Apply Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Settings */}
        <div className="lg:col-span-8 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--card-bg)] rounded-xl p-6 md:p-8 border border-[var(--border-soft)] shadow-soft space-y-6"
          >
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-4 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--border-soft)]">
              <div className="flex items-center gap-3.5">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${settings.cashbackEnabled ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)]' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}>
                  <Zap className={`w-5 h-5 ${settings.cashbackEnabled ? 'fill-current' : ''}`} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wide">System Status</h3>
                  <p className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase">{settings.cashbackEnabled ? 'Global Incentives Active' : 'All Rewards Paused'}</p>
                </div>
              </div>
              <button 
                onClick={() => setSettings({...settings, cashbackEnabled: !settings.cashbackEnabled})}
                className="focus:outline-none cursor-pointer"
              >
                {settings.cashbackEnabled ? (
                  <ToggleRight className="w-10 h-10 text-[var(--color-primary)]" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-[var(--text-secondary)]" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Reward Mode */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Reward Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSettings({...settings, rewardMode: 'PERCENTAGE'})}
                    className={`px-4 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 cursor-pointer ${settings.rewardMode === 'PERCENTAGE' ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)]' : 'border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--color-primary)]/30'}`}
                  >
                    <Percent className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Percentage</span>
                  </button>
                  <button
                    onClick={() => setSettings({...settings, rewardMode: 'RANDOM'})}
                    className={`px-4 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1.5 cursor-pointer ${settings.rewardMode === 'RANDOM' ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)]' : 'border-[var(--border-soft)] text-[var(--text-secondary)] hover:border-[var(--color-primary)]/30'}`}
                  >
                    <Dices className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase">Randomized</span>
                  </button>
                </div>
              </div>

              {/* Global Percentage */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Global Incentive (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={settings.globalPercentage}
                    onChange={(e) => setSettings({...settings, globalPercentage: e.target.value})}
                    className="w-full px-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] focus:outline-none font-bold text-[var(--text-primary)] text-sm"
                  />
                  <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
                </div>
              </div>

              {/* Thresholds */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Min Recharge Threshold (₹)</label>
                <input
                  type="number"
                  value={settings.minRechargeAmount}
                  onChange={(e) => setSettings({...settings, minRechargeAmount: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] focus:outline-none font-bold text-[var(--text-primary)] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">Max Reward Cap (₹)</label>
                <input
                  type="number"
                  value={settings.maxCashbackPerRecharge}
                  onChange={(e) => setSettings({...settings, maxCashbackPerRecharge: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] focus:outline-none font-bold text-[var(--text-primary)] text-sm"
                />
              </div>

              {/* Limits */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5 flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[var(--color-primary)]" /> User Daily Limit (₹)
                </label>
                <input
                  type="number"
                  value={settings.dailyCashbackLimit}
                  onChange={(e) => setSettings({...settings, dailyCashbackLimit: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] focus:outline-none font-bold text-[var(--text-primary)] text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-[var(--color-primary)]" /> Reward Expiry (Days)
                </label>
                <input
                  type="number"
                  value={settings.cashbackExpiryDays}
                  onChange={(e) => setSettings({...settings, cashbackExpiryDays: e.target.value})}
                  className="w-full px-4 py-3 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] focus:outline-none font-bold text-[var(--text-primary)] text-sm"
                  placeholder="0 for never"
                />
              </div>
            </div>

            {/* Advanced JSON Sections */}
            <div className="space-y-5 pt-5 border-t border-[var(--border-soft)]">
               <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    <Smartphone className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Operator Overrides (JSON)
                  </div>
                  <textarea 
                    value={operatorJsonStr}
                    onChange={(e) => {
                      setOperatorJsonStr(e.target.value);
                      try {
                        const val = JSON.parse(e.target.value);
                        setSettings(prev => ({...prev, operatorWiseCashback: val}));
                      } catch(e) {}
                    }}
                    className="w-full h-32 px-4 py-3 bg-[var(--admin-input-bg)] text-[var(--text-primary)] font-mono text-xs rounded-xl border border-[var(--border-soft)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] focus:outline-none shadow-inner resize-y"
                    placeholder='{ "JIO": 1.5, "AIRTEL": 0.8 }'
                  />
               </div>

               <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    <Layers className="w-3.5 h-3.5 text-[var(--color-primary)]" /> Slab-based Rules (JSON Array)
                  </div>
                  <textarea 
                    value={slabJsonStr}
                    onChange={(e) => {
                      setSlabJsonStr(e.target.value);
                      try {
                        const val = JSON.parse(e.target.value);
                        setSettings(prev => ({...prev, slabWiseCashback: val}));
                      } catch(e) {}
                    }}
                    className="w-full h-32 px-4 py-3 bg-[var(--admin-input-bg)] text-[var(--text-primary)] font-mono text-xs rounded-xl border border-[var(--border-soft)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] focus:outline-none shadow-inner resize-y"
                    placeholder='[ { "min": 500, "percent": 2.0 }, { "min": 1000, "percent": 3.0 } ]'
                  />
               </div>
            </div>
          </motion.div>
        </div>

        {/* Live Preview Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-6 text-[var(--text-primary)] space-y-6 shadow-soft"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4.5 h-4.5 text-[var(--color-primary)]" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Simulator</h3>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Transaction Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={previewAmount}
                  onChange={(e) => setPreviewAmount(e.target.value)}
                  className="w-full px-4 py-4 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl focus:ring-2 focus:ring-[var(--admin-focus-ring)] focus:border-[var(--color-primary)] focus:outline-none font-bold text-2xl text-[var(--text-primary)]"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] text-lg font-bold">₹</div>
              </div>
            </div>

            <div className="p-5 bg-[var(--bg-secondary)]/50 rounded-xl border border-[var(--border-soft)] space-y-5">
              <div className="flex justify-between items-center text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                <span>Model</span>
                <span>Expected Yield</span>
              </div>
              
              <div className="space-y-3.5">
                <div className="flex justify-between items-end border-b border-[var(--border-soft)] pb-3">
                  <span className="text-xs font-medium text-[var(--text-secondary)]">Global Rate</span>
                  <span className="text-lg font-bold text-[var(--text-primary)]">₹{calculatePreview().toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">User Wallet Credit</span>
                  </div>
                  <span className="text-2xl font-bold text-emerald-500">₹{calculatePreview().toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 bg-[var(--color-primary-glow)] rounded-xl border border-[var(--border-soft)]">
              <AlertCircle className="w-4.5 h-4.5 text-[var(--color-primary)] shrink-0 mt-0.5" />
              <p className="text-[9px] text-[var(--text-primary)] font-semibold uppercase leading-relaxed tracking-wider">
                Rewards are calculated based on the highest applicable rule (Slab &gt; Operator &gt; Global).
              </p>
            </div>
          </motion.div>

          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl p-5 shadow-soft">
             <div className="flex items-center gap-2 mb-2.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-primary)]">Safety Protocol</h4>
             </div>
             <p className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase leading-relaxed tracking-wider">
               Daily limits and cooldowns are calculated per user to prevent high-frequency reward drainage.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
