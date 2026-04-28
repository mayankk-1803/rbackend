import React, { useState, useEffect } from 'react';
import { AlertCircle, ShieldAlert } from 'lucide-react';
import api from '../services/api';

export const Alerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/admin/alerts');
        setAlerts(Array.isArray(data?.data) ? data.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">System Alerts</h1>
        <p className="text-slate-500 mt-1">
          Fraud warnings and provider anomalies
        </p>
      </div>

      {/* Alerts List */}
      <div className="grid gap-4">
        
        {loading ? (
          <div className="p-8 text-center text-slate-400 border border-slate-100 rounded-2xl">
            Loading alerts...
          </div>

        ) : alerts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 border border-slate-100 rounded-2xl bg-white">
            No active alerts. System healthy.
          </div>

        ) : (
          alerts.map((alert, idx) => (
            <div
              key={alert.id || idx}
              className={`flex items-start p-5 rounded-2xl border ${
                alert.severity === 'high'
                  ? 'bg-red-50 border-red-100'
                  : 'bg-orange-50 border-orange-100'
              }`}
            >
              
              {/* Icon */}
              <div
                className={`p-3 rounded-full mr-4 ${
                  alert.severity === 'high'
                    ? 'bg-red-100 text-red-600'
                    : 'bg-orange-100 text-orange-600'
                }`}
              >
                {alert.type === 'FRAUD' ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <AlertCircle className="w-6 h-6" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1">
                <h3
                  className={`font-semibold text-lg ${
                    alert.severity === 'high'
                      ? 'text-red-900'
                      : 'text-orange-900'
                  }`}
                >
                  {(alert.type || 'ALERT').replace('_', ' ')}
                </h3>

                <p
                  className={`mt-1 font-medium ${
                    alert.severity === 'high'
                      ? 'text-red-700'
                      : 'text-orange-700'
                  }`}
                >
                  {alert.message || 'No message'}
                </p>

                {/* Meta Info */}
                <div className="mt-3 flex gap-2 text-xs font-bold uppercase">
                  
                  <span
                    className={`px-2 py-1 rounded-md ${
                      alert.severity === 'high'
                        ? 'bg-red-200 text-red-800'
                        : 'bg-orange-200 text-orange-800'
                    }`}
                  >
                    {alert.val || 'N/A'}
                  </span>

                  <span
                    className={`px-2 py-1 rounded-md ${
                      alert.severity === 'high'
                        ? 'bg-red-100 text-red-600'
                        : 'bg-orange-100 text-orange-600'
                    }`}
                  >
                    {alert.time
                      ? new Date(alert.time).toLocaleString()
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}

      </div>
    </div>
  );
};