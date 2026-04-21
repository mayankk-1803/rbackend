import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

export const Providers = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/providers');
      setProviders(Array.isArray(data?.data) ? data.data : []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const handleSetActive = async (code) => {
    const loadingToast = toast.loading("Updating active provider...");
    try {
      await api.post('/admin/providers/set-active', { code });
      toast.success("Active provider updated", { id: loadingToast });
      fetchProviders(); // Refresh the list
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to set active provider", { id: loadingToast });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'HEALTHY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">HEALTHY</span>;
      case 'DEGRADED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-700">DEGRADED</span>;
      case 'DOWN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">DOWN</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">{status || 'UNKNOWN'}</span>;
    }
  };

  return (
    <div className="p-6 bg-[#F9FAFB] min-h-screen font-sans text-[#111827]">
      <header className="mb-8">
        <h1 className="text-xl font-semibold">Provider Management</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor and control recharge gateways</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-gray-400 text-sm">Loading provider data...</div>
        ) : providers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-gray-400 text-sm">No providers configured</div>
        ) : (
          providers.map((prov) => (
            <div key={prov._id} className="bg-white border border-gray-200 rounded-md p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-tight">{prov.name}</h3>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{prov.code}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{Number(prov.successRate || 0).toFixed(1)}%</div>
                    <div className="text-[10px] text-gray-400 uppercase font-medium">Success Rate</div>
                  </div>
                </div>

                <div className="mb-4">
                  {getStatusBadge(prov.status)}
                </div>

                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Latency</span>
                    <span className="font-mono text-gray-700">{prov.latency || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Priority</span>
                    <span className="text-gray-700 font-medium">{prov.priority}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => !prov.isActive && handleSetActive(prov.code)}
                disabled={prov.isActive}
                className={`w-full py-1.5 px-3 rounded-md text-sm font-medium transition duration-150 border ${
                  prov.isActive 
                    ? 'bg-gray-50 text-gray-400 border-gray-200 cursor-default' 
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {prov.isActive ? 'Active' : 'Set as Active'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
