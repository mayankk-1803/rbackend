import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Percent, 
  AlertTriangle, 
  AlertOctagon, 
  Calendar, 
  User, 
  Cpu, 
  Search, 
  RefreshCw, 
  Eye, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  FileText
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend,
  BarChart,
  Bar
} from 'recharts';

const MISMATCH_REASONS = {
  RULE_NOT_FOUND: 'Rule Not Found',
  LEGACY_RULE_USED: 'Legacy Rule Used',
  RANGE_MISMATCH: 'Range Mismatch',
  RECHARGE_MISMATCH: 'Recharge Mismatch',
  PACKAGE_MAPPING: 'Package Slab Resolution',
  SLAB_OVERRIDE: 'Slab Override',
  ROUNDING: 'Rounding / Precision Diff',
  MODE_PRIORITY: 'Mode Priority Conflict',
  UNKNOWN: 'Unknown / Unmapped Mismatch'
};

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280', '#14B8A6'];

export const ShadowValidation = () => {
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [userId, setUserId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [slabId, setSlabId] = useState('');
  const [mismatchType, setMismatchType] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  
  // Lists for dropdowns
  const [operators, setOperators] = useState([]);
  const [packages, setPackages] = useState([]);
  const [slabs, setSlabs] = useState([]);

  // Data states
  const [stats, setStats] = useState({
    totalCompared: 0,
    matches: 0,
    mismatches: 0,
    matchPercent: 100,
    topMismatchReasons: [],
    dailyTrend: [],
    operatorBreakdown: []
  });
  
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  
  // UI States
  const [loadingStats, setLoadingStats] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  // Migration & Rollout States
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [migrationConfig, setMigrationConfig] = useState({
    commissionEngineVersion: 'LEGACY',
    rolloutPercent: 0
  });
  const [migrationMetrics, setMigrationMetrics] = useState({
    transactionsProcessed: { total: 0, legacy: 0, new: 0 },
    averageCommission: 0.0,
    mismatchRate: 0.0,
    fallbackRate: 0.0,
    ruleNotFoundRate: 0.0
  });
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Fetch Dropdown Catalogs
  const fetchCatalogs = async () => {
    try {
      const opsRes = await api.get('/admin/commission/operators');
      if (opsRes.data?.success) setOperators(opsRes.data.data || []);

      const pkgsRes = await api.get('/admin/commission/packages', { params: { limit: 100 } });
      if (pkgsRes.data?.success) setPackages(pkgsRes.data.data.packages || []);

      const slabsRes = await api.get('/admin/commission/slabs', { params: { limit: 100 } });
      if (slabsRes.data?.success) setSlabs(slabsRes.data.data.slabs || []);
    } catch (err) {
      console.error("Error fetching shadow validation catalogs:", err);
    }
  };

  // Fetch Migration Configuration
  const fetchMigrationConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await api.get('/admin/commission/config');
      if (res.data?.success) {
        setMigrationConfig(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching migration config:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  // Fetch Migration Metrics
  const fetchMigrationMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const params = {
        startDate: startDate || undefined,
        endDate: endDate || undefined
      };
      const res = await api.get('/admin/commission/migration/metrics', { params });
      if (res.data?.success) {
        setMigrationMetrics(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching migration metrics:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  // Update Migration Configuration (SUPER_ADMIN only)
  const handleUpdateConfig = async (newVersion, newPercent) => {
    if (!isSuperAdmin) {
      toast.error("Access Denied: Only SUPER_ADMIN can modify the configuration.");
      return;
    }
    const toastId = toast.loading("Updating migration configuration...");
    try {
      const res = await api.put('/admin/commission/config', {
        commissionEngineVersion: newVersion,
        rolloutPercent: parseInt(newPercent)
      });
      if (res.data?.success) {
        setMigrationConfig(res.data.data);
        toast.success(res.data.message || "Configuration updated successfully", { id: toastId });
        fetchMigrationMetrics();
      } else {
        toast.error(res.data.message || "Failed to update configuration", { id: toastId });
      }
    } catch (err) {
      console.error("Error updating config:", err);
      toast.error(err.response?.data?.message || "Failed to update configuration", { id: toastId });
    }
  };

  // Fetch Dashboard aggregate stats
  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const params = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        operatorId: operatorId || undefined,
        userId: userId || undefined,
        packageId: packageId || undefined,
        slabId: slabId || undefined,
        mismatchType: mismatchType || undefined,
        matchStatus: matchStatus || undefined
      };
      const res = await api.get('/admin/commission/shadow-validation/stats', { params });
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error("Error fetching shadow validation stats:", err);
      toast.error("Failed to load validation statistics.");
    } finally {
      setLoadingStats(false);
    }
  };

  // Fetch individual comparison record logs
  const fetchList = async (page = 1) => {
    setLoadingList(true);
    try {
      const params = {
        page,
        limit: pagination.limit,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        operatorId: operatorId || undefined,
        userId: userId || undefined,
        packageId: packageId || undefined,
        slabId: slabId || undefined,
        mismatchType: mismatchType || undefined,
        matchStatus: matchStatus || undefined
      };
      const res = await api.get('/admin/commission/shadow-validation/list', { params });
      if (res.data?.success) {
        setRecords(res.data.data.records);
        setPagination({
          page: res.data.data.pagination.page,
          limit: res.data.data.pagination.limit,
          total: res.data.data.pagination.total,
          totalPages: res.data.data.pagination.totalPages
        });
      }
    } catch (err) {
      console.error("Error fetching shadow validation list:", err);
      toast.error("Failed to load comparison records.");
    } finally {
      setLoadingList(false);
    }
  };

  // Run on mount
  useEffect(() => {
    fetchCatalogs();
    const stored = sessionStorage.getItem("dizipay_admin_data");
    if (stored) {
      const adminData = JSON.parse(stored);
      setIsSuperAdmin(adminData.role === "SUPER_ADMIN");
    }
    fetchMigrationConfig();
  }, []);

  // Run when filters are modified or paginated
  useEffect(() => {
    fetchStats();
    fetchList(1);
    fetchMigrationMetrics();
  }, [startDate, endDate, operatorId, userId, packageId, slabId, mismatchType, matchStatus]);

  // Handle pagination changes
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchList(newPage);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setOperatorId('');
    setUserId('');
    setPackageId('');
    setSlabId('');
    setMismatchType('');
    setMatchStatus('');
    toast.success("Filters cleared successfully.");
  };

  // Alerts logic based on mismatch rate threshold
  const mismatchPercent = 100 - stats.matchPercent;
  const isCritical = stats.totalCompared > 100 && mismatchPercent > 2.0;
  const isWarning = stats.totalCompared > 100 && mismatchPercent > 0.5 && mismatchPercent <= 2.0;

  // Render pie chart data for mismatches
  const pieData = stats.topMismatchReasons.map((item, idx) => ({
    name: MISMATCH_REASONS[item.reason] || item.reason,
    value: item.count,
    color: CHART_COLORS[idx % CHART_COLORS.length]
  }));

  // Render daily trend chart data
  const trendData = stats.dailyTrend.map(d => ({
    date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    Matches: d.matches,
    Mismatches: d.mismatches,
    Total: d.total
  }));

  // Render operator breakdown chart data
  const opData = stats.operatorBreakdown.map(o => ({
    name: o.name,
    Matches: o.matches,
    Mismatches: o.mismatches
  })).slice(0, 8); // Top 8 operators to prevent visual clutter

  return (
    <div className="space-y-6 pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border-soft)] pb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2.5">
            <Cpu className="w-6 h-6 text-[var(--color-primary)]" />
            Controlled Parallel Validation (Shadow Mode)
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Validating real-time production recharge transactions against the simulator engine without ledger or wallet impacts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => { 
              fetchStats(); 
              fetchList(pagination.page); 
              fetchMigrationConfig(); 
              fetchMigrationMetrics(); 
              toast.success("Refreshed metrics!"); 
            }}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats || loadingList || loadingConfig || loadingMetrics ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
              showFilters 
                ? 'bg-[var(--color-primary-glow)] border-[var(--color-primary)] text-[var(--color-primary)]' 
                : 'bg-[var(--bg-secondary)] border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>
      </div>

      {/* Warning/Critical alerts banners */}
      {isCritical && (
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 animate-pulse">
          <AlertOctagon className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Critical Discrepancy Rate Exceeded</h4>
            <p className="text-xs mt-1 leading-relaxed">
              Shadow validation has recorded a mismatch rate of <strong className="underline font-extrabold">{mismatchPercent.toFixed(2)}%</strong> (Threshold: 2.0%). Please inspect slab configurations and rule values before commencing final cutover.
            </p>
          </div>
        </div>
      )}

      {isWarning && (
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Elevated Discrepancy Detected</h4>
            <p className="text-xs mt-1 leading-relaxed">
              The discrepancy rate is currently <strong className="font-bold">{mismatchPercent.toFixed(2)}%</strong>, which exceeds the warning threshold of 0.5%. Verify if mismatch classifications point to rounding variance or missing fallback rules.
            </p>
          </div>
        </div>
      )}

      {/* Commission Engine Migration & Cutover Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cutover Controls Card */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] space-y-6 hover:shadow-md transition-shadow relative overflow-hidden">
          {/* Subtle decoration/glow */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--color-primary-glow)] rounded-full blur-3xl opacity-30"></div>
          
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[var(--color-primary)]" />
                Commission Engine Migration Control
              </h2>
              <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                Manage progressive rollout of the new simulator-based precedence resolution engine.
              </p>
            </div>
            <span className={`inline-flex px-2.5 py-1 text-[10px] font-black rounded-full uppercase tracking-wider ${
              migrationConfig.commissionEngineVersion === "NEW" 
                ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                : migrationConfig.commissionEngineVersion === "HYBRID"
                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                : "bg-blue-500/10 text-blue-500 border border-blue-500/20"
            }`}>
              Active: {migrationConfig.commissionEngineVersion} {migrationConfig.commissionEngineVersion === "HYBRID" ? `(${migrationConfig.rolloutPercent}%)` : ""}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Mode Selection */}
            <div className="space-y-4">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Engine Version Flag</label>
              <div className="space-y-2.5">
                {[
                  {
                    value: "LEGACY",
                    title: "Legacy Engine",
                    desc: "100% of traffic routes through the legacy commission engine."
                  },
                  {
                    value: "HYBRID",
                    title: "Hybrid Progressive Rollout",
                    desc: "Split traffic based on user bucket modulo hash."
                  },
                  {
                    value: "NEW",
                    title: "Simulator Engine (NEW)",
                    desc: "100% of traffic routes through the simulator commission engine."
                  }
                ].map((mode) => (
                  <button
                    key={mode.value}
                    disabled={!isSuperAdmin}
                    onClick={() => handleUpdateConfig(mode.value, mode.value === "HYBRID" ? 10 : 0)}
                    className={`w-full p-3.5 rounded-xl border text-left transition-all ${
                      migrationConfig.commissionEngineVersion === mode.value
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-glow)]"
                        : "border-[var(--border-soft)] bg-[var(--bg-primary)] hover:bg-[var(--accent-hover)]"
                    } ${!isSuperAdmin ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)]">{mode.title}</span>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                        migrationConfig.commissionEngineVersion === mode.value
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                          : "border-[var(--border-soft)]"
                      }`}>
                        {migrationConfig.commissionEngineVersion === mode.value && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">{mode.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Rollout Percent Slider & 24hr Buffer */}
            <div className="space-y-5 flex flex-col justify-between">
              {migrationConfig.commissionEngineVersion === "HYBRID" && (
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider block">
                    Rollout Percentage ({migrationConfig.rolloutPercent}%)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 25, 50, 100].map((pct) => (
                      <button
                        key={pct}
                        disabled={!isSuperAdmin}
                        onClick={() => handleUpdateConfig("HYBRID", pct)}
                        className={`py-2 rounded-lg text-xs font-bold border transition-all ${
                          migrationConfig.rolloutPercent === pct
                            ? "bg-[var(--color-primary)] border-[var(--color-primary)] text-white"
                            : "bg-[var(--bg-primary)] border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--accent-hover)]"
                        } ${!isSuperAdmin ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-[var(--text-secondary)] italic leading-relaxed">
                    Splits transactions by hashing the customer user ID. Users in buckets below the percentage threshold will run on the new simulator-based engine.
                  </p>
                </div>
              )}

              {migrationConfig.commissionEngineVersion !== "HYBRID" && (
                <div className="p-4 rounded-xl bg-[var(--bg-primary)] border border-[var(--border-soft)] text-center text-[var(--text-secondary)] text-xs flex flex-col items-center justify-center min-h-[100px]">
                  <Cpu className="w-6 h-6 text-[var(--text-secondary)] opacity-50 mb-2" />
                  Select "Hybrid" mode to customize the progressive traffic rollout percentage slider.
                </div>
              )}

              {/* 24-hour monitoring buffer banner */}
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                <h4 className="font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Mandatory Monitoring Stage
                </h4>
                <p className="text-[9px] leading-relaxed mt-1">
                  Upon switching the engine version or adjusting rollout configuration, a mandatory <strong>24-hour telemetry evaluation stage</strong> is required. Monitor mismatches and rule resolution anomalies continuously before approving complete cutover (100% NEW).
                </p>
              </div>
            </div>
          </div>

          {!isSuperAdmin && (
            <div className="text-[10px] font-semibold text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
              Note: Current permissions allow viewing configuration only. Modify operations are restricted to SUPER_ADMIN users.
            </div>
          )}
        </div>

        {/* Telemetry Metrics Panel */}
        <div className="p-6 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] space-y-4 hover:shadow-md transition-shadow flex flex-col justify-between">
          <div className="border-b border-[var(--border-soft)] pb-4">
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--color-primary)]" />
              Migration Telemetry
            </h2>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">
              Real-time monitoring metrics from live routed traffic.
            </p>
          </div>

          <div className="space-y-3.5 flex-1 py-2">
            {/* Transactions Split */}
            <div className="flex items-center justify-between border-b border-[var(--border-soft)]/40 pb-2">
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">Routed Transactions:</span>
              <div className="text-right">
                <div className="font-bold text-[var(--text-primary)] text-xs">
                  {migrationMetrics.transactionsProcessed?.total || 0} Total
                </div>
                <div className="text-[9px] text-[var(--text-secondary)]">
                  Legacy: {migrationMetrics.transactionsProcessed?.legacy || 0} | New: {migrationMetrics.transactionsProcessed?.new || 0}
                </div>
              </div>
            </div>

            {/* Mismatch Rate */}
            <div className="flex items-center justify-between border-b border-[var(--border-soft)]/40 pb-2">
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">Shadow Mismatch Rate:</span>
              <span className={`font-mono font-bold text-xs ${
                migrationMetrics.mismatchRate > 5.0 ? "text-rose-500" : migrationMetrics.mismatchRate > 0.0 ? "text-amber-500" : "text-emerald-500"
              }`}>
                {Number(migrationMetrics.mismatchRate).toFixed(2)}%
              </span>
            </div>

            {/* Fallback Rate */}
            <div className="flex items-center justify-between border-b border-[var(--border-soft)]/40 pb-2">
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">Fallback Rate (Legacy Match):</span>
              <span className={`font-mono font-bold text-xs ${
                migrationMetrics.fallbackRate > 1.0 ? "text-rose-500" : "text-[var(--text-primary)]"
              }`}>
                {Number(migrationMetrics.fallbackRate).toFixed(2)}%
              </span>
            </div>

            {/* Rule Not Found Rate */}
            <div className="flex items-center justify-between pb-2">
              <span className="text-[10px] text-[var(--text-secondary)] font-medium">Rule Not Found (Default Fallback):</span>
              <span className={`font-mono font-bold text-xs ${
                migrationMetrics.ruleNotFoundRate > 0.5 ? "text-rose-500" : "text-[var(--text-primary)]"
              }`}>
                {Number(migrationMetrics.ruleNotFoundRate).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Dynamic Telemetry Warnings */}
          <div className="space-y-2">
            {migrationMetrics.mismatchRate > 5.0 && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-bold">
                <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                Critical Discrepancy Rate exceeds 5%! Rollback advised.
              </div>
            )}
            {migrationMetrics.fallbackRate > 1.0 && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                High Fallback Rate (&gt;1%) detected on simulator engine.
              </div>
            )}
            {migrationMetrics.ruleNotFoundRate > 0.5 && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Rule Not Found Rate exceeds 0.5% fallback limit!
              </div>
            )}
            {migrationMetrics.mismatchRate <= 5.0 && migrationMetrics.fallbackRate <= 1.0 && migrationMetrics.ruleNotFoundRate <= 0.5 && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                All migration telemetry values within safety thresholds.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter drawer/section */}
      {showFilters && (
        <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Search & Filters</span>
            <button onClick={handleClearFilters} className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer">
              Clear All Filters
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* User Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">User ID</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)] opacity-60" />
                <input 
                  type="number" 
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="Filter User ID..."
                  className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Operator Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Operator</label>
              <select 
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="w-full text-xs px-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All Operators</option>
                {operators.map(o => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>

            {/* Package Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Commission Package</label>
              <select 
                value={packageId}
                onChange={(e) => setPackageId(e.target.value)}
                className="w-full text-xs px-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All Packages</option>
                {packages.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Slab Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Commission Slab</label>
              <select 
                value={slabId}
                onChange={(e) => setSlabId(e.target.value)}
                className="w-full text-xs px-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All Slabs</option>
                {slabs.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Date Range Start */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Start Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)] opacity-60" />
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Date Range End */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">End Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-[var(--text-secondary)] opacity-60" />
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
                />
              </div>
            </div>

            {/* Match Status Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Match Status</label>
              <select 
                value={matchStatus}
                onChange={(e) => setMatchStatus(e.target.value)}
                className="w-full text-xs px-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All statuses</option>
                <option value="match">Match (Success)</option>
                <option value="mismatch">Mismatch (Discrepancy)</option>
              </select>
            </div>

            {/* Mismatch Type Filter */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Mismatch Reason</label>
              <select 
                value={mismatchType}
                onChange={(e) => setMismatchType(e.target.value)}
                className="w-full text-xs px-4 py-2.5 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--color-primary)]"
              >
                <option value="">All mismatch types</option>
                {Object.entries(MISMATCH_REASONS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Aggregate metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Compared */}
        <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Total Compared</span>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-1">
              {stats.totalCompared.toLocaleString()}
            </h3>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">transactions validation</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* Matches */}
        <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Matches</span>
            <h3 className="text-2xl font-bold text-emerald-500 mt-1">
              {stats.matches.toLocaleString()}
            </h3>
            <p className="text-[10px] text-emerald-500/80 mt-1.5">identical results</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Mismatches */}
        <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Mismatches</span>
            <h3 className={`text-2xl font-bold mt-1 ${stats.mismatches > 0 ? 'text-rose-500' : 'text-[var(--text-secondary)]'}`}>
              {stats.mismatches.toLocaleString()}
            </h3>
            <p className="text-[10px] text-rose-500/80 mt-1.5">discrepancies flagged</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.mismatches > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-gray-500/10 text-gray-500'}`}>
            <XCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Match Percentage */}
        <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Match Rate</span>
            <h3 className={`text-2xl font-bold mt-1 ${stats.matchPercent >= 99.5 ? 'text-emerald-500' : stats.matchPercent >= 98.0 ? 'text-amber-500' : 'text-rose-500'}`}>
              {stats.matchPercent.toFixed(2)}%
            </h3>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1.5">Target &ge; 99.50%</p>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.matchPercent >= 99.5 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            <Percent className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily trend area chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Daily Validation Trend (Matches vs Mismatches)</h3>
            <span className="text-[10px] font-semibold text-[var(--text-secondary)]">Last 30 Days</span>
          </div>
          <div className="h-72 w-full">
            {stats.dailyTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[var(--text-secondary)]">No trend data found in date range</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="matchesGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="mismatchesGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" opacity={0.6} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--text-secondary)" opacity={0.7} />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--text-secondary)" opacity={0.7} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderColor: 'var(--border-soft)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: 'var(--text-primary)'
                    }} 
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Area type="monotone" dataKey="Matches" stroke="#10B981" fillOpacity={1} fill="url(#matchesGlow)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Mismatches" stroke="#EF4444" fillOpacity={1} fill="url(#mismatchesGlow)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Mismatch breakdown donut chart */}
        <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Discrepancy Breakdown</h3>
            <span className="text-[10px] font-semibold text-rose-500">Mismatches</span>
          </div>
          <div className="h-56 w-full relative flex items-center justify-center">
            {stats.mismatches === 0 ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-secondary)]">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                No discrepancies recorded!
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-secondary)', 
                      borderColor: 'var(--border-soft)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      color: 'var(--text-primary)'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {stats.mismatches > 0 && (
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Discrepancies</span>
                <span className="text-xl font-black text-rose-500">{stats.mismatches}</span>
              </div>
            )}
          </div>
          {stats.mismatches > 0 ? (
            <div className="max-h-28 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {pieData.map((d, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] font-medium">
                  <div className="flex items-center gap-2 truncate pr-4">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }}></div>
                    <span className="text-[var(--text-primary)] truncate">{d.name}</span>
                  </div>
                  <span className="text-[var(--text-secondary)] font-bold">{d.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[10px] text-center text-emerald-500/80 font-bold bg-emerald-500/10 py-2 rounded-xl">
              All rules resolving matches cleanly.
            </div>
          )}
        </div>
      </div>

      {/* Operator Breakdown Chart */}
      {stats.operatorBreakdown.length > 0 && (
        <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Discrepancy Breakdown by Mobile Operator</h3>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={opData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-soft)" opacity={0.6} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="var(--text-secondary)" interval={0} angle={-15} textAnchor="end" />
                <YAxis tick={{ fontSize: 9 }} stroke="var(--text-secondary)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderColor: 'var(--border-soft)',
                    borderRadius: '12px',
                    fontSize: '11px',
                    color: 'var(--text-primary)'
                  }} 
                />
                <Legend wrapperStyle={{ fontSize: 9 }} />
                <Bar dataKey="Matches" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Mismatches" fill="#EF4444" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Individual validations table */}
      <div className="p-5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-soft)]">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[var(--color-primary)]" />
            Telemetry Comparison Audit Logs
          </h3>
          <span className="text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2.5 py-1 rounded-full uppercase tracking-wider">
            Showing {records.length} of {pagination.total} entries
          </span>
        </div>

        {/* Table wrapper */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-[10px] font-bold uppercase text-[var(--text-secondary)] tracking-wider">
                <th className="py-3 px-4">Txn ID</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Legacy Earnings</th>
                <th className="py-3 px-4 text-right">Simulator Earnings</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-xs">
              {loadingList ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--text-secondary)]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-[var(--color-primary)]" />
                      Loading validation telemetry...
                    </div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[var(--text-secondary)]">
                    No comparison records matched the specified filters.
                  </td>
                </tr>
              ) : (
                records.map((r) => {
                  const legacyEarnings = r.legacyResult?.finalEarnings ?? 0;
                  const simEarnings = r.simulatorResult?.finalEarnings ?? 0;
                  
                  return (
                    <tr key={r.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                      <td className="py-3.5 px-4 font-mono font-semibold text-[var(--color-primary)]">#{r.transactionId}</td>
                      <td className="py-3.5 px-4 max-w-[150px] truncate">
                        <div className="font-bold text-[var(--text-primary)]">{r.userName}</div>
                        <div className="text-[9px] text-[var(--text-secondary)] truncate">ID: {r.userId} | {r.userRole}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)]">{r.operatorName}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-[var(--text-primary)]">₹{Number(r.amount).toFixed(2)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-emerald-500">₹{Number(legacyEarnings).toFixed(4)}</td>
                      <td className="py-3.5 px-4 text-right font-mono font-medium text-blue-500">₹{Number(simEarnings).toFixed(4)}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          r.isMatch 
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                            : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                        }`}>
                          {r.isMatch ? 'MATCH' : 'MISMATCH'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {r.isMatch ? (
                          <span className="text-[var(--text-secondary)] opacity-50">-</span>
                        ) : (
                          <span className="text-rose-500 font-semibold">{MISMATCH_REASONS[r.mismatchReason] || r.mismatchReason}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[10px] text-[var(--text-secondary)]">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button 
                          onClick={() => setSelectedRecord(r)}
                          className="p-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] transition-all cursor-pointer"
                          title="View comparison details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t border-[var(--border-soft)] text-xs text-[var(--text-secondary)]">
            <div>
              Showing page <strong className="text-[var(--text-primary)]">{pagination.page}</strong> of <strong className="text-[var(--text-primary)]">{pagination.totalPages}</strong> ({pagination.total} total items)
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              {/* Short pagination numbers list */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pNum = pagination.page - 2 + i;
                if (pagination.page <= 2) pNum = i + 1;
                if (pagination.page >= pagination.totalPages - 1) pNum = pagination.totalPages - 4 + i;
                if (pNum < 1 || pNum > pagination.totalPages) return null;
                
                return (
                  <button
                    key={pNum}
                    onClick={() => handlePageChange(pNum)}
                    className={`w-8 h-8 rounded-lg font-bold border transition-all cursor-pointer ${
                      pagination.page === pNum 
                        ? 'bg-[var(--color-primary-glow)] border-[var(--color-primary)] text-[var(--color-primary)]' 
                        : 'border-[var(--border-soft)] bg-[var(--bg-secondary)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)]'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}

              <button 
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-secondary)] hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Comparison detailed Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-3xl w-full max-w-4xl shadow-xl flex flex-col overflow-hidden max-h-[90vh] animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/20 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                  Validation Log Detail: Transaction #{selectedRecord.transactionId}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                  Comparison recorded on {new Date(selectedRecord.createdAt).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedRecord(null)}
                className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-hover)] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar text-xs">
              {/* Quick Transaction Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[var(--bg-tertiary)]/40 rounded-2xl border border-[var(--border-soft)]">
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">Transaction Amount</span>
                  <p className="text-sm font-bold text-[var(--text-primary)] mt-1">₹{Number(selectedRecord.amount).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">Operator Name</span>
                  <p className="text-sm font-bold text-[var(--text-primary)] mt-1">{selectedRecord.operatorName} (ID: {selectedRecord.operatorId})</p>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">User Details</span>
                  <p className="text-sm font-bold text-[var(--text-primary)] mt-1 truncate" title={selectedRecord.userEmail}>
                    {selectedRecord.userName}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)]">Tier: {selectedRecord.userTier} | Role: {selectedRecord.userRole}</p>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-bold">Comparison Status</span>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      selectedRecord.isMatch 
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-500 border border-rose-500/20 animate-pulse'
                    }`}>
                      {selectedRecord.isMatch ? 'MATCH' : 'MISMATCH'}
                    </span>
                    {!selectedRecord.isMatch && (
                      <span className="text-rose-500 font-extrabold text-[9px]">{MISMATCH_REASONS[selectedRecord.mismatchReason] || selectedRecord.mismatchReason}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Side-by-side Financial Comparison */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Side-By-Side Resolution Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Legacy Production Results */}
                  <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-soft)] space-y-3 relative overflow-hidden">
                    <div className="absolute right-3 top-3 text-[9px] font-bold text-emerald-500/40 uppercase tracking-widest">Legacy Production</div>
                    <h5 className="font-bold text-xs border-b border-[var(--border-soft)] pb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      Legacy Commission Result
                    </h5>
                    <div className="space-y-2">
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--text-secondary)]">Base Commission Value:</span>
                        <span className="font-mono text-[var(--text-primary)] font-bold">₹{Number(selectedRecord.legacyResult?.commission ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--text-secondary)]">Corporate Profit (Internal Share):</span>
                        <span className="font-mono text-[var(--text-primary)] font-bold">₹{Number(selectedRecord.legacyResult?.profit ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--text-secondary)]">Fee Charged:</span>
                        <span className="font-mono text-[var(--text-primary)] font-bold">₹{Number(selectedRecord.legacyResult?.fee ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--text-secondary)]">Surcharge Paid:</span>
                        <span className="font-mono text-[var(--text-primary)] font-bold">₹{Number(selectedRecord.legacyResult?.surcharge ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-[var(--border-soft)] pt-2 text-emerald-500">
                        <span>Net Retailer Earnings:</span>
                        <span className="font-mono">₹{Number(selectedRecord.legacyResult?.finalEarnings ?? 0).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Simulator Shadow Results */}
                  <div className="p-4 rounded-2xl bg-[var(--bg-primary)] border border-[var(--border-soft)] space-y-3 relative overflow-hidden">
                    <div className="absolute right-3 top-3 text-[9px] font-bold text-blue-500/40 uppercase tracking-widest">Simulator Shadow</div>
                    <h5 className="font-bold text-xs border-b border-[var(--border-soft)] pb-2 flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-blue-500" />
                      Simulator Commission Result
                    </h5>
                    <div className="space-y-2">
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--text-secondary)]">Base Commission Value:</span>
                        <span className="font-mono text-[var(--text-primary)] font-bold">₹{Number(selectedRecord.simulatorResult?.commission ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--text-secondary)]">Corporate Profit (Internal Share):</span>
                        <span className="font-mono text-[var(--text-primary)] font-bold">₹{Number(selectedRecord.simulatorResult?.profit ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--text-secondary)]">Fee Charged:</span>
                        <span className="font-mono text-[var(--text-primary)] font-bold">₹{Number(selectedRecord.simulatorResult?.fee ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span className="text-[var(--text-secondary)]">Surcharge Paid:</span>
                        <span className="font-mono text-[var(--text-primary)] font-bold">₹{Number(selectedRecord.simulatorResult?.surcharge ?? 0).toFixed(4)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-[var(--border-soft)] pt-2 text-blue-500">
                        <span>Net Retailer Earnings:</span>
                        <span className="font-mono">₹{Number(selectedRecord.simulatorResult?.finalEarnings ?? 0).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resolution trace details */}
              {!selectedRecord.isMatch && (
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                  <h4 className="font-bold text-rose-500 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" />
                    Mismatch Diagnostics
                  </h4>
                  <p className="leading-relaxed text-[var(--text-secondary)]">
                    The simulator resolved using slab configuration source <strong className="text-[var(--text-primary)] font-semibold">{selectedRecord.simulatorResult?.slabSource || 'N/A'}</strong> and rule resolution source <strong className="text-[var(--text-primary)] font-semibold">{selectedRecord.simulatorResult?.ruleSource || 'N/A'}</strong>. 
                    The winning rule ID was <strong className="text-[var(--text-primary)] font-semibold">#{selectedRecord.simulatorResult?.winningRuleId || 'N/A'}</strong>. 
                    Ensure that this rule is synchronized and active in the database compared to the legacy code rules.
                  </p>
                </div>
              )}

              {/* Complete JSON payload view */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Raw Telemetry JSON Payload</span>
                <pre className="p-4 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-2xl font-mono text-[10px] overflow-x-auto text-[var(--text-primary)] max-h-56 custom-scrollbar">
                  {JSON.stringify(selectedRecord, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-[var(--border-soft)] bg-[var(--bg-tertiary)]/20 flex justify-end">
              <button 
                onClick={() => setSelectedRecord(null)}
                className="px-4 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-bold text-xs transition-colors cursor-pointer"
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
