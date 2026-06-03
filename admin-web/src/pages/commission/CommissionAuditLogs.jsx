import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, 
  Search, 
  Filter, 
  RefreshCw, 
  Info, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Eye, 
  BookOpen, 
  X,
  Sliders,
  Database
} from 'lucide-react';

export const CommissionAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = async (showSkeleton = true) => {
    if (showSkeleton) setLoading(true);
    setError(false);
    try {
      const response = await api.get('/admin/commission/audit-logs', {
        params: {
          page,
          limit,
          search,
          actionFilter
        }
      });
      if (response.data?.success) {
        setLogs(response.data.data.logs || []);
        setPagination(response.data.data.pagination || { total: 0, totalPages: 1 });
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
      if (err.response?.status !== 403) {
        toast.error("Failed to load commission audit logs");
      }
    } finally {
      if (showSkeleton) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, [page, actionFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs(true);
  };

  const handleExportCSV = () => {
    if (logs.length === 0) return toast.error("No log datasets to export");
    
    const headers = ["Log ID", "Action", "Entity", "Entity ID", "Admin Name", "Admin Email", "IP Address", "Timestamp"];
    const rows = logs.map(l => [
      l.id,
      l.action,
      l.entity || "N/A",
      l.entityId || "N/A",
      l.admin?.name || "System",
      l.admin?.email || "system@dizipay.in",
      l.ipAddress || "N/A",
      new Date(l.createdAt).toLocaleString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `commission_audit_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("CSV log snapshot exported!");
  };

  const handleExportJSON = () => {
    if (logs.length === 0) return toast.error("No log datasets to export");
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `commission_audit_logs_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success("JSON log snapshot exported!");
  };

  const getActionBadgeColor = (action) => {
    const act = String(action || "").toUpperCase();
    if (act.includes("CREATE")) return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
    if (act.includes("DELETE")) return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    if (act.includes("REJECT")) return "text-rose-500 bg-rose-500/10 border-rose-500/20";
    if (act.includes("APPROVE")) return "text-indigo-500 bg-indigo-500/10 border-indigo-500/20";
    if (act.includes("EXECUTE") || act.includes("ROLLBACK")) return "text-amber-500 bg-amber-500/10 border-amber-500/20";
    return "text-blue-500 bg-blue-500/10 border-blue-500/20";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--text-primary)]">Commission Audit Logs</h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Immutable administrative trails mapping slabs, package rules, and checker verifications.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchLogs(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-3.5 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] p-4 rounded-xl">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="lg:col-span-2 flex gap-2">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input 
              type="text"
              placeholder="Search by action name, details parameters, or admin info..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--admin-focus-ring)] rounded-xl text-xs text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)]"
            />
          </div>
          <button 
            type="submit"
            className="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 text-[var(--bg-primary)] text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer transition-all"
          >
            Search
          </button>
        </form>

        {/* Dropdown Filters */}
        <div className="lg:col-span-1 flex gap-2">
          <div className="relative w-full">
            <Sliders className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2" />
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-4 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] outline-none cursor-pointer focus:border-[var(--color-primary)] transition-all"
            >
              <option value="">All Action Categories</option>
              <option value="SLAB">Slab Master Logs</option>
              <option value="PACKAGE">Package Master Logs</option>
              <option value="RULE">Rules & Overrides Logs</option>
              <option value="BULK">Bulk Execution Logs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Audit Grid */}
      <div className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-[var(--bg-secondary)]/50 border-b border-[var(--border-soft)] text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                <th className="px-6 py-4">Log ID</th>
                <th className="px-6 py-4">Action Type</th>
                <th className="px-6 py-4">Target Entity</th>
                <th className="px-6 py-4">Admin Actor</th>
                <th className="px-6 py-4">IP Location</th>
                <th className="px-6 py-4 text-right">Timestamp</th>
                <th className="px-6 py-4 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)] font-medium">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-16 text-center text-[var(--text-secondary)] font-medium">
                    <RefreshCw className="w-8 h-8 text-[var(--color-primary)] animate-spin mx-auto mb-3" />
                    Retrieving secure log parameters...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan="7" className="p-16 text-center text-rose-500 font-bold">
                    <ShieldAlert className="w-8 h-8 text-rose-500 mx-auto mb-3" />
                    Unable to load audit logs. Please verify connection and retry.
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-16 text-center text-[var(--text-secondary)] font-medium">
                    <Info className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-3" />
                    No matching audit trail records captured in database.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[var(--accent-hover)] transition-colors group">
                    <td className="px-6 py-4 font-mono text-[10px] text-[var(--text-muted)] group-hover:text-[var(--color-primary)] transition-colors">
                      #{log.id}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide border ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {log.entity ? (
                        <div className="flex flex-col">
                          <span className="font-bold text-[var(--text-primary)]">{log.entity}</span>
                          <span className="text-[9px] text-[var(--text-secondary)] font-mono">ID: {log.entityId || "N/A"}</span>
                        </div>
                      ) : "N/A"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-[var(--text-primary)]">{log.admin?.name || "System"}</span>
                        <span className="text-[10px] text-[var(--text-secondary)]">{log.admin?.email || "system@dizipay.in"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[var(--text-secondary)] text-[10px]">
                      {log.ipAddress || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-right text-[var(--text-secondary)] font-medium">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--color-primary-glow)] border border-[var(--border-soft)] hover:border-[var(--color-primary)] rounded-lg text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-all cursor-pointer inline-flex items-center justify-center"
                        title="View Complete Payload"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paging Footer */}
        {!loading && !error && logs.length > 0 && (
          <div className="p-4 border-t border-[var(--border-soft)] flex justify-between items-center text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-secondary)]/30">
            <div>
              Showing {logs.length} entries of {pagination.total} records
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                className="p-2 border border-[var(--border-soft)] rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] disabled:opacity-30 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3">Page {page} of {pagination.totalPages}</span>
              <button
                disabled={page === pagination.totalPages}
                onClick={() => setPage(prev => Math.min(prev + 1, pagination.totalPages))}
                className="p-2 border border-[var(--border-soft)] rounded-xl bg-[var(--bg-primary)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] disabled:opacity-30 transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Drawer Modal (Payload Viewer) */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedLog(null)}
              className="absolute inset-0 bg-black"
            />
            {/* Drawer */}
            <motion.div 
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.3 }}
              className="relative w-full max-w-xl h-full bg-[var(--bg-primary)] border-l border-[var(--border-soft)] flex flex-col shadow-2xl z-10 overflow-hidden"
            >
              <div className="p-6 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/50">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-4.5 h-4.5 text-[var(--color-primary)]" />
                    <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Inspect Log Payload</h3>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] font-medium">Detailed configuration and state values logged</p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-2 hover:bg-[var(--bg-secondary)] rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-4 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-xl p-4">
                  <div>
                    <span className="text-[9px] text-[var(--text-secondary)] uppercase block tracking-wider mb-0.5">Log ID:</span>
                    <span className="font-mono font-bold text-[var(--text-primary)]">#{selectedLog.id}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--text-secondary)] uppercase block tracking-wider mb-0.5">Timestamp:</span>
                    <span className="font-bold text-[var(--text-primary)]">{new Date(selectedLog.createdAt).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--text-secondary)] uppercase block tracking-wider mb-0.5">Action Executed:</span>
                    <span className="font-bold text-[var(--text-primary)]">{selectedLog.action}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--text-secondary)] uppercase block tracking-wider mb-0.5">IP Location:</span>
                    <span className="font-mono text-[var(--text-primary)]">{selectedLog.ipAddress || "N/A"}</span>
                  </div>
                </div>

                {/* Actor Info */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-soft)] pb-1.5">Administrative Actor</h4>
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/20">
                    <div className="w-8 h-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-soft)] flex items-center justify-center font-bold text-xs">
                      {selectedLog.admin?.name ? selectedLog.admin.name.substring(0,2).toUpperCase() : 'SY'}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">{selectedLog.admin?.name || "System"}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{selectedLog.admin?.email || "system@dizipay.in"}</p>
                    </div>
                    <span className="ml-auto px-2 py-0.5 bg-[var(--color-primary-glow)] text-[var(--color-primary)] text-[9px] font-bold rounded uppercase tracking-wider border border-[var(--border-soft)]">
                      {selectedLog.admin?.role || "SYSTEM"}
                    </span>
                  </div>
                </div>

                {/* JSON Payload Details */}
                <div className="space-y-2 flex-1">
                  <h4 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border-soft)] pb-1.5">Action Details & JSON Payload</h4>
                  <div className="rounded-xl border border-[var(--border-soft)] overflow-hidden bg-zinc-950 p-4 font-mono text-[10px] text-zinc-300 overflow-x-auto shadow-inner leading-relaxed">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedLog.details || {}, null, 2)}</pre>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
