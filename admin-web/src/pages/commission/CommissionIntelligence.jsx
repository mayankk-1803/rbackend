import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Activity, 
  RefreshCw, 
  Cpu, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Settings,
  Sliders,
  DollarSign,
  Play,
  RotateCcw,
  Check,
  X,
  FileText
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';

export const CommissionIntelligence = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Simulation form states
  const [operatorId, setOperatorId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [role, setRole] = useState('RETAILER');
  const [currentComm, setCurrentComm] = useState('');
  const [recComm, setRecComm] = useState('');
  const [reasoning, setReasoning] = useState('');
  const [simulating, setSimulating] = useState(false);

  // Configuration edit states
  const [editingConfig, setEditingConfig] = useState(false);
  const [minVolume, setMinVolume] = useState('');
  const [minTransactions, setMinTransactions] = useState('');
  const [targetMargin, setTargetMargin] = useState('');
  const [automationMode, setAutomationMode] = useState('MANUAL');
  const [dropThreshold, setDropThreshold] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Lists for dropdown options
  const [operators, setOperators] = useState([]);
  const [categories, setCategories] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    setError(false);
    try {
      const [recRes, confRes, opRes, catRes] = await Promise.all([
        api.get('/admin/commission/intelligence/recommendations'),
        api.get('/admin/commission/intelligence/config'),
        api.get('/admin/commission/operators').catch(() => ({ data: { success: true, data: [] } })),
        api.get('/admin/commission/service-categories').catch(() => ({ data: { success: true, data: [] } }))
      ]);

      if (recRes.data?.success) {
        setRecommendations(recRes.data.data);
      } else {
        setError(true);
      }

      if (confRes.data?.success && confRes.data.data) {
        const c = confRes.data.data;
        setConfig(c);
        setMinVolume(c.minVolume);
        setMinTransactions(c.minTransactions);
        setTargetMargin(c.targetProfitMargin);
        setAutomationMode(c.automationMode);
        setDropThreshold(c.profitDropThreshold);
      }

      if (opRes.data?.success) {
        setOperators(opRes.data.data);
      }
      if (catRes.data?.success) {
        setCategories(catRes.data.data);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const response = await api.put('/admin/commission/intelligence/config', {
        minVolume: parseFloat(minVolume),
        minTransactions: parseInt(minTransactions),
        targetProfitMargin: parseFloat(targetMargin),
        automationMode,
        profitDropThreshold: parseFloat(dropThreshold)
      });
      if (response.data?.success) {
        toast.success("Intelligence configuration updated!");
        setConfig(response.data.data);
        setEditingConfig(false);
      } else {
        toast.error("Failed to update config");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save configuration");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSimulate = async (e) => {
    e.preventDefault();
    if (!operatorId || !categoryId || currentComm === '' || recComm === '') {
      toast.error("Please fill in all simulation fields");
      return;
    }
    setSimulating(true);
    try {
      const response = await api.post('/admin/commission/intelligence/recommendations', {
        operatorId: parseInt(operatorId),
        serviceCategoryId: parseInt(categoryId),
        role,
        currentCommission: parseFloat(currentComm),
        recommendedCommission: parseFloat(recComm),
        reasoning
      });
      if (response.data?.success) {
        toast.success("Recommendation generated and replayed successfully!");
        setOperatorId('');
        setCategoryId('');
        setCurrentComm('');
        setRecComm('');
        setReasoning('');
        fetchData();
      } else {
        toast.error("Simulation run failed");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Simulation failed");
    } finally {
      setSimulating(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      const response = await api.post(`/admin/commission/intelligence/recommendations/${id}/${action}`);
      if (response.data?.success) {
        toast.success(`Recommendation successfully ${action}ed!`);
        fetchData();
      } else {
        toast.error(`Action '${action}' failed`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to execute ${action}`);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-[var(--bg-secondary)] rounded-md shimmer-element"></div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-32 shimmer-element"></div>
          ))}
        </div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-96 shimmer-element"></div>
        <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">Retrieving commission parameters...</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Unable to load data.</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
          Commission intelligence configs unavailable. Verify that the feature flag is enabled.
        </p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  // Pre-calculated stats
  const pendingCount = recommendations.filter(r => r.status === 'SUBMITTED' || r.status === 'DRAFT').length;
  const appliedCount = recommendations.filter(r => r.status === 'APPLIED').length;
  const avgRiskScore = recommendations.length > 0 
    ? (recommendations.reduce((acc, r) => acc + r.riskScore, 0) / recommendations.length).toFixed(1) 
    : 0;

  // Chart data preparing
  const chartData = recommendations.slice(0, 8).map(r => {
    const op = operators.find(o => o.id === r.operatorId);
    return {
      name: op ? op.name : `Rec #${r.id}`,
      "Expected Growth (%)": r.expectedGrowth,
      "Expected Profit (%)": r.expectedProfit
    };
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[var(--color-primary)]" />
            Commission Intelligence Center
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Configure slab optimization metrics, simulate commission impacts, and manage automated replay proposals.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-glow)] flex items-center justify-center text-[var(--color-primary)]">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Automation Mode</p>
            <p className="text-lg font-black text-[var(--text-primary)] mt-1">{config.automationMode}</p>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Active Recommendations</p>
            <p className="text-lg font-black text-[var(--text-primary)] mt-1">{pendingCount} Pending Approval</p>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Applied Rules</p>
            <p className="text-lg font-black text-[var(--text-primary)] mt-1">{appliedCount} Applied in Slab</p>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Avg Risk Score</p>
            <p className="text-lg font-black text-[var(--text-primary)] mt-1">{avgRiskScore} / 100</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Setup config & Run simulation */}
        <div className="space-y-6 lg:col-span-1">
          {/* Intelligence Config Card */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-3">
              <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-[var(--color-primary)]" />
                Slab Optimization Setup
              </h3>
              {!editingConfig ? (
                <button 
                  onClick={() => setEditingConfig(true)}
                  className="text-xs text-[var(--color-primary)] hover:underline font-semibold cursor-pointer"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button 
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="text-xs text-emerald-500 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button 
                    onClick={() => setEditingConfig(false)}
                    className="text-xs text-rose-500 hover:underline font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)]">Automation Level:</span>
                {!editingConfig ? (
                  <span className="font-bold text-[var(--text-primary)]">{config.automationMode}</span>
                ) : (
                  <select 
                    value={automationMode}
                    onChange={(e) => setAutomationMode(e.target.value)}
                    className="bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg p-1.5 text-xs text-[var(--text-primary)] focus:outline-none"
                  >
                    <option value="MANUAL">MANUAL</option>
                    <option value="SEMI_AUTOMATIC">SEMI_AUTOMATIC</option>
                    <option value="AUTOMATIC">AUTOMATIC</option>
                  </select>
                )}
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)]">Profit Margin Target:</span>
                {!editingConfig ? (
                  <span className="font-bold text-[var(--text-primary)]">{(config.targetProfitMargin * 100).toFixed(1)}%</span>
                ) : (
                  <input 
                    type="number"
                    step="0.01"
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(e.target.value)}
                    className="w-20 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg p-1.5 text-xs text-[var(--text-primary)] focus:outline-none text-right"
                  />
                )}
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)]">Profit Drop Trigger Limit:</span>
                {!editingConfig ? (
                  <span className="font-bold text-[var(--text-primary)]">{(config.profitDropThreshold * 100).toFixed(1)}%</span>
                ) : (
                  <input 
                    type="number"
                    step="0.01"
                    value={dropThreshold}
                    onChange={(e) => setDropThreshold(e.target.value)}
                    className="w-20 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg p-1.5 text-xs text-[var(--text-primary)] focus:outline-none text-right"
                  />
                )}
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)]">Min Volume Threshold:</span>
                {!editingConfig ? (
                  <span className="font-bold text-[var(--text-primary)]">{Number(config.minVolume).toLocaleString()}</span>
                ) : (
                  <input 
                    type="number"
                    value={minVolume}
                    onChange={(e) => setMinVolume(e.target.value)}
                    className="w-24 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg p-1.5 text-xs text-[var(--text-primary)] focus:outline-none text-right"
                  />
                )}
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-[var(--text-secondary)]">Min Txns Limit:</span>
                {!editingConfig ? (
                  <span className="font-bold text-[var(--text-primary)]">{config.minTransactions} txns</span>
                ) : (
                  <input 
                    type="number"
                    value={minTransactions}
                    onChange={(e) => setMinTransactions(e.target.value)}
                    className="w-20 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg p-1.5 text-xs text-[var(--text-primary)] focus:outline-none text-right"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Simulation Proposal Form */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2 border-b border-[var(--border-soft)] pb-3">
              <Play className="w-4 h-4 text-emerald-500" />
              Simulate Proposal Replay
            </h3>

            <form onSubmit={handleSimulate} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[var(--text-secondary)] font-semibold">Operator</label>
                  <select 
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl p-2.5 text-[var(--text-primary)] focus:outline-none"
                    required
                  >
                    <option value="">Select Operator</option>
                    {operators.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[var(--text-secondary)] font-semibold">Service Type</label>
                  <select 
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl p-2.5 text-[var(--text-primary)] focus:outline-none"
                    required
                  >
                    <option value="">Select Service</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[var(--text-secondary)] font-semibold">User Role Scope</label>
                <select 
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-[var(--bg-tertiary)] border border(--border-soft) rounded-xl p-2.5 text-[var(--text-primary)] focus:outline-none"
                >
                  <option value="RETAILER">RETAILER</option>
                  <option value="DISTRIBUTOR">DISTRIBUTOR</option>
                  <option value="MASTER_DISTRIBUTOR">MASTER DISTRIBUTOR</option>
                  <option value="API_USER">API USER</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[var(--text-secondary)] font-semibold">Current Commission (%)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="e.g. 3.0"
                    value={currentComm}
                    onChange={(e) => setCurrentComm(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl p-2.5 text-[var(--text-primary)] focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[var(--text-secondary)] font-semibold">Proposed Target (%)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="e.g. 3.2"
                    value={recComm}
                    onChange={(e) => setRecComm(e.target.value)}
                    className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl p-2.5 text-[var(--text-primary)] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[var(--text-secondary)] font-semibold">Reasoning</label>
                <textarea
                  placeholder="Optimization logic detail..."
                  value={reasoning}
                  onChange={(e) => setReasoning(e.target.value)}
                  rows="2"
                  className="w-full bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl p-2.5 text-[var(--text-primary)] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full py-2.5 bg-[var(--color-primary)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                {simulating ? "Running Replay Simulator..." : "Execute Impact Replay Simulation"}
              </button>
            </form>
          </div>
        </div>

        {/* Right column: Charts & Proposals list */}
        <div className="space-y-6 lg:col-span-2">
          {/* Recharts Performance chart */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider mb-6 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--color-primary)]" />
              Impact Forecasting Model
            </h3>
            
            {chartData.length === 0 ? (
              <div className="text-center py-10 text-xs text-[var(--text-secondary)]">No simulation datasets logged yet.</div>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-soft)" opacity={0.3} />
                    <XAxis dataKey="name" stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                    <YAxis stroke="var(--text-secondary)" fontSize={10} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'var(--bg-secondary)', 
                        borderColor: 'var(--border-soft)',
                        borderRadius: '0.75rem',
                        color: 'var(--text-primary)'
                      }} 
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" fontSize={10} />
                    <Bar dataKey="Expected Growth (%)" fill="var(--color-primary)" opacity={0.8} />
                    <Bar dataKey="Expected Profit (%)" fill="#10b981" opacity={0.8} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Recommendations List Stream */}
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex items-center justify-between">
              <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">
                Intelligence Replay Recommendations
              </h3>
            </div>

            {recommendations.length === 0 ? (
              <div className="text-center py-10 text-xs text-[var(--text-secondary)]">No optimization proposals.</div>
            ) : (
              <div className="divide-y divide-[var(--border-soft)] max-h-[50vh] overflow-y-auto custom-scrollbar">
                {recommendations.map((rec) => {
                  const op = operators.find(o => o.id === rec.operatorId);
                  const cat = categories.find(c => c.id === rec.serviceCategoryId);
                  
                  return (
                    <div key={rec.id} className="p-5 space-y-3 hover:bg-[var(--accent-hover)] transition-all">
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[var(--text-primary)]">Proposal #{rec.id}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                              {op ? op.name : `Operator #${rec.operatorId}`} ({cat ? cat.name : `Service #${rec.serviceCategoryId}`})
                            </span>
                          </div>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Optimize {rec.role} commission from <strong className="text-[var(--text-primary)]">{rec.currentCommission}%</strong> to <strong className="text-emerald-500">{rec.recommendedCommission}%</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            rec.riskScore < 20 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                              : rec.riskScore < 50 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                              : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                          }`}>
                            Risk: {rec.riskScore.toFixed(0)} PTS
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            rec.status === 'APPLIED' 
                              ? 'bg-teal-500/10 text-teal-500 border border-teal-500/20' 
                              : rec.status === 'APPROVED' 
                              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                              : rec.status === 'REJECTED' || rec.status === 'ROLLED_BACK'
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                          }`}>
                            {rec.status}
                          </span>
                        </div>
                      </div>

                      {/* Forecast details */}
                      <div className="grid grid-cols-3 gap-4 bg-[var(--bg-tertiary)]/50 rounded-xl p-3 text-[10px]">
                        <div>
                          <span className="text-[var(--text-secondary)] uppercase block">Forecast Growth:</span>
                          <span className="font-bold text-[var(--text-primary)] font-mono">{rec.expectedGrowth > 0 ? `+${rec.expectedGrowth}%` : `${rec.expectedGrowth}%`}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-secondary)] uppercase block">Forecast Profit:</span>
                          <span className="font-bold text-[var(--text-primary)] font-mono">{rec.expectedProfit > 0 ? `+${rec.expectedProfit}%` : `${rec.expectedProfit}%`}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-secondary)] uppercase block">Model Version:</span>
                          <span className="font-bold text-[var(--text-primary)] font-mono">{rec.modelVersion}</span>
                        </div>
                      </div>

                      {rec.reasoning && (
                        <p className="text-[11px] text-[var(--text-secondary)] italic">
                          " {rec.reasoning} "
                        </p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 justify-end pt-1">
                        {rec.status === 'SUBMITTED' && (
                          <>
                            <button 
                              onClick={() => handleAction(rec.id, 'approve')}
                              className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" /> Approve
                            </button>
                            <button 
                              onClick={() => handleAction(rec.id, 'reject')}
                              className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                            >
                              <X className="w-3 h-3" /> Reject
                            </button>
                          </>
                        )}
                        {rec.status === 'APPROVED' && (
                          <button 
                            onClick={() => handleAction(rec.id, 'apply')}
                            className="px-3 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" /> Apply to Slab
                          </button>
                        )}
                        {rec.status === 'APPLIED' && (
                          <button 
                            onClick={() => handleAction(rec.id, 'rollback')}
                            className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> Rollback Rule
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
