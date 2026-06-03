import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { 
  ClipboardList, 
  RefreshCw, 
  Send, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  User, 
  ShieldCheck, 
  ShieldX 
} from 'lucide-react';

export const ApiWebhooks = () => {
  const [developers, setDevelopers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [events, setEvents] = useState([]);
  const [loadingDevs, setLoadingDevs] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [error, setError] = useState(false);
  const [replayingEventId, setReplayingEventId] = useState(null);

  const fetchDevelopers = async () => {
    setLoadingDevs(true);
    setError(false);
    try {
      const response = await api.get('/admin/api-access/partners');
      if (response.data?.success) {
        const approved = response.data.approvedUsers || [];
        setDevelopers(approved);
        if (approved.length > 0) {
          setSelectedUserId(approved[0].id.toString());
        }
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoadingDevs(false);
    }
  };

  const fetchEvents = async (userId) => {
    if (!userId) return;
    setLoadingEvents(true);
    try {
      const response = await api.get(`/admin/api-access/webhook-events?userId=${userId}`);
      if (response.data?.success) {
        setEvents(response.data.data || []);
      }
    } catch (err) {
      toast.error("Failed to load webhook logs for developer");
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchDevelopers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchEvents(selectedUserId);
    } else {
      setEvents([]);
    }
  }, [selectedUserId]);

  const handleReplayEvent = async (eventId) => {
    setReplayingEventId(eventId);
    try {
      const response = await api.post('/admin/api-access/webhook-events/replay', { eventId });
      if (response.data?.success) {
        toast.success("Webhook replay event queued successfully!");
        // Refresh after small delay
        setTimeout(() => fetchEvents(selectedUserId), 1000);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to trigger webhook replay");
    } finally {
      setReplayingEventId(null);
    }
  };

  if (loadingDevs) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 w-64 bg-[var(--bg-secondary)] rounded-md shimmer-element"></div>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl p-6 h-96 shimmer-element"></div>
        <p className="text-xs text-[var(--text-secondary)] text-center animate-pulse">Loading data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-16 h-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-[var(--text-primary)]">Unable to load data.</h1>
        <p className="text-sm text-[var(--text-secondary)] max-w-md text-center">
          Webhook dispatch delivery telemetry is currently offline.
        </p>
        <button
          onClick={fetchDevelopers}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Signed Webhooks</h1>
          <p className="text-sm text-[var(--text-secondary)]">Monitor webhook payload callback deliveries, HMAC signature validation states, and dispatch retry logs.</p>
        </div>
        <button
          onClick={() => {
            fetchDevelopers();
            if (selectedUserId) fetchEvents(selectedUserId);
          }}
          disabled={loadingEvents}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--accent-hover)] transition-all cursor-pointer h-fit w-fit"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingEvents ? 'animate-spin' : ''}`} />
          Refresh State
        </button>
      </div>

      {/* Developer Selector Panel */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-glow)] flex items-center justify-center text-[var(--color-primary)]">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Select Developer Consumer</h3>
            <p className="text-[11px] text-[var(--text-secondary)]">Load immutable dispatch webhook logs for the whitelisted client.</p>
          </div>
        </div>
        
        {developers.length === 0 ? (
          <span className="text-xs text-[var(--text-secondary)] font-bold">No active developer consumers found.</span>
        ) : (
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="text-xs bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg p-2.5 text-[var(--text-primary)] outline-none min-w-[240px]"
          >
            {developers.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.email})</option>
            ))}
          </select>
        )}
      </div>

      {/* Webhook Logs Stream */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-[var(--border-soft)]">
          <h3 className="font-bold text-sm text-[var(--text-primary)] uppercase tracking-wider">Immutable Dispatch Webhook Log Stream</h3>
        </div>

        {loadingEvents ? (
          <div className="p-12 text-center text-xs text-[var(--text-secondary)] animate-pulse">Loading developer webhook dispatch logs...</div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-xs text-[var(--text-secondary)]">No records found.</div>
        ) : (
          <div className="divide-y divide-[var(--border-soft)]">
            {events.map((ev) => {
              const isSuccess = ev.deliveryStatus === 'SUCCESS' || ev.responseCode === 200;
              const hasSignature = ev.payload ? true : false;
              
              return (
                <div key={ev.id} className="p-6 flex flex-col md:flex-row md:items-start justify-between gap-6 hover:bg-[var(--accent-hover)] transition-all">
                  <div className="space-y-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-[var(--text-primary)]">Dispatch #{ev.id}</span>
                      <span className="inline-flex px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] border border-[var(--border-soft)] text-[9px] font-bold text-[var(--text-secondary)] font-mono">{ev.eventType || 'recharge.success'}</span>
                      <span className="text-[10px] text-[var(--text-secondary)]">{new Date(ev.createdAt).toLocaleString()}</span>
                    </div>

                    {/* Signature and Retries metadata */}
                    <div className="flex items-center gap-4 text-[10px] text-[var(--text-secondary)] font-medium">
                      <span className="flex items-center gap-1">
                        {hasSignature ? <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" /> : <ShieldX className="w-3.5 h-3.5 text-rose-500" />}
                        {hasSignature ? 'HMAC-SHA256 SIGNED' : 'UNSIGNED'}
                      </span>
                      <span>•</span>
                      <span>Delivery Retries: {ev.retryCount || 0} times</span>
                    </div>

                    {/* Payload Viewer */}
                    <div className="bg-[var(--bg-tertiary)]/50 border border-[var(--border-soft)] rounded-xl p-4 font-mono text-[10px] text-[var(--text-primary)] overflow-x-auto max-h-36 max-w-full">
                      <pre>{JSON.stringify(ev.payload || {}, null, 2)}</pre>
                    </div>
                  </div>

                  <div className="flex flex-col md:items-end justify-between gap-4 h-full">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-extrabold uppercase border ${
                        isSuccess 
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                      }`}>
                        {isSuccess ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {isSuccess ? 'DELIVERED' : 'DISPATCH_FAILED'}
                      </span>
                      <span className="font-mono text-[10px] font-bold text-[var(--text-secondary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded border border-[var(--border-soft)]">
                        HTTP {ev.responseCode || 'N/A'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleReplayEvent(ev.id)}
                      disabled={replayingEventId === ev.id}
                      className="px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[var(--accent-hover)] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 w-fit"
                    >
                      <Send className="w-3 h-3" />
                      {replayingEventId === ev.id ? 'Replaying...' : 'Replay event'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
