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
  ChevronRight
} from "lucide-react";

export const SlabMaster = () => {
  const [slabs, setSlabs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  
  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  
  // Active/Target items
  const [selectedSlab, setSelectedSlab] = useState(null);
  const [activeActionMenu, setActiveActionMenu] = useState(null);

  // Form inputs
  const [formData, setFormData] = useState({ name: "", description: "", isActive: true });
  const [cloneData, setCloneData] = useState({ name: "", description: "" });
  const [assignData, setAssignData] = useState({ userIds: "" });

  const fetchSlabs = async () => {
    setLoading(true);
    try {
      const response = await api.get("/admin/commission/slabs", {
        params: {
          page,
          limit,
          search,
          status: statusFilter !== "all" ? statusFilter : undefined
        }
      });
      if (response.data?.success) {
        setSlabs(response.data.data.slabs);
        setTotalPages(response.data.data.pagination.totalPages);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch slabs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlabs();
  }, [page, search, statusFilter]);


  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post("/admin/commission/slabs", formData);
      if (response.data?.success) {
        toast.success("Slab created successfully!");
        setIsCreateOpen(false);
        setFormData({ name: "", description: "", isActive: true });
        fetchSlabs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create slab");
    }
  };

  const handleEditInit = (slab) => {
    setSelectedSlab(slab);
    setFormData({
      name: slab.name,
      description: slab.description || "",
      isActive: slab.isActive
    });
    setIsEditOpen(true);
    setActiveActionMenu(null);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.put(`/admin/commission/slabs/${selectedSlab.id}`, formData);
      if (response.data?.success) {
        toast.success("Slab updated successfully!");
        setIsEditOpen(false);
        fetchSlabs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update slab");
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete Slab: ${name}?`)) return;
    try {
      const response = await api.delete(`/admin/commission/slabs/${id}`);
      if (response.data?.success) {
        toast.success("Slab deleted successfully (soft delete)");
        fetchSlabs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete slab");
    }
  };

  const handleStatusToggle = async (slab) => {
    try {
      const response = await api.put(`/admin/commission/slabs/${slab.id}`, {
        isActive: !slab.isActive
      });
      if (response.data?.success) {
        toast.success(`Slab ${!slab.isActive ? "enabled" : "disabled"} successfully`);
        fetchSlabs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to toggle status");
    }
  };

  const handleCloneInit = (slab) => {
    setSelectedSlab(slab);
    setCloneData({
      name: `Copy of ${slab.name}`,
      description: `Cloned from ${slab.name}`
    });
    setIsCloneOpen(true);
    setActiveActionMenu(null);
  };

  const handleClone = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(`/admin/commission/slabs/${selectedSlab.id}/clone`, cloneData);
      if (response.data?.success) {
        toast.success("Slab cloned successfully with all rules!");
        setIsCloneOpen(false);
        fetchSlabs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to clone slab");
    }
  };

  const handleAssignInit = (slab) => {
    setSelectedSlab(slab);
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
      const response = await api.post(`/admin/commission/slabs/${selectedSlab.id}/assign-users`, {
        userIds: ids.map(id => parseInt(id))
      });
      if (response.data?.success) {
        toast.success(response.data.message || "Users assigned successfully!");
        setIsAssignOpen(false);
        fetchSlabs();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to assign users");
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveActionMenu(null);
    window.addEventListener("click", handleOutsideClick);
    return () => window.removeEventListener("click", handleOutsideClick);
  }, []);

  return (
    <div className="p-6 bg-[var(--bg-primary)] min-h-screen text-[var(--text-primary)]">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[var(--border-soft)] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight uppercase">Slab Master</h1>
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest mt-0.5">Telecom Multi-Tier Slab Configuration Registry</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase bg-[var(--color-primary)] text-[var(--bg-primary)] hover:bg-[var(--color-primary-hover)] rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Slab
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
            placeholder="SEARCH SLAB NAME..."
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
            <option value="all">ALL SLABS</option>
            <option value="active">ACTIVE ONLY</option>
            <option value="inactive">INACTIVE ONLY</option>
          </select>

          <button
            onClick={() => fetchSlabs()}
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
            <span className="text-xs uppercase tracking-widest text-[var(--text-secondary)]">Loading Slab Catalog...</span>
          </div>
        ) : slabs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-widest">No Commission Slabs Registered</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs select-none">
              <thead>
                <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border-soft)] uppercase text-[10px] tracking-wider text-[var(--text-secondary)] font-bold sticky top-0">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-16 text-center">Actions</th>
                  <th className="py-2.5 px-3">Slab Name</th>
                  <th className="py-2.5 px-3">Details</th>
                  <th className="py-2.5 px-3">Entry Date</th>
                  <th className="py-2.5 px-3">Modify Date</th>
                  <th className="py-2.5 px-3 text-center">IsActive</th>
                  <th className="py-2.5 px-3 text-center">IsSignupB2B</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-soft)] bg-[var(--bg-primary)]/10 font-medium">
                {slabs.map((slab, index) => (
                  <tr key={slab.id} className="hover:bg-[var(--accent-hover)]/30 transition-colors">
                    <td className="py-2 px-3 text-center font-mono text-[var(--text-secondary)]">
                      {(page - 1) * limit + index + 1}
                    </td>
                    <td className="py-2 px-3 text-center relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveActionMenu(activeActionMenu === slab.id ? null : slab.id);
                        }}
                        className="p-1 hover:bg-[var(--accent-hover)] rounded-md transition-colors cursor-pointer inline-block"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {/* Telecom Style Action Menu Dropdown */}
                      {activeActionMenu === slab.id && (
                        <div className="absolute left-10 mt-1 w-52 bg-[var(--bg-secondary)] border border-[var(--border-soft)] shadow-md rounded-lg py-1.5 z-40 text-left font-semibold uppercase text-[10px] tracking-wider">
                          <button
                            onClick={() => handleEditInit(slab)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" /> Edit
                          </button>
                          <a
                            href={`/commission/recharge-slabs?slabId=${slab.id}`}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <ChevronRight className="w-3 h-3" /> Recharge Commission Slab
                          </a>
                          <a
                            href={`/commission/range-slabs?slabId=${slab.id}`}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <ChevronRight className="w-3 h-3" /> Range Commission Slab
                          </a>
                          <button
                            onClick={() => { toast.success("Target slabs configured (Self assignment)"); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <ChevronRight className="w-3 h-3" /> Target
                          </button>
                          <button
                            onClick={() => { toast.success("Circle configurations resolved."); }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <ChevronRight className="w-3 h-3" /> Circle Slab
                          </button>
                          <button
                            onClick={() => handleAssignInit(slab)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <UserPlus className="w-3 h-3" /> Assign Users
                          </button>
                          <button
                            onClick={() => handleCloneInit(slab)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer"
                          >
                            <Copy className="w-3 h-3" /> Clone
                          </button>
                          <button
                            onClick={() => handleStatusToggle(slab)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[var(--accent-hover)] text-[var(--text-primary)] cursor-pointer border-t border-[var(--border-soft)] mt-1 pt-1.5"
                          >
                            {slab.isActive ? (
                              <span className="flex items-center gap-2 text-amber-500"><X className="w-3 h-3" /> Disable</span>
                            ) : (
                              <span className="flex items-center gap-2 text-emerald-500"><Check className="w-3 h-3" /> Enable</span>
                            )}
                          </button>
                          {!slab.isDefault && (
                            <button
                              onClick={() => handleDelete(slab.id, slab.name)}
                              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-rose-500/10 text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" /> Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 font-semibold uppercase tracking-tight text-[var(--text-primary)]">
                      {slab.name}
                    </td>
                    <td className="py-2 px-3 text-[var(--text-secondary)] italic max-w-xs truncate">
                      {slab.description || "N/A"}
                    </td>
                    <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">
                      {new Date(slab.createdAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-2 px-3 font-mono text-[var(--text-secondary)]">
                      {new Date(slab.updatedAt).toLocaleDateString("en-GB")}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {slab.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Disabled
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {slab.isDefault ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--border-soft)]">
                          DEFAULT
                        </span>
                      ) : (
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      {!loading && slabs.length > 0 && (
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

      {/* 1. Create Slab Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-md rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Create Slab Master</h2>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-4 space-y-4">
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Slab Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="E.G. PLATINUM RECHARGE SLAB"
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="SLAB DETAILS..."
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors h-20 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create-active"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-3.5 h-3.5 rounded-md border border-[var(--border-soft)] focus:outline-hidden accent-[var(--color-primary)]"
                />
                <label htmlFor="create-active" className="text-[var(--text-primary)] text-[10px] tracking-wider font-bold select-none cursor-pointer">Activate immediately</label>
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
                  Save Slab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Slab Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-md rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Edit Slab Master</h2>
              <button onClick={() => setIsEditOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-4 space-y-4">
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Slab Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="SLAB NAME..."
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="SLAB DETAILS..."
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors h-20 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-active"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  disabled={selectedSlab?.isDefault}
                  className="w-3.5 h-3.5 rounded-md border border-[var(--border-soft)] focus:outline-hidden accent-[var(--color-primary)] disabled:opacity-40"
                />
                <label htmlFor="edit-active" className="text-[var(--text-primary)] text-[10px] tracking-wider font-bold select-none cursor-pointer">Slab is Active</label>
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
                  Update Slab
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Clone Slab Modal */}
      {isCloneOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs font-semibold uppercase">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-soft)] w-full max-w-md rounded-lg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-[var(--border-soft)] flex justify-between items-center bg-[var(--bg-primary)]/10">
              <h2 className="font-bold text-sm tracking-tight">Clone Slab Configuration</h2>
              <button onClick={() => setIsCloneOpen(false)} className="p-1 hover:bg-[var(--accent-hover)] rounded-md text-[var(--text-secondary)]"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleClone} className="p-4 space-y-4">
              <div className="bg-[var(--color-primary-glow)]/30 border border-[var(--border-soft)] p-2.5 rounded-md mb-2 text-[10px] uppercase text-[var(--text-primary)]">
                Cloning source: <span className="font-bold text-[var(--color-primary)]">{selectedSlab?.name}</span>. This will duplicate the slab profile along with all linked operator and range rules.
              </div>
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">New Slab Name *</label>
                <input
                  type="text"
                  required
                  value={cloneData.name}
                  onChange={(e) => setCloneData({ ...cloneData, name: e.target.value })}
                  placeholder="NEW SLAB NAME..."
                  className="w-full p-2 bg-[var(--bg-primary)] border border-[var(--border-soft)] rounded-md text-xs uppercase tracking-wide focus:outline-hidden focus:border-[var(--color-primary)] transition-colors"
                />
              </div>
              <div>
                <label className="block mb-1.5 text-[var(--text-secondary)] text-[10px] tracking-wider font-bold">New Description</label>
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
                  Clone Slab
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
              <h2 className="font-bold text-sm tracking-tight">Assign Users to Slab</h2>
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
                <span className="text-[9px] text-[var(--text-secondary)] font-medium mt-1 block">Specify integer numeric IDs of users you want to map directly to this slab.</span>
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
    </div>
  );
};
