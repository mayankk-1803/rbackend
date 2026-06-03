import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, Download } from 'lucide-react';

export const OperatorMapping = () => {
  const [mappings, setMappings] = useState([]);
  const [operators, setOperators] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // Form parameters
  const [operatorId, setOperatorId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providerOperatorCode, setProviderOperatorCode] = useState('');
  const [providerCircleCode, setProviderCircleCode] = useState('');
  const [priority, setPriority] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [resMappings, resOperators, resProviders] = await Promise.all([
        fetch('/api/admin/enterprise/operators/provider-mappings', { headers }).then(r => r.json()),
        fetch('/api/admin/enterprise/operators/mappings', { headers }).then(r => r.json()), // to fetch standard operators list
        fetch('/api/admin/enterprise/providers', { headers }).then(r => r.json())
      ]);

      if (resMappings.success) setMappings(resMappings.data);
      if (resProviders.success) setProviders(resProviders.data);

      if (resOperators.success) {
        // Build list of unique operators
        const uniqueOps = [];
        const seen = new Set();
        resOperators.data.forEach(m => {
          if (m.operator && !seen.has(m.operator.id)) {
            seen.add(m.operator.id);
            uniqueOps.push(m.operator);
          }
        });
        setOperators(uniqueOps);
      }
    } catch (err) {
      toast.error('Error fetching operator mappings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditMode(false);
    setOperatorId('');
    setProviderId('');
    setProviderOperatorCode('');
    setProviderCircleCode('');
    setPriority('0');
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (m) => {
    setEditMode(true);
    setSelectedId(m.id);
    setOperatorId(m.operatorId.toString());
    setProviderId(m.providerId.toString());
    setProviderOperatorCode(m.providerOperatorCode);
    setProviderCircleCode(m.providerCircleCode || '');
    setPriority(m.priority.toString());
    setIsActive(m.isActive);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!operatorId || !providerId || !providerOperatorCode) {
      toast.error('Missing required fields');
      return;
    }

    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const url = editMode 
        ? `/api/admin/enterprise/operators/provider-mappings/${selectedId}` 
        : '/api/admin/enterprise/operators/provider-mappings';
      const method = editMode ? 'PUT' : 'POST';

      const payload = {
        operatorId: parseInt(operatorId),
        providerId: parseInt(providerId),
        providerOperatorCode,
        providerCircleCode,
        priority: parseInt(priority),
        isActive
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const res = await response.json();
      if (res.success) {
        toast.success(res.message || 'Saved successfully');
        setShowModal(false);
        fetchData();
      } else {
        toast.error(res.message || 'Failed to save mapping');
      }
    } catch (err) {
      toast.error('Error saving mapping');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this operator mapping?')) return;
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch(`/api/admin/enterprise/operators/provider-mappings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        toast.success('Mapping deleted successfully');
        fetchData();
      } else {
        toast.error(res.message || 'Failed to delete');
      }
    } catch (err) {
      toast.error('Error deleting mapping');
    }
  };

  const exportCSV = () => {
    const headers = ['#', 'Operator', 'Gateway Provider', 'Provider Op Code', 'Provider Circle Code', 'Priority Weight', 'Status'];
    const rows = mappings.map((m, idx) => [
      idx + 1,
      m.operator?.name || 'Unknown',
      m.provider?.name || 'Unknown',
      m.providerOperatorCode,
      m.providerCircleCode || 'ALL',
      m.priority,
      m.isActive ? 'ACTIVE' : 'INACTIVE'
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "operator_mappings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = mappings.filter(m => 
    (m.operator?.name && m.operator.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (m.providerOperatorCode && m.providerOperatorCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Operator Mapping</h1>
          <p className="text-sm text-[var(--text-secondary)]">Map standardized operators to specific gateway provider codes.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportCSV}
            className="flex items-center px-4 py-2 border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium text-[var(--text-secondary)] cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button 
            onClick={openAddModal}
            className="flex items-center px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-xl text-sm font-semibold text-white cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Mapping
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border-soft)]">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              type="text" 
              placeholder="Search by operator or provider code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-semibold">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Internal Operator</th>
                <th className="px-6 py-4">Gateway Provider</th>
                <th className="px-6 py-4">Provider Operator Code</th>
                <th className="px-6 py-4">Provider Circle Code</th>
                <th className="px-6 py-4 font-mono text-center">Priority</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-[var(--text-secondary)]">Loading operator mappings data...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-[var(--text-secondary)]">No operator provider mappings registered yet.</td>
                </tr>
              ) : filtered.map((map, idx) => (
                <tr key={map.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                  <td className="px-6 py-4 font-medium text-[var(--text-secondary)]">{idx + 1}</td>
                  <td className="px-6 py-4 font-semibold">{map.operator?.name || 'Unknown'}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs px-2.5 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg font-semibold text-[var(--color-primary)]">
                      {map.provider?.name || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-xs">{map.providerOperatorCode}</td>
                  <td className="px-6 py-4 text-xs font-mono">{map.providerCircleCode || 'ALL'}</td>
                  <td className="px-6 py-4 font-mono text-center">{map.priority}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      map.isActive 
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    }`}>
                      {map.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => openEditModal(map)}
                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--color-primary)] cursor-pointer"
                    >
                      <Edit2 className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(map.id)}
                      className="p-1 text-[var(--text-secondary)] hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-soft)]">
              <h3 className="font-bold text-lg text-[var(--text-primary)]">
                {editMode ? 'Edit Operator Mapping' : 'Register Operator Mapping'}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Standard Operator</label>
                <select 
                  value={operatorId}
                  onChange={(e) => setOperatorId(e.target.value)}
                  disabled={editMode}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden disabled:opacity-50"
                  required
                >
                  <option value="">Select Operator</option>
                  {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Gateway Provider</label>
                <select 
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  disabled={editMode}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden disabled:opacity-50 font-semibold text-[var(--color-primary)]"
                  required
                >
                  <option value="">Select Gateway</option>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Provider Operator Code</label>
                <input 
                  type="text" 
                  value={providerOperatorCode}
                  onChange={(e) => setProviderOperatorCode(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
                  placeholder="e.g. RJIO"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Provider Circle Code</label>
                  <input 
                    type="text" 
                    value={providerCircleCode}
                    onChange={(e) => setProviderCircleCode(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
                    placeholder="e.g. 5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Priority (Order)</label>
                  <input 
                    type="number" 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border-[var(--border-soft)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                <label htmlFor="isActive" className="text-sm font-semibold text-[var(--text-primary)]">Active and enabled for resolution</label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border-soft)]">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-xl text-sm font-semibold text-white cursor-pointer"
                >
                  Save Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
