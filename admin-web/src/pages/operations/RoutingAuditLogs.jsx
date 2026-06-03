import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Search, Download, ClipboardList } from 'lucide-react';

export const RoutingAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch('/api/admin/enterprise/routing/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        setLogs(res.data);
      } else {
        toast.error(res.message || 'Failed to fetch audit logs');
      }
    } catch (err) {
      toast.error('Connection error loading audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const exportCSV = () => {
    const headers = ['#', 'Action', 'Entity Type', 'Entity ID', 'User ID', 'Role', 'IP Address', 'Timestamp'];
    const rows = logs.map((l, idx) => [
      idx + 1,
      l.action,
      l.entityType,
      l.entityId,
      l.userId || 'System',
      l.userRole || 'N/A',
      l.ipAddress || 'localhost',
      new Date(l.createdAt).toLocaleString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "routing_audit_logs.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = logs.filter(l => 
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.entityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.userRole && l.userRole.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Routing Audit Logs</h1>
          <p className="text-sm text-[var(--text-secondary)]">Searchable append-only audit trail logging all modifications to sections, mappings, overrides, and rules.</p>
        </div>
        <div>
          <button 
            onClick={exportCSV}
            className="flex items-center px-4 py-2 border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium text-[var(--text-secondary)] cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border-soft)]">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              type="text" 
              placeholder="Search by action, entity type, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-semibold">
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Action Type</th>
                <th className="px-6 py-4">Entity Target</th>
                <th className="px-6 py-4 font-mono text-center">Entity ID</th>
                <th className="px-6 py-4">Operator/User</th>
                <th className="px-6 py-4">IP Address</th>
                <th className="px-6 py-4">Change Log Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)]">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-[var(--text-secondary)]">Loading immutable logs...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-[var(--text-secondary)]">No auditing logs registered.</td>
                </tr>
              ) : filtered.map((l) => (
                <tr key={l.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                  <td className="px-6 py-4 text-xs font-mono text-[var(--text-secondary)]">{new Date(l.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold font-mono px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg text-[var(--color-primary)]">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold uppercase">{l.entityType}</td>
                  <td className="px-6 py-4 font-mono text-center">{l.entityId}</td>
                  <td className="px-6 py-4">
                    <div className="text-xs">
                      <p className="font-semibold">{l.userRole || 'System Action'}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">User ID: {l.userId || 'N/A'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-[var(--text-secondary)]">{l.ipAddress || '127.0.0.1'}</td>
                  <td className="px-6 py-4 max-w-sm truncate text-xs text-[var(--text-secondary)] font-mono">
                    {l.newValue || l.oldValue || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
