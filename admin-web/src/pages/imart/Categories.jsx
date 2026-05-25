import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import { Plus, Edit2, Trash2, Folder, X, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import gsap from "gsap";

export const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(null); // null for create, object for edit
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

  // GSAP animation for list items
  useEffect(() => {
    if (loading || categories.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".category-card",
        { opacity: 0, y: 30, scale: 0.95 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.05,
          duration: 0.5,
          ease: "power3.out",
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
        // Edit
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
        // Create
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
    <div ref={containerRef} className="space-y-6 min-h-screen pb-12">
      {/* Top Header Section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-color)] tracking-tight uppercase italic flex items-center gap-2">
            <Folder className="w-8 h-8 text-[var(--color-primary)] drop-shadow-[0_0_8px_var(--color-primary-glow)]" />
            iMart <span className="text-[var(--color-primary)] cyan-glow">Categories</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest font-black mt-1">
            Organize & tag product lines inside the secure virtual network
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={fetchCategories}
            className="p-3 bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border)] border border-[var(--glass-border)] rounded-xl transition-all text-[var(--text-secondary)] cursor-pointer"
            title="Refresh Grid"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin text-[var(--color-accent)]" : ""}`} />
          </button>
          
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-[0_0_20px_var(--color-primary-glow)] border border-[var(--glass-border)] cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Create Category
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(n => (
            <div key={n} className="h-32 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-card-bg)] shimmer-element"></div>
          ))}
        </div>
      ) : categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-3xl border border-dashed border-[var(--glass-border)] bg-[var(--glass-card-bg)] text-center">
          <Folder className="w-16 h-16 text-[var(--text-secondary)] opacity-40 mb-4 animate-bounce" />
          <h2 className="text-lg font-black uppercase tracking-wider text-[var(--text-color)]">No Categories Found</h2>
          <p className="text-xs text-[var(--text-secondary)] tracking-wide mt-1 max-w-sm">
            Categories must be established first before uploading products into the command center.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => (
            <div
              key={category.id}
              className="category-card group relative p-6 rounded-2xl bg-[var(--glass-card-bg)] border border-[var(--glass-border)] hover:border-[var(--color-accent)]/40 transition-all duration-300 shadow-[var(--glass-shadow)] flex flex-col justify-between overflow-hidden"
            >
              {/* Decorative side accent glow */}
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[var(--color-primary)] to-[var(--color-accent)] opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              <div>
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2.5 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] group-hover:border-[var(--color-primary)]/20 transition-all">
                    <Folder className="w-5 h-5 text-[var(--color-accent)]" />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOpenEdit(category)}
                      className="p-2 rounded-lg bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border)] text-[var(--text-secondary)] hover:text-[var(--text-color)] border border-[var(--glass-border)] transition-all cursor-pointer"
                      title="Edit Category"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(category.id)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-black uppercase tracking-tight text-[var(--text-color)] group-hover:text-[var(--color-accent)] transition-colors mt-2">
                  {category.name}
                </h3>
                <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-mono mt-1">
                  SLUG: {category.slug}
                </p>
              </div>

              {/* Delete Confirmation Overlay */}
              {deleteConfirmId === category.id && (
                <div className="absolute inset-0 bg-[var(--glass-modal-bg)] backdrop-blur-md p-6 flex flex-col justify-between z-10">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="w-6 h-6 text-rose-500 flex-shrink-0 animate-pulse" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-rose-500">Confirm Deletion</h4>
                      <p className="text-[10px] text-[var(--text-secondary)] tracking-wide mt-1">
                        Are you sure you want to delete this category? This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setDeleteConfirmId(null)}
                      className="px-3 py-1.5 rounded-lg border border-[var(--glass-border)] hover:bg-[var(--glass-border)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-[fadeIn_0.2s_ease-out]">
          <div className="w-full max-w-md rounded-2xl bg-[var(--glass-modal-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)] p-6 relative overflow-hidden">
            {/* Header glow */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]"></div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-black uppercase tracking-tight text-[var(--text-color)] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--color-accent)] animate-pulse" />
                {currentCategory ? "Modify Category" : "New Category Protocol"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Gaming Consoles, Digital Gift Cards"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] focus:border-[var(--color-accent)] text-xs font-black uppercase tracking-widest text-[var(--text-color)] rounded-xl outline-none transition-all focus:ring-4 focus:ring-[var(--color-accent)]/10"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--glass-border)] text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-[0_0_15px_var(--color-primary-glow)] border border-[var(--glass-border)] cursor-pointer disabled:opacity-50"
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
