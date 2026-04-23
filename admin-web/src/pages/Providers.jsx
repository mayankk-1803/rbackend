import React, { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

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
      fetchProviders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to set active provider", { id: loadingToast });
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'HEALTHY':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#ECFDF5] text-[#16A34A]">HEALTHY</span>;
      case 'DEGRADED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFFBEB] text-[#D97706]">DEGRADED</span>;
      case 'DOWN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF2F2] text-[#DC2626]">DOWN</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#F1F5F9] text-[#64748B]">{status || 'UNKNOWN'}</span>;
    }
  };

  const [showAll, setShowAll] = useState(false);

  const visibleProviders = showAll 
    ? providers 
    : providers.slice(0, 4);

  return (
    <div className="space-y-6">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-[#0F172A] tracking-tight">Provider Management</h1>
          <p className="text-sm text-[#64748B] mt-0.5">Monitor and control recharge gateways</p>
        </div>
        {providers.length > 4 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Show Less" : `Show More (${providers.length})`}
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 text-center text-[#94A3B8] text-sm">Loading provider data...</div>
        ) : providers.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#94A3B8] text-sm">No providers configured</div>
        ) : (
          visibleProviders.map((prov) => (
            <Card key={prov._id} className="flex flex-col justify-between">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-[#0F172A] uppercase tracking-tight">{prov.name}</h3>
                    <p className="text-[10px] text-[#94A3B8] font-mono mt-0.5">{prov.code}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#0F172A]">{Number(prov.successRate || 0).toFixed(1)}%</div>
                    <div className="text-[10px] text-[#94A3B8] uppercase font-bold">Success</div>
                  </div>
                </div>

                <div className="mb-4">
                  {getStatusBadge(prov.status)}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Latency</span>
                    <span className="font-mono text-[#0F172A] font-medium">{prov.latency || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#64748B]">Priority</span>
                    <span className="text-[#0F172A] font-medium">{prov.priority}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                <Button
                  variant={prov.isActive ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => !prov.isActive && handleSetActive(prov.code)}
                  disabled={prov.isActive}
                  className="w-full"
                >
                  {prov.isActive ? 'Currently Active' : 'Set as Active'}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
