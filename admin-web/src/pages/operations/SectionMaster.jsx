import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, ArrowUpDown, Download } from 'lucide-react';

export const SectionMaster = () => {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [serviceType, setServiceType] = useState('RECHARGE');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  const fetchSections = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch('/api/admin/enterprise/sections', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const res = await response.json();
      if (res.success) {
        setSections(res.data);
      } else {
        toast.error(res.message || 'Failed to fetch sections');
      }
    } catch (err) {
      toast.error('Connection error fetching sections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const openAddModal = () => {
    setEditMode(false);
    setName('');
    setCode('');
    setDescription('');
    setServiceType('RECHARGE');
    setDisplayOrder('0');
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (sec) => {
    setEditMode(true);
    setSelectedId(sec.id);
    setName(sec.name);
    setCode(sec.code);
    setDescription(sec.description || '');
    setServiceType(sec.serviceType);
    setDisplayOrder(sec.displayOrder.toString());
    setIsActive(sec.isActive);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name || !code || !serviceType) {
      toast.error('Missing required fields');
      return;
    }

    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const url = editMode 
        ? `/api/admin/enterprise/sections/${selectedId}` 
        : '/api/admin/enterprise/sections';
      const method = editMode ? 'PUT' : 'POST';

      const payload = {
        name,
        code,
        description,
        serviceType,
        displayOrder: parseInt(displayOrder),
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
        fetchSections();
      } else {
        toast.error(res.message || 'Failed to save section');
      }
    } catch (err) {
      toast.error('Error saving section');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this section?')) return;
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch(`/api/admin/enterprise/sections/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const res = await response.json();
      if (res.success) {
        toast.success('Section deleted successfully');
        fetchSections();
      } else {
        toast.error(res.message || 'Failed to delete');
      }
    } catch (err) {
      toast.error('Error deleting section');
    }
  };

  const exportCSV = () => {
    const headers = ['#', 'Section Name', 'Code', 'Description', 'Priority', 'Status', 'Service Type', 'Created Date', 'Modified Date'];
    const rows = sections.map((s, idx) => [
      idx + 1,
      s.name,
      s.code,
      s.description || '',
      s.displayOrder,
      s.isActive ? 'ACTIVE' : 'INACTIVE',
      s.serviceType,
      new Date(s.createdAt).toLocaleDateString(),
      new Date(s.updatedAt).toLocaleDateString()
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sections_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filtered = sections.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Section Master</h1>
          <p className="text-sm text-[var(--text-secondary)]">Manage system categories and service classifications.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportCSV}
            className="flex items-center px-4 py-2 border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-xl text-sm font-medium text-[var(--text-secondary)] transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
          <button 
            onClick={openAddModal}
            className="flex items-center px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-xl text-sm font-semibold text-white transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Section
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border-soft)] flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              type="text" 
              placeholder="Search by section name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-semibold">
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">Section Name</th>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Priority (Order)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Service Type</th>
                <th className="px-6 py-4">Created Date</th>
                <th className="px-6 py-4">Modified Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)]">
              {loading ? (
                <tr>
                  <td colSpan="10" className="px-6 py-10 text-center text-[var(--text-secondary)]">Loading sections data...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="10" className="px-6 py-10 text-center text-[var(--text-secondary)]">No service sections configured yet.</td>
                </tr>
              ) : filtered.map((sec, idx) => (
                <tr key={sec.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                  <td className="px-6 py-4 font-medium text-[var(--text-secondary)]">{idx + 1}</td>
                  <td className="px-6 py-4 font-semibold">{sec.name}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs px-2.5 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg">
                      {sec.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-[var(--text-secondary)] max-w-xs truncate">{sec.description || '-'}</td>
                  <td className="px-6 py-4 font-mono">{sec.displayOrder}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                      sec.isActive 
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    }`}>
                      {sec.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold uppercase">{sec.serviceType}</td>
                  <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{new Date(sec.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-xs text-[var(--text-secondary)]">{new Date(sec.updatedAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => openEditModal(sec)}
                      className="p-1 text-[var(--text-secondary)] hover:text-[var(--color-primary)] transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-4.5 h-4.5" />
                    </button>
                    <button 
                      onClick={() => handleDelete(sec.id)}
                      className="p-1 text-[var(--text-secondary)] hover:text-rose-600 transition-colors cursor-pointer"
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
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-[var(--border-soft)]">
              <h3 className="font-bold text-lg text-[var(--text-primary)]">
                {editMode ? 'Edit Service Section' : 'Create Service Section'}
              </h3>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Section Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                  placeholder="e.g. DTH Services"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Unique Code</label>
                <input 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={editMode}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] disabled:opacity-50 font-mono"
                  placeholder="e.g. DTH"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Description</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] h-20 resize-none"
                  placeholder="Brief description of this service category..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Service Type</label>
                  <select 
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                  >
                    <option value="RECHARGE">Recharge</option>
                    <option value="DTH">DTH</option>
                    <option value="BBPS">BBPS</option>
                    <option value="AEPS">AEPS</option>
                    <option value="DMT">Money Transfer</option>
                    <option value="FASTAG">FASTag</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Priority (Order)</label>
                  <input 
                    type="number" 
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
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
                <label htmlFor="isActive" className="text-sm font-semibold text-[var(--text-primary)]">Active and available for routing rules</label>
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
                  Save Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
