import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import { 
  Plus, Edit2, Trash2, ShoppingBag, X, ShieldAlert, Sparkles, 
  Upload, Image as ImageIcon, Search, Tag, Layers, Check, Trash
} from "lucide-react";
import gsap from "gsap";

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null); // null for create, object for edit

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [stock, setStock] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [featured, setFeatured] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]); // array of URLs
  const [specifications, setSpecifications] = useState([{ key: "", value: "" }]); // array of {key, value}

  // Filters State
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [featuredFilter, setFeaturedFilter] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fetch Categories and Products
  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [catRes, prodRes] = await Promise.all([
        api.get("/imart/categories"),
        api.get("/imart/products")
      ]);
      
      if (catRes.data && catRes.data.success) {
        setCategories(catRes.data.data);
      }
      if (prodRes.data && prodRes.data.success) {
        setProducts(prodRes.data.data);
      }
    } catch (error) {
      console.error("Failed to load initial data:", error);
      toast.error("Failed to fetch product catalog data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // GSAP animation for product cards
  useEffect(() => {
    if (loading || filteredProducts.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".product-card",
        { opacity: 0, y: 30, scale: 0.96 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          stagger: 0.04,
          duration: 0.45,
          ease: "power3.out",
        }
      );
    }, containerRef);

    return () => ctx.revert();
  }, [loading, search, categoryFilter, featuredFilter, products]);

  // Filters logic
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter ? p.categoryId === Number(categoryFilter) : true;
    const matchesFeatured = featuredFilter === "true" ? p.featured : featuredFilter === "false" ? !p.featured : true;
    
    return matchesSearch && matchesCategory && matchesFeatured;
  });

  const handleOpenCreate = () => {
    setCurrentProduct(null);
    setName("");
    setDescription("");
    setPrice("");
    setDiscountPrice("");
    setStock("");
    setCategoryId(categories[0]?.id || "");
    setFeatured(false);
    setUploadedImages([]);
    setSpecifications([{ key: "", value: "" }]);
    setModalOpen(true);
  };

  const handleOpenEdit = (product) => {
    setCurrentProduct(product);
    setName(product.name);
    setDescription(product.description);
    setPrice(product.price);
    setDiscountPrice(product.discountPrice || "");
    setStock(product.stock);
    setCategoryId(product.categoryId);
    setFeatured(product.featured);
    setUploadedImages(product.images.map(img => img.url));
    
    // Parse specifications from JSON
    if (product.specifications && typeof product.specifications === "object") {
      const specsArray = Object.entries(product.specifications).map(([key, value]) => ({
        key,
        value: String(value)
      }));
      setSpecifications(specsArray.length > 0 ? specsArray : [{ key: "", value: "" }]);
    } else {
      setSpecifications([{ key: "", value: "" }]);
    }

    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setCurrentProduct(null);
  };

  // Image Upload handler
  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("images", files[i]);
    }

    try {
      setUploading(true);
      const res = await api.post("/imart/admin/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data"
        }
      });

      if (res.data && res.data.success) {
        setUploadedImages(prev => [...prev, ...res.data.urls]);
        toast.success(`${files.length} image(s) uploaded successfully`);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error.response?.data?.message || "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveUploadedImage = (indexToRemove) => {
    setUploadedImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Specifications helpers
  const handleSpecChange = (index, field, value) => {
    setSpecifications(prev => prev.map((s, idx) => {
      if (idx === index) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleAddSpec = () => {
    setSpecifications(prev => [...prev, { key: "", value: "" }]);
  };

  const handleRemoveSpec = (index) => {
    setSpecifications(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!categoryId) {
      toast.error("Please select a category");
      return;
    }

    // Convert specs array back to JSON object
    const specsObject = {};
    specifications.forEach(s => {
      if (s.key.trim()) {
        specsObject[s.key.trim()] = s.value.trim();
      }
    });

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      stock: Number(stock) || 0,
      categoryId: Number(categoryId),
      featured,
      images: uploadedImages,
      specifications: Object.keys(specsObject).length > 0 ? specsObject : null
    };

    try {
      setSubmitting(true);
      if (currentProduct) {
        const res = await api.put(`/imart/admin/products/${currentProduct.id}`, payload);
        if (res.data && res.data.success) {
          toast.success("Product updated successfully");
          setProducts(prev => prev.map(p => p.id === currentProduct.id ? res.data.data : p));
          handleCloseModal();
        }
      } else {
        const res = await api.post("/imart/admin/products", payload);
        if (res.data && res.data.success) {
          toast.success("Product created successfully");
          setProducts(prev => [res.data.data, ...prev]);
          handleCloseModal();
        }
      }
    } catch (error) {
      console.error("Product submission failed:", error);
      toast.error(error.response?.data?.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      const res = await api.delete(`/imart/admin/products/${id}`);
      if (res.data && res.data.success) {
        toast.success("Product deleted successfully");
        setProducts(prev => prev.filter(p => p.id !== id));
        setDeleteConfirmId(null);
      }
    } catch (error) {
      console.error("Deletion failed:", error);
      toast.error("Failed to delete product");
    }
  };

  const API_URL = import.meta.env.VITE_API_URL || "https://rchserver.irecharge.in/api";
  const baseUrl = API_URL.replace("/api", "");

  return (
    <div ref={containerRef} className="space-y-6 min-h-screen pb-12">
      {/* Top Header Section */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[var(--color-primary-glow)] rounded-xl">
              <ShoppingBag className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              iMart Products
            </h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 font-medium">
            Manage virtual merchandise catalog, digital cards, and inventory telemetry
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--color-primary)] text-[var(--bg-primary)] text-xs font-semibold tracking-wide hover:opacity-90 transition-all shadow-sm border border-[var(--border-soft)] cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </header>

      {/* Filtering Protocol Dashboard */}
      <div className="p-4 rounded-xl bg-[var(--card-bg)] border border-[var(--border-soft)] flex flex-col md:flex-row gap-4 items-center shadow-soft">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--color-primary)] transition-colors" />
          <input
            type="text"
            placeholder="Filter catalog products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] rounded-xl text-xs font-medium text-[var(--text-primary)] outline-none transition-all"
          />
        </div>

        <div className="flex flex-wrap md:flex-nowrap gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl px-3 py-1.5">
            <Tag className="w-4 h-4 text-[var(--text-secondary)]" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="" className="bg-[var(--card-bg)]">ALL CATEGORIES</option>
              {categories.map(c => (
                <option key={c.id} value={c.id} className="bg-[var(--card-bg)]">
                  {c.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] rounded-xl px-3 py-1.5">
            <Layers className="w-4 h-4 text-[var(--text-secondary)]" />
            <select
              value={featuredFilter}
              onChange={(e) => setFeaturedFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-[var(--text-primary)] outline-none cursor-pointer"
            >
              <option value="" className="bg-[var(--card-bg)]">ALL FEATURED</option>
              <option value="true" className="bg-[var(--card-bg)]">FEATURED ONLY</option>
              <option value="false" className="bg-[var(--card-bg)]">STANDARD ONLY</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-80 rounded-xl border border-[var(--border-soft)] bg-[var(--card-bg)] shimmer-element"></div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--card-bg)] text-center shadow-soft">
          <ShoppingBag className="w-12 h-12 text-[var(--text-secondary)] opacity-40 mb-4" />
          <h2 className="text-base font-bold text-[var(--text-primary)]">No Products Registered</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-sm font-medium">
            Make sure you have created categories before cataloging products inside the admin database.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => {
            const hasDiscount = product.discountPrice && Number(product.discountPrice) > 0;

            return (
              <div
                key={product.id}
                className="product-card group relative rounded-xl bg-[var(--card-bg)] border border-[var(--border-soft)] hover:border-[var(--color-primary)]/40 hover:shadow-medium transition-all duration-300 flex flex-col justify-between overflow-hidden"
              >
                {/* Featured Badge */}
                {product.featured && (
                  <span className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded-md bg-[var(--color-primary-glow)] text-[var(--color-primary)] text-[9px] font-bold uppercase tracking-wider border border-[var(--color-primary)]/20 shadow-sm">
                    FEATURED
                  </span>
                )}

                {/* Product Image Cover */}
                <div className="h-40 w-full bg-[var(--bg-secondary)] relative flex items-center justify-center border-b border-[var(--border-soft)] overflow-hidden">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={
                        product.images[0].url.startsWith("http")
                          ? product.images[0].url
                          : `${baseUrl}${product.images[0].url}`
                      }
                      alt={product.name}
                      className="object-cover w-full h-full group-hover:scale-102 transition-transform duration-300"
                    />
                  ) : (
                    <ImageIcon className="w-10 h-10 text-[var(--text-secondary)] opacity-30" />
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <span className="inline-block px-2 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-soft)] text-[9px] font-bold uppercase tracking-wider text-[var(--color-primary)]">
                      {product.category?.name}
                    </span>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">
                      {product.name}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] tracking-wide line-clamp-2 h-8 font-medium">
                      {product.description}
                    </p>
                  </div>

                  <div className="pt-2.5 border-t border-[var(--border-soft)] flex items-center justify-between">
                    <div>
                      {hasDiscount ? (
                        <div className="flex flex-col">
                          <span className="text-[10px] text-rose-500 line-through font-mono">
                            ₹{Number(product.price).toLocaleString()}
                          </span>
                          <span className="text-sm font-bold text-[var(--color-primary)] font-mono">
                            ₹{Number(product.discountPrice).toLocaleString()}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                          ₹{Number(product.price).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${product.stock > 0 ? 'text-[var(--color-primary)]' : 'text-rose-500 animate-pulse'}`}>
                        {product.stock > 0 ? `${product.stock} In Stock` : 'Out of Stock'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => handleOpenEdit(product)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--border-soft)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border-soft)] transition-all cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Configure
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(product.id)}
                      className="py-2 px-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation Overlay */}
                {deleteConfirmId === product.id && (
                  <div className="absolute inset-0 bg-[var(--card-bg)] p-5 flex flex-col justify-between z-20">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0 animate-pulse mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-600">Confirm Deletion</h4>
                        <p className="text-xs text-[var(--text-secondary)] tracking-wide mt-1 font-medium">
                          Delete this product? Relational logs will be maintained, but catalog representation is disabled.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 rounded-lg border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-xs font-semibold text-white cursor-pointer"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Dialog Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-2xl my-8 rounded-xl bg-[var(--glass-modal-bg)] border border-[var(--border-primary)] shadow-medium p-6 relative overflow-hidden">
            {/* Top Border Accent */}
            <div className="absolute top-0 left-0 w-full h-1 bg-[var(--color-primary)]"></div>

            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--color-primary)] animate-pulse" />
                {currentProduct ? "Modify Product Credentials" : "New Virtual Product Protocol"}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--border-soft)] text-[var(--text-secondary)] transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Row 1: Name and Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    Product Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Apple Gift Card, Xbox Console..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] text-xs font-medium text-[var(--text-primary)] rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    Catalog Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] text-xs font-medium text-[var(--text-primary)] rounded-xl outline-none cursor-pointer"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id} className="bg-[var(--card-bg)] text-[var(--text-primary)]">
                        {c.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Price, Discount Price, Stock, Featured */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    Price (INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="1999"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] text-xs font-medium text-[var(--text-primary)] rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    Discount Price (INR)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="1499 (Optional)"
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] text-xs font-medium text-[var(--text-primary)] rounded-xl outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    Stock Limit
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="50"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] text-xs font-medium text-[var(--text-primary)] rounded-xl outline-none"
                  />
                </div>

                <div className="flex flex-col justify-center items-start space-y-1.5 h-full">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    Featured
                  </label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-5 bg-[var(--bg-secondary)] rounded-full border border-[var(--border-soft)] peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[var(--text-secondary)] peer-checked:after:bg-[var(--color-primary)] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--color-primary-glow)] peer-checked:border-[var(--color-primary)]"></div>
                  </label>
                </div>
              </div>

              {/* Row 3: Product Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                  Product Description / Specifications
                </label>
                <textarea
                  required
                  rows="3"
                  placeholder="Enter details about this product, specifications outline, warranty details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] focus:border-[var(--color-primary)] text-xs font-medium text-[var(--text-primary)] rounded-xl outline-none resize-none"
                />
              </div>

              {/* Multi-Image Upload Module */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                  Product Galleries
                  {uploading && <span className="ml-2 text-[10px] text-[var(--color-primary)] animate-pulse">(Uploading...)</span>}
                </label>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Upload button wrapper */}
                  <div
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    className="h-24 rounded-xl border border-dashed border-[var(--border-soft)] hover:border-[var(--color-primary)]/40 bg-[var(--bg-secondary)] flex flex-col justify-center items-center cursor-pointer transition-all hover:bg-[var(--border-soft)]"
                  >
                    <Upload className={`w-5 h-5 text-[var(--text-secondary)] ${uploading ? "animate-bounce" : ""}`} />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mt-2">
                      {uploading ? "Uploading..." : "Add Images"}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      disabled={uploading}
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>

                  {/* Render uploaded image thumbnails */}
                  {uploadedImages.map((url, index) => (
                    <div key={index} className="h-24 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] relative group overflow-hidden">
                      <img
                        src={url.startsWith("http") ? url : `${baseUrl}${url}`}
                        alt="Product upload"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveUploadedImage(index)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity duration-200 cursor-pointer"
                      >
                        <Trash className="w-5 h-5 text-rose-500" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Specifications key-value generator */}
              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider ml-0.5">
                    System Parameters / Specifications
                  </label>
                  <button
                    type="button"
                    onClick={handleAddSpec}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--border-soft)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-primary)] border border-[var(--border-soft)] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Parameter
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                  {specifications.map((spec, index) => (
                    <div key={index} className="flex gap-2.5 items-center">
                      <input
                        type="text"
                        placeholder="Parameter Name (e.g. Brand)"
                        value={spec.key}
                        onChange={(e) => handleSpecChange(index, "key", e.target.value)}
                        className="flex-1 px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-xs font-medium text-[var(--text-primary)] rounded-xl outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Value (e.g. Apple)"
                        value={spec.value}
                        onChange={(e) => handleSpecChange(index, "value", e.target.value)}
                        className="flex-1 px-3 py-2 bg-[var(--admin-input-bg)] border border-[var(--border-soft)] text-xs font-medium text-[var(--text-primary)] rounded-xl outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSpec(index)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-[var(--border-soft)]">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl border border-[var(--border-soft)] hover:bg-[var(--bg-secondary)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || uploading}
                  className="px-5 py-2 rounded-xl bg-[var(--color-primary)] text-[var(--bg-primary)] text-xs font-bold uppercase tracking-wider hover:opacity-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? "Saving..." : currentProduct ? "Save Changes" : "Publish Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
