import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../api";
import { ArrowLeft, Heart, ShoppingBag, Loader, Check, Info } from "lucide-react";
import { toast } from "react-hot-toast";
import gsap from "gsap";
import { getDemoProductBySlug } from "./demoCatalog";

const ProductDetails = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishing, setWishing] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => {
    fetchProductDetails();
  }, [slug]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/imart/products/${slug}`);
      if (res.data?.success) {
        setProduct(res.data.data);
        
        // Check if wishlisted
        const wishRes = await api.get("/imart/wishlist").catch(() => null);
        if (wishRes?.data?.success) {
          const inWishlist = wishRes.data.data.items.some(
            (item) => item.productId === res.data.data.id
          );
          setIsWishlisted(inWishlist);
        }
      }
    } catch (err) {
      console.error(err);
      const demoProduct = getDemoProductBySlug(slug);
      if (demoProduct) {
        setProduct(demoProduct);
      } else {
        toast.error("Failed to load product details");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && product) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          ".animate-fade-in",
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: "power2.out" }
        );
      }, containerRef);
      return () => ctx.revert();
    }
  }, [loading]);

  const handleWishlistToggle = async () => {
    if (!product) return;
    setWishing(true);
    try {
      if (isWishlisted) {
        const res = await api.delete(`/imart/wishlist/${product.id}`);
        if (res.data?.success) {
          setIsWishlisted(false);
          toast.success("Removed from wishlist");
        }
      } else {
        const res = await api.post("/imart/wishlist", { productId: product.id });
        if (res.data?.success) {
          setIsWishlisted(true);
          toast.success("Added to wishlist");
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWishing(false);
    }
  };

  const handleProceedToBuy = () => {
    if (!product) return;
    
    // Add product to wishlist first if it's not already in it, then redirect to wishlist for checkout
    // This allows the user to see the cart/wishlist context and complete purchase via NextGate.
    if (!isWishlisted) {
      api.post("/imart/wishlist", { productId: product.id })
        .then(() => {
          navigate("/imart/wishlist");
        })
        .catch(() => {
          navigate("/imart/wishlist");
        });
    } else {
      navigate("/imart/wishlist");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">
          Decryption product credentials...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] border border-[var(--glass-border)] bg-[var(--bg-tertiary)]/20 rounded-3xl p-8">
        <Info className="w-12 h-12 text-[var(--text-muted)] mb-4" />
        <h2 className="text-sm font-black text-[var(--text-color)] uppercase tracking-widest mb-2">
          Protocol Lost
        </h2>
        <p className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-6">
          The requested product could not be resolved in the registry
        </p>
        <Link
          to="/imart"
          className="flex items-center gap-2 px-5 py-3 bg-[var(--glass-button-bg)] border border-[var(--glass-border)] hover:bg-[var(--glass-border-hover)] rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--text-color)] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const isOutOfStock = product.stock < 1;
  const imagesList = product.images?.length > 0 ? product.images : [{ url: "https://placehold.co/600x450/030012/f8fafc?text=" + encodeURIComponent(product.name) }];
  const specifications = typeof product.specifications === "string" 
    ? JSON.parse(product.specifications) 
    : product.specifications || {};

  return (
    <div className="space-y-8" ref={containerRef}>
      {/* Back Button and Navigation */}
      <div className="flex justify-between items-center glass-panel p-4 rounded-2xl">
        <Link
          to="/imart"
          className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-color)] transition-colors text-[10px] font-black uppercase tracking-widest cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
        <p className="text-[8px] font-black text-[var(--text-muted)] uppercase tracking-[0.2em]">
          Product Code: PROT_{product.id}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN: Gallery */}
        <div className="space-y-4 animate-fade-in">
          {/* Active Image */}
          <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-3xl relative">
            <img
              src={imagesList[activeImage].url}
              alt={product.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = "https://placehold.co/600x450/030012/f8fafc?text=" + encodeURIComponent(product.name);
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/40 to-transparent pointer-events-none"></div>
            {isOutOfStock && (
              <div className="absolute top-4 right-4 px-3 py-1 bg-red-500/80 backdrop-blur-md border border-red-500 rounded-lg">
                <span className="text-[8px] font-black text-white uppercase tracking-widest">
                  OUT OF STOCK
                </span>
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {imagesList.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {imagesList.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(idx)}
                  className={`w-20 aspect-video rounded-xl overflow-hidden border transition-all cursor-pointer flex-shrink-0 ${
                    activeImage === idx
                      ? "border-[var(--color-accent)] ring-2 ring-[var(--color-accent-glow)]"
                      : "border-[var(--glass-border)] hover:border-[var(--glass-border-hover)]"
                  }`}
                >
                  <img
                    src={img.url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.src = "https://placehold.co/100x60/030012/f8fafc?text=" + idx;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Product Info */}
        <div className="space-y-6 flex flex-col justify-between animate-fade-in">
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[8px] font-black text-[var(--color-primary)] uppercase tracking-[0.25em]">
                {product.category?.name}
              </span>
              <h1 className="text-xl md:text-2xl font-black text-[var(--text-color)] uppercase tracking-tight">
                {product.name}
              </h1>
            </div>

            {/* Price display */}
            <div className="flex items-baseline gap-3">
              {product.discountPrice ? (
                <>
                  <span className="text-2xl font-black text-[var(--color-accent)] cyan-glow">
                    ₹{Number(product.discountPrice).toFixed(2)}
                  </span>
                  <span className="text-[var(--text-muted)] line-through text-xs font-bold">
                    ₹{Number(product.price).toFixed(2)}
                  </span>
                </>
              ) : (
                <span className="text-2xl font-black text-[var(--text-color)]">
                  ₹{Number(product.price).toFixed(2)}
                </span>
              )}
            </div>

            {/* Availability details */}
            <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)] border-y border-[var(--glass-border)] py-3">
              <span>
                Status:{" "}
                <span className={isOutOfStock ? "text-red-400" : "text-emerald-500"}>
                  {isOutOfStock ? "OUT OF STOCK" : "IN STOCK"}
                </span>
              </span>
              <span>Available Units: {product.stock}</span>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-color)]">
                Product Specification Narrative
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Specs list */}
            {Object.keys(specifications).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-color)]">
                  Telemetry / System Attributes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {Object.entries(specifications).map(([key, val]) => (
                    <div
                      key={key}
                      className="flex justify-between items-center bg-[var(--bg-tertiary)]/30 border border-[var(--glass-border)] px-3 py-2 rounded-xl text-[9px]"
                    >
                      <span className="font-bold text-[var(--text-muted)] uppercase tracking-wider">
                        {key}
                      </span>
                      <span className="font-black text-[var(--text-secondary)] uppercase tracking-widest">
                        {String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-[var(--glass-border)] mt-auto">
            {/* Wishlist toggle */}
            <button
              disabled={wishing}
              onClick={handleWishlistToggle}
              className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl border transition-all cursor-pointer font-black text-[10px] uppercase tracking-widest ${
                isWishlisted
                  ? "bg-red-500/10 border-red-500/40 text-red-500"
                  : "bg-[var(--glass-button-bg)] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-color)] hover:border-[var(--glass-border-hover)]"
              }`}
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
              {isWishlisted ? "In Wishlist" : "Add to Wishlist"}
            </button>

            {/* Buy Now */}
            <button
              disabled={isOutOfStock}
              onClick={handleProceedToBuy}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-black text-[10px] uppercase tracking-widest shadow-[var(--shadow-medium)] hover:shadow-[var(--shadow-glow)] disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              Proceed to Buy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;
