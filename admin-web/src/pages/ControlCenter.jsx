import React, { useState, useEffect } from "react";
import api from "../services/api";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import ProvidersManager from "../components/providers/ProvidersManager";
import MasterKeyModal from "../components/MasterKeyModal";
import {
  Activity,
  Layers,
  Settings,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Send,
  Sliders,
  Plus,
  Shield,
  Smartphone,
  Edit,
  Trash2,
  Download,
  Upload,
  X
} from "lucide-react";

export const ControlCenter = () => {
  // Forms state
  const [newRule, setNewRule] = useState({ name: "", ruleType: "operator", targetValue: "", providerCode: "Primary Gateway", priority: 1, minAmount: 0, maxAmount: 9999 });
  const [newMapping, setNewMapping] = useState({ operatorName: "", circleName: "ALL", providerCode: "Primary Gateway", providerOperatorCode: "", minAmount: 0, maxAmount: 9999 });
  const [newTemplate, setNewTemplate] = useState({ name: "", templateId: "", body: "" });

  // Operator Registry state (Phase 6)
  const [operators, setOperators] = useState([]);
  const [editingOperator, setEditingOperator] = useState(null);
  const [operatorForm, setOperatorForm] = useState({
    name: "",
    code: "",
    category: "Mobile",
    active: true,
    circleRequired: false,
    description: ""
  });
  const [csvText, setCsvText] = useState("");
  const [showCsvImport, setShowCsvImport] = useState(false);

  const [activeTab, setActiveTab] = useState("providers");
  const [securityStatus, setSecurityStatus] = useState({ enabled: false, lastSuccess: null, lastFailure: null, lastDenied: null, recentEvents: [] });
  const [superAdmins, setSuperAdmins] = useState([]);
  const [newSuperAdminForm, setNewSuperAdminForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [isMasterKeyModalOpen, setIsMasterKeyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [providers, setProviders] = useState([]);
  const [operatorMappings, setOperatorMappings] = useState([]);
  const [routingRules, setRoutingRules] = useState([]);
  const [whatsappTemplates, setWhatsappTemplates] = useState([]);
  const [notificationLogs, setNotificationLogs] = useState([]);
  const [routingDecisionLogs, setRoutingDecisionLogs] = useState([]);
  const [telemetry, setTelemetry] = useState({ healthLogs: [], decisionLogs: [], queueStatus: {}, featureFlags: {} });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [provRes, mapRes, ruleRes, tempRes, logsRes, telRes, decLogsRes, opsRes, secRes, superRes] = await Promise.all([
        api.get("/admin/enterprise/providers").catch(() => ({ data: { data: [] } })),
        api.get("/admin/enterprise/operators/mappings").catch(() => ({ data: { data: [] } })),
        api.get("/admin/enterprise/routing/rules").catch(() => ({ data: { data: [] } })),
        api.get("/admin/enterprise/whatsapp/templates").catch(() => ({ data: { data: [] } })),
        api.get("/admin/enterprise/whatsapp/logs").catch(() => ({ data: { data: [] } })),
        api.get("/admin/enterprise/telemetry").catch(() => ({ data: { data: { healthLogs: [], decisionLogs: [], queueStatus: {}, featureFlags: {} } } })),
        api.get("/admin/enterprise/routing/logs").catch(() => ({ data: { data: [] } })),
        api.get("/admin/enterprise/operators").catch(() => ({ data: { data: [] } })),
        api.get("/admin/enterprise/security/master-key-status").catch(() => ({ data: { data: { enabled: false, lastSuccess: null, lastFailure: null, lastDenied: null, recentEvents: [] } } })),
        api.get("/admin/security/super-admins").catch(() => ({ data: { data: [] } }))
      ]);

      setProviders(provRes.data?.data || []);
      setOperatorMappings(mapRes.data?.data || []);
      setRoutingRules(ruleRes.data?.data || []);
      setWhatsappTemplates(tempRes.data?.data || []);
      setNotificationLogs(logsRes.data?.data || []);
      setTelemetry(telRes.data?.data || { healthLogs: [], decisionLogs: [], queueStatus: {}, featureFlags: {} });
      setRoutingDecisionLogs(decLogsRes.data?.data || []);
      setOperators(opsRes.data?.data || []);
      setSecurityStatus(secRes.data?.data || { enabled: false, lastSuccess: null, lastFailure: null, lastDenied: null, recentEvents: [] });
      setSuperAdmins(superRes.data?.data || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load control center configurations");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleProvider = async (id, currentStatus) => {
    try {
      await api.put(`/admin/enterprise/providers/${id}`, { isActive: !currentStatus });
      toast.success("Provider status updated!");
      fetchData();
    } catch (err) {
      toast.error("Failed to update provider status");
    }
  };

  const handleToggleFlag = async (flagName, currentValue) => {
    try {
      await api.post(`/admin/enterprise/features/flags`, { flagName, value: !currentValue });
      toast.success("Feature flag configuration hot-swapped!");
      fetchData();
    } catch (err) {
      toast.error("Failed to toggle feature flag");
    }
  };

  const handleToggleMapping = async (id, currentStatus) => {
    try {
      await api.patch(`/admin/enterprise/operators/mappings/${id}/toggle`, { isActive: !currentStatus });
      toast.success("Operator mapping toggled!");
      fetchData();
    } catch (err) {
      toast.error("Failed to toggle operator mapping");
    }
  };

  const handleToggleRule = async (id, currentStatus) => {
    try {
      await api.patch(`/admin/enterprise/routing/rules/${id}/toggle`, { isActive: !currentStatus });
      toast.success("Routing rule toggled!");
      fetchData();
    } catch (err) {
      toast.error("Failed to toggle routing rule");
    }
  };

  const handleToggleTemplate = async (id, currentStatus) => {
    try {
      await api.patch(`/admin/enterprise/whatsapp/templates/${id}/toggle`, { isActive: !currentStatus });
      toast.success("WhatsApp template status updated!");
      fetchData();
    } catch (err) {
      toast.error("Failed to toggle WhatsApp template");
    }
  };

  const handleCreateRule = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/enterprise/routing/rules", newRule);
      toast.success("New routing rule deployed!");
      setNewRule({ name: "", ruleType: "operator", targetValue: "", providerCode: "Primary Gateway", priority: 1, minAmount: 0, maxAmount: 9999 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create rule");
    }
  };

  const handleCreateMapping = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/enterprise/operators/mappings", newMapping);
      toast.success("Operator mapping registered!");
      setNewMapping({ operatorName: "", circleName: "ALL", providerCode: "Primary Gateway", providerOperatorCode: "", minAmount: 0, maxAmount: 9999 });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create mapping");
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/enterprise/whatsapp/templates", newTemplate);
      toast.success("WhatsApp template registered!");
      setNewTemplate({ name: "", templateId: "", body: "" });
      fetchData();
    } catch (err) {
      toast.error("Failed to register template");
    }
  };

  // Operator Registry actions (Phase 6)
  const handleOperatorSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingOperator) {
        await api.put(`/admin/enterprise/operators/${editingOperator.id}`, operatorForm);
        toast.success("Operator updated successfully!");
      } else {
        await api.post("/admin/enterprise/operators", operatorForm);
        toast.success("Operator registered successfully!");
      }
      setOperatorForm({ name: "", code: "", category: "Mobile", active: true, circleRequired: false, description: "" });
      setEditingOperator(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save operator");
    }
  };

  const handleEditOperator = (op) => {
    setEditingOperator(op);
    setOperatorForm({
      name: op.name,
      code: op.code,
      category: op.category,
      active: op.active,
      circleRequired: op.circleRequired,
      description: op.description
    });
  };

  const handleToggleOperatorStatus = async (op) => {
    try {
      await api.put(`/admin/enterprise/operators/${op.id}`, {
        active: !op.active
      });
      toast.success(`Operator ${!op.active ? "enabled" : "disabled"} successfully!`);
      fetchData();
    } catch (err) {
      toast.error("Failed to toggle operator status");
    }
  };

  const handleDeleteOperator = async (id) => {
    if (!window.confirm("Are you sure you want to delete this operator?")) return;
    try {
      await api.delete(`/admin/enterprise/operators/${id}`);
      toast.success("Operator deleted successfully!");
      fetchData();
    } catch (err) {
      toast.error("Failed to delete operator");
    }
  };

  const handleCsvImport = async (e) => {
    e.preventDefault();
    if (!csvText.trim()) return toast.error("CSV data text is required");
    try {
      await api.post("/admin/enterprise/operators/import", { csvData: csvText });
      toast.success("Operators imported successfully!");
      setCsvText("");
      setShowCsvImport(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to import CSV");
    }
  };

  const handleExportCSV = () => {
    handleCriticalAction(async () => {
      try {
        const response = await api.get("/admin/enterprise/operators/export", { responseType: "blob" });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "operators_registry.csv");
        document.body.appendChild(link);
        link.click();
        link.remove();
        toast.success("Operators exported successfully!");
      } catch (err) {
        toast.error("Failed to export operators CSV");
      }
    });
  };

  const handleCriticalAction = (actionCallback) => {
    if (window.masterKeySession && window.masterKeySessionExpiry && window.masterKeySessionExpiry > Date.now()) {
      actionCallback(window.masterKeySession);
    } else {
      setPendingAction(() => actionCallback);
      setIsMasterKeyModalOpen(true);
    }
  };

  const handleCreateSuperAdmin = (e) => {
    e.preventDefault();
    handleCriticalAction(async () => {
      try {
        await api.post("/admin/security/super-admin", newSuperAdminForm);
        toast.success("Super Admin created successfully!");
        setNewSuperAdminForm({ name: "", email: "", phone: "", password: "" });
        fetchData();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to create Super Admin");
      }
    });
  };

  const handleDeleteSuperAdmin = (id) => {
    if (!window.confirm("Are you sure you want to delete this Super Admin?")) return;
    handleCriticalAction(async () => {
      try {
        await api.delete(`/admin/security/super-admin/${id}`);
        toast.success("Super Admin deleted successfully!");
        fetchData();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to delete Super Admin");
      }
    });
  };

  // Enterprise Telemetry Classification Thresholds
  const classifyHealthStatus = (successRate, latency) => {
    const rate = Number(successRate || 100);
    const lat = Number(latency || 0);
    if (rate >= 98 && lat < 1500) return "HEALTHY";
    if (rate >= 90 && lat < 5000) return "DEGRADED";
    if (rate >= 70) return "UNSTABLE";
    return "DOWN";
  };

  const getHealthBadgeClass = (status) => {
    switch (status) {
      case "HEALTHY":
        return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      case "DEGRADED":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "UNSTABLE":
        return "bg-orange-500/10 text-orange-500 border border-orange-500/20";
      case "DOWN":
      default:
        return "bg-rose-500/10 text-rose-500 border border-rose-500/20";
    }
  };

  const renderProviders = () => (
    <ProvidersManager />
  );

  const renderSecurity = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Master Key Status & Activity */}
        <div className="space-y-6">
          <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-rose-500" /> Master Key Status
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-soft)]">
                <span className="text-xs text-[var(--text-secondary)] font-semibold">Framework Mode</span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase ${securityStatus.enabled ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"}`}>
                  {securityStatus.enabled ? "Active / Enabled" : "Disabled / Inactive"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-soft)]">
                <span className="text-xs text-[var(--text-secondary)] font-semibold">Last Success</span>
                <span className="text-xs font-mono text-[var(--text-primary)]">
                  {securityStatus.lastSuccess ? new Date(securityStatus.lastSuccess).toLocaleString() : "Never"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--border-soft)]">
                <span className="text-xs text-[var(--text-secondary)] font-semibold">Last Failure</span>
                <span className="text-xs font-mono text-[var(--text-primary)]">
                  {securityStatus.lastFailure ? new Date(securityStatus.lastFailure).toLocaleString() : "Never"}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-[var(--text-secondary)] font-semibold">Last Denied</span>
                <span className="text-xs font-mono text-[var(--text-primary)]">
                  {securityStatus.lastDenied ? new Date(securityStatus.lastDenied).toLocaleString() : "Never"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">
              Recent Master Key Events
            </h3>
            <div className="flow-root">
              <ul className="-mb-8">
                {securityStatus.recentEvents?.map((event, idx) => (
                  <li key={event.id}>
                    <div className="relative pb-8">
                      {idx !== securityStatus.recentEvents.length - 1 && (
                        <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-[var(--border-soft)]" aria-hidden="true" />
                      )}
                      <div className="relative flex space-x-3">
                        <div>
                          <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-[var(--card-bg)] ${
                            event.action === "MASTER_KEY_USED" ? "bg-emerald-500/10 text-emerald-500" :
                            event.action === "MASTER_KEY_FAILED" ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                          }`}>
                            <Shield className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-1.5 flex justify-between space-x-4">
                          <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">{event.action.replace("MASTER_KEY_", "")}</p>
                            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">By: {event.admin?.email || "System"}</p>
                          </div>
                          <div className="text-right text-[10px] whitespace-nowrap text-[var(--text-muted)] font-mono">
                            {new Date(event.createdAt).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
                {(!securityStatus.recentEvents || securityStatus.recentEvents.length === 0) && (
                  <div className="text-center py-6 text-xs text-[var(--text-muted)] uppercase tracking-wider">No recent events logged</div>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Right columns - Super Admin CRUD and User list */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
              Super Admin Management
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Form to create */}
              <div className="bg-[var(--bg-secondary)]/50 p-5 rounded-xl border border-[var(--border-soft)]">
                <h4 className="text-xs font-bold text-[var(--text-primary)] mb-4 uppercase tracking-wider">Register New Super Admin</h4>
                <form onSubmit={handleCreateSuperAdmin} className="space-y-4">
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Maya Devi"
                      value={newSuperAdminForm.name}
                      onChange={(e) => setNewSuperAdminForm({ ...newSuperAdminForm, name: e.target.value })}
                      className="w-full text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. maya@dizipay.in"
                      value={newSuperAdminForm.email}
                      onChange={(e) => setNewSuperAdminForm({ ...newSuperAdminForm, email: e.target.value })}
                      className="w-full text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={newSuperAdminForm.phone}
                      onChange={(e) => setNewSuperAdminForm({ ...newSuperAdminForm, phone: e.target.value })}
                      className="w-full text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Login Password</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter secure password"
                      value={newSuperAdminForm.password}
                      onChange={(e) => setNewSuperAdminForm({ ...newSuperAdminForm, password: e.target.value })}
                      className="w-full text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                    />
                  </div>
                  <button type="submit" className="w-full bg-[var(--color-primary)] text-[var(--bg-primary)] py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
                    Register Super Admin
                  </button>
                </form>
              </div>

              {/* List existing */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Active Super Admins</h4>
                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                  {superAdmins.map((admin) => (
                    <div key={admin.id} className="p-3 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-xl flex justify-between items-center gap-3">
                      <div>
                        <div className="font-bold text-xs text-[var(--text-primary)]">{admin.name || "Super Admin"}</div>
                        <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">{admin.email}</div>
                      </div>
                      <button
                        onClick={() => handleDeleteSuperAdmin(admin.id)}
                        className="p-2 hover:bg-rose-500/10 text-rose-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer"
                        title="Delete Super Admin"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {superAdmins.length === 0 && (
                    <div className="text-center py-12 text-xs text-[var(--text-muted)] uppercase tracking-wider">No Super Admin records found</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderOperators = () => (
    <div className="space-y-8">
      {/* Operator Registry Section (Phase 6) */}
      <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 border-b border-[var(--border-soft)] pb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <Smartphone className="w-5 h-5 text-[var(--color-primary)]" /> Operator Registry
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Manage standard operator entities, categories, and circles</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCsvImport(!showCsvImport)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--border-soft)] text-[var(--text-primary)] rounded-lg text-xs font-bold transition-all border border-[var(--border-soft)]"
            >
              <Upload className="w-3.5 h-3.5" /> Export CSV
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--border-soft)] text-[var(--text-primary)] rounded-lg text-xs font-bold transition-all border border-[var(--border-soft)]"
            >
              <Download className="w-3.5 h-3.5" /> Import CSV
            </button>
          </div>
        </div>

        {showCsvImport && (
          <form onSubmit={handleCsvImport} className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-soft)] space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-[var(--text-primary)]">Paste CSV Content (Format: name,code,category,status)</span>
              <button type="button" onClick={() => setShowCsvImport(false)} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Jio Prepaid,JIO_PRE,MOBILE,ACTIVE&#10;Airtel Prepaid,AIRTEL_PRE,MOBILE,ACTIVE"
              className="w-full h-32 text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] font-mono"
            />
            <button type="submit" className="px-4 py-2 bg-[var(--color-primary)] text-[var(--bg-primary)] rounded-lg text-xs font-bold uppercase">
              Submit Bulk Import
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Operator Register/Edit Form */}
          <div className="bg-[var(--bg-secondary)]/50 p-5 rounded-xl border border-[var(--border-soft)] h-fit">
            <h4 className="text-xs font-bold text-[var(--text-primary)] mb-4 uppercase tracking-wider">
              {editingOperator ? "Edit Operator Registry" : "Create Operator Registry"}
            </h4>
            <form onSubmit={handleOperatorSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Operator Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jio Test"
                  value={operatorForm.name}
                  onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })}
                  className="w-full text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Operator Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. JIO_TEST"
                  value={operatorForm.code}
                  onChange={(e) => setOperatorForm({ ...operatorForm, code: e.target.value })}
                  className="w-full text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Category</label>
                <select
                  value={operatorForm.category}
                  onChange={(e) => setOperatorForm({ ...operatorForm, category: e.target.value })}
                  className="w-full text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                >
                  <option value="Mobile">Mobile</option>
                  <option value="DTH">DTH</option>
                  <option value="Broadband">Broadband</option>
                  <option value="Electricity">Electricity</option>
                  <option value="Gas">Gas</option>
                  <option value="Water">Water</option>
                  <option value="FASTag">FASTag</option>
                  <option value="Landline">Landline</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Registry Description"
                  value={operatorForm.description}
                  onChange={(e) => setOperatorForm({ ...operatorForm, description: e.target.value })}
                  className="w-full text-xs bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
                />
              </div>
              <div className="flex items-center gap-6 py-2">
                <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={operatorForm.circleRequired}
                    onChange={(e) => setOperatorForm({ ...operatorForm, circleRequired: e.checked })}
                    className="rounded border-[var(--border-soft)] bg-[var(--bg-secondary)]"
                  />
                  Circle Required
                </label>
                <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={operatorForm.active}
                    onChange={(e) => setOperatorForm({ ...operatorForm, active: e.checked })}
                    className="rounded border-[var(--border-soft)] bg-[var(--bg-secondary)]"
                  />
                  Active Status
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-[var(--color-primary)] text-[var(--bg-primary)] py-2 rounded-lg text-xs font-bold uppercase tracking-wider">
                  {editingOperator ? "Update" : "Create"}
                </button>
                {editingOperator && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOperator(null);
                      setOperatorForm({ name: "", code: "", category: "Mobile", active: true, circleRequired: false, description: "" });
                    }}
                    className="px-3 bg-[var(--bg-secondary)] hover:bg-[var(--border-soft)] text-[var(--text-primary)] py-2 rounded-lg text-xs font-bold uppercase"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Operator List Table */}
          <div className="lg:col-span-2 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-[10px] text-[var(--text-secondary)] font-extrabold uppercase">
                  <th className="py-2.5">Name / Code</th>
                  <th className="py-2.5">Category</th>
                  <th className="py-2.5">Circle Req</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {operators.map((op) => (
                  <tr key={op.id} className="border-b border-[var(--border-soft)] text-[var(--text-primary)]">
                    <td className="py-3">
                      <div className="font-bold">{op.name}</div>
                      <div className="text-[9px] text-[var(--text-secondary)] font-mono">{op.code}</div>
                    </td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded text-[9px] font-bold">
                        {op.category}
                      </span>
                    </td>
                    <td className="py-3 text-[var(--text-secondary)] font-bold">{op.circleRequired ? "Yes" : "No"}</td>
                    <td className="py-3">
                      <button
                        onClick={() => handleToggleOperatorStatus(op)}
                        className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase ${op.active ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          }`}
                      >
                        {op.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="py-3 text-right space-x-1.5">
                      <button
                        onClick={() => handleEditOperator(op)}
                        className="p-1 hover:bg-[var(--bg-secondary)] rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all inline-block"
                        title="Edit Operator"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteOperator(op.id)}
                        className="p-1 hover:bg-rose-500/10 rounded text-rose-400 hover:text-rose-500 transition-all inline-block"
                        title="Soft Delete Operator"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {operators.length === 0 && (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-[var(--text-muted)] uppercase text-[10px] tracking-widest">
                      No operator registry entries found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Legacy Mappings Section (Untouched) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mapping Form */}
        <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] h-fit shadow-soft">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-[var(--color-primary)]" /> Map Operator Code
          </h3>
          <form onSubmit={handleCreateMapping} className="space-y-4">
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Operator Name</label>
              <input
                type="text"
                required
                placeholder="e.g. JIO, AIRTEL"
                value={newMapping.operatorName}
                onChange={(e) => setNewMapping({ ...newMapping, operatorName: e.target.value })}
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Provider Specific Code</label>
              <input
                type="text"
                required
                placeholder="e.g. 5, 1"
                value={newMapping.providerOperatorCode}
                onChange={(e) => setNewMapping({ ...newMapping, providerOperatorCode: e.target.value })}
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Min Amt</label>
                <input
                  type="number"
                  value={newMapping.minAmount}
                  onChange={(e) => setNewMapping({ ...newMapping, minAmount: Number(e.target.value) })}
                  className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Max Amt</label>
                <input
                  type="number"
                  value={newMapping.maxAmount}
                  onChange={(e) => setNewMapping({ ...newMapping, maxAmount: Number(e.target.value) })}
                  className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)]"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-[var(--color-primary)] text-[var(--bg-primary)] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider">
              Register Mapping
            </button>
          </form>
        </div>

        {/* Mappings Table */}
        <div className="bg-[var(--card-bg)] lg:col-span-2 p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Live Operator Codes Mapping Table</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-[10px] text-[var(--text-secondary)] font-extrabold uppercase">
                  <th className="py-3">Operator</th>
                  <th className="py-3">Provider</th>
                  <th className="py-3">Target Code</th>
                  <th className="py-3">Min/Max limits</th>
                  <th className="py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {operatorMappings.map((m) => (
                  <tr key={m.id} className="border-b border-[var(--border-soft)] text-[var(--text-primary)]">
                    <td className="py-3.5 font-bold">{m.operatorName}</td>
                    <td className="py-3.5 font-semibold text-[var(--color-primary)]">{m.providerCode}</td>
                    <td className="py-3.5 font-black">{m.providerOperatorCode}</td>
                    <td className="py-3.5 text-[10px] text-[var(--text-secondary)]">₹{Number(m.minAmount)} - ₹{Number(m.maxAmount)}</td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => handleToggleMapping(m.id, m.isActive)}
                        className={`px-2 py-1 rounded text-[8px] font-extrabold uppercase ${m.isActive ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          }`}
                      >
                        {m.isActive ? "Active" : "Disabled"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRouting = () => (
    <div className="space-y-6">
      {/* Switch indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)]">Routing Engine Core</h4>
            <p className="text-[9px] text-[var(--text-secondary)]">Primary resolving orchestration layer</p>
          </div>
          <button onClick={() => handleToggleFlag("routingEngine", telemetry.featureFlags?.routingEngine)}>
            {telemetry.featureFlags?.routingEngine ? (
              <ToggleRight className="w-8 h-8 text-[var(--color-primary)]" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />
            )}
          </button>
        </div>

        <div className="flex justify-between items-center border-t md:border-t-0 md:border-l border-[var(--border-soft)] pt-4 md:pt-0 md:pl-6">
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)]">Shadow Router Hook</h4>
            <p className="text-[9px] text-[var(--text-secondary)]">Decisions computed and logged cleanly</p>
          </div>
          <button onClick={() => handleToggleFlag("shadowMode", telemetry.featureFlags?.shadowMode)}>
            {telemetry.featureFlags?.shadowMode ? (
              <ToggleRight className="w-8 h-8 text-amber-500" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-[var(--text-muted)]" />
            )}
          </button>
        </div>

        <div className="flex justify-between items-center border-t md:border-t-0 md:border-l border-[var(--border-soft)] pt-4 md:pt-0 md:pl-6">
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)]">Active Route Status</h4>
            <p className="text-[9px] text-[var(--text-secondary)]">Active provider resolving nodes</p>
          </div>
          <span className="px-2.5 py-1 bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 text-[9px] font-black uppercase rounded-lg tracking-wider">
            SINGLE GWAY: Primary Gateway
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules Form */}
        <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft h-fit">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-[var(--color-primary)]" /> Deploy Switching Rule
          </h3>
          <form onSubmit={handleCreateRule} className="space-y-4">
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Rule Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Jio Amount Slab Split"
                value={newRule.name}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Rule Type</label>
              <select
                value={newRule.ruleType}
                onChange={(e) => setNewRule({ ...newRule, ruleType: e.target.value })}
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
              >
                <option value="operator">Operator Wise</option>
                <option value="user">User Wise</option>
                <option value="circle">Circle Wise</option>
                <option value="amount">Amount Wise</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Target Match Value</label>
              <input
                type="text"
                required
                placeholder="e.g. JIO, 104, DELHI"
                value={newRule.targetValue}
                onChange={(e) => setNewRule({ ...newRule, targetValue: e.target.value })}
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Reroute Target</label>
                <input
                  type="text"
                  value={newRule.providerCode}
                  disabled
                  className="w-full text-xs bg-[var(--bg-secondary)]/50 border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-muted)] cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Priority</label>
                <input
                  type="number"
                  value={newRule.priority}
                  onChange={(e) => setNewRule({ ...newRule, priority: Number(e.target.value) })}
                  className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)]"
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-[var(--color-primary)] text-[var(--bg-primary)] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider">
              Deploy Rule (Shadow)
            </button>
          </form>
        </div>

        {/* Rules Table */}
        <div className="bg-[var(--card-bg)] lg:col-span-2 p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">Active Global Switching Rules Registry</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-soft)] text-[10px] text-[var(--text-secondary)] font-extrabold uppercase">
                  <th className="py-3">Rule Name</th>
                  <th className="py-3">Type</th>
                  <th className="py-3">Match Value</th>
                  <th className="py-3">Target Provider</th>
                  <th className="py-3 text-right">Switch Status</th>
                </tr>
              </thead>
              <tbody>
                {routingRules.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border-soft)] text-[var(--text-primary)]">
                    <td className="py-3.5 font-bold">{r.name}</td>
                    <td className="py-3.5"><span className="px-2 py-0.5 bg-[var(--bg-secondary)] text-[9px] font-semibold rounded uppercase">{r.ruleType}</span></td>
                    <td className="py-3.5 font-semibold text-[var(--color-primary)]">{r.targetValue}</td>
                    <td className="py-3.5 font-black">{r.providerCode}</td>
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => handleToggleRule(r.id, r.isActive)}
                        className={`px-2.5 py-1 rounded text-[8px] font-extrabold uppercase ${r.isActive ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                          }`}
                      >
                        {r.isActive ? "Shadow Active" : "Disabled"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTelemetry = () => {
    // Dynamic calculation of average latency from health logs
    const avgLatencyVal = telemetry.healthLogs && telemetry.healthLogs.length > 0
      ? Math.round(telemetry.healthLogs.reduce((sum, log) => sum + log.latency, 0) / telemetry.healthLogs.length)
      : null;

    // Dynamic queue processing success rate calculation from BullMQ statistics
    const totalJobs = (telemetry.queueStatus?.completedJobs || 0) + (telemetry.queueStatus?.failedJobs || 0);
    const queueSuccessPercent = totalJobs > 0
      ? ((telemetry.queueStatus.completedJobs / totalJobs) * 100).toFixed(1)
      : "100.0";

    return (
      <div className="space-y-6">
        {/* Telemetry charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Queue Processing</div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-2">{queueSuccessPercent}%</div>
            <p className="text-[9px] text-emerald-500 font-bold mt-1">✔ Workers active</p>
          </div>
          <div className="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Avg Latency</div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-2">
              {avgLatencyVal !== null ? `${avgLatencyVal}ms` : "N/A"}
            </div>
            <p className="text-[9px] text-emerald-500 font-bold mt-1">⚡ Real-time latency</p>
          </div>
          <div className="bg-[var(--card-bg)] p-5 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <div className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Shadow Audits</div>
            <div className="text-2xl font-black text-[var(--text-primary)] mt-2">{routingDecisionLogs?.length || 0} logs</div>
            <p className="text-[9px] text-[var(--text-secondary)] font-semibold mt-1">Decisions logged successfully</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-500" /> Live Health Telemetry Logs
            </h3>
            {telemetry.healthLogs && telemetry.healthLogs.length > 0 ? (
              <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                {telemetry.healthLogs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center p-3 bg-[var(--bg-secondary)]/40 rounded-lg border border-[var(--border-soft)]">
                    <div>
                      <span className="text-[10px] font-black text-[var(--text-primary)]">{log.providerCode}</span>
                      <div className="text-[8px] text-[var(--text-secondary)] font-semibold uppercase">{log.status} | {log.message}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-[var(--text-primary)]">{log.latency}ms</span>
                      <div className="text-[8px] text-[var(--text-secondary)] font-bold">{new Date(log.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)] text-xs border border-dashed border-[var(--border-soft)] rounded-xl">
                No provider telemetry available yet.
              </div>
            )}
          </div>

          <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[var(--color-primary)]" /> Shadow Routing Decision Audit Logs
            </h3>
            {routingDecisionLogs && routingDecisionLogs.length > 0 ? (
              <div className="space-y-3.5 max-h-96 overflow-y-auto pr-1">
                {routingDecisionLogs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center p-3 bg-[var(--bg-secondary)]/40 rounded-lg border border-[var(--border-soft)]">
                    <div>
                      <span className="text-[10px] font-bold text-[var(--text-primary)]">TXN #{log.txnId}</span>
                      <div className="text-[8px] text-[var(--text-secondary)] font-semibold uppercase">Operator: {log.operator} | Amount: ₹{log.amount}</div>
                      <div className="text-[8px] text-amber-500 font-extrabold uppercase mt-1">REC: {log.recommendedProvider} | RUN: {log.executedProvider}</div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-black text-[var(--text-primary)]">{log.latency}ms</span>
                      <div className="text-[8px] text-[var(--text-secondary)] font-bold">{new Date(log.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-[var(--text-muted)] text-xs border border-dashed border-[var(--border-soft)] rounded-xl">
                No shadow routing logs generated yet.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderWhatsapp = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Template Form */}
        <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft h-fit">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-[var(--color-primary)]" /> Create Template
          </h3>
          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Template Trigger Name</label>
              <input
                type="text"
                required
                placeholder="e.g. recharge_success"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Template ID</label>
              <input
                type="text"
                required
                placeholder="e.g. dizipay_success_v1"
                value={newTemplate.templateId}
                onChange={(e) => setNewTemplate({ ...newTemplate, templateId: e.target.value })}
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Body Text</label>
              <textarea
                required
                rows={3}
                placeholder="variables like {amount}, {mobile}"
                value={newTemplate.body}
                onChange={(e) => setNewTemplate({ ...newTemplate, body: e.target.value })}
                className="w-full text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none resize-none"
              />
            </div>
            <button type="submit" className="w-full bg-[var(--color-primary)] text-[var(--bg-primary)] py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider">
              Register Template
            </button>
          </form>
        </div>

        {/* Templates Register */}
        <div className="bg-[var(--card-bg)] lg:col-span-2 p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">WhatsApp Registered Templates</h3>
          {whatsappTemplates && whatsappTemplates.length > 0 ? (
            <div className="space-y-4">
              {whatsappTemplates.map((t) => (
                <div key={t.id} className="p-4 bg-[var(--bg-secondary)]/40 rounded-xl border border-[var(--border-soft)] flex justify-between items-start">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-[var(--text-primary)] uppercase">{t.name}</span>
                      <span className="px-2 py-0.5 bg-[var(--color-primary-glow)] text-[var(--color-primary)] text-[8px] font-extrabold uppercase rounded border border-[var(--color-primary)]/10">{t.templateId}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] italic">"{t.body}"</p>
                  </div>
                  <button
                    onClick={() => handleToggleTemplate(t.id, t.isActive)}
                    className={`px-2 py-1 rounded text-[8px] font-extrabold uppercase ${t.isActive ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}
                  >
                    {t.isActive ? "Active" : "Disabled"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--text-muted)] text-xs border border-dashed border-[var(--border-soft)] rounded-xl">
              No WhatsApp templates registered yet.
            </div>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 flex items-center gap-1.5">
          <Send className="w-4 h-4 text-[var(--color-primary)]" /> WhatsApp Asynchronous Dispatch Logs
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-[10px] text-[var(--text-secondary)] font-extrabold uppercase">
                <th className="py-3">Recipient</th>
                <th className="py-3">Template</th>
                <th className="py-3">Status</th>
                <th className="py-3">Resolved Content</th>
                <th className="py-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {notificationLogs.map((log) => (
                <tr key={log.id} className="border-b border-[var(--border-soft)] text-[var(--text-primary)]">
                  <td className="py-3.5 font-bold">+{log.recipient}</td>
                  <td className="py-3.5"><span className="px-2 py-0.5 bg-[var(--bg-secondary)] text-[9px] font-semibold rounded uppercase">{log.templateName}</span></td>
                  <td className="py-3.5">
                    <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-full ${log.status === "DELIVERED" ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                      }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-[10px] text-[var(--text-secondary)] max-w-xs truncate">"{log.response?.resolvedBody || "N/A"}"</td>
                  <td className="py-3.5 text-right text-[10px] text-[var(--text-secondary)] font-semibold">{new Date(log.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Shield className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight">
              Enterprise <span className="text-[var(--color-primary)]">Control Center</span>
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Orchestrate provider switching, dynamic operator mapping, shadow routing, and WhatsApp delivery pipelines.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 border-b border-[var(--border-soft)]">
        {[
          { id: "providers", label: "Providers Manager", icon: Settings },
          { id: "operators", label: "Operator Codes", icon: Smartphone },
          { id: "routing", label: "Shadow Routing", icon: Sliders },
          { id: "telemetry", label: "Health & Telemetry", icon: Activity },
          { id: "whatsapp", label: "WhatsApp Automations", icon: Send },
          { id: "security", label: "Security Center", icon: Shield }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${isActive
                  ? "bg-[var(--color-primary)] text-[var(--bg-primary)] shadow-sm"
                  : "bg-[var(--card-bg)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)]"
                }`}
            >
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="mt-4">
        {loading ? (
          <div className="flex justify-center items-center py-24">
            <RefreshCw className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === "providers" && renderProviders()}
              {activeTab === "operators" && renderOperators()}
              {activeTab === "routing" && renderRouting()}
              {activeTab === "telemetry" && renderTelemetry()}
              {activeTab === "whatsapp" && renderWhatsapp()}
              {activeTab === "security" && renderSecurity()}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <MasterKeyModal
        isOpen={isMasterKeyModalOpen}
        onClose={() => setIsMasterKeyModalOpen(false)}
        onSuccess={(token) => {
          if (pendingAction) pendingAction(token);
        }}
      />
    </motion.div>
  );
};
