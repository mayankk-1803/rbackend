import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Copy,
  UserPlus,
  Edit2,
  Trash2,
  Check,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Database
} from "lucide-react";
import { PackageActionsMenu } from "../../components/commission/PackageActionsMenu";

export const PackageMaster = () => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Dynamic dropdown catalogs
  const [slabs, setSlabs] = useState([]);
  const [categories, setCategories] = useState([]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [isMatrixViewOpen, setIsMatrixViewOpen] = useState(false);

  // Active/Target items
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [activeActionMenu, setActiveActionMenu] = useState(null);

  // Form inputs
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    cost: "0",
    expiryDays: "",
    selfAssignment: false,
    isActive: true,
    matrix: {} // maps serviceCategoryId -> slabId
  });

  const [cloneData, setCloneData] = useState({ name: "", description: "" });
  const [assignData, setAssignData] = useState({ userIds: "" });

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/commission/packages", {
        params: {
          page,
          limit,
          search,
          status: statusFilter !== "all" ? statusFilter : undefined
        }
      });
      if (response.data?.success) {
        setPackages(response.data.data.packages);
        setTotalPages(response.data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch packages");
    } finally {
      setLoading(false);
    }
  };

  const fetchCatalogs = async () => {
    try {
      // 1. Fetch Slabs list
      const slabsRes = await api.get("/admin/commission/slabs", { params: { limit: 100 } });
      if (slabsRes.data?.success) {
        setSlabs(slabsRes.data.data.slabs || []);
      }

      // 2. Fetch Service Categories
      const catsRes = await api.get("/admin/commission/service-categories");
      if (catsRes.data?.success) {
        setCategories(catsRes.data.data || []);
      }
    } catch (err) {
      console.error("Error loading dropdown catalogs:", err);
      toast.error("Error loading dropdown catalogs");
    }
  };

  useEffect(() => {
    fetchPackages();
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchCatalogs();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/admin/commission/packages", {
        ...formData,
        cost: parseFloat(formData.cost || "0"),
        expiryDays: formData.expiryDays ? parseInt(formData.expiryDays) : null
      });
      if (response.data?.success) {
        toast.success("Package created successfully!");
        setIsCreateOpen(false);
        resetForm();
        fetchPackages();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create package");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      cost: "0",
      expiryDays: "",
      selfAssignment: false,
      isActive: true,
      matrix: {}
    });
  };

  const handleEditInit = (pkg) => {
    setSelectedPackage(pkg);
    setFormData({
      name: pkg.name,
      description: pkg.description || "",
      cost: pkg.cost.toString(),
      expiryDays: pkg.expiryDays ? pkg.expiryDays.toString() : "",
      selfAssignment: pkg.selfAssignment,
      isActive: pkg.isActive,
      matrix: pkg.matrix || {}
    });
    setIsEditOpen(true);
    setActiveActionMenu(null);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put(`/admin/commission/packages/${selectedPackage.id}`, {
        ...formData,
        cost: parseFloat(formData.cost || "0"),
        expiryDays: formData.expiryDays ? parseInt(formData.expiryDays) : null
      });
      if (response.data?.success) {
        toast.success("Package updated successfully!");
        setIsEditOpen(false);
        resetForm();
        fetchPackages();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update package");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete Package: ${name}?`)) return;
    try {
      const response = await api.delete(`/admin/commission/packages/${id}`);
      if (response.data?.success) {
        toast.success("Package deleted successfully");
        fetchPackages();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete package");
    }
  };

  const handleStatusToggle = async (pkg) => {
    try {
      const response = await api.put(`/admin/commission/packages/${pkg.id}`, {
        isActive: !pkg.isActive
      });
      if (response.data?.success) {
        toast.success(`Package ${!pkg.isActive ? "enabled" : "disabled"} successfully`);
        fetchPackages();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to toggle package status");
    }
  };

  const handleCloneInit = (pkg) => {
    setSelectedPackage(pkg);
    setCloneData({
      name: `Copy of ${pkg.name}`,
      description: `Cloned from ${pkg.name}`
    });
    setIsCloneOpen(true);
    setActiveActionMenu(null);
  };

  const handleClone = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(`/admin/commission/packages/${selectedPackage.id}/clone`, cloneData);
      if (response.data?.success) {
        toast.success("Package cloned successfully with Service Matrix!");
        setIsCloneOpen(false);
        fetchPackages();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clone package");
    }
  };

  const handleAssignInit = (pkg) => {
    setSelectedPackage(pkg);
    setAssignData({ userIds: "" });
    setIsAssignOpen(true);
    setActiveActionMenu(null);
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    const ids = assignData.userIds.split(",").map(id => id.trim()).filter(id => id);
    if (ids.length === 0) {
      toast.error("Please enter at least one User ID");
      return;
    }

    try {
      const response = await api.post(`/admin/commission/packages/${selectedPackage.id}/assign-users`, {
        userIds: ids.map(id => parseInt(id))
      });
      if (response.data?.success) {
        toast.success(response.data.message || "Users assigned successfully!");
        setIsAssignOpen(false);
        fetchPackages();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to assign users");
    }
  };

  const handleMatrixViewInit = (pkg) => {
    setSelectedPackage(pkg);
    setIsMatrixViewOpen(true);
    setActiveActionMenu(null);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveActionMenu(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  const handleMatrixCellChange = (catId, slabId) => {
    setFormData(prev => ({
      ...prev,
      matrix: {
        ...prev.matrix,
        [catId]: slabId ? parseInt(slabId) : undefined
      }
    }));
  };

  const safeSlabs = Array.isArray(slabs) ? slabs : [];
  const safeCategories = Array.isArray(categories) ? categories : [];
  const safePackages = Array.isArray(packages) ? packages : [];

  return (
    <div className="p-6 bg-[var(--bg-primary)] min-h-screen text-[var(--text-primary)]">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[var(--border-soft)] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight uppercase">Package Master</h1>
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">Telecom Service Package Mappings Registry</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsCreateOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase bg-[var(--color-primary)] text-[var(--bg-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Package
        </button>
      </div>

      {/* Filter and Search Panel */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-[var(--bg-secondary)] border border-[var(--border-soft)] p-3 rounded-lg mb-4 text-xs">
        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--text-secondary)]">
            <Search className="w-3.5 h-3.5" />
          </span>
          <input
            type="text"
            placeholder="SEARCH PACKAGE NAME..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-1.5 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md uppercase tracking-wider text-[11px] focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">Status:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[var(--bg-primary)] border border-[var(--border-soft)] px-2.5 py-1.5 rounded-md uppercase tracking-wider text-[10px] font-semibold focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
          >
            <option value="all">ALL PACKAGES</option>
            <option value="active">ACTIVE ONLY</option>
            <option value="inactive">INACTIVE ONLY</option>
          </select>

          <button
            onClick={() => fetchPackages()}
            className="p-1.5 bg-[var(--bg-primary)] border border-[var(--border-soft)] hover:bg-[var(--accent-hover)] rounded-md transition-colors cursor-pointer"
            title="Reload Data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Dense Table Layout */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] rounded-lg overflow-hidden relative shadow-xs">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
            <span className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">Loading Package Matrix...</span>
          </div>
        ) : packages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-widest">No Commission Packages Registered</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-soft)] uppercase text-[10px] tracking-wider text-[var(--text-secondary)] font-bold sticky top-0">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-16 text-center">Actions</th>
                  <th className="py-2.5 px-3">Package Name</th>
                  <th className="py-2.5 px-3 text-center">Services</th>
                  <th className="py-2.5 px-3 text-right">Cost</th>
                  <th className="py-2.5 px-3 text-center">Expiry Days</th>
                  <th className="py-2.5 px-3 text-center">Default</th>
                  <th className="py-2.5 px-3 text-center">Self Assignment</th>
                  <th className="py-2.5 px-3 text-center">Assigned Users</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Created At</th>
                  <th className="py-2.5 px-3">Updated At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] bg-[var(--bg-primary)]/10 font-medium">
                {safePackages.map((pkg, index) => (
                  <tr key={pkg.id} className="hover:bg-[var(--accent-hover)]/30 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-[var(--text-secondary)]">
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <PackageActionsMenu
                        pkg={pkg}
                        onEditInit={handleEditInit}
                        onMatrixViewInit={handleMatrixViewInit}
                        onAssignInit={handleAssignInit}
                        onCloneInit={handleCloneInit}
                        onStatusToggle={handleStatusToggle}
                        onDelete={handleDelete}
                      />
                    </td>
                    <td className="py-2 px-3 font-semibold uppercase tracking-tight text-[var(--text-primary)]">
                      {pkg.name}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[var(--text-secondary)]">
                      {pkg.slabCount} Categories
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--color-primary)]">
                      ₹{pkg.cost.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[var(--text-secondary)]">
                      {pkg.expiryDays ? `${pkg.expiryDays} Days` : "Lifetime"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {pkg.isDefault ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)]">
                          DEFAULT
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {pkg.selfAssignment ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/20">
                          Yes
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-soft)]">
                          No
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-[var(--text-primary)]">
                      {pkg.assignedUsers}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {pkg.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">
                      {new Date(pkg.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">
                      {new Date(pkg.updatedAt).toLocaleDateString("en-GB")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && packages.length > 0 && (
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

      {/* 1. Create Package Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-4xl rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Create Package Master</h2>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Package Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="E.G. SUPER DISTRIBUTOR COMMISSION PACKAGE"
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="DETAILS..."
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors h-16 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Cost (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Expiry Days (Empty = Lifetime)</label>
                      <input
                        type="number"
                        value={formData.expiryDays}
                        onChange={(e) => setFormData({ ...formData, expiryDays: e.target.value })}
                        placeholder="E.G. 365"
                        className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="create-self"
                        checked={formData.selfAssignment}
                        onChange={(e) => setFormData({ ...formData, selfAssignment: e.target.checked })}
                        className="w-3.5 h-3.5 rounded-md border border-[var(--border-soft)] focus:outline-hidden accent-[var(--color-primary)]"
                      />
                      <label htmlFor="create-self" className="text-[var(--text-primary)] text-[10px] tracking-wider font-bold select-none cursor-pointer">Self Assignment</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="create-active"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="w-3.5 h-3.5 rounded-md border border-[var(--border-soft)] focus:outline-hidden accent-[var(--color-primary)]"
                      />
                      <label htmlFor="create-active" className="text-[var(--text-primary)] text-[10px] tracking-wider font-bold select-none cursor-pointer">Active</label>
                    </div>
                  </div>
                </div>

                {/* Service Matrix Dynamic Grid */}
                <div className="border border-[var(--border-soft)] rounded-lg p-3 bg-[var(--bg-primary)]/20 flex flex-col h-[280px]">
                  <h3 className="text-[10px] font-bold tracking-wider mb-2 text-[var(--text-secondary)] border-b border-[var(--border-soft)] pb-1.5">SERVICE CATEGORIES MATRIX</h3>
                  <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
                    {safeCategories.length === 0 ? (
                      <div className="text-center text-xs text-[var(--text-secondary)] py-4">No service categories available</div>
                    ) : (
                      safeCategories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-bold text-[var(--text-primary)] tracking-wide truncate max-w-[150px]">{cat.code}</span>
                          <select
                            value={formData.matrix[cat.id] || ""}
                            onChange={(e) => handleMatrixCellChange(cat.id, e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-soft)] px-2 py-1 rounded-md text-[10px] tracking-wide font-semibold focus:outline-hidden focus:border-[var(--color-primary)] transition-colors w-48"
                          >
                            <option value="">NO SLAB (COMMISSION DISABLED)</option>
                            {safeSlabs.length === 0 ? (
                              <option disabled>No slabs available</option>
                            ) : (
                              safeSlabs.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))
                            )}
                          </select>
                        </div>
                      ))
                    )}
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
                  Save Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Package Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-4xl rounded-lg shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Edit Package Details & Matrix</h2>
              <button onClick={() => setIsEditOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Package Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="PACKAGE NAME..."
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="DETAILS..."
                      className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors h-16 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Cost (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.cost}
                        onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                        className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Expiry Days</label>
                      <input
                        type="number"
                        value={formData.expiryDays}
                        onChange={(e) => setFormData({ ...formData, expiryDays: e.target.value })}
                        placeholder="E.G. 365"
                        className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs font-mono focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="edit-self"
                        checked={formData.selfAssignment}
                        onChange={(e) => setFormData({ ...formData, selfAssignment: e.target.checked })}
                        className="w-3.5 h-3.5 rounded-md border border-[var(--border-soft)] focus:outline-hidden accent-[var(--color-primary)]"
                      />
                      <label htmlFor="edit-self" className="text-[var(--text-primary)] text-[10px] tracking-wider font-bold select-none cursor-pointer">Self Assignment</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="edit-active"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        disabled={selectedPackage?.isDefault}
                        className="w-3.5 h-3.5 rounded-md border border-[var(--border-soft)] focus:outline-hidden accent-[var(--color-primary)] disabled:opacity-40"
                      />
                      <label htmlFor="edit-active" className="text-[var(--text-primary)] text-[10px] tracking-wider font-bold select-none cursor-pointer">Active</label>
                    </div>
                  </div>
                </div>

                {/* Service Matrix Dynamic Grid */}
                <div className="border border-[var(--border-soft)] rounded-lg p-3 bg-[var(--bg-primary)]/20 flex flex-col h-[280px]">
                  <h3 className="text-[10px] font-bold tracking-wider mb-2 text-[var(--text-secondary)] border-b border-[var(--border-soft)] pb-1.5">SERVICE CATEGORIES MATRIX</h3>
                  <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
                    {safeCategories.length === 0 ? (
                      <div className="text-center text-xs text-[var(--text-secondary)] py-4">No service categories available</div>
                    ) : (
                      safeCategories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between gap-3 text-[11px]">
                          <span className="font-bold text-[var(--text-primary)] tracking-wide truncate max-w-[150px]">{cat.code}</span>
                          <select
                            value={formData.matrix[cat.id] || ""}
                            onChange={(e) => handleMatrixCellChange(cat.id, e.target.value)}
                            className="bg-[var(--bg-primary)] border border-[var(--border-soft)] px-2 py-1 rounded-md text-[10px] tracking-wide font-semibold focus:outline-hidden focus:border-[var(--color-primary)] transition-colors w-48"
                          >
                            <option value="">NO SLAB (COMMISSION DISABLED)</option>
                            {safeSlabs.length === 0 ? (
                              <option disabled>No slabs available</option>
                            ) : (
                              safeSlabs.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))
                            )}
                          </select>
                        </div>
                      ))
                    )}
                  </div>
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
                  Update Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Clone Package Modal */}
      {isCloneOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-md rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Clone Package Profile</h2>
              <button onClick={() => setIsCloneOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleClone} className="p-4 space-y-4">
              <div className="bg-[var(--color-primary-glow)]/30 border border-[var(--border-soft)] p-2.5 rounded-md mb-2 text-[10px] uppercase text-[var(--text-primary)]">
                Cloning Source: <span className="font-bold text-[var(--color-primary)]">{selectedPackage?.name}</span>. This duplicates pricing metadata and service categories matrix configurations.
              </div>
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">New Package Name *</label>
                <input
                  type="text"
                  required
                  value={cloneData.name}
                  onChange={(e) => setCloneData({ ...cloneData, name: e.target.value })}
                  placeholder="NEW PACKAGE NAME..."
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Description</label>
                <textarea
                  value={cloneData.description}
                  onChange={(e) => setCloneData({ ...cloneData, description: e.target.value })}
                  placeholder="DESCRIPTION..."
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors h-20 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <button
                  type="button"
                  onClick={() => setIsCloneOpen(false)}
                  className="px-3.5 py-1.5 rounded-md border border-[var(--border-soft)] text-[10px] font-bold uppercase hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-[var(--color-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                >
                  Clone Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Assign Users Modal */}
      {isAssignOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-md rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Assign Users to Package</h2>
              <button onClick={() => setIsAssignOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAssign} className="p-4 space-y-4">
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">User IDs (comma separated) *</label>
                <input
                  type="text"
                  required
                  value={assignData.userIds}
                  onChange={(e) => setAssignData({ ...assignData, userIds: e.target.value })}
                  placeholder="E.G. 2, 4, 15"
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                />
                <span className="text-[9px] text-[var(--text-secondary)] font-medium mt-1 block">Specify integer numeric IDs of users you want to map directly to this package.</span>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--border-soft)] pt-3">
                <button
                  type="button"
                  onClick={() => setIsAssignOpen(false)}
                  className="px-3.5 py-1.5 rounded-md border border-[var(--border-soft)] text-[10px] font-bold uppercase hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-md bg-[var(--color-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
                >
                  Assign Users
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. View Matrix Modal */}
      {isMatrixViewOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-md rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Service-Slab Matrix Matrix ({selectedPackage?.name})</h2>
              <button onClick={() => setIsMatrixViewOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {categories.map(cat => {
                const slabId = selectedPackage?.matrix?.[cat.id];
                const slabName = slabs.find(s => s.id === slabId)?.name || "Disabled / Empty";
                return (
                  <div key={cat.id} className="flex justify-between border-b border-[var(--border-soft)] pb-2 last:border-0 last:pb-0">
                    <span className="font-bold text-[var(--text-primary)]">{cat.name} ({cat.code})</span>
                    <span className="font-mono text-[var(--color-primary)]">{slabName}</span>
                  </div>
                );
              })}
            </div>
            <div className="p-3 border-t border-[var(--border-soft)] flex justify-end">
              <button
                onClick={() => setIsMatrixViewOpen(false)}
                className="px-3.5 py-1.5 rounded-md bg-[var(--color-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase hover:bg-[var(--color-primary-hover)] transition-colors cursor-pointer"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
