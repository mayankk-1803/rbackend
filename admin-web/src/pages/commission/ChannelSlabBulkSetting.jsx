import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { 
  Layers, 
  Settings, 
  RefreshCw, 
  Play, 
  History, 
  AlertTriangle, 
  CheckCircle, 
  ArrowRight, 
  Sliders, 
  UserCheck, 
  CheckSquare, 
  Square,
  HelpCircle,
  Activity
} from 'lucide-react';

export const ChannelSlabBulkSetting = () => {
  // Config state
  const [configVersion, setConfigVersion] = useState(1);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Catalogs
  const [slabs, setSlabs] = useState([]);
  const [packages, setPackages] = useState([]);
  const [operators, setOperators] = useState([]);
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);
  const [historyJobs, setHistoryJobs] = useState([]);

  // Selections / Filters
  const [ruleType, setRuleType] = useState('RECHARGE'); // RECHARGE or RANGE
  const [selectedSlabs, setSelectedSlabs] = useState([]);
  const [selectedPackages, setSelectedPackages] = useState([]);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [mode, setMode] = useState('GENERAL'); // GENERAL or REAL
  const [action, setAction] = useState('INCREASE'); // INCREASE, DECREASE, REPLACE, COPY, RESET
  const [targetField, setTargetField] = useState('COMMISSION'); // COMMISSION, SURCHARGE, PROFIT, FEE

  // Action Params
  const [value, setValue] = useState('0');
  const [valueType, setValueType] = useState('PERCENTAGE'); // PERCENTAGE or FLAT
  const [sourceSlabId, setSourceSlabId] = useState('');
  const [autoActivate, setAutoActivate] = useState(false);

  // Preview & Loading States
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [rollingBackId, setRollingBackId] = useState(null);

  // Load Catalogs and Session Role
  const loadCatalogs = async () => {
    try {
      const stored = sessionStorage.getItem("dizipay_admin_data");
      if (stored) {
        const adminData = JSON.parse(stored);
        setIsSuperAdmin(adminData.role === "SUPER_ADMIN");
        setIsAdminUser(adminData.role === "SUPER_ADMIN" || adminData.role === "ADMIN");
      }

      // Slabs
      const slabsRes = await api.get('/admin/commission/slabs', { params: { limit: 100 } });
      if (slabsRes.data?.success) setSlabs(slabsRes.data.data.slabs || []);

      // Packages
      const pkgsRes = await api.get('/admin/commission/packages', { params: { limit: 100 } });
      if (pkgsRes.data?.success) setPackages(pkgsRes.data.data.packages || []);

      // Operators
      const opsRes = await api.get('/admin/commission/operators');
      if (opsRes.data?.success) setOperators(opsRes.data.data || []);

      // Categories
      const catsRes = await api.get('/admin/commission/service-categories');
      if (catsRes.data?.success) setCategories(catsRes.data.data || []);

      // Roles
      const rolesRes = await api.get('/admin/commission/commission-roles');
      if (rolesRes.data?.success) setRoles(rolesRes.data.data || []);

      // Load Version
      const configRes = await api.get('/admin/commission/recharge-rules', { params: { limit: 1 } });
      // The backend returns latest version dynamically in list or preview, we fetch configuration version.
      // Let's call preview with empty filters just to get config version
      const versionPreview = await api.post('/admin/commission/bulk/preview', {
        action: 'RESET',
        ruleType: 'RECHARGE',
        targetField: 'COMMISSION',
        filters: {},
        params: {}
      }).catch(() => null);

      if (versionPreview?.data?.success) {
        setConfigVersion(versionPreview.data.data.previewVersion);
      }

    } catch (err) {
      console.error("Error loading bulk setting catalogs:", err);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/admin/commission/bulk/jobs', { params: { page, limit: 10 } });
      if (res.data?.success) {
        setHistoryJobs(res.data.data.jobs || []);
        setTotalPages(res.data.data.pagination.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to load execution history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadCatalogs();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [page]);

  // Collapsible toggle helpers for checklists
  const toggleItem = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter(i => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const selectAll = (allList, setList, items) => {
    if (allList.length === items.length) {
      setList([]);
    } else {
      setList(items.map(item => item.id || item));
    }
  };

  // Generate Preview Handler
  const handleGeneratePreview = async () => {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const payload = {
        action,
        ruleType,
        targetField,
        filters: {
          slabIds: selectedSlabs,
          packageIds: selectedPackages,
          operatorIds: selectedOperators,
          serviceCategoryIds: selectedCategories,
          roles: selectedRoles,
          mode: ruleType === 'RANGE' ? mode : undefined
        },
        params: {
          value: parseFloat(value || '0'),
          valueType,
          sourceSlabId: action === 'COPY' ? parseInt(sourceSlabId) : undefined,
          autoActivate
        }
      };

      const res = await api.post('/admin/commission/bulk/preview', payload);
      if (res.data?.success) {
        setPreviewData(res.data.data);
        setConfigVersion(res.data.data.previewVersion);
        toast.success(`Preview generated successfully! ${res.data.data.affectedCount} rules affected.`);
      } else {
        toast.error(res.data?.message || "Failed to generate preview.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Internal preview server error.");
    } finally {
      setPreviewLoading(false);
    }
  };

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSelectedSlabs([]);
    setSelectedPackages([]);
    setSelectedOperators([]);
    setSelectedCategories([]);
    setSelectedRoles([]);
    setValue('0');
    setSourceSlabId('');
    setAutoActivate(false);
    setPreviewData(null);
    toast.success("Filters reset successfully.");
  };

  // Execute Handler
  const handleExecuteBulk = async () => {
    if (!previewData || previewData.affectedCount === 0) return;
    
    const confirmMessage = action === 'COPY' && autoActivate 
      ? `Are you sure you want to execute copy and auto-activate rules to target slabs? This cannot be undone easily.`
      : `Are you sure you want to execute this bulk operation affecting ${previewData.affectedCount} rules?`;

    if (!window.confirm(confirmMessage)) return;

    setExecuting(true);
    try {
      const payload = {
        action,
        ruleType,
        targetField,
        filters: {
          slabIds: selectedSlabs,
          packageIds: selectedPackages,
          operatorIds: selectedOperators,
          serviceCategoryIds: selectedCategories,
          roles: selectedRoles,
          mode: ruleType === 'RANGE' ? mode : undefined
        },
        params: {
          value: parseFloat(value || '0'),
          valueType,
          sourceSlabId: action === 'COPY' ? parseInt(sourceSlabId) : undefined,
          autoActivate
        },
        previewVersion: previewData.previewVersion
      };

      const res = await api.post('/admin/commission/bulk/execute', payload);
      if (res.data?.success) {
        toast.success(res.data.message || "Bulk operation completed successfully!");
        setPreviewData(null);
        loadHistory();
        // Update version dynamically
        const newVersion = configVersion + 1;
        setConfigVersion(newVersion);
      } else {
        toast.error(res.data?.message || "Execution failed.");
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 409) {
        // Concurrency stale preview conflict
        toast.error("Bulk preview is stale. Please regenerate preview.");
      } else {
        toast.error(err.response?.data?.message || "Execution encountered an error.");
      }
    } finally {
      setExecuting(false);
    }
  };

  // Rollback Handler
  const handleRollback = async (jobId) => {
    if (!window.confirm(`Are you sure you want to rollback bulk job #${jobId}? All values will be reverted to the snapshot.`)) {
      return;
    }
    setRollingBackId(jobId);
    try {
      const res = await api.post(`/admin/commission/bulk/rollback/${jobId}`);
      if (res.data?.success) {
        toast.success(res.data.message || `Job #${jobId} rolled back successfully.`);
        loadHistory();
        setConfigVersion(prev => prev + 1);
      } else {
        toast.error(res.data?.message || "Rollback failed.");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to execute rollback.");
    } finally {
      setRollingBackId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 text-[var(--text-primary)] min-h-screen">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-violet-600/10 to-indigo-600/10 p-6 rounded-2xl border border-violet-500/20 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Sliders className="text-violet-500 w-8 h-8" />
            Channel Slab Bulk Setting
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Telecom grade bulk preview & execution engine for recharge and range commission slab rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/50 border border-slate-700/50 text-xs font-semibold text-[var(--text-secondary)]">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Active Config: <span className="text-white">v{configVersion}</span>
          </div>
          <button 
            onClick={loadCatalogs} 
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 transition duration-150 text-[var(--text-secondary)] hover:text-white"
            title="Refresh Config Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Grid: Settings & Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Filters and Parameters Panel */}
        <div className="xl:col-span-1 space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-white/10 shadow-xl space-y-5">
            <h3 className="text-md font-bold border-b border-white/10 pb-3 flex items-center gap-2">
              <Settings className="w-4.5 h-4.5 text-violet-500" />
              Operation Scope
            </h3>

            {/* Rule Type Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Rule Type</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setRuleType('RECHARGE')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${ruleType === 'RECHARGE' ? 'bg-violet-600 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}
                >
                  Recharge Rules
                </button>
                <button
                  onClick={() => {
                    setRuleType('RANGE');
                    setMode('GENERAL');
                  }}
                  className={`py-2 rounded-lg text-xs font-bold transition ${ruleType === 'RANGE' ? 'bg-violet-600 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}
                >
                  Range Rules
                </button>
              </div>
            </div>

            {/* Slabs Multi-Select */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Target Slabs</label>
                <button 
                  onClick={() => selectAll(selectedSlabs, setSelectedSlabs, slabs)}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                >
                  {selectedSlabs.length === slabs.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto border border-slate-800 rounded-xl p-2.5 bg-slate-900/20 space-y-1">
                {slabs.map(s => (
                  <button
                    key={s.id}
                    onClick={() => toggleItem(selectedSlabs, setSelectedSlabs, s.id)}
                    className="flex items-center gap-2 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-white/5 transition"
                  >
                    {selectedSlabs.includes(s.id) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-violet-500 fill-violet-500/20" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Packages Multi-Select */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Target Packages</label>
                <button 
                  onClick={() => selectAll(selectedPackages, setSelectedPackages, packages)}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                >
                  {selectedPackages.length === packages.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto border border-slate-800 rounded-xl p-2.5 bg-slate-900/20 space-y-1">
                {packages.map(p => (
                  <button
                    key={p.id}
                    onClick={() => toggleItem(selectedPackages, setSelectedPackages, p.id)}
                    className="flex items-center gap-2 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-white/5 transition"
                  >
                    {selectedPackages.includes(p.id) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-violet-500 fill-violet-500/20" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Operators Multi-Select */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Operators</label>
                <button 
                  onClick={() => selectAll(selectedOperators, setSelectedOperators, operators)}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                >
                  {selectedOperators.length === operators.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto border border-slate-800 rounded-xl p-2.5 bg-slate-900/20 space-y-1">
                {operators.map(op => (
                  <button
                    key={op.id}
                    onClick={() => toggleItem(selectedOperators, setSelectedOperators, op.id)}
                    className="flex items-center gap-2 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-white/5 transition"
                  >
                    {selectedOperators.includes(op.id) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-violet-500 fill-violet-500/20" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="truncate">{op.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Categories Checklist */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Service Categories</label>
                <button 
                  onClick={() => selectAll(selectedCategories, setSelectedCategories, categories)}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                >
                  {selectedCategories.length === categories.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto border border-slate-800 rounded-xl p-2.5 bg-slate-900/20 space-y-1">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => toggleItem(selectedCategories, setSelectedCategories, cat.id)}
                    className="flex items-center gap-2 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-white/5 transition"
                  >
                    {selectedCategories.includes(cat.id) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-violet-500 fill-violet-500/20" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="truncate">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Roles Checklist */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Commission Roles</label>
                <button 
                  onClick={() => selectAll(selectedRoles, setSelectedRoles, roles)}
                  className="text-[10px] text-violet-400 hover:text-violet-300 font-semibold"
                >
                  {selectedRoles.length === roles.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto border border-slate-800 rounded-xl p-2.5 bg-slate-900/20 space-y-1">
                {roles.map(r => (
                  <button
                    key={r}
                    onClick={() => toggleItem(selectedRoles, setSelectedRoles, r)}
                    className="flex items-center gap-2 w-full text-left text-xs py-1 px-1.5 rounded hover:bg-white/5 transition"
                  >
                    {selectedRoles.includes(r) ? (
                      <CheckSquare className="w-3.5 h-3.5 text-violet-500 fill-violet-500/20" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span className="truncate">{r}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode Select (Range only) */}
            {ruleType === 'RANGE' && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">Rule Mode</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-900/40 p-1 rounded-xl border border-slate-800">
                  <button
                    onClick={() => setMode('GENERAL')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${mode === 'GENERAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}
                  >
                    GENERAL
                  </button>
                  <button
                    onClick={() => setMode('REAL')}
                    className={`py-1.5 rounded-lg text-xs font-bold transition ${mode === 'REAL' ? 'bg-indigo-600 text-white shadow-md' : 'text-[var(--text-secondary)] hover:text-white'}`}
                  >
                    REAL
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Action configuration block */}
          <div className="glass-panel rounded-2xl p-6 border border-white/10 shadow-xl space-y-5">
            <h3 className="text-md font-bold border-b border-white/10 pb-3 flex items-center gap-2">
              <Sliders className="w-4.5 h-4.5 text-violet-500" />
              Action Parameters
            </h3>

            {/* Action Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Action</label>
              <select 
                value={action} 
                onChange={(e) => {
                  setAction(e.target.value);
                  setPreviewData(null);
                }}
                className="w-full p-2.5 text-sm bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 rounded-xl"
              >
                <option value="INCREASE">Increase Value</option>
                <option value="DECREASE">Decrease Value</option>
                <option value="REPLACE">Replace Value</option>
                <option value="COPY">Copy Rules Slab-to-Slab</option>
                <option value="RESET">Reset to 0.0000</option>
              </select>
            </div>

            {/* Target Field Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Target Value Field</label>
              <select 
                value={targetField} 
                onChange={(e) => {
                  setTargetField(e.target.value);
                  setPreviewData(null);
                }}
                className="w-full p-2.5 text-sm bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 rounded-xl"
              >
                <option value="COMMISSION">Commission Value</option>
                <option value="SURCHARGE">Surcharge Value</option>
                <option value="PROFIT">Profit Value</option>
                <option value="FEE">Fee Value</option>
              </select>
            </div>

            {/* Increase/Decrease parameters */}
            {(action === 'INCREASE' || action === 'DECREASE') && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Adjustment Value</label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="w-full p-2.5 text-sm bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Adjustment Type</label>
                  <select 
                    value={valueType} 
                    onChange={(e) => setValueType(e.target.value)}
                    className="w-full p-2.5 text-sm bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 rounded-xl"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FLAT">Flat Rate (INR)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Replace parameter */}
            {action === 'REPLACE' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">New Value</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full p-2.5 text-sm bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 rounded-xl"
                />
              </div>
            )}

            {/* Copy parameters */}
            {action === 'COPY' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Source Slab</label>
                  <select 
                    value={sourceSlabId} 
                    onChange={(e) => setSourceSlabId(e.target.value)}
                    className="w-full p-2.5 text-sm bg-slate-900 border border-slate-700 text-white focus:outline-none focus:ring-1 focus:ring-violet-500 rounded-xl"
                  >
                    <option value="">-- Select Source Slab --</option>
                    {slabs.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                {isSuperAdmin && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-violet-600/10 border border-violet-500/20">
                    <div className="flex flex-col gap-0.5">
                      <label className="text-xs font-bold text-violet-400">Super Admin Auto-Activate</label>
                      <span className="text-[10px] text-[var(--text-secondary)]">Activate copied rules instantly without approval.</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={autoActivate}
                      onChange={(e) => setAutoActivate(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 text-violet-600 focus:ring-violet-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Reset description */}
            {action === 'RESET' && (
              <div className="flex gap-2.5 items-start p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <span><strong>WARNING:</strong> This action will reset the targeted rules value field to 0.0000. It requires confirmation before executing.</span>
              </div>
            )}

            {/* Button actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-white/5 transition text-sm font-semibold"
              >
                Clear Filters
              </button>
              <button
                type="button"
                disabled={previewLoading || !isAdminUser}
                onClick={handleGeneratePreview}
                className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition text-sm font-bold text-white shadow-md flex items-center justify-center gap-1.5"
              >
                {previewLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Preview
                  </>
                )}
              </button>
            </div>
            
            {!isAdminUser && (
              <p className="text-[10px] text-center text-rose-400 font-semibold mt-1">
                Sub-Admins have read-only access and cannot generate execution updates.
              </p>
            )}
          </div>
        </div>

        {/* Preview Results Panel */}
        <div className="xl:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-white/10 shadow-xl min-h-[400px] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-md font-bold flex items-center gap-2">
                  <Layers className="w-4.5 h-4.5 text-violet-500" />
                  Adjustment Preview Matrix
                </h3>
                {previewData && (
                  <span className="px-2.5 py-1 rounded-full bg-violet-600/20 text-violet-400 text-xs font-semibold">
                    Preview Version: v{previewData.previewVersion}
                  </span>
                )}
              </div>

              {!previewData && !previewLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-center text-[var(--text-secondary)]">
                  <HelpCircle className="w-16 h-16 text-slate-600 mb-3" />
                  <h4 className="text-sm font-bold text-white">No Preview Generated Yet</h4>
                  <p className="text-xs max-w-xs mt-1">
                    Select your filters and adjustment action on the left, then click "Preview" to load the affected rules here.
                  </p>
                </div>
              )}

              {previewLoading && (
                <div className="space-y-3 py-6">
                  <div className="h-6 w-full shimmer-element rounded-lg" />
                  <div className="h-24 w-full shimmer-element rounded-xl" />
                  <div className="h-24 w-full shimmer-element rounded-xl" />
                  <div className="h-24 w-full shimmer-element rounded-xl" />
                </div>
              )}

              {previewData && (
                <div className="space-y-4">
                  {/* Summary banner */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 flex-shrink-0" />
                      <span>
                        <strong>Preview Verified!</strong> Wrote <strong>{previewData.affectedCount}</strong> matching rule updates based on filters.
                      </span>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="max-h-[360px] overflow-y-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-900/80 sticky top-0 backdrop-blur">
                        <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          <th className="py-2.5 px-3">Slab Name</th>
                          <th className="py-2.5 px-3">Operator</th>
                          <th className="py-2.5 px-3">Cat / Role</th>
                          <th className="py-2.5 px-3">Type/Mode</th>
                          <th className="py-2.5 px-3 text-right">Old Value</th>
                          <th className="py-2.5 px-3 text-right">New Value</th>
                          <th className="py-2.5 px-3 text-right">Diff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-xs text-white">
                        {previewData.affectedRecords.map((r, idx) => (
                          <tr key={idx} className="hover:bg-white/5 transition">
                            <td className="py-2.5 px-3 truncate max-w-[120px]">{r.slabName}</td>
                            <td className="py-2.5 px-3">{r.operatorName}</td>
                            <td className="py-2.5 px-3 text-[var(--text-secondary)]">
                              {r.serviceCategoryName} / <span className="text-violet-400 font-semibold">{r.role}</span>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 mr-1">{r.ruleType}</span>
                              {r.ruleType === 'RANGE' && (
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${r.mode === 'REAL' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700/30 text-slate-400'}`}>{r.mode}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-[var(--text-secondary)]">
                              {r.oldValue !== null ? Number(r.oldValue).toFixed(4) : <span className="text-amber-500 text-[10px] font-semibold uppercase">New</span>}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold">
                              {Number(r.newValue).toFixed(4)}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono font-bold ${r.difference > 0 ? 'text-emerald-400' : r.difference < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                              {r.difference > 0 ? `+${Number(r.difference).toFixed(4)}` : Number(r.difference).toFixed(4)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Execute Box */}
            {previewData && (
              <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/20 p-4 rounded-xl mt-4">
                <div className="text-xs text-[var(--text-secondary)] text-center sm:text-left">
                  <span>Target Parameter: <strong>{previewData.targetField}</strong></span>
                  <span className="mx-2">•</span>
                  <span>Will update: <strong>{previewData.affectedCount}</strong> Rules</span>
                </div>
                <button
                  type="button"
                  disabled={executing || !isAdminUser}
                  onClick={handleExecuteBulk}
                  className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 transition text-sm font-bold text-white shadow-md flex items-center justify-center gap-1.5"
                >
                  {executing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-white" />
                      Execute Bulk Updates
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bulk Executions Log / History */}
      <div className="glass-panel rounded-2xl p-6 border border-white/10 shadow-xl">
        <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
          <h3 className="text-md font-bold flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-violet-500" />
            Execution & Rollback Logs
          </h3>
          <button 
            onClick={loadHistory} 
            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-semibold"
            disabled={historyLoading}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            Sync Logs
          </button>
        </div>

        {historyLoading && historyJobs.length === 0 ? (
          <div className="space-y-2 py-4">
            <div className="h-10 w-full shimmer-element rounded-lg" />
            <div className="h-10 w-full shimmer-element rounded-lg" />
            <div className="h-10 w-full shimmer-element rounded-lg" />
          </div>
        ) : historyJobs.length === 0 ? (
          <div className="text-center py-10 text-[var(--text-secondary)] text-sm">
            No bulk commission setting jobs found.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900/80">
                  <tr className="border-b border-slate-800 text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    <th className="py-3 px-4">Job ID</th>
                    <th className="py-3 px-4">Action Type</th>
                    <th className="py-3 px-4">Field</th>
                    <th className="py-3 px-4">Slabs Affected</th>
                    <th className="py-3 px-4">Rules affected</th>
                    <th className="py-3 px-4">Executed At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-xs text-white">
                  {historyJobs.map((job) => {
                    const affectedCount = Array.isArray(job.oldValues) ? job.oldValues.length : 0;
                    const slabNames = (job.slabs || []).map(s => s.slab?.name || `ID ${s.slabId}`).join(', ');
                    
                    return (
                      <tr key={job.id} className="hover:bg-white/5 transition">
                        <td className="py-3 px-4 font-mono text-slate-400">#{job.id}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            job.action === 'INCREASE' ? 'bg-emerald-500/20 text-emerald-400' :
                            job.action === 'DECREASE' ? 'bg-rose-500/20 text-rose-400' :
                            job.action === 'REPLACE' ? 'bg-sky-500/20 text-sky-400' :
                            job.action === 'COPY' ? 'bg-violet-500/20 text-violet-400' :
                            'bg-slate-500/20 text-slate-300'
                          }`}>
                            {job.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-300">{job.commissionType}</td>
                        <td className="py-3 px-4 truncate max-w-[200px]" title={slabNames}>{slabNames || 'All Slabs'}</td>
                        <td className="py-3 px-4 font-bold">{affectedCount} rules</td>
                        <td className="py-3 px-4 text-[var(--text-secondary)]">
                          {new Date(job.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            job.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${job.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                            {job.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {job.status === 'COMPLETED' ? (
                            <button
                              type="button"
                              disabled={rollingBackId === job.id || !isAdminUser}
                              onClick={() => handleRollback(job.id)}
                              className="py-1 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/80 border border-rose-500/30 text-rose-400 hover:text-white transition text-[10px] font-bold disabled:opacity-50"
                            >
                              {rollingBackId === job.id ? 'Rolling back...' : 'Rollback'}
                            </button>
                          ) : (
                            <span className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center pt-2">
                <span className="text-xs text-[var(--text-secondary)]">Page {page} of {totalPages}</span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(prev => prev - 1)}
                    className="py-1 px-3 rounded-lg border border-slate-700 bg-slate-800 disabled:opacity-40 text-xs font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(prev => prev + 1)}
                    className="py-1 px-3 rounded-lg border border-slate-700 bg-slate-800 disabled:opacity-40 text-xs font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
