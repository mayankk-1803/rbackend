import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Layers, 
  Settings, 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Download, 
  ArrowRight, 
  User, 
  Sliders, 
  DollarSign, 
  Wallet,
  ArrowDown
} from 'lucide-react';

export const CommissionSimulator = () => {
  // State for selectors
  const [users, setUsers] = useState([]);
  const [slabs, setSlabs] = useState([]);
  const [packages, setPackages] = useState([]);
  const [operators, setOperators] = useState([]);
  const [categories, setCategories] = useState([]);

  // Form Inputs
  const [selectedUserId, setSelectedUserId] = useState('');
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [slabOverrideId, setSlabOverrideId] = useState('');
  const [packageOverrideId, setPackageOverrideId] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [amount, setAmount] = useState('100');
  const [modeOverride, setModeOverride] = useState('');
  const [commissionTypeOverride, setCommissionTypeOverride] = useState('');

  // Results & Loading States
  const [loading, setLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState(null);

  // Fetch Catalogs
  const fetchCatalogs = async () => {
    try {
      // Slabs
      const slabsRes = await api.get('/admin/commission/slabs', { params: { limit: 100 } });
      if (slabsRes.data?.success) setSlabs(slabsRes.data.data.slabs || []);

      // Packages
      const pkgsRes = await api.get('/admin/commission/packages', { params: { limit: 100 } });
      if (pkgsRes.data?.success) setPackages(pkgsRes.data.data.packages || []);

      // Operators
      const opsRes = await api.get('/admin/commission/operators');
      if (opsRes.data?.success) setOperators(opsRes.data.data || []);

      // Service Categories
      const catsRes = await api.get('/admin/commission/service-categories');
      if (catsRes.data?.success) setCategories(catsRes.data.data || []);

      // Initial Users (Limit 50)
      const usersRes = await api.get('/admin/users', { params: { limit: 50 } });
      if (usersRes.data?.success) setUsers(usersRes.data.data.users || []);
    } catch (err) {
      console.error("Error loading simulator catalogs:", err);
      toast.error("Failed to load catalog data.");
    }
  };

  // Handle User Search Input
  const handleUserSearch = async (val) => {
    setSearchUserQuery(val);
    if (!val.trim()) return;
    try {
      const res = await api.get('/admin/users', { params: { search: val, limit: 20 } });
      if (res.data?.success) {
        setUsers(res.data.data.users || []);
      }
    } catch (err) {
      console.error("Error searching users:", err);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  // Run Simulation Handler
  const handleRunSimulation = async () => {
    if (!selectedOperatorId) {
      toast.error("Operator is required.");
      return;
    }
    if (!selectedCategoryId) {
      toast.error("Service Category is required.");
      return;
    }
    if (!amount || parseFloat(amount) <= 0 || isNaN(parseFloat(amount))) {
      toast.error("Please enter a valid positive transaction amount.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        userId: selectedUserId ? parseInt(selectedUserId) : undefined,
        slabId: slabOverrideId ? parseInt(slabOverrideId) : undefined,
        packageId: packageOverrideId ? parseInt(packageOverrideId) : undefined,
        operatorId: parseInt(selectedOperatorId),
        serviceCategoryId: parseInt(selectedCategoryId),
        amount: parseFloat(amount),
        mode: modeOverride || undefined,
        commissionType: commissionTypeOverride || undefined
      };

      const res = await api.post('/admin/commission/simulate', payload);
      if (res.data?.success) {
        setSimulationResult(res.data.data);
        toast.success("Simulation executed successfully.");
      } else {
        toast.error(res.data?.message || "Simulation failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Server simulation error.");
    } finally {
      setLoading(false);
    }
  };

  // Reset parameters
  const handleClearParameters = () => {
    setSelectedUserId('');
    setSearchUserQuery('');
    setSlabOverrideId('');
    setPackageOverrideId('');
    setSelectedOperatorId('');
    setSelectedCategoryId('');
    setAmount('100');
    setModeOverride('');
    setCommissionTypeOverride('');
    setSimulationResult(null);
    toast.success("Simulator parameters cleared.");
  };

  // Export Simulation JSON Handler
  const handleExportSimulation = () => {
    if (!simulationResult) return;

    const exportData = {
      timestamp: new Date().toISOString(),
      userId: selectedUserId ? parseInt(selectedUserId) : null,
      packageId: packageOverrideId ? parseInt(packageOverrideId) : null,
      slabId: slabOverrideId ? parseInt(slabOverrideId) : null,
      operatorId: parseInt(selectedOperatorId),
      serviceCategoryId: parseInt(selectedCategoryId),
      amount: parseFloat(amount),
      resolutionPath: simulationResult.resolutionPath,
      winningRule: simulationResult.winningRule,
      financials: simulationResult.financials,
      trace: simulationResult.trace
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `dizipay_simulation_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast.success("Simulation snapshot exported successfully!");
  };

  // Match visual highlight path
  const getWinningPath = (ruleSource) => {
    if (!ruleSource) return null;
    if (ruleSource.includes("RANGE_RULE")) return "RANGE";
    if (ruleSource.includes("RECHARGE_RULE")) return "RECHARGE";
    if (ruleSource.includes("LEGACY_RULE")) return "LEGACY";
    return "DEFAULT";
  };

  const winningPath = simulationResult ? getWinningPath(simulationResult.resolutionPath.ruleSource) : null;
  const slabSourceText = simulationResult ? simulationResult.resolutionPath.slabSource : null;

  return (
    <div className="p-6 text-[var(--text-primary)] min-h-screen bg-[var(--bg-primary)]">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-4 border-b border-[var(--border-color)]">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-2">
            <Sliders className="w-6 h-6 text-[var(--accent-color)]" />
            Commission Simulator
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Production-safe rate resolution verification workbench. Standard read-only mode.
          </p>
        </div>
        <div className="mt-4 md:mt-0 flex gap-2">
          {simulationResult && (
            <button
              onClick={handleExportSimulation}
              className="px-4 py-2 text-xs font-bold rounded-lg border border-[var(--accent-color)] text-[var(--accent-color)] bg-transparent hover:bg-[rgba(99,102,241,0.1)] transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Export Simulation Snapshot
            </button>
          )}
          <button
            onClick={handleClearParameters}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-primary)] hover:brightness-110 transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset Workbench
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Input panel (1/3 width) */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] backdrop-blur-md shadow-xl flex flex-col gap-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
              <Settings className="w-4 h-4 text-[var(--accent-color)]" />
              Simulation Controls
            </h2>

            {/* User Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
                <span>Select User Context (Optional)</span>
                {selectedUserId && <span className="text-[var(--accent-color)] text-[10px]">Loaded</span>}
              </label>
              <div className="relative">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-color)]"
                >
                  <option value="">-- No User (Mocks default RETAILER role) --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.commissionRole || 'RETAILER'} - {u.tier || 'Standard'})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  placeholder="Quick search user name/email..."
                  value={searchUserQuery}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  className="w-full px-2 py-1 text-[11px] rounded border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="border-t border-[var(--border-color)] my-1"></div>

            {/* Slab Override */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Slab Override (Optional)</label>
              <select
                value={slabOverrideId}
                onChange={(e) => setSlabOverrideId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                <option value="">-- Use User Slab Assignment --</option>
                {slabs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} {s.isDefault ? '(Default)' : ''}</option>
                ))}
              </select>
            </div>

            {/* Package Override */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Package Override (Optional)</label>
              <select
                value={packageOverrideId}
                onChange={(e) => setPackageOverrideId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                <option value="">-- Use User Package Assignment --</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="border-t border-[var(--border-color)] my-1"></div>

            {/* Operator */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Operator (Required)</label>
              <select
                value={selectedOperatorId}
                onChange={(e) => setSelectedOperatorId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                <option value="">-- Select Operator --</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Service Category (Required)</label>
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Transaction Amount (Required)</label>
              <div className="relative rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] flex items-center">
                <span className="pl-3 text-xs font-bold text-[var(--text-secondary)]">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2 py-2 text-xs bg-transparent text-[var(--text-primary)] focus:outline-none"
                />
              </div>
            </div>

            {/* Mode Override */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Mode Override (Optional)</label>
              <select
                value={modeOverride}
                onChange={(e) => setModeOverride(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                <option value="">-- Evaluate Mode Priorities (REAL &gt; GENERAL) --</option>
                <option value="REAL">REAL</option>
                <option value="GENERAL">GENERAL</option>
              </select>
            </div>

            {/* Comm Type Override */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Commission Type Override (Optional)</label>
              <select
                value={commissionTypeOverride}
                onChange={(e) => setCommissionTypeOverride(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
              >
                <option value="">-- Use Assigned Rule Defaults --</option>
                <option value="PERCENTAGE">PERCENTAGE</option>
                <option value="FLAT">FLAT</option>
              </select>
            </div>

            {/* Action Trigger */}
            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="mt-2 w-full py-2.5 rounded-lg bg-[var(--accent-color)] text-white font-black text-xs uppercase tracking-wider hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[rgba(99,102,241,0.2)]"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Simulating Precedence Resolution...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Evaluate Resolution Path
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Output panels (2/3 width) */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          {!simulationResult ? (
            <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center border border-dashed border-[var(--border-color)] rounded-2xl bg-[rgba(255,255,255,0.02)] p-12 text-center">
              <div className="w-12 h-12 rounded-xl bg-[rgba(99,102,241,0.1)] flex items-center justify-center text-[var(--accent-color)] mb-4 animate-pulse">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-[var(--text-primary)]">Workbench Ready</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mt-1">
                Enter simulated user credentials, operators, amounts, and click "Evaluate Resolution Path" to preview target transaction settlement rules.
              </p>
            </div>
          ) : (
            <>
              {/* Financial Dashboard */}
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] backdrop-blur shadow flex flex-col gap-1 text-center">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Commission</span>
                  <span className="text-base font-black text-emerald-500">
                    {simulationResult.financials.commission}
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)]">
                    Type: {simulationResult.winningRule.commissionType}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] backdrop-blur shadow flex flex-col gap-1 text-center">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Surcharge</span>
                  <span className="text-base font-black text-amber-500">
                    {simulationResult.financials.surcharge}
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)]">
                    Type: {simulationResult.winningRule.surchargeType}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] backdrop-blur shadow flex flex-col gap-1 text-center">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Profit Margin</span>
                  <span className="text-base font-black text-indigo-500">
                    {simulationResult.financials.profit}
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)]">
                    Type: {simulationResult.winningRule.profitType}
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] backdrop-blur shadow flex flex-col gap-1 text-center">
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Service Fee</span>
                  <span className="text-base font-black text-red-500">
                    {simulationResult.financials.fee}
                  </span>
                  <span className="text-[9px] text-[var(--text-secondary)]">
                    Type: {simulationResult.winningRule.feeType}
                  </span>
                </div>

                <div className="col-span-2 lg:col-span-1 p-4 rounded-xl border border-[var(--accent-color)] bg-[rgba(99,102,241,0.05)] backdrop-blur shadow flex flex-col gap-1 text-center relative overflow-hidden">
                  <span className="text-[10px] font-black text-[var(--accent-color)] uppercase tracking-wider flex items-center justify-center gap-1">
                    <Wallet className="w-3 h-3" />
                    Wallet Estimate
                  </span>
                  <span className={`text-base font-black ${parseFloat(simulationResult.financials.walletImpactEstimate) >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {simulationResult.financials.walletImpactEstimate}
                  </span>
                  <span className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                    Estimated Wallet Impact
                  </span>
                  <div className="text-[7px] text-[var(--text-secondary)] border-t border-[rgba(99,102,241,0.2)] mt-1 pt-1 font-bold">
                    Not Live Settlement
                  </div>
                </div>
              </div>

              {/* Precedence Flow Diagram */}
              <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] backdrop-blur shadow-lg flex flex-col gap-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[var(--accent-color)]" />
                  Resolution Path Precedence Flow
                </h3>

                <div className="flex flex-col lg:flex-row items-center justify-center gap-2 py-4 px-2 bg-[rgba(0,0,0,0.2)] rounded-xl relative">
                  {/* Step 1: User Override */}
                  <div className={`p-3 rounded-lg border text-center flex flex-col gap-1 w-full lg:w-44 transition-all ${slabSourceText === "USER_SLAB_OVERRIDE" || slabSourceText === "MANUAL_SLAB_OVERRIDE" ? 'border-emerald-500 bg-[rgba(16,185,129,0.1)] shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold' : 'border-[var(--border-color)] bg-[var(--bg-primary)] opacity-40'}`}>
                    <span className="text-[9px] uppercase tracking-wider font-semibold">1. User Slab Override</span>
                    <span className="text-[10px] font-mono truncate">{slabSourceText === "USER_SLAB_OVERRIDE" || slabSourceText === "MANUAL_SLAB_OVERRIDE" ? `Slab: ${simulationResult.resolutionPath.slabName}` : 'Inactive'}</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] hidden lg:block rotate-0" />
                  <ArrowDown className="w-4 h-4 text-[var(--text-secondary)] lg:hidden block" />

                  {/* Step 2: Package Resolution */}
                  <div className={`p-3 rounded-lg border text-center flex flex-col gap-1 w-full lg:w-44 transition-all ${slabSourceText === "PACKAGE_SLAB_RESOLUTION" ? 'border-emerald-500 bg-[rgba(16,185,129,0.1)] shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold' : 'border-[var(--border-color)] bg-[var(--bg-primary)] opacity-40'}`}>
                    <span className="text-[9px] uppercase tracking-wider font-semibold">2. Package Resolution</span>
                    <span className="text-[10px] font-mono truncate">{slabSourceText === "PACKAGE_SLAB_RESOLUTION" ? `Slab: ${simulationResult.resolutionPath.slabName}` : 'Inactive'}</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] hidden lg:block rotate-0" />
                  <ArrowDown className="w-4 h-4 text-[var(--text-secondary)] lg:hidden block" />

                  {/* Step 3: Range Rule */}
                  <div className={`p-3 rounded-lg border text-center flex flex-col gap-1 w-full lg:w-44 transition-all ${winningPath === "RANGE" ? 'border-emerald-500 bg-[rgba(16,185,129,0.1)] shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold' : 'border-[var(--border-color)] bg-[var(--bg-primary)] opacity-40'}`}>
                    <span className="text-[9px] uppercase tracking-wider font-semibold">3. Range Rules</span>
                    <span className="text-[10px] font-mono truncate">{winningPath === "RANGE" ? `Rule ID: #${simulationResult.winningRule.id}` : 'Inactive'}</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] hidden lg:block rotate-0" />
                  <ArrowDown className="w-4 h-4 text-[var(--text-secondary)] lg:hidden block" />

                  {/* Step 4: Recharge Rule */}
                  <div className={`p-3 rounded-lg border text-center flex flex-col gap-1 w-full lg:w-44 transition-all ${winningPath === "RECHARGE" ? 'border-emerald-500 bg-[rgba(16,185,129,0.1)] shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold' : 'border-[var(--border-color)] bg-[var(--bg-primary)] opacity-40'}`}>
                    <span className="text-[9px] uppercase tracking-wider font-semibold">4. Recharge Rules</span>
                    <span className="text-[10px] font-mono truncate">{winningPath === "RECHARGE" ? `Rule ID: #${simulationResult.winningRule.id}` : 'Inactive'}</span>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[var(--text-secondary)] hidden lg:block rotate-0" />
                  <ArrowDown className="w-4 h-4 text-[var(--text-secondary)] lg:hidden block" />

                  {/* Step 5: Legacy/Default fallback */}
                  <div className={`p-3 rounded-lg border text-center flex flex-col gap-1 w-full lg:w-44 transition-all ${winningPath === "LEGACY" || winningPath === "DEFAULT" ? 'border-emerald-500 bg-[rgba(16,185,129,0.1)] shadow-[0_0_12px_rgba(16,185,129,0.2)] font-bold' : 'border-[var(--border-color)] bg-[var(--bg-primary)] opacity-40'}`}>
                    <span className="text-[9px] uppercase tracking-wider font-semibold">5. Legacy / System Default</span>
                    <span className="text-[10px] font-mono truncate">{winningPath === "LEGACY" || winningPath === "DEFAULT" ? `${simulationResult.resolutionPath.ruleSource}` : 'Inactive'}</span>
                  </div>
                </div>

                <div className="flex gap-2 items-center p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
                  <Info className="w-4 h-4 text-[var(--accent-color)] shrink-0" />
                  <div>
                    <strong>Winning Path Source:</strong> {simulationResult.resolutionPath.ruleSource} (resolved target: <strong>{simulationResult.resolutionPath.slabName}</strong>)
                  </div>
                </div>
              </div>

              {/* Trace Table */}
              <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] backdrop-blur shadow-lg flex flex-col gap-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">
                  Diagnostic Resolution Trace Log
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-[var(--text-secondary)] font-bold">
                        <th className="py-2 px-3">Rule ID</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Mode</th>
                        <th className="py-2 px-3">Amount range</th>
                        <th className="py-2 px-3">Priority Score</th>
                        <th className="py-2 px-3 text-center">Decision</th>
                        <th className="py-2 px-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simulationResult.trace.map((t, index) => {
                        const isWinner = t.decision === "SELECTED";
                        const isRejected = t.decision.startsWith("REJECTED_");
                        const isOutranked = t.decision.startsWith("OUTRANKED_");

                        let rowBg = "hover:bg-[rgba(255,255,255,0.02)]";
                        let statusColor = "bg-[var(--bg-secondary)] text-[var(--text-primary)]";

                        if (isWinner) {
                          rowBg = "bg-[rgba(16,185,129,0.05)] hover:bg-[rgba(16,185,129,0.08)] border-l-2 border-emerald-500";
                          statusColor = "bg-emerald-500 text-white font-bold";
                        } else if (isRejected) {
                          statusColor = "bg-red-500/25 text-red-300";
                        } else if (isOutranked) {
                          statusColor = "bg-amber-500/25 text-amber-300";
                        }

                        return (
                          <tr key={index} className={`border-b border-[var(--border-color)] transition-all ${rowBg}`}>
                            <td className="py-3 px-3 font-mono font-bold">
                              {t.ruleId ? `#${t.ruleId}` : 'N/A'}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.ruleType === "RANGE" ? 'bg-indigo-500/20 text-indigo-300' : 'bg-sky-500/20 text-sky-300'}`}>
                                {t.ruleType}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-[var(--text-secondary)]">
                              {t.mode}
                            </td>
                            <td className="py-3 px-3 font-mono text-[var(--text-secondary)]">
                              {t.amountRange}
                            </td>
                            <td className="py-3 px-3 font-mono text-center font-semibold text-[var(--text-secondary)]">
                              {t.priorityScore}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${statusColor}`}>
                                {t.decision}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-[var(--text-secondary)] max-w-xs truncate" title={t.reason}>
                              {t.reason}
                            </td>
                          </tr>
                        );
                      })}
                      {simulationResult.trace.length === 0 && (
                        <tr>
                          <td colSpan="7" className="py-6 text-center text-[var(--text-secondary)] italic">
                            No rules evaluated. Path resolved via default fallback directly.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
