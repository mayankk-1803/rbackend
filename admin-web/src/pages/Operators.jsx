import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smartphone, Plus, Search, Edit2, Trash2, CheckCircle2, XCircle, 
  Settings, RefreshCw, Sliders, Info, ShieldAlert, Wifi, Tv, HelpCircle,
  PlusCircle, Check, X, ToggleLeft, ToggleRight
} from 'lucide-react';

export const Operators = () => {
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // ALL, MOBILE, DTH
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingOperator, setEditingOperator] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'Mobile',
    active: true,
    circleRequired: false,
    description: ''
  });

  const fetchOperators = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/enterprise/operators');
      if (data?.success) {
        setOperators(data.data || []);
      } else {
        toast.error("Failed to load operators registry");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch operators list");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOperators();
  }, []);

  const handleOpenAdd = () => {
    setEditingOperator(null);
    setFormData({
      name: '',
      code: '',
      category: 'Mobile',
      active: true,
      circleRequired: false,
      description: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (op) => {
    setEditingOperator(op);
    setFormData({
      name: op.name,
      code: op.code,
      category: op.category || 'Mobile',
      active: op.active,
      circleRequired: op.circleRequired || false,
      description: op.description || ''
    });
    setShowModal(true);
  };

  const handleToggleStatus = async (op) => {
    const loadingToast = toast.loading(`Updating ${op.name} status...`);
    try {
      const { data } = await api.put(`/admin/enterprise/operators/${op.id}`, {
        active: !op.active
      });
      if (data?.success) {
        toast.success(`Operator ${!op.active ? 'activated' : 'deactivated'} successfully!`, { id: loadingToast });
        fetchOperators();
      } else {
        toast.error(data?.message || "Failed to update status", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to toggle status", { id: loadingToast });
    }
  };

  const handleDeleteOperator = async (op) => {
    if (!window.confirm(`Are you sure you want to delete ${op.name}?`)) return;
    const loadingToast = toast.loading(`Deleting ${op.name}...`);
    try {
      const { data } = await api.delete(`/admin/enterprise/operators/${op.id}`);
      if (data?.success) {
        toast.success("Operator deleted successfully!", { id: loadingToast });
        fetchOperators();
      } else {
        toast.error(data?.message || "Failed to delete operator", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to delete operator", { id: loadingToast });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      return toast.error("Name and code are required.");
    }
    
    setSaving(true);
    const loadingToast = toast.loading(editingOperator ? "Updating operator..." : "Creating operator...");
    
    try {
      let res;
      if (editingOperator) {
        res = await api.put(`/admin/enterprise/operators/${editingOperator.id}`, formData);
      } else {
        res = await api.post('/admin/enterprise/operators', formData);
      }
      
      if (res.data?.success) {
        toast.success(editingOperator ? "Operator updated!" : "Operator registered!", { id: loadingToast });
        setShowModal(false);
        fetchOperators();
      } else {
        toast.error(res.data?.message || "Failed to save operator", { id: loadingToast });
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Operational execution error occurred.", { id: loadingToast });
    } finally {
      setSaving(false);
    }
  };

  // Filter & Search Logic
  const filteredOperators = operators.filter((op) => {
    const matchesSearch = 
      op.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      String(op.code).toLowerCase().includes(searchTerm.toLowerCase());
    
    const category = op.category ? op.category.toUpperCase() : 'MOBILE';
    const matchesCategory = 
      categoryFilter === 'ALL' || 
      (categoryFilter === 'MOBILE' && category === 'MOBILE') || 
      (categoryFilter === 'DTH' && category === 'DTH');

    return matchesSearch && matchesCategory;
  });

  const getOperatorIcon = (category) => {
    const cat = category ? category.toUpperCase() : 'MOBILE';
    if (cat === 'DTH') {
      return <Tv className="w-5 h-5 text-indigo-400 shrink-0" />;
    }
    return <Smartphone className="w-5 h-5 text-emerald-400 shrink-0" />;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header section */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[var(--card-bg)] p-6 rounded-xl border border-[var(--border-soft)] shadow-soft">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Smartphone className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              Operator <span className="text-[var(--color-primary)]">Registry</span>
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium">Manage and configure service providers, recharge categories, and validation rules</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="w-full lg:w-auto bg-[var(--color-primary)] hover:opacity-90 text-[var(--bg-primary)] shadow-sm transition-all px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
        >
          <PlusCircle className="w-4.5 h-4.5" />
          Add Operator
        </button>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[var(--card-bg)] p-4 rounded-xl border border-[var(--border-soft)] shadow-soft">
        {/* Category Tabs */}
        <div className="flex gap-2.5 overflow-x-auto pb-1 md:pb-0 w-full md:w-auto">
          {[
            { id: 'ALL', label: 'All Operators', icon: Sliders },
            { id: 'MOBILE', label: 'Mobile Recharge', icon: Wifi },
            { id: 'DTH', label: 'DTH TV Services', icon: Tv }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = categoryFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-xs"
                    : "bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> 
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Field */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <input 
            type="text" 
            placeholder="Search operator name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)]/40 border border-[var(--border-soft)] rounded-xl text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Operators Grid / Cards View */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-44 bg-[var(--bg-secondary)]/40 animate-pulse rounded-xl border border-[var(--border-soft)]"></div>
          ))}
        </div>
      ) : filteredOperators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[var(--card-bg)] rounded-xl border border-[var(--border-soft)] shadow-soft text-center p-6">
          <Info className="w-10 h-10 text-[var(--text-muted)] mb-3" />
          <h3 className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wider">No Operators Found</h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm">No operators registry entries matched your search criteria. Check your filters or add a new operator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOperators.map((op) => {
            const isDth = (op.category || 'Mobile').toUpperCase() === 'DTH';
            return (
              <motion.div 
                key={op.id}
                whileHover={{ y: -2 }}
                className={`rounded-xl border transition-all duration-300 overflow-hidden flex flex-col justify-between group ${
                  op.active 
                    ? 'bg-[var(--card-bg)] border-[var(--border-soft)] shadow-soft' 
                    : 'bg-[var(--bg-secondary)]/30 border-[var(--border-soft)] opacity-60 hover:opacity-90'
                }`}
              >
                <div className="p-5 space-y-4">
                  {/* Title & Icon Header */}
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                        op.active ? 'bg-[var(--color-primary-glow)] border-[var(--border-soft)]' : 'bg-[var(--bg-secondary)] border-[var(--border-soft)]'
                      }`}>
                        {getOperatorIcon(op.category)}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">
                          {op.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            isDth ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {op.category || 'Mobile'}
                          </span>
                          <span className="text-[9px] font-mono text-[var(--text-muted)]">Code: {op.code}</span>
                        </div>
                      </div>
                    </div>

                    {/* Active Checkbox */}
                    <button 
                      onClick={() => handleToggleStatus(op)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        op.active 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20'
                      }`}
                      title={op.active ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {op.active ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-[var(--text-secondary)] line-clamp-2 min-h-[2rem]">
                    {op.description || `Operator configurations for ${op.name}.`}
                  </p>

                  {/* Meta details tags */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border-soft)]/50">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                      op.circleRequired 
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-soft)]'
                    }`}>
                      {op.circleRequired ? 'Circle Req' : 'Global (No Circle)'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--border-soft)]">
                      Secure API
                    </span>
                  </div>
                </div>

                {/* Footer Buttons for Edit/Delete */}
                <div className="px-5 py-3.5 bg-[var(--bg-secondary)]/40 border-t border-[var(--border-soft)] flex justify-between items-center gap-3">
                  <button 
                    onClick={() => handleOpenEdit(op)}
                    className="flex-1 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-soft)] text-[var(--text-primary)] hover:text-[var(--color-primary)] text-[10px] font-bold tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit2 className="w-3 h-3 text-[var(--color-primary)]" />
                    Configure
                  </button>
                  <button 
                    onClick={() => handleDeleteOperator(op)}
                    className="p-1.5 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 hover:border-rose-500/20 text-rose-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer"
                    title="Delete Operator"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal Overlay */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--card-bg)] border border-[var(--border-soft)] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-secondary)]/30">
                <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[var(--color-primary)]" />
                  {editingOperator ? `Edit Operator: ${editingOperator.name}` : 'Register New Operator Node'}
                </h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  ✕ Close
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Operator Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. TATA PLAY"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full text-xs p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Operator Code</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. 10"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      className="w-full text-xs p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Category</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full text-xs p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] font-bold cursor-pointer"
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

                  <div className="flex gap-4 items-center h-full pt-4">
                    <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] font-semibold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.circleRequired}
                        onChange={(e) => setFormData({ ...formData, circleRequired: e.target.checked })}
                        className="rounded border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      Circle Required
                    </label>

                    <label className="flex items-center gap-2 text-xs text-[var(--text-primary)] font-semibold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.active}
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                        className="rounded border-[var(--border-soft)] bg-[var(--bg-secondary)] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                      Active Status
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-[var(--text-secondary)] font-bold uppercase block mb-1">Description</label>
                  <textarea 
                    rows={3}
                    placeholder="Provide operator description, gateway mapping notes, etc."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full text-xs p-2.5 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] resize-none"
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex gap-4 border-t border-[var(--border-soft)] pt-4 justify-end">
                  <button 
                    type="button" 
                    onClick={() => setShowModal(false)}
                    className="bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-soft)] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="bg-[var(--color-primary)] text-[var(--bg-primary)] px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Operator'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Operators;
