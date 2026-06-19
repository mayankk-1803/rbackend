import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  X
} from "lucide-react";
import RechargeSlabActionsMenu from "../../components/commission/RechargeSlabActionsMenu";

export const RechargeCommissionSlab = () => {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Filter settings
  const [slabFilter, setSlabFilter] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(15);

  // Catalogs
  const [slabs, setSlabs] = useState([]);
  const [operators, setOperators] = useState([]);
  const [categories, setCategories] = useState([]);
  const [roles, setRoles] = useState([]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);

  // Selected items
  const [selectedRule, setSelectedRule] = useState(null);
  const [activeActionMenu, setActiveActionMenu] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    slabId: "",
    operatorId: "",
    serviceCategoryId: "",
    role: "",
    commissionType: "PERCENTAGE",
    commissionValue: "0",
    realCommission: "0",
    surchargeType: "PERCENTAGE",
    surchargeValue: "0",
    profitType: "PERCENTAGE",
    profitValue: "0",
    feeType: "PERCENTAGE",
    feeValue: "0",
    maxCommission: "",
    fixedCharge: "0",
    effectiveFrom: "",
    effectiveTo: "",
    status: "PENDING"
  });

  const [commentData, setCommentData] = useState({ comment: "" });

  const fetchCatalogs = async () => {
    try {
      const slabsRes = await api.get("/admin/commission/slabs", { params: { limit: 100 } });
      if (slabsRes.data?.success) setSlabs(slabsRes.data.data.slabs || []);

      const opsRes = await api.get("/admin/commission/operators");
      if (opsRes.data?.success) setOperators(opsRes.data.data || []);

      const catsRes = await api.get("/admin/commission/service-categories");
      if (catsRes.data?.success) setCategories(catsRes.data.data || []);

      const rolesRes = await api.get("/admin/commission/commission-roles");
      if (rolesRes.data?.success) setRoles(rolesRes.data.data || []);
    } catch (err) {
      console.error("Error fetching rules catalogs:", err);
    }
  };

  const fetchRules = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/commission/recharge-rules", {
        params: {
          page,
          limit,
          search,
          slabId: slabFilter || undefined,
          operatorId: operatorFilter || undefined,
          serviceCategoryId: categoryFilter || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined
        }
      });
      if (response.data?.success) {
        setRules(response.data.data.rules);
        setTotalPages(response.data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch recharge rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogs();
  }, []);

  useEffect(() => {
    fetchRules();
  }, [page, search, slabFilter, operatorFilter, categoryFilter, roleFilter, statusFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/admin/commission/recharge-rules", {
        ...formData,
        commissionValue: parseFloat(formData.commissionValue || "0"),
        realCommission: parseFloat(formData.realCommission || "0"),
        surchargeValue: parseFloat(formData.surchargeValue || "0"),
        profitValue: parseFloat(formData.profitValue || "0"),
        feeValue: parseFloat(formData.feeValue || "0"),
        fixedCharge: parseFloat(formData.fixedCharge || "0"),
        maxCommission: formData.maxCommission ? parseFloat(formData.maxCommission) : null,
        effectiveFrom: formData.effectiveFrom || null,
        effectiveTo: formData.effectiveTo || null
      });
      if (response.data?.success) {
        toast.success("Recharge rule created in PENDING status!");
        setIsCreateOpen(false);
        resetForm();
        fetchRules();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create rule");
    }
  };

  const resetForm = () => {
    setFormData({
      slabId: "",
      operatorId: "",
      serviceCategoryId: "",
      role: "",
      commissionType: "PERCENTAGE",
      commissionValue: "0",
      realCommission: "0",
      surchargeType: "PERCENTAGE",
      surchargeValue: "0",
      profitType: "PERCENTAGE",
      profitValue: "0",
      feeType: "PERCENTAGE",
      feeValue: "0",
      maxCommission: "",
      fixedCharge: "0",
      effectiveFrom: "",
      effectiveTo: "",
      status: "PENDING"
    });
  };

  const handleEditInit = (rule) => {
    setSelectedRule(rule);
    setFormData({
      slabId: rule?.slabId?.toString?.() || "",
      operatorId: rule?.operatorId?.toString?.() || "",
      serviceCategoryId: rule?.serviceCategoryId?.toString?.() || "",
      role: rule?.role || "",
      commissionType: rule?.commissionType || "PERCENTAGE",
      commissionValue: rule?.commissionValue?.toString?.() || "0",
      realCommission: rule?.realCommission?.toString?.() || "0",
      surchargeType: rule?.surchargeType || "PERCENTAGE",
      surchargeValue: rule?.surchargeValue?.toString?.() || "0",
      profitType: rule?.profitType || "PERCENTAGE",
      profitValue: rule?.profitValue?.toString?.() || "0",
      feeType: rule?.feeType || "PERCENTAGE",
      feeValue: rule?.feeValue?.toString?.() || "0",
      maxCommission: rule?.maxCommission ? rule.maxCommission.toString() : "",
      fixedCharge: rule?.fixedCharge?.toString?.() || "0",
      effectiveFrom: rule?.effectiveFrom ? rule.effectiveFrom.substring(0, 10) : "",
      effectiveTo: rule?.effectiveTo ? rule.effectiveTo.substring(0, 10) : "",
      status: rule?.status || "PENDING"
    });
    setIsEditOpen(true);
    setActiveActionMenu(null);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put(`/admin/commission/recharge-rules/${selectedRule.id}`, {
        ...formData,
        commissionValue: parseFloat(formData.commissionValue || "0"),
        realCommission: parseFloat(formData.realCommission || "0"),
        surchargeValue: parseFloat(formData.surchargeValue || "0"),
        profitValue: parseFloat(formData.profitValue || "0"),
        feeValue: parseFloat(formData.feeValue || "0"),
        fixedCharge: parseFloat(formData.fixedCharge || "0"),
        maxCommission: formData.maxCommission ? parseFloat(formData.maxCommission) : null,
        effectiveFrom: formData.effectiveFrom || null,
        effectiveTo: formData.effectiveTo || null
      });
      if (response.data?.success) {
        toast.success("Recharge rule updated successfully!");
        setIsEditOpen(false);
        resetForm();
        fetchRules();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update rule");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this commission rule?")) return;
    try {
      const response = await api.delete(`/admin/commission/recharge-rules/${id}`);
      if (response.data?.success) {
        toast.success("Rule soft deleted successfully!");
        fetchRules();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete rule");
    }
  };

  const handleClone = async (rule) => {
    try {
      const response = await api.post(`/admin/commission/recharge-rules/${rule?.id}/clone`);
      if (response.data?.success) {
        toast.success("Rule cloned into PENDING status!");
        fetchRules();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clone rule");
    }
  };

  const handleApproveInit = (rule) => {
    setSelectedRule(rule);
    setCommentData({ comment: "" });
    setIsApproveOpen(true);
    setActiveActionMenu(null);
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(`/admin/commission/recharge-rules/${selectedRule?.id}/approve`, commentData);
      if (response.data?.success) {
        toast.success("Rule approved and activated successfully!");
        setIsApproveOpen(false);
        fetchRules();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to approve rule");
    }
  };

  const handleRejectInit = (rule) => {
    setSelectedRule(rule);
    setCommentData({ comment: "" });
    setIsRejectOpen(true);
    setActiveActionMenu(null);
  };

  const handleReject = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(`/admin/commission/recharge-rules/${selectedRule?.id}/reject`, commentData);
      if (response.data?.success) {
        toast.success("Rule rejected successfully!");
        setIsRejectOpen(false);
        fetchRules();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to reject rule");
    }
  };

  // Close dropdown menus
  useEffect(() => {
    const handleOutsideClick = () => setActiveActionMenu(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const safeSlabs = Array.isArray(slabs) ? slabs : [];
  const safeOperators = Array.isArray(operators) ? operators : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safeRoles = Array.isArray(roles) ? roles : [];

  const selectedSlab = safeSlabs.find(s => s?.id?.toString() === formData?.slabId) || null;
  const selectedOperator = safeOperators.find(o => o?.id?.toString() === formData?.operatorId) || null;
  const selectedCategory = safeCategories.find(c => c?.id?.toString() === formData?.serviceCategoryId) || null;
  const selectedRole = safeRoles.find(r => r === formData?.role) || null;

  return (
    <div className="p-6 bg-[var(--bg-primary)] min-h-screen text-[var(--text-primary)]">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[var(--border-soft)] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight uppercase">Recharge Commission Slab</h1>
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">Telecom Multi-Tier Operator Rates Configuration</p>
        </div>
        <button
          onClick={() => {
            try {
              resetForm();
              setIsCreateOpen(true);
            } catch (error) {
              console.error(
                "[Recharge Commission Slab] Add Rate Rule Modal Error",
                error
              );
              toast.error("Failed to open Add Rate Rule modal");
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase bg-[var(--color-primary)] text-[var(--bg-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Rate Rule
        </button>
      </div>

      {/* Advanced Filters Panel */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] p-3 rounded-lg mb-4 text-xs space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <label className="block mb-1 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Slab</label>
            <select
              value={slabFilter}
              onChange={(e) => { setSlabFilter(e.target.value); setPage(1); }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-soft)] px-2 py-1.5 rounded-md uppercase tracking-wider text-[10px] font-semibold focus:outline-hidden"
            >
              <option value="">ALL SLABS</option>
              {safeSlabs.length === 0 ? (
                <option disabled>No slabs available</option>
              ) : (
                safeSlabs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Operator</label>
            <select
              value={operatorFilter}
              onChange={(e) => { setOperatorFilter(e.target.value); setPage(1); }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-soft)] px-2 py-1.5 rounded-md uppercase tracking-wider text-[10px] font-semibold focus:outline-hidden"
            >
              <option value="">ALL OPERATORS</option>
              {safeOperators.length === 0 ? (
                <option disabled>No operators available</option>
              ) : (
                safeOperators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Service Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-soft)] px-2 py-1.5 rounded-md uppercase tracking-wider text-[10px] font-semibold focus:outline-hidden"
            >
              <option value="">ALL SERVICES</option>
              {safeCategories.length === 0 ? (
                <option disabled>No categories available</option>
              ) : (
                safeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Target Role</label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-soft)] px-2 py-1.5 rounded-md uppercase tracking-wider text-[10px] font-semibold focus:outline-hidden"
            >
              <option value="">ALL ROLES</option>
              {safeRoles.length === 0 ? (
                <option disabled>No roles available</option>
              ) : (
                safeRoles.map(r => <option key={r} value={r}>{r}</option>)
              )}
            </select>
          </div>

          <div>
            <label className="block mb-1 font-bold text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">Workflow Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-soft)] px-2 py-1.5 rounded-md uppercase tracking-wider text-[10px] font-semibold focus:outline-hidden"
            >
              <option value="">ALL STATUSES</option>
              <option value="PENDING">PENDING</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pt-2 border-t border-[var(--border-soft)]/40">
          <div className="relative w-full sm:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-secondary)]">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              placeholder="SEARCH OPERATOR / CATEGORY..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md uppercase tracking-wider text-[10px] font-semibold focus:outline-hidden transition-colors"
            />
          </div>
          <button
            onClick={() => fetchRules()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-md transition-colors cursor-pointer self-stretch sm:self-auto justify-center"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Rules
          </button>
        </div>
      </div>

      {/* Dense Table Grid */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg overflow-hidden relative shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            <span className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">Loading Rate Matrix...</span>
          </div>
        ) : rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-widest">No Commission Rules configured</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px] select-none">
              <thead>
                <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-soft)] uppercase text-[9px] tracking-wider text-[var(--text-secondary)] font-bold sticky top-0">
                  <th className="py-2.5 px-2 w-10 text-center">#</th>
                  <th className="py-2.5 px-2 w-16 text-center">Actions</th>
                  <th className="py-2.5 px-2">Slab</th>
                  <th className="py-2.5 px-2">Operator</th>
                  <th className="py-2.5 px-2">Service</th>
                  <th className="py-2.5 px-2">Role</th>
                  <th className="py-2.5 px-2 text-right">Commission</th>
                  <th className="py-2.5 px-2 text-right">Surcharge</th>
                  <th className="py-2.5 px-2 text-right">Profit</th>
                  <th className="py-2.5 px-2 text-right">Fee</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                  <th className="py-2.5 px-2 text-center">Dates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] bg-[var(--bg-primary)]/10 font-medium">
                {rules.map((rule, index) => (
                  <tr key={rule.id} className="hover:bg-[var(--accent-hover)]/30 transition-colors">
                    <td className="py-2 px-2 text-center font-mono text-[var(--text-secondary)]">
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className="py-2 px-2 text-center">
                      <RechargeSlabActionsMenu
                        rule={rule}
                        onEditInit={handleEditInit}
                        onClone={handleClone}
                        onApproveInit={handleApproveInit}
                        onRejectInit={handleRejectInit}
                        onDelete={handleDelete}
                      />
                    </td>
                    <td className="py-2 px-2 uppercase font-bold text-[var(--text-primary)]">{rule.slab?.name}</td>
                    <td className="py-2 px-2 uppercase">{rule.operatorRel?.name}</td>
                    <td className="py-2 px-2 uppercase truncate max-w-[100px]">{rule.serviceCategory?.name}</td>
                    <td className="py-2 px-2 font-mono text-[var(--text-secondary)]">{rule.role}</td>
                    <td className="py-2 px-2 text-right font-mono font-bold">
                      {rule.commissionValue} {rule.commissionType === "PERCENTAGE" ? "%" : "₹"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[var(--text-secondary)]">
                      {rule.surchargeValue} {rule.surchargeType === "PERCENTAGE" ? "%" : "₹"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[var(--text-secondary)]">
                      {rule.profitValue} {rule.profitType === "PERCENTAGE" ? "%" : "₹"}
                    </td>
                    <td className="py-2 px-2 text-right font-mono text-[var(--text-secondary)]">
                      {rule.feeValue} {rule.feeType === "PERCENTAGE" ? "%" : "₹"}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {rule.status === "ACTIVE" ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Active</span>
                      ) : rule.status === "PENDING" ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">Pending</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-bold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">Rejected</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {rule.effectiveFrom ? (
                        <span className="flex items-center gap-0.5 justify-center font-mono text-[9px] text-[var(--text-secondary)]" title={`From ${new Date(rule.effectiveFrom).toLocaleDateString()} to ${rule.effectiveTo ? new Date(rule.effectiveTo).toLocaleDateString() : "Unlimited"}`}>
                          <Calendar className="w-2.5 h-2.5" />
                          Range
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] text-[var(--text-secondary)]">Always</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && rules.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-[var(--text-secondary)] text-xs border-t border-[var(--border-soft)] pt-4 uppercase tracking-wider font-semibold">
          <div>
            Showing <span className="font-bold text-[var(--text-primary)]">{(page - 1) * limit + 1}</span> to{" "}
            <span className="font-bold text-[var(--text-primary)]">{Math.min(page * limit, totalPages * limit)}</span> of{" "}
            <span className="font-bold text-[var(--text-primary)]">{totalPages * limit}</span> entries
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1 px-2 border border-[var(--border-soft)] rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono text-[var(--text-primary)]">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1 px-2 border border-[var(--border-soft)] rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODALS SECTION */}
      {/* ======================================================== */}

      {/* 1. Create Rule Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-2xl rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Create Recharge Rule</h2>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Select Slab *</label>
                  <select
                    required
                    value={formData.slabId}
                    onChange={(e) => setFormData({ ...formData, slabId: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs"
                  >
                    <option value="">SELECT SLAB...</option>
                    {safeSlabs.length === 0 ? (
                      <option disabled>No slabs available</option>
                    ) : (
                      safeSlabs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                    )}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Select Operator *</label>
                  <select
                    required
                    value={formData.operatorId}
                    onChange={(e) => setFormData({ ...formData, operatorId: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs"
                  >
                    <option value="">SELECT OPERATOR...</option>
                    {safeOperators.length === 0 ? (
                      <option disabled>No operators available</option>
                    ) : (
                      safeOperators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)
                    )}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Select Service Category *</label>
                  <select
                    required
                    value={formData.serviceCategoryId}
                    onChange={(e) => setFormData({ ...formData, serviceCategoryId: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs"
                  >
                    <option value="">SELECT SERVICE...</option>
                    {safeCategories.length === 0 ? (
                      <option disabled>No service categories available</option>
                    ) : (
                      safeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    )}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Target Role *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs"
                  >
                    <option value="">SELECT ROLE...</option>
                    {safeRoles.length === 0 ? (
                      <option disabled>No roles available</option>
                    ) : (
                      safeRoles.map(r => <option key={r} value={r}>{r}</option>)
                    )}
                  </select>
                </div>
              </div>

              <div className="border-t border-[var(--border-soft)]/60 my-3 pt-3">
                <h3 className="font-bold text-[10px] text-[var(--text-secondary)] mb-2">PRICING MATRIX & VALUES</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Commission Type</label>
                    <select
                      value={formData.commissionType}
                      onChange={(e) => setFormData({ ...formData, commissionType: e.target.value })}
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs"
                    >
                      <option value="PERCENTAGE">PERCENTAGE (%)</option>
                      <option value="FLAT">FLAT (₹)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Commission Value</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.commissionValue}
                      onChange={(e) => setFormData({ ...formData, commissionValue: e.target.value })}
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Real Commission (Actual Cost)</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.realCommission}
                      onChange={(e) => setFormData({ ...formData, realCommission: e.target.value })}
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Surcharge Value</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.surchargeValue}
                      onChange={(e) => setFormData({ ...formData, surchargeValue: e.target.value })}
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Profit Value</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.profitValue}
                      onChange={(e) => setFormData({ ...formData, profitValue: e.target.value })}
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Fee Value</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={formData.feeValue}
                      onChange={(e) => setFormData({ ...formData, feeValue: e.target.value })}
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[var(--border-soft)]/60 my-3 pt-3">
                <h3 className="font-bold text-[10px] text-[var(--text-secondary)] mb-2">VALIDITY DATE RANGE (OPTIONAL)</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Effective From</label>
                    <input
                      type="date"
                      value={formData.effectiveFrom}
                      onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Effective To</label>
                    <input
                      type="date"
                      value={formData.effectiveTo}
                      onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-1.5 rounded-md border border-[var(--border-soft)] text-[10px] font-bold uppercase hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-[var(--color-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                >
                  Save Rate Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Rule Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-2xl rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Edit Recharge Rule #{selectedRule?.id}</h2>
              <button onClick={() => setIsEditOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="bg-[var(--color-primary-glow)]/20 border border-[var(--border-soft)] p-2.5 rounded-md mb-2 text-[10px]">
                Modifying target rules mapping: Slab: <span className="font-bold text-[var(--color-primary)]">{selectedRule?.slab?.name}</span> | Operator: <span className="font-bold">{selectedRule?.operatorRel?.name}</span> | Role: <span className="font-bold">{selectedRule?.role}</span>.
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Commission Type</label>
                  <select
                    value={formData.commissionType}
                    onChange={(e) => setFormData({ ...formData, commissionType: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs"
                  >
                    <option value="PERCENTAGE">PERCENTAGE (%)</option>
                    <option value="FLAT">FLAT (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Commission Value</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.commissionValue}
                    onChange={(e) => setFormData({ ...formData, commissionValue: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Real Commission (Actual Cost)</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.realCommission}
                    onChange={(e) => setFormData({ ...formData, realCommission: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Surcharge Value</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.surchargeValue}
                    onChange={(e) => setFormData({ ...formData, surchargeValue: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Profit Value</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.profitValue}
                    onChange={(e) => setFormData({ ...formData, profitValue: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Fee Value</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.feeValue}
                    onChange={(e) => setFormData({ ...formData, feeValue: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Effective From</label>
                  <input
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-[10px] text-[var(--text-secondary)]">Effective To</label>
                  <input
                    type="date"
                    value={formData.effectiveTo}
                    onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                    className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-3.5 py-1.5 rounded-md border border-[var(--border-soft)] text-[10px] font-bold uppercase hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-[var(--color-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                >
                  Update Rate Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Approve Rule Modal */}
      {isApproveOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-md rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight text-emerald-500">Approve & Activate Rule</h2>
              <button onClick={() => setIsApproveOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleApprove} className="p-4 space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-md text-[10px]">
                Approving this rule will set its status to <span className="font-bold">ACTIVE</span> and begin applying its rates to transactions matching its slab/operator/role configurations.
              </div>
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Approval Comments</label>
                <textarea
                  required
                  value={commentData.comment}
                  onChange={(e) => setCommentData({ comment: e.target.value })}
                  placeholder="SPECIFY COMMENTS..."
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors h-20 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <button
                  type="button"
                  onClick={() => setIsApproveOpen(false)}
                  className="px-3.5 py-1.5 rounded-md border border-[var(--border-soft)] text-[10px] font-bold uppercase hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold uppercase hover:bg-emerald-700 transition-colors cursor-pointer"
                >
                  Confirm Approval
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Reject Rule Modal */}
      {isRejectOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-md rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight text-rose-500">Reject Rule Setup</h2>
              <button onClick={() => setIsRejectOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleReject} className="p-4 space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-md text-[10px]">
                Rejecting this rule will mark its status to <span className="font-bold">REJECTED</span>. It will remain in catalog logs but never activate.
              </div>
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Reason for Rejection *</label>
                <textarea
                  required
                  value={commentData.comment}
                  onChange={(e) => setCommentData({ comment: e.target.value })}
                  placeholder="SPECIFY REJECTION REASON..."
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors h-20 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <button
                  type="button"
                  onClick={() => setIsRejectOpen(false)}
                  className="px-3.5 py-1.5 rounded-md border border-[var(--border-soft)] text-[10px] font-bold uppercase hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-rose-600 text-white text-[10px] font-bold uppercase hover:bg-rose-700 transition-colors cursor-pointer"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
