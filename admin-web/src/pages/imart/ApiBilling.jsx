import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  Coins, 
  RefreshCw, 
  ShieldAlert, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Layers 
} from 'lucide-react';

export const ApiBilling = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchBilling = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/admin/api-marketplace/billing');
      if (response.data?.success) {
        setData(response.data.data);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
  }, []);

  const wallets = data?.wallets || [];
  const invoices = data?.invoices || [];
  const subscriptions = data?.subscriptions || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Credit Wallet Billing</h1>
          <p className="text-sm text-[var(--text-secondary)] font-medium">Monitor credit wallet ledger updates, continuous consumption reconciliations, and subscription invoices.</p>
        </div>
        <button
          onClick={fetchBilling}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all disabled:opacity-50 cursor-pointer h-fit w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh State
        </button>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="h-48 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl shimmer-element"></div>
          <div className="h-64 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl shimmer-element"></div>
          <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">Loading data...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-rose-500" />
          <h3 className="font-bold text-sm text-[var(--text-primary)]">Unable to load data.</h3>
          <p className="text-xs text-[var(--text-secondary)]">Please check your connection and try refreshing.</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Active Developer Wallets Grid */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-4 h-4 text-[var(--color-primary)]" /> Live B2B Credit Ledger Wallets
            </h3>
            
            {wallets.length === 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-8 text-center text-xs text-[var(--text-secondary)]">
                No active B2B credit ledger wallets found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {wallets.map((w) => (
                  <div key={w.id} className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 space-y-4 shadow-xs relative">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-extrabold text-[var(--text-secondary)] uppercase">Client UID: #{w.userId}</span>
                      <span className="inline-flex px-1.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold rounded">LEDGER_ACTIVE</span>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Remaining Balance</p>
                      <p className="text-3xl font-black text-[var(--text-primary)] font-mono">₹{Number(w.balance).toLocaleString()}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-[var(--border-soft)] pt-3 text-[11px] font-semibold text-[var(--text-primary)]">
                      <div>
                        <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase">Reserved</p>
                        <p className="font-mono text-amber-500 mt-0.5">₹{Number(w.reservedCredits).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase">Used Credits</p>
                        <p className="font-mono text-blue-500 mt-0.5">₹{Number(w.usedCredits).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="border-t border-[var(--border-soft)] pt-3 flex justify-between text-[9px] text-[var(--text-secondary)] font-bold uppercase">
                      <span>Purchased: ₹{Number(w.lifetimePurchased).toLocaleString()}</span>
                      <span>Consumed: ₹{Number(w.lifetimeConsumed).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Subscriptions */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-500" /> Active Developer Channel Subscriptions
            </h3>
            
            {subscriptions.length === 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-8 text-center text-xs text-[var(--text-secondary)]">
                No active developer channels subscriptions found.
              </div>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-extrabold uppercase">
                        <th className="px-6 py-4">Subscription ID</th>
                        <th className="px-6 py-4">Client ID</th>
                        <th className="px-6 py-4">Billing Plan</th>
                        <th className="px-6 py-4">Limits</th>
                        <th className="px-6 py-4">Date Subscribed</th>
                        <th className="px-6 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)] font-medium">
                      {subscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-[11px] text-[var(--color-primary)]">{sub.id}</td>
                          <td className="px-6 py-4 font-mono">User #{sub.clientId}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold block">{sub.plan?.name}</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">{sub.plan?.product?.name}</span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[10px] text-[var(--text-secondary)]">
                            <div>Daily Limit: ₹{sub.dailyCreditLimit ? Number(sub.dailyCreditLimit).toLocaleString() : 'UNLIMITED'}</div>
                            <div>Monthly Limit: ₹{sub.monthlyCreditLimit ? Number(sub.monthlyCreditLimit).toLocaleString() : 'UNLIMITED'}</div>
                          </td>
                          <td className="px-6 py-4 text-[var(--text-secondary)]">{new Date(sub.startDate).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-extrabold border ${
                              sub.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            }`}>
                              {sub.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Invoice Logs */}
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" /> Subscription Invoice Ledgers
            </h3>
            
            {invoices.length === 0 ? (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-8 text-center text-xs text-[var(--text-secondary)]">
                No invoices have been logged in the marketplace ledger.
              </div>
            ) : (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-soft)] bg-[var(--bg-tertiary)]/50 text-[var(--text-secondary)] font-extrabold uppercase">
                        <th className="px-6 py-4">Invoice ID</th>
                        <th className="px-6 py-4">Period</th>
                        <th className="px-6 py-4">Subscribed Plan</th>
                        <th className="px-6 py-4">Billing Amount</th>
                        <th className="px-6 py-4">Logged Date</th>
                        <th className="px-6 py-4 text-right">Payment State</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-soft)] text-[var(--text-primary)] font-medium">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-[var(--accent-hover)] transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-[11px]">{inv.id}</td>
                          <td className="px-6 py-4 font-mono font-bold text-[10px] uppercase text-[var(--text-secondary)]">{inv.invoicePeriod}</td>
                          <td className="px-6 py-4">
                            <span className="font-bold block">{inv.subscription?.plan?.name || "API Access Plan"}</span>
                            <span className="text-[10px] text-[var(--text-secondary)] font-mono">UID: #{inv.subscriptionId}</span>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-sm text-[var(--text-primary)]">₹{Number(inv.amount).toLocaleString()}</td>
                          <td className="px-6 py-4 text-[var(--text-secondary)]">{new Date(inv.createdAt).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-extrabold border ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                : inv.status === 'DRAFT'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            }`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};
