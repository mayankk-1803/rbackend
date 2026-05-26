import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import { Plus, Edit2, Trash2, Folder, X, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import gsap from "gsap";

export const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const containerRef = useRef(null);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get("/imart/categories");
      if (res.data && res.data.success) {
        setCategories(res.data.data);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    if (loading || categories.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".category-card",
        { opacity: 0, y: 15, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.04,
          duration: 0.35,
          ease: "power2.out",
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [loading, categories]);

  const handleOpenCreate = () => {
    setCurrentCategory(null);
    setCategoryName("");
    setModalOpen(true);
  };

  const handleOpenEdit = (category) => {
    setCurrentCategory(category);
    setCategoryName(category.name);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCategoryName("");
    setCurrentCategory(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      setSubmitting(true);
      if (currentCategory) {
        const res = await api.put(`/imart/admin/categories/${currentCategory.id}`, {
          name: categoryName.trim(),
        });
        if (res.data && res.data.success) {
          toast.success("Category updated successfully");
          setCategories(prev =>
            prev.map(c => (c.id === currentCategory.id ? res.data.data : c))
          );
          handleCloseModal();
        }
      } else {
        const res = await api.post("/imart/admin/categories", {
          name: categoryName.trim(),
        });
        if (res.data && res.data.success) {
          toast.success("Category created successfully");
          setCategories(prev => [...prev, res.data.data]);
          handleCloseModal();
        }
      }
    } catch (error) {
      console.error("Submission failed:", error);
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/imart/admin/categories/${id}`);
      if (res.data && res.data.success) {
        toast.success("Category deleted successfully");
        setCategories(prev => prev.filter(c => c.id !== id));
        setDeleteConfirmId(null);
      }
    } catch (error) {
      console.error("Deletion failed:", error);
      toast.error(error.response?.data?.message || "Failed to delete category");
    }
  };

  return (
    <div ref={containerRef} className="space-y-6 pb-12">
      {/* Top Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Folder className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tight">
              iMart <span className="text-[var(--color-primary)]">Categories</span>
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Organize & tag product lines inside the secure virtual network
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchCategories}
            className="p-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)]/50 border border-[var(--border-soft)] rounded-xl transition-all text-[var(--text-secondary)] cursor-pointer"
            title="Refresh Grid"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${loading ? "animate-spin text-[var(--color-primary)]" : ""}`} />
          </button>
          
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--bg-primary)] text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Category
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-32 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/50 animate-pulse"></div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--card-bg)] text-center shadow-soft">
          <Folder className="w-12 h-12 text-[var(--text-secondary)] opacity-40 mb-3" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">No Categories Found</h2>
          <p className="text-xs text-[var(--text-secondary)] tracking-wide mt-1.5 max-w-xs">
            Categories must be established first before uploading products.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div
              key={category.id}
              className="category-card group relative p-5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-soft)] hover:border-[var(--color-primary)]/40 transition-all duration-300 shadow-soft flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-soft)] group-hover:border-[var(--color-primary)]/20 transition-all">
                    <Folder className="w-4.5 h-4.5 text-[var(--color-primary)]" />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(category)}
                      className="p-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-soft)] transition-all cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(category.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[var(--text-primary)] transition-colors mt-2">
                  {category.name}
                </h3>
                <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-mono mt-0.5">
                  SLUG: {category.slug}
                </p>
              </div>

              {/* Delete Confirmation Overlay */}
              {deleteConfirmId === category.id && (
                <div className="absolute inset-0 bg-[var(--card-bg)] p-4 flex flex-col justify-between z-10 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-rose-500">Confirm Deletion</h4>
                      <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed mt-1">
                        Are you sure you want to delete this category? This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-2.5 py-1.5 rounded-lg border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-[9px] font-bold uppercase tracking-wider text-white cursor-pointer"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Slide-Up Category Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-xl bg-[var(--card-bg)] border border-[var(--border-soft)] shadow-medium p-6 relative overflow-hidden">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-4.5 h-4.5 text-[var(--color-primary)]" />
                {currentCategory ? "Modify Category" : "New Category Protocol"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Gaming Consoles, Digital Gift Cards"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] text-xs text-[var(--text-primary)] rounded-xl outline-none transition-all focus:ring-2 focus:ring-[var(--admin-focus-ring)]"
                />
              </div>

              <div className="flex gap-2.5 justify-end pt-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-3.5 py-2 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--bg-primary)] text-[10px] font-bold uppercase tracking-wider hover:opacity-90 transition-all shadow-sm border border-transparent cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Processing..." : currentCategory ? "Update Category" : "Establish Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
