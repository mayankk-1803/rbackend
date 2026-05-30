import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import ProviderTable from "./ProviderTable";
import {
  RefreshCw,
  Search,
  Plus,
  Activity,
  Sliders,
  Shield,
  Layers,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink
} from "lucide-react";

export const ProvidersManager = () => {
  const [providers, setProviders] = useState([]);
  const [telemetry, setTelemetry] = useState({ healthLogs: [], decisionLogs: [], queueStatus: {} });
  const [loading, setLoading] = useState(true);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [routeFilter, setRouteFilter] = useState("All");
  const [healthFilter, setHealthFilter] = useState("All");

  // Modals & Active Records
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  
  const [selectedProvider, setSelectedProvider] = useState(null);
  
  // Form Inputs
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    baseUrl: "",
    apiKey: "",
    priority: 0,
    isActive: false,
    inSwitch: false,
    routeType: "Both",
    callbackId: "",
    apiUrl: "",
    statusCheckUrl: "",
    balanceUrl: "",
    disputeUrl: "",
    maintenanceMode: false,
    version: 1,
    providerType: "RECHARGE"
  });

  // Diagnostics State
  const [testType, setTestType] = useState("ping");
  const [testRunning, setTestRunning] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [warningAction, setWarningAction] = useState(null); // Tracks toggle action requiring warning

  const fetchData = async () => {
    setLoading(true);
    try {
      const [provRes, telRes] = await Promise.all([
        api.get("/admin/enterprise/providers").catch(() => ({ data: { data: [] } })),
        api.get("/admin/enterprise/telemetry").catch(() => ({ data: { data: { healthLogs: [], decisionLogs: [], queueStatus: {} } } }))
      ]);

      setProviders(provRes.data?.data || []);
      setTelemetry(telRes.data?.data || { healthLogs: [], decisionLogs: [], queueStatus: {} });
    } catch (err) {
      console.error(err);
      toast.error("Failed to load operations metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // 15 seconds telemetry polling
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Safe inline toggles with optimistic concurrency checking
  const handleToggleField = async (id, fieldName, value, version) => {
    const target = providers.find(p => p.id === id);
    if (!target) return;

    // Safety Interceptor: If this is the only active + inSwitch provider, warn the user
    const activeAndInSwitchCount = providers.filter(p => p.isActive && p.inSwitch).length;
    if (activeAndInSwitchCount === 1 && target.isActive && target.inSwitch && !value) {
      // Intercept action and show warning confirmation modal
      setWarningAction({ id, fieldName, value, version });
      setShowWarningModal(true);
      throw new Error("Safety check triggered"); // Triggers toggle rollback
    }

    try {
      await api.patch(`/admin/enterprise/providers/${id}`, {
        [fieldName]: value,
        version
      });
      toast.success(`${fieldName} state updated!`);
      fetchData();
    } catch (err) {
      const errMsg = err.response?.data?.message || `Failed to update ${fieldName}`;
      toast.error(errMsg);
      fetchData(); // Reset optimistic state to server state
      throw err;
    }
  };

  const handleRouteTypeChange = async (id, value, version) => {
    try {
      await api.patch(`/admin/enterprise/providers/${id}`, {
        routeType: value,
        version
      });
      toast.success("Route Type priority updated successfully!");
      fetchData();
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to update Route Type";
      toast.error(errMsg);
      fetchData();
    }
  };

  const handleActionClick = (action, provider) => {
    setSelectedProvider(provider);
    if (action === "edit") {
      setFormData({
        name: provider.name || "",
        code: provider.code || "",
        baseUrl: provider.baseUrl || "",
        apiKey: provider.apiKey || "",
        priority: provider.priority || 0,
        isActive: provider.isActive || false,
        inSwitch: provider.inSwitch || false,
        routeType: provider.routeType || "Both",
        callbackId: provider.callbackId || "",
        apiUrl: provider.apiUrl || "",
        statusCheckUrl: provider.statusCheckUrl || "",
        balanceUrl: provider.balanceUrl || "",
        disputeUrl: provider.disputeUrl || "",
        maintenanceMode: provider.maintenanceMode || false,
        version: provider.version || 1,
        providerType: provider.providerType || "RECHARGE"
      });
      setShowEditModal(true);
    } else if (action === "test") {
      setTestResult(null);
      setTestType("ping");
      setShowTestModal(true);
    } else if (action === "maintenance") {
      handleToggleField(provider.id, "maintenanceMode", !provider.maintenanceMode, provider.version);
    } else if (action === "logs") {
      toast.success(`Redirecting to telemetry health audits for ${provider.name}...`);
    } else if (action === "diagnostics" || action === "rules") {
      toast.success(`Loading active ${action} for ${provider.code}...`);
    }
  };

  const executeWarningAction = async () => {
    setShowWarningModal(false);
    if (!warningAction) return;

    const { id, fieldName, value, version } = warningAction;
    try {
      await api.patch(`/admin/enterprise/providers/${id}`, {
        [fieldName]: value,
        version
      });
      toast.success("Safety override confirmed. Configuration updated.");
      fetchData();
    } catch (err) {
      const errMsg = err.response?.data?.message || "Failed to execute safety override.";
      toast.error(errMsg);
      fetchData();
    } finally {
      setWarningAction(null);
    }
  };

  const handleCreateProvider = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/enterprise/providers", formData);
      toast.success("New gateway configuration loaded in shadow switch!");
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to register provider.");
    }
  };

  const handleUpdateProvider = async (e) => {
    e.preventDefault();
    try {
      await api.patch(`/admin/enterprise/providers/${selectedProvider.id}`, formData);
      toast.success("Operational configuration updated successfully!");
      setShowEditModal(false);
      fetchData();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error("Stale Overwrite Warning: Stale operational settings prevented. Reloading...");
      } else {
        toast.error(err.response?.data?.message || "Failed to update configuration.");
      }
      fetchData();
    }
  };

  const runApiTest = async () => {
    if (!selectedProvider) return;
    setTestRunning(true);
    setTestResult(null);

    try {
      const res = await api.post(`/admin/enterprise/providers/${selectedProvider.id}/test`, {
        testType
      });
      setTestResult(res.data?.data || {});
      if (res.data?.success) {
        toast.success("Diagnostics executed successfully!");
      }
    } catch (err) {
      setTestResult({
        error: err.response?.data?.message || "Diagnostics request timed out.",
        message: "Diagnostics Failed"
      });
      toast.error("Diagnostics check failed.");
    } finally {
      setTestRunning(false);
    }
  };

  // Searching & Filter Calculations
  const filteredProviders = providers.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRoute = routeFilter === "All" || p.routeType === routeFilter;
    const matchesHealth = healthFilter === "All" || p.healthStatus === healthFilter;

    return matchesSearch && matchesRoute && matchesHealth;
  });

  return (
    <div className="space-y-6">
      {/* 1. Header Metrics Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border-soft)] shadow-soft">
          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
            Recharge Processing Queue
          </div>
          <div className="text-xl font-black text-[var(--text-primary)] mt-1.5 flex items-baseline gap-1">
            {telemetry.queueStatus?.activeJobs || 0}
            <span className="text-[10px] text-[var(--text-secondary)] font-semibold">active</span>
          </div>
          <p className="text-[9px] text-emerald-500 font-bold mt-1">
            ⚡ BullMQ processing active
          </p>
        </div>

        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border-soft)] shadow-soft">
          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
            Waiting Queue Count
          </div>
          <div className="text-xl font-black text-[var(--text-primary)] mt-1.5 flex items-baseline gap-1">
            {telemetry.queueStatus?.waitingJobs || 0}
            <span className="text-[10px] text-[var(--text-secondary)] font-semibold">waiting</span>
          </div>
          <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-1">
            Waiting for worker slots
          </p>
        </div>

        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border-soft)] shadow-soft">
          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
            Latency Index
          </div>
          <div className="text-xl font-black text-[var(--text-primary)] mt-1.5">
            {providers.length > 0
              ? `${Math.round(providers.reduce((sum, p) => sum + p.avgResponseTime, 0) / providers.length)}ms`
              : "0ms"}
          </div>
          <p className="text-[9px] text-cyan-500 font-bold mt-1">
            ⚡ Real-time latency average
          </p>
        </div>

        <div className="bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border-soft)] shadow-soft">
          <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">
            Routing Decisions
          </div>
          <div className="text-xl font-black text-[var(--text-primary)] mt-1.5">
            {telemetry.decisionLogs?.length || 0} audits
          </div>
          <p className="text-[9px] text-[var(--text-secondary)] font-medium mt-1">
            Shadow audits registered
          </p>
        </div>
      </div>

      {/* 2. Operations Controller Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border-soft)] shadow-soft">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] lg:flex-initial">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <input
              type="text"
              placeholder="Search providers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-lg pl-9 pr-3 py-2 text-[var(--text-primary)] outline-none"
            />
          </div>

          {/* Route Type Filter */}
          <select
            value={routeFilter}
            onChange={(e) => setRouteFilter(e.target.value)}
            className="text-xs bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-[var(--text-primary)] outline-none font-bold cursor-pointer"
          >
            <option value="All">All Routes</option>
            <option value="Internal">Internal</option>
            <option value="External">External</option>
            <option value="Both">Both</option>
          </select>

          {/* Health Filter */}
          <select
            value={healthFilter}
            onChange={(e) => setHealthFilter(e.target.value)}
            className="text-xs bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-lg px-3 py-2 text-[var(--text-primary)] outline-none font-bold cursor-pointer"
          >
            <option value="All">All Health</option>
            <option value="HEALTHY">HEALTHY</option>
            <option value="DEGRADED">DEGRADED</option>
            <option value="UNSTABLE">UNSTABLE</option>
            <option value="DOWN">DOWN</option>
          </select>
        </div>

        <button
          onClick={() => {
            setFormData({
              name: "",
              code: "",
              baseUrl: "",
              apiKey: "",
              priority: 0,
              isActive: false,
              inSwitch: false,
              routeType: "Both",
              callbackId: "",
              apiUrl: "",
              statusCheckUrl: "",
              balanceUrl: "",
              disputeUrl: "",
              maintenanceMode: false,
              providerType: "RECHARGE"
            });
            setShowCreateModal(true);
          }}
          className="w-full lg:w-auto bg-[var(--color-primary)] hover:bg-[var(--color-primary-glow)] hover:text-[var(--color-primary)] text-[var(--bg-primary)] px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Provider
        </button>
      </div>

      {/* 3. Dense Table view */}
      <ProviderTable
        providers={filteredProviders}
        loading={loading}
        onToggleField={handleToggleField}
        onRouteTypeChange={handleRouteTypeChange}
        onActionClick={handleActionClick}
      />

      {/* ========================================================================= */}
      {/* MODALS SECTION */}
      {/* ========================================================================= */}

      {/* 4. Edit Modal Configuration Drawer */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[var(--color-primary)]" /> Update Provider Config
              </h3>
              <button onClick={() => setShowEditModal(false)} className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                ✕ Close
              </button>
            </div>
            <form onSubmit={handleUpdateProvider} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Provider Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Recharge Gateway 02"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Unique Code (Callback/Route ID)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RECHARGE_GATEWAY_02"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Provider Type</label>
                  <select
                    value={formData.providerType || "RECHARGE"}
                    onChange={(e) => setFormData({ ...formData, providerType: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-bold cursor-pointer"
                  >
                    <option value="RECHARGE">RECHARGE</option>
                    <option value="PLAN_FETCH">PLAN_FETCH</option>
                    <option value="OPERATOR_LOOKUP">OPERATOR_LOOKUP</option>
                    <option value="BBPS" disabled>BBPS (Future-ready)</option>
                    <option value="DMT" disabled>DMT (Future-ready)</option>
                    <option value="AEPS" disabled>AEPS (Future-ready)</option>
                    <option value="FASTAG" disabled>FASTAG (Future-ready)</option>
                    <option value="CMS" disabled>CMS (Future-ready)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Base API URL</label>
                  <input
                    type="text"
                    required
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Authorization API Key</label>
                  <input
                    type="password"
                    required
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-[var(--border-soft)] pt-4">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Route Type</label>
                  <select
                    value={formData.routeType}
                    onChange={(e) => setFormData({ ...formData, routeType: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none"
                  >
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Route Priority Index</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Callback Route ID</label>
                  <input
                    type="text"
                    value={formData.callbackId}
                    onChange={(e) => setFormData({ ...formData, callbackId: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-mono"
                    placeholder="Auto falls back to code"
                  />
                </div>
              </div>

              <div className="space-y-3.5 border-t border-[var(--border-soft)] pt-4">
                <h4 className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-wider">Enterprise Endpoint Mappings</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">API Execution URL</label>
                    <input
                      type="text"
                      value={formData.apiUrl}
                      onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
                      className="w-full text-xs p-2.5 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Status Verification URL</label>
                    <input
                      type="text"
                      value={formData.statusCheckUrl}
                      onChange={(e) => setFormData({ ...formData, statusCheckUrl: e.target.value })}
                      className="w-full text-xs p-2.5 outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Balance Query URL</label>
                    <input
                      type="text"
                      value={formData.balanceUrl}
                      onChange={(e) => setFormData({ ...formData, balanceUrl: e.target.value })}
                      className="w-full text-xs p-2.5 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Dispute Reconciliation URL</label>
                    <input
                      type="text"
                      value={formData.disputeUrl}
                      onChange={(e) => setFormData({ ...formData, disputeUrl: e.target.value })}
                      className="w-full text-xs p-2.5 outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 border-t border-[var(--border-soft)] pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-soft)] px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[var(--color-primary)] text-[var(--bg-primary)] px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[var(--color-primary)]" /> Register New Provider Node
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                ✕ Close
              </button>
            </div>
            <form onSubmit={handleCreateProvider} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Provider Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Recharge Gateway 02"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Unique Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RECHARGE_GATEWAY_02"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Provider Type</label>
                  <select
                    value={formData.providerType || "RECHARGE"}
                    onChange={(e) => setFormData({ ...formData, providerType: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-bold cursor-pointer"
                  >
                    <option value="RECHARGE">RECHARGE</option>
                    <option value="PLAN_FETCH">PLAN_FETCH</option>
                    <option value="OPERATOR_LOOKUP">OPERATOR_LOOKUP</option>
                    <option value="BBPS" disabled>BBPS (Future-ready)</option>
                    <option value="DMT" disabled>DMT (Future-ready)</option>
                    <option value="AEPS" disabled>AEPS (Future-ready)</option>
                    <option value="FASTAG" disabled>FASTAG (Future-ready)</option>
                    <option value="CMS" disabled>CMS (Future-ready)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Base URL</label>
                  <input
                    type="text"
                    required
                    placeholder="https://api.gateway.com"
                    value={formData.baseUrl}
                    onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">API Key</label>
                  <input
                    type="password"
                    required
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 border-t border-[var(--border-soft)] pt-4">
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Route Type</label>
                  <select
                    value={formData.routeType}
                    onChange={(e) => setFormData({ ...formData, routeType: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none"
                  >
                    <option value="Internal">Internal</option>
                    <option value="External">External</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Priority Index</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                    className="w-full text-xs p-2.5 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Callback Route ID</label>
                  <input
                    type="text"
                    value={formData.callbackId}
                    onChange={(e) => setFormData({ ...formData, callbackId: e.target.value })}
                    className="w-full text-xs p-2.5 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-4 border-t border-[var(--border-soft)] pt-4 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-soft)] px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[var(--color-primary)] text-[var(--bg-primary)] px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                >
                  Register Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Diagnostics / Test API Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl w-full max-w-lg shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
              <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-500 animate-pulse" /> Diagnostics Console: {selectedProvider?.name}
              </h3>
              <button onClick={() => setShowTestModal(false)} className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                ✕ Close
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-2">Select Diagnostic Target</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTestType("ping")}
                    className={`p-2.5 rounded-lg text-xs font-bold transition-all border ${
                      testType === "ping"
                        ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border-[var(--color-primary)]/20"
                        : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-soft)]"
                    }`}
                  >
                    Ping Host
                  </button>
                  <button
                    onClick={() => setTestType("balance")}
                    className={`p-2.5 rounded-lg text-xs font-bold transition-all border ${
                      testType === "balance"
                        ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border-[var(--color-primary)]/20"
                        : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-soft)]"
                    }`}
                  >
                    Check Balance
                  </button>
                  <button
                    onClick={() => setTestType("status_check")}
                    className={`p-2.5 rounded-lg text-xs font-bold transition-all border ${
                      testType === "status_check"
                        ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border-[var(--color-primary)]/20"
                        : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border-soft)]"
                    }`}
                  >
                    Verify Status API
                  </button>
                </div>
              </div>

              {testResult && (
                <div className="bg-[var(--bg-secondary)]/50 p-4 rounded-xl border border-[var(--border-soft)] text-xs font-mono overflow-x-auto max-h-56">
                  {testResult.error ? (
                    <div className="text-rose-500">
                      <div className="font-bold flex items-center gap-1">❌ {testResult.message}</div>
                      <div className="mt-1">{testResult.error}</div>
                    </div>
                  ) : (
                    <div className="text-emerald-500">
                      <div className="font-bold flex items-center gap-1">✔ {testResult.message}</div>
                      <div className="mt-2 text-[10px] text-[var(--text-primary)]">
                        <pre>{JSON.stringify(testResult, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={runApiTest}
                disabled={testRunning}
                className="w-full bg-[var(--color-primary)] text-[var(--bg-primary)] py-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {testRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Running Diagnostics...
                  </>
                ) : (
                  "Execute Diagnostics"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Safety warning modal */}
      {showWarningModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] border-2 border-rose-500/30 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <AlertTriangle className="w-12 h-12 shrink-0 animate-bounce" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">High-Severity Safety Warning</h3>
                <p className="text-[10px] text-[var(--text-secondary)] font-medium">Production routing integrity check</p>
              </div>
            </div>

            <p className="text-xs text-[var(--text-primary)] font-semibold leading-relaxed">
              WARNING: You are attempting to disable or remove the final active and in-switch recharge provider (<span className="text-rose-500 font-bold">{selectedProvider?.name}</span>) from the live switch routing engine.
            </p>

            <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-secondary)] p-3 rounded-lg border border-[var(--border-soft)]">
              This action will halt the execution of all waiting recharges inside the BullMQ processing queues and trigger systemic failures across API clients and mobile endpoints.
            </p>

            <div className="flex gap-3 justify-end border-t border-[var(--border-soft)] pt-4">
              <button
                onClick={() => {
                  setShowWarningModal(false);
                  setWarningAction(null);
                  fetchData(); // Rollback toggles visually
                }}
                className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[var(--text-primary)] px-4 py-2 rounded-lg text-xs font-bold uppercase"
              >
                Abort Action
              </button>
              <button
                onClick={executeWarningAction}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProvidersManager;
