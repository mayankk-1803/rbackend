import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://rchserver.irecharge.in/api';

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
    try {
      const token = localStorage.getItem('dizipay_admin_token');
      const response = await axios.get(`${API_BASE_URL}/admin/cashback/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
    setSaving(true);
    try {
      const token = localStorage.getItem('dizipay_admin_token');
      const response = await axios.patch(`${API_BASE_URL}/admin/cashback/settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
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
      // For random, show the maximum potential reward based on global percentage
      reward = (amount * percentage) / 100;
    }

    return Math.min(reward, maxReward);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <RefreshCcw className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
            Reward <span className="text-purple-600">Engine</span>
          </h1>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Configure global cashback and incentive algorithms</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 px-8 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-purple-600 transition-all disabled:opacity-50 shadow-xl shadow-slate-200"
        >
          {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving Configuration..." : "Apply Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Settings */}
        <div className="lg:col-span-8 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-8"
          >
            {/* Status Toggle */}
            <div className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${settings.cashbackEnabled ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                  <Zap className={`w-6 h-6 ${settings.cashbackEnabled ? 'fill-current' : ''}`} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">System Status</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">{settings.cashbackEnabled ? 'Global Incentives Active' : 'All Rewards Paused'}</p>
                </div>
              </div>
              <button 
                onClick={() => setSettings({...settings, cashbackEnabled: !settings.cashbackEnabled})}
                className="focus:outline-none"
              >
                {settings.cashbackEnabled ? (
                  <ToggleRight className="w-12 h-12 text-emerald-500 fill-current" />
                ) : (
                  <ToggleLeft className="w-12 h-12 text-slate-300" />
                )}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Reward Mode */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reward Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSettings({...settings, rewardMode: 'PERCENTAGE'})}
                    className={`px-4 py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${settings.rewardMode === 'PERCENTAGE' ? 'border-purple-600 bg-purple-50 text-purple-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <Percent className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">Percentage</span>
                  </button>
                  <button
                    onClick={() => setSettings({...settings, rewardMode: 'RANDOM'})}
                    className={`px-4 py-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${settings.rewardMode === 'RANDOM' ? 'border-purple-600 bg-purple-50 text-purple-600' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <Dices className="w-5 h-5" />
                    <span className="text-[10px] font-black uppercase">Randomized</span>
                  </button>
                </div>
              </div>

              {/* Global Percentage */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Global Incentive (%)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={settings.globalPercentage}
                    onChange={(e) => setSettings({...settings, globalPercentage: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-black text-slate-900"
                  />
                  <Percent className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Thresholds */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Min Recharge Threshold (₹)</label>
                <input
                  type="number"
                  value={settings.minRechargeAmount}
                  onChange={(e) => setSettings({...settings, minRechargeAmount: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-black text-slate-900"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Max Reward Cap (₹)</label>
                <input
                  type="number"
                  value={settings.maxCashbackPerRecharge}
                  onChange={(e) => setSettings({...settings, maxCashbackPerRecharge: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-black text-slate-900"
                />
              </div>

              {/* Limits */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Clock className="w-3 h-3" /> User Daily Limit (₹)
                </label>
                <input
                  type="number"
                  value={settings.dailyCashbackLimit}
                  onChange={(e) => setSettings({...settings, dailyCashbackLimit: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-black text-slate-900"
                />
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Reward Expiry (Days)
                </label>
                <input
                  type="number"
                  value={settings.cashbackExpiryDays}
                  onChange={(e) => setSettings({...settings, cashbackExpiryDays: e.target.value})}
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-black text-slate-900"
                  placeholder="0 for never"
                />
              </div>
            </div>

            {/* Advanced JSON Sections */}
            <div className="space-y-6 pt-6 border-t border-slate-100">
               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <Smartphone className="w-3 h-3" /> Operator Overrides (JSON)
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
                    className="w-full h-32 px-6 py-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-2xl focus:ring-2 focus:ring-purple-600 focus:outline-none shadow-inner"
                    placeholder='{ "JIO": 1.5, "AIRTEL": 0.8 }'
                  />
               </div>

               <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <Layers className="w-3 h-3" /> Slab-based Rules (JSON Array)
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
                    className="w-full h-32 px-6 py-4 bg-slate-900 text-cyan-400 font-mono text-xs rounded-2xl focus:ring-2 focus:ring-purple-600 focus:outline-none shadow-inner"
                    placeholder='[ { "min": 500, "percent": 2.0 }, { "min": 1000, "percent": 3.0 } ]'
                  />
               </div>
            </div>
          </motion.div>
        </div>

        {/* Live Preview Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-8 shadow-2xl relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-600/10 blur-[100px] rounded-full"></div>
            
            <div className="flex items-center gap-3 relative z-10">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <h3 className="text-xs font-black uppercase tracking-widest">Simulator</h3>
            </div>

            <div className="space-y-4 relative z-10">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Amount</label>
              <div className="relative">
                <input
                  type="number"
                  value={previewAmount}
                  onChange={(e) => setPreviewAmount(e.target.value)}
                  className="w-full px-6 py-6 bg-white/10 border border-white/10 rounded-2xl focus:ring-2 focus:ring-purple-500 focus:outline-none font-black text-3xl text-white"
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-white/40 text-xl font-black">₹</div>
              </div>
            </div>

            <div className="p-8 bg-white/5 rounded-3xl border border-white/5 space-y-6 relative z-10">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Model</span>
                <span>Expected Yield</span>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between items-end border-b border-white/10 pb-4">
                  <span className="text-xs font-bold text-slate-300">Global Rate</span>
                  <span className="text-xl font-black">₹{calculatePreview().toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest">User Wallet Credit</span>
                  </div>
                  <span className="text-3xl font-black text-emerald-400">₹{calculatePreview().toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4 p-5 bg-purple-600/20 rounded-2xl border border-purple-600/30 relative z-10">
              <AlertCircle className="w-5 h-5 text-purple-400 mt-0.5" />
              <p className="text-[9px] text-purple-200 font-bold uppercase leading-relaxed tracking-wider">
                Rewards are calculated based on the highest applicable rule (Slab &gt; Operator &gt; Global).
              </p>
            </div>
          </motion.div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
             <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Safety Protocol</h4>
             </div>
             <p className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed tracking-wider">
               Daily limits and cooldowns are calculated per user to prevent high-frequency reward drainage.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
