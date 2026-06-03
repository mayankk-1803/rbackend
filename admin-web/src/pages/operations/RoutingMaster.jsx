import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Plus, Check, X, Search, Settings2, Trash2, ArrowRight } from 'lucide-react';

export const RoutingMaster = () => {
  const [rules, setRules] = useState([]);
  const [sections, setSections] = useState([]);
  const [operators, setOperators] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedRule, setSelectedRule] = useState(null);

  // Maker form states
  const [name, setName] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [priority, setPriority] = useState('1');
  const [weight, setWeight] = useState('0');
  const [routeType, setRouteType] = useState('PRIMARY');
  const [amountFrom, setAmountFrom] = useState('0.00');
  const [amountTo, setAmountTo] = useState('99999.00');
  const [serviceType, setServiceType] = useState('RECHARGE');
  const [failureThreshold, setFailureThreshold] = useState('0');
  const [latencyThreshold, setLatencyThreshold] = useState('0');

  // Role resolution
  const [adminUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("dizipay_admin_data")) || {};
    } catch {
      return {};
    }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [resRules, resSections, resOperators, resProviders] = await Promise.all([
        fetch('/api/admin/enterprise/routing/advanced-rules', { headers }).then(r => r.json()),
        fetch('/api/admin/enterprise/sections', { headers }).then(r => r.json()),
        fetch('/api/admin/enterprise/operators/mappings', { headers }).then(r => r.json()), // reuse mappings/operators list
        fetch('/api/admin/enterprise/providers', { headers }).then(r => r.json())
      ]);

      if (resRules.success) setRules(resRules.data);
      if (resSections.success) setSections(resSections.data);
      if (resProviders.success) setProviders(resProviders.data);

      // Unique operators list
      if (resOperators.success) {
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
      toast.error('Error fetching routing rules dependencies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateDraft = async (e) => {
    e.preventDefault();
    if (!name || !providerId) {
      toast.error('Rule name and provider are required');
      return;
    }

    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch('/api/admin/enterprise/routing/advanced-rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          sectionId: sectionId ? parseInt(sectionId) : null,
          operatorId: operatorId ? parseInt(operatorId) : null,
          providerId: parseInt(providerId),
          priority: parseInt(priority),
          weight: parseInt(weight),
          routeType,
          amountFrom: parseFloat(amountFrom),
          amountTo: parseFloat(amountTo),
          serviceType,
          failureThreshold: parseInt(failureThreshold),
          latencyThreshold: parseInt(latencyThreshold)
        })
      });

      const res = await response.json();
      if (res.success) {
        toast.success('Draft rule created successfully. Please submit for approval.');
        setShowModal(false);
        fetchData();
      } else {
        toast.error(res.message || 'Failed to create draft');
      }
    } catch (err) {
      toast.error('Connection error creating rule');
    }
  };

  const submitApproval = async (id) => {
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch(`/api/admin/enterprise/routing/advanced-rules/${id}/submit`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        toast.success('Submitted for approval.');
        fetchData();
      } else {
        toast.error(res.message || 'Failed to submit');
      }
    } catch (err) {
      toast.error('Connection error submitting rule');
    }
  };

  const approve = async (id) => {
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch(`/api/admin/enterprise/routing/advanced-rules/${id}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        toast.success('Rule approved and updated in Redis cache.');
        fetchData();
      } else {
        toast.error(res.message || 'Approval failed');
      }
    } catch (err) {
      toast.error('Connection error approving rule');
    }
  };

  const reject = async (id) => {
    const comments = window.prompt('Provide rejection comments:');
    if (comments === null) return;
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch(`/api/admin/enterprise/routing/advanced-rules/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comments })
      });
      const res = await response.json();
      if (res.success) {
        toast.success('Rule changes rejected');
        fetchData();
      } else {
        toast.error(res.message || 'Failed to reject rule');
      }
    } catch (err) {
      toast.error('Connection error rejecting rule');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch(`/api/admin/enterprise/routing/advanced-rules/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const res = await response.json();
      if (res.success) {
        toast.success('Rule deleted successfully');
        fetchData();
      } else {
        toast.error(res.message || 'Failed to delete');
      }
    } catch (err) {
      toast.error('Error deleting rule');
    }
  };

  const filtered = rules.filter(r => 
    (r.name && r.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (r.serviceType && r.serviceType.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Routing Master</h1>
          <p className="text-sm text-[var(--text-secondary)]">Manage resolution logic precedence, fallback providers, and traffic splits.</p>
        </div>
        <div>
          <button 
            onClick={() => {
              setName('');
              setSectionId('');
              setOperatorId('');
              setProviderId('');
              setPriority('1');
              setWeight('0');
              setRouteType('PRIMARY');
              setAmountFrom('0.00');
              setAmountTo('99999.00');
              setServiceType('RECHARGE');
              setFailureThreshold('0');
              setLatencyThreshold('0');
              setShowModal(true);
            }}
            className="flex items-center px-4 py-2 bg-[var(--color-primary)] hover:opacity-90 rounded-xl text-sm font-semibold text-white transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Rule
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-[var(--border-soft)]">
          <div className="relative max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
            <input 
              type="text" 
              placeholder="Search by rule name or service type..."
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
                <th className="px-6 py-4">Rule Name</th>
                <th className="px-6 py-4">Section / Service</th>
                <th className="px-6 py-4">Scope (Op/Circle)</th>
                <th className="px-6 py-4">Target Provider</th>
                <th className="px-6 py-4">Precedence / Weight</th>
                <th className="px-6 py-4">Slab Limits</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)]">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-[var(--text-secondary)]">Loading rules data...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-[var(--text-secondary)]">No routing rules resolved.</td>
                </tr>
              ) : filtered.map((rule) => (
                <tr key={rule.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                  <td className="px-6 py-4 font-semibold">
                    <div>
                      <p>{rule.name || `Rule #${rule.id}`}</p>
                      <span className="text-[10px] text-[var(--text-secondary)] font-mono">Type: {rule.routeType}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs">
                      <p className="font-semibold text-[var(--text-secondary)]">{rule.section?.name || 'All Sections'}</p>
                      <p className="opacity-80 uppercase font-semibold text-[10px]">{rule.serviceType || 'All Services'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium">
                    {rule.operator?.name || 'Any Operator'} {rule.circleId ? `(Circle: ${rule.circleId})` : '(Any Region)'}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs px-2 py-1 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg font-semibold text-[var(--color-primary)]">
                      {rule.provider?.name || 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    <p>Precedence: {rule.priority}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">Weight: {rule.weight}%</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">
                    ₹{Number(rule.amountFrom).toFixed(0)} - ₹{Number(rule.amountTo).toFixed(0)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      rule.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      rule.status === 'PENDING_APPROVAL' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                      rule.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                      'bg-slate-500/10 text-slate-600 border-slate-500/20'
                    }`}>
                      {rule.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {rule.status === 'DRAFT' && (
                      <button 
                        onClick={() => submitApproval(rule.id)}
                        className="px-2.5 py-1 bg-[var(--bg-tertiary)] hover:bg-[var(--accent-hover)] border border-[var(--border-soft)] rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Submit
                      </button>
                    )}

                    {rule.status === 'PENDING_APPROVAL' && adminUser.role === 'SUPER_ADMIN' && (
                      <>
                        <button 
                          onClick={() => approve(rule.id)}
                          className="p-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg cursor-pointer"
                          title="Approve Publish"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => reject(rule.id)}
                          className="p-1 bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg cursor-pointer"
                          title="Reject Change"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    <button 
                      onClick={() => handleDelete(rule.id)}
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
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl w-full max-w-xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-soft)]">
              <h3 className="font-bold text-lg text-[var(--text-primary)]">Configure Routing Rule</h3>
            </div>
            <form onSubmit={handleCreateDraft} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Rule Name</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                  placeholder="e.g. JIO Prepaid high-priority rule"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Service Section</label>
                  <select 
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                  >
                    <option value="">All Sections</option>
                    {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Telecom Operator</label>
                  <select 
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                  >
                    <option value="">Any Operator</option>
                    {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Target Provider Node</label>
                  <select 
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] font-semibold text-[var(--color-primary)]"
                    required
                  >
                    <option value="">Select Gateway</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Service Type</label>
                  <select 
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)] font-mono"
                  >
                    <option value="RECHARGE">RECHARGE</option>
                    <option value="DTH">DTH</option>
                    <option value="BBPS">BBPS</option>
                    <option value="AEPS">AEPS</option>
                    <option value="DMT">MONEY_TRANSFER</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Precedence (Priority)</label>
                  <input 
                    type="number" 
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Weight (Traffic Split %)</label>
                  <input 
                    type="number" 
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Min Amount Slab (₹)</label>
                  <input 
                    type="number" 
                    value={amountFrom}
                    onChange={(e) => setAmountFrom(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Max Amount Slab (₹)</label>
                  <input 
                    type="number" 
                    value={amountTo}
                    onChange={(e) => setAmountTo(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Failure Threshold</label>
                  <input 
                    type="number" 
                    value={failureThreshold}
                    onChange={(e) => setFailureThreshold(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
                    placeholder="consecutive errors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Latency Threshold (ms)</label>
                  <input 
                    type="number" 
                    value={latencyThreshold}
                    onChange={(e) => setLatencyThreshold(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
                    placeholder="e.g. 500"
                  />
                </div>
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
                  Create Rule Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
