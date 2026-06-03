import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Play, HelpCircle, ShieldAlert, Cpu, Layers, AlertCircle } from 'lucide-react';

export const RouteSimulator = () => {
  const [sections, setSections] = useState([]);
  const [operators, setOperators] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form Inputs
  const [sectionId, setSectionId] = useState('');
  const [operatorId, setOperatorId] = useState('');
  const [circleId, setCircleId] = useState('');
  const [amount, setAmount] = useState('299');
  const [serviceType, setServiceType] = useState('RECHARGE');

  // Simulation Output
  const [output, setOutput] = useState(null);

  const fetchDependencies = async () => {
    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [resSections, resOperators] = await Promise.all([
        fetch('/api/admin/enterprise/sections', { headers }).then(r => r.json()),
        fetch('/api/admin/enterprise/operators/mappings', { headers }).then(r => r.json())
      ]);

      if (resSections.success) setSections(resSections.data);
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
      toast.error('Failed to load simulator parameters');
    }
  };

  useEffect(() => {
    fetchDependencies();
  }, []);

  const handleSimulate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setOutput(null);

    try {
      const token = sessionStorage.getItem('dizipay_admin_token');
      const response = await fetch('/api/admin/enterprise/routing/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          sectionId: sectionId ? parseInt(sectionId) : null,
          operatorId: operatorId ? parseInt(operatorId) : null,
          circleId: circleId ? parseInt(circleId) : null,
          amount: parseFloat(amount),
          serviceType
        })
      });

      const res = await response.json();
      if (res.success) {
        setOutput(res.data);
        toast.success('Simulation computed successfully.');
      } else {
        toast.error(res.message || 'Simulation query failed');
      }
    } catch (err) {
      toast.error('Connection error running simulation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Route Simulator</h1>
        <p className="text-sm text-[var(--text-secondary)]">Dry run transaction routing logic. Simulator operations are read-only and have no impact on production databases.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Parameters Form */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs h-fit">
          <h3 className="font-bold text-base mb-4 text-[var(--text-primary)]">Transaction Inputs</h3>
          <form onSubmit={handleSimulate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Service Section</label>
              <select 
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
              >
                <option value="">All Sections</option>
                {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Operator</label>
              <select 
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
              >
                <option value="">Any Operator</option>
                {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Circle (Standard Telecom ID)</label>
              <input 
                type="text" 
                placeholder="e.g. 5 (Delhi NCR)"
                value={circleId}
                onChange={(e) => setCircleId(e.target.value)}
                className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Amount (₹)</label>
                <input 
                  type="number" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Service Type</label>
                <select 
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-hidden font-mono"
                >
                  <option value="RECHARGE">RECHARGE</option>
                  <option value="DTH">DTH</option>
                  <option value="BBPS">BBPS</option>
                  <option value="AEPS">AEPS</option>
                  <option value="DMT">MONEY_TRANSFER</option>
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 bg-[var(--color-primary)] hover:opacity-90 disabled:opacity-50 rounded-xl text-sm font-semibold text-white flex items-center justify-center cursor-pointer transition-opacity"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              {loading ? 'Simulating Resolution...' : 'Run Simulation'}
            </button>
          </form>
        </div>

        {/* Output Diagnostics Panel */}
        <div className="lg:col-span-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 shadow-xs flex flex-col min-h-[400px]">
          <h3 className="font-bold text-base mb-4 text-[var(--text-primary)]">Simulation Path & Trail</h3>

          {!output && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-[var(--border-soft)] rounded-xl text-[var(--text-secondary)]">
              <Cpu className="w-10 h-10 mb-3 opacity-60" />
              <p className="font-semibold text-sm">Awaiting Simulation</p>
              <p className="text-xs max-w-xs mt-1">Configure transaction parameters and run the simulator to preview paths.</p>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex items-center justify-center text-[var(--text-secondary)]">
              Evaluating precedence logic and telemetry variables...
            </div>
          )}

          {output && (
            <div className="space-y-6 flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Selected Provider</p>
                  <p className="text-lg font-bold text-[var(--color-primary)] mt-1">{output.selectedProvider}</p>
                </div>
                <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Routing Mode</p>
                  <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{output.routingMode}</p>
                </div>
                <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase">Primary Health Score</p>
                  <p className="text-lg font-bold text-emerald-500 mt-1">{output.healthScore.toFixed(1)}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">Matched Rules</h4>
                {output.matchedRules.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No custom rules matched. Global system default applied.</p>
                ) : (
                  <div className="space-y-2">
                    {output.matchedRules.map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-xl text-sm">
                        <span className="font-semibold text-[var(--text-primary)]">{r.name}</span>
                        <span className="text-xs text-[var(--text-secondary)]">Precedence Priority: {r.priority}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-[var(--text-secondary)] uppercase mb-2">Fallback Failover Chain</h4>
                {output.fallbackChain.length === 0 ? (
                  <p className="text-xs text-[var(--text-secondary)]">No backup nodes configured or active for this route.</p>
                ) : (
                  <div className="flex items-center gap-2 flex-wrap">
                    {output.fallbackChain.map((bc, idx) => (
                      <React.Fragment key={bc}>
                        {idx > 0 && <ArrowRight className="w-4 h-4 text-[var(--text-secondary)]" />}
                        <span className="px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border-soft)] rounded-lg text-xs font-semibold font-mono text-[var(--text-primary)]">
                          {bc}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-amber-700 uppercase">Reasoning & Diagnostics Trail</h4>
                  <p className="text-xs text-[var(--text-primary)] mt-1">{output.reason}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
