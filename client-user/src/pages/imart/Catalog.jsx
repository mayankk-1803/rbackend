import React, { useState, useEffect, useRef, useDeferredValue, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api";
import { ShoppingBag, Search, Heart, Eye, Loader, ArrowRight, Tag } from "lucide-react";
import { toast } from "react-hot-toast";
import gsap from "gsap";
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "./demoCatalog";
import { isIOSDevice } from "../../utils/device";

const Catalog = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [wishlistProductIds, setWishlistProductIds] = useState(new Set());
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [wishingId, setWishingId] = useState(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const containerRef = useRef(null);
  const isIOS = isIOSDevice();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, wishRes] = await Promise.all([
        api.get("/imart/products").catch(() => ({ data: { success: false } })),
        api.get("/imart/categories").catch(() => ({ data: { success: false } })),
        api.get("/imart/wishlist").catch(() => null),
      ]);

      let productsLoaded = false;
      let categoriesLoaded = false;

      if (prodRes?.data?.success && Array.isArray(prodRes.data.data) && prodRes.data.data.length > 0) {
        setProducts(prodRes.data.data);
        productsLoaded = true;
      }
      if (catRes?.data?.success && Array.isArray(catRes.data.data) && catRes.data.data.length > 0) {
        setCategories(catRes.data.data);
        categoriesLoaded = true;
      }
      if (wishRes?.data?.success) {
        const ids = wishRes.data.data.items.map((item) => item.productId);
        setWishlistProductIds(new Set(ids));
      }

      if (!productsLoaded) {
        setProducts(DEMO_PRODUCTS);
      }
      if (!categoriesLoaded) {
        setCategories(DEMO_CATEGORIES);
      }
    } catch (err) {
      console.error("Failed to load catalog data, using fallback", err);
      setProducts(DEMO_PRODUCTS);
      setCategories(DEMO_CATEGORIES);
    } finally {
      setTimeout(() => {
        setLoading(false);
      }, 600);
    }
  };

  // GSAP animation for product reveals
  useEffect(() => {
    if (!loading && products.length > 0) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".product-card",
          { opacity: 0, y: isIOS ? 10 : 30, scale: isIOS ? 1 : 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            stagger: isIOS ? 0.01 : 0.04,
            duration: isIOS ? 0.22 : 0.6,
            ease: "power3.out",
          }
        );
      }, containerRef);
      return () => ctx.revert();
    }
    return undefined;
  }, [loading, selectedCategory, deferredSearchQuery, products.length, isIOS]);

  const toggleWishlist = useCallback(async (productId) => {
    const isWishlisted = wishlistProductIds.has(productId);
    setWishingId(productId);

    try {
      if (isWishlisted) {
        const res = await api.delete(`/imart/wishlist/${productId}`);
        if (res.data?.success) {
          const updated = new Set(wishlistProductIds);
          updated.delete(productId);
          setWishlistProductIds(updated);
          toast.success("Removed from wishlist");
        }
      } else {
        const res = await api.post("/imart/wishlist", { productId });
        if (res.data?.success) {
          const updated = new Set(wishlistProductIds);
          updated.add(productId);
          setWishlistProductIds(updated);
          toast.success("Added to wishlist");
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setWishingId(null);
    }
  }, [wishlistProductIds]);

  // Filters
  const filteredProducts = useMemo(() => products.filter((p) => {
    const matchesCategory = selectedCategory
      ? p.category?.slug === selectedCategory
      : true;
    const normalizedSearch = deferredSearchQuery.trim().toLowerCase();
    const matchesSearch = normalizedSearch
      ? p.name.toLowerCase().includes(normalizedSearch) ||
        p.description.toLowerCase().includes(normalizedSearch)
      : true;
    return matchesCategory && matchesSearch;
  }), [products, selectedCategory, deferredSearchQuery]);

  return (
    <div className="space-y-8" ref={containerRef}>
      {/* Catalog Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel p-6 rounded-3xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[var(--color-accent)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-accent)] cyan-glow">
              Quantum Marketplace
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-[var(--text-color)]">
            iMart Hub
          </h1>
          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            Futuristic e-commerce command center
          </p>
        </div>

        <Link
          to="/imart/wishlist"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-500/30 text-[var(--color-accent)] text-[10px] font-black uppercase tracking-widest shadow-[var(--shadow-soft)] transition-all cursor-pointer group"
        >
          <Heart className="w-4 h-4 fill-cyan-400/20 group-hover:scale-110 transition-transform" />
          Wishlist & Cart ({wishlistProductIds.size})
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      {/* Filters and Search Control Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category Panel */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-3xl h-fit space-y-4">
          <div className="flex items-center gap-2 border-b border-[var(--glass-border)] pb-3">
            <Tag className="w-4 h-4 text-[var(--color-primary)]" />
            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-color)]">
              Filter Node
            </h2>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-left transition-all cursor-pointer ${
                selectedCategory === ""
                  ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                  : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-[var(--glass-button-bg)] border border-transparent"
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.slug)}
                className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-left transition-all cursor-pointer ${
                  selectedCategory === cat.slug
                    ? "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20"
                    : "text-[var(--text-muted)] hover:text-[var(--text-color)] hover:bg-[var(--glass-button-bg)] border border-transparent"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Grid list */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search index database..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-6 py-4 glass-input rounded-2xl text-[10px] font-black uppercase tracking-widest text-[var(--text-color)] transition-all outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--color-accent)]/30 focus:ring-4 focus:ring-[var(--color-accent-glow)]"
            />
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[...Array(6)].map((_, idx) => (
                <div
                  key={idx}
                  className="flex flex-col justify-between overflow-hidden relative rounded-2xl border border-[var(--glass-border)] bg-[var(--card-bg)] min-h-[380px] p-5 space-y-4"
                >
                  <div className="aspect-[4/3] w-full rounded-xl shimmer-element bg-[var(--bg-tertiary)] opacity-30"></div>
                  <div className="space-y-3 flex-1">
                    <div className="h-3 w-1/4 rounded bg-[var(--bg-tertiary)] shimmer-element opacity-30"></div>
                    <div className="h-5 w-3/4 rounded bg-[var(--bg-tertiary)] shimmer-element opacity-30"></div>
                    <div className="h-10 w-full rounded bg-[var(--bg-tertiary)] shimmer-element opacity-30"></div>
                  </div>
                  <div className="flex justify-between items-center border-t border-[var(--glass-border)] pt-4 mt-auto">
                    <div className="h-6 w-1/3 rounded bg-[var(--bg-tertiary)] shimmer-element opacity-30"></div>
                    <div className="h-9 w-1/3 rounded bg-[var(--bg-tertiary)] shimmer-element opacity-30"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-[var(--glass-border)] rounded-3xl bg-[var(--bg-tertiary)]/20">
              <ShoppingBag className="w-12 h-12 text-[var(--text-muted)] mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
                No matching product protocols found
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredProducts.map((p) => {
                const isWishlisted = wishlistProductIds.has(p.id);
                const firstImage = p.images?.[0]?.url || "/placeholder-product.png";
                const isOutOfStock = p.stock < 1;

                return (
                  <div
                    key={p.id}
                    className="product-card flex flex-col justify-between overflow-hidden relative group gradient-border-card hover:shadow-[var(--shadow-glow)] hover:-translate-y-1.5 hover:scale-[1.01] transition-all duration-300"
                  >
                    {/* Featured Tag */}
                    {p.featured && (
                      <div className="absolute top-4 left-4 z-20 px-2.5 py-1 bg-purple-500/15 border border-purple-500/30 rounded-lg">
                        <span className="text-[7px] font-black text-purple-400 uppercase tracking-widest">
                          FEATURED
                        </span>
                      </div>
                    )}

                    {/* Stock Status */}
                    {isOutOfStock && (
                      <div className="absolute top-4 right-4 z-20 px-2.5 py-1 bg-red-500/15 border border-red-500/30 rounded-lg">
                        <span className="text-[7px] font-black text-red-400 uppercase tracking-widest">
                          OUT OF STOCK
                        </span>
                      </div>
                    )}

                    {/* Product Image */}
                    <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--bg-secondary)] border-b border-[var(--glass-border)] relative">
                      <img
                        src={firstImage}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        loading="lazy"
                        decoding="async"
                        sizes="(min-width: 1280px) 28vw, (min-width: 768px) 42vw, 92vw"
                        onError={(e) => {
                          e.target.src = "https://placehold.co/400x300/030012/f8fafc?text=" + encodeURIComponent(p.name);
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/40 to-transparent opacity-60"></div>
                    </div>

                    {/* Content */}
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4 relative z-10">
                      <div className="space-y-1">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-[8px] font-black text-[var(--color-primary)] uppercase tracking-widest">
                            {p.category?.name}
                          </p>
                          <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-widest">
                            Stock: {p.stock}
                          </p>
                        </div>
                        <h3 className="text-sm font-black text-[var(--text-color)] uppercase tracking-tight line-clamp-1 group-hover:text-[var(--color-accent)] transition-colors">
                          {p.name}
                        </h3>
                        <p className="text-[10px] text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                          {p.description}
                        </p>
                      </div>

                      {/* Pricing and Actions */}
                      <div className="flex justify-between items-center border-t border-[var(--glass-border)] pt-4 mt-auto">
                        <div className="flex flex-col">
                          {p.discountPrice ? (
                            <>
                              <span className="text-[var(--text-muted)] line-through text-[9px] font-bold">
                                ₹{Number(p.price).toFixed(2)}
                              </span>
                              <span className="text-[var(--color-accent)] text-sm font-black tracking-tight">
                                ₹{Number(p.discountPrice).toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className="text-[var(--text-color)] text-sm font-black tracking-tight">
                              ₹{Number(p.price).toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Wishlist Icon Toggle */}
                          <button
                            disabled={wishingId === p.id}
                            onClick={() => toggleWishlist(p.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                              isWishlisted
                                ? "bg-red-500/10 border-red-500/40 text-red-500"
                                : "bg-[var(--glass-button-bg)] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-color)] hover:border-[var(--glass-border-hover)]"
                            }`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isWishlisted ? "fill-current" : ""}`} />
                          </button>

                          {/* View details */}
                          <button
                            onClick={() => navigate(`/imart/product/${p.slug}`)}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[var(--color-accent-glow)] border border-[var(--color-accent)]/20 text-[var(--color-accent)] rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-[var(--color-accent)] hover:text-white transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
