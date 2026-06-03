import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import {
  Heart,
  Trash2,
  ShoppingBag,
  ArrowLeft,
  Loader,
  CreditCard,
  CheckCircle,
  XCircle,
  ShieldCheck,
  ReceiptText,
  Printer,
  Download,
  Smartphone,
  Landmark,
  WalletCards,
  BadgeIndianRupee
} from "lucide-react";
import { toast } from "react-hot-toast";
import gsap from "gsap";

const GST_RATE = 0.18;

const formatCurrency = (value) =>
  `INR ${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const getOrderTotals = (order) => {
  const subtotal = Number(order?.subtotalAmount || 0) ||
    (order?.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
  const gst = Number(order?.gstAmount || 0);
  const total = Number(order?.totalAmount || subtotal + gst);
  return { subtotal, gst, total };
};

const InvoiceModal = ({ order, onClose }) => {
  const invoiceRef = useRef(null);
  if (!order) return null;

  const { subtotal, gst, total } = getOrderTotals(order);
  const invoiceId = order.invoiceId || `IMART-${String(order.id).padStart(6, "0")}`;

  const downloadInvoice = async () => {
    const html2pdf = (await import("html2pdf.js")).default;
    await html2pdf()
      .set({
        margin: 10,
        filename: `${invoiceId}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      })
      .from(invoiceRef.current)
      .save();
  };

  const printInvoice = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>${invoiceId}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 24px; }
            th, td { border-bottom: 1px solid #e5e7eb; padding: 10px; text-align: left; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 11px; }
            .total { font-size: 20px; font-weight: 800; }
          </style>
        </head>
        <body>${invoiceRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-modal rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 border border-[var(--glass-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--color-accent)]">iMart GST Invoice</p>
            <h2 className="text-lg font-black uppercase tracking-tight text-[var(--text-color)]">{invoiceId}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={downloadInvoice} className="px-3 py-2 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest text-[var(--text-color)] flex items-center gap-2">
              <Download className="w-3.5 h-3.5" /> Download
            </button>
            <button onClick={printInvoice} className="px-3 py-2 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest text-[var(--text-color)] flex items-center gap-2">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[9px] font-black uppercase tracking-widest text-red-500">
              Close
            </button>
          </div>
        </div>

        <div ref={invoiceRef} className="bg-white text-slate-950 rounded-2xl p-6 space-y-6">
          <div className="flex justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h1 className="text-2xl font-black tracking-tight">DiziPay iMart</h1>
              <p className="text-xs text-slate-500 uppercase tracking-widest">Tax invoice for ecommerce order</p>
            </div>
            <div className="text-right text-xs">
              <p><strong>Invoice ID:</strong> {invoiceId}</p>
              <p><strong>Order ID:</strong> #{order.id}</p>
              <p><strong>Date:</strong> {new Date(order.createdAt).toLocaleString()}</p>
              <p><strong>Status:</strong> {order.paymentStatus}</p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-black uppercase tracking-widest text-slate-500">Customer</p>
              <p className="font-bold">{order.user?.name || "Customer"}</p>
              <p>{order.user?.email || "Email not available"}</p>
              <p>{order.user?.phone || "Phone not available"}</p>
            </div>
            <div className="sm:text-right">
              <p className="font-black uppercase tracking-widest text-slate-500">Payment</p>
              <p><strong>Method:</strong> {order.paymentMethod || "IMART"}</p>
              <p><strong>Gateway Ref:</strong> {order.gatewayRef || "N/A"}</p>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-3 text-left">Product</th>
                <th className="p-3 text-right">Qty</th>
                <th className="p-3 text-right">Unit Price</th>
                <th className="p-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item) => (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="p-3 font-semibold">{item.product?.name || "iMart Product"}</td>
                  <td className="p-3 text-right">{item.quantity}</td>
                  <td className="p-3 text-right">{formatCurrency(item.price)}</td>
                  <td className="p-3 text-right">{formatCurrency(Number(item.price) * Number(item.quantity || 1))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="ml-auto max-w-sm space-y-2 text-sm">
            <div className="flex justify-between"><span>Product subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
            <div className="flex justify-between"><span>GST 18%</span><strong>{formatCurrency(gst)}</strong></div>
            <div className="flex justify-between border-t border-slate-300 pt-3 total"><span>Final payable</span><strong>{formatCurrency(total)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Wishlist = () => {
  const [wishlist, setWishlist] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [paymentStatus, setPaymentStatus] = useState("IDLE");
  const [paymentMessage, setPaymentMessage] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [latestOrder, setLatestOrder] = useState(null);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const containerRef = useRef(null);
  const paymentRef = useRef(null);

  useEffect(() => {
    fetchWishlist();
    fetchOrders();
  }, []);

  const fetchWishlist = async () => {
    try {
      setLoading(true);
      const res = await api.get("/imart/wishlist");
      if (res.data?.success) setWishlist(res.data.data);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      toast.error("Failed to load wishlist protocols");
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await api.get("/imart/orders");
      if (res.data?.success) setOrders(res.data.data || []);
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
    }
  };

  useEffect(() => {
    if (!loading && wishlist) {
      const ctx = gsap.context(() => {
        gsap.fromTo(".wishlist-item", { opacity: 0, x: -20 }, { opacity: 1, x: 0, stagger: 0.05, duration: 0.45, ease: "power2.out" });
        gsap.fromTo(".summary-panel", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.55, ease: "power3.out", delay: 0.1 });
      }, containerRef);
      return () => ctx.revert();
    }
  }, [loading, wishlist]);

  useEffect(() => {
    if (showPaymentModal && paymentRef.current) {
      gsap.fromTo(paymentRef.current, { opacity: 0, scale: 0.96, y: 20 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: "power3.out" });
    }
  }, [showPaymentModal]);

  const items = wishlist?.items || [];
  const subtotal = items.reduce((sum, item) => {
    const price = item.product.discountPrice || item.product.price;
    return sum + Number(price);
  }, 0);
  const gst = subtotal * GST_RATE;
  const grandTotal = subtotal + gst;

  const removeItem = async (productId) => {
    setRemovingId(productId);
    try {
      const res = await api.delete(`/imart/wishlist/${productId}`);
      if (res.data?.success) {
        toast.success("Item removed from cart registry");
        setWishlist((prev) => ({ ...prev, items: prev.items.filter((item) => item.productId !== productId) }));
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      toast.error("Failed to update wishlist registry");
    } finally {
      setRemovingId(null);
    }
  };

  const openPaymentGateway = () => {
    setShowCheckoutModal(false);
    setShowPaymentModal(true);
    setPaymentStatus("IDLE");
    setPaymentMessage("");
    setLatestOrder(null);
  };

  const runSecurePayment = async () => {
    setCheckoutLoading(true);
    setPaymentStatus("PROCESSING");
    setPaymentMessage("Authorizing secure iMart payment...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const res = await api.post("/imart/checkout", { paymentMethod });
      if (res.data?.success) {
        setPaymentStatus("SUCCESS");
        setLatestOrder(res.data.order);
        setPaymentMessage("Order Placed Successfully");
        setWishlist((prev) => ({ ...(prev || {}), items: [] }));
        await fetchOrders();
        toast.success("iMart order paid successfully");
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error(err);
      setPaymentStatus("FAILED");
      setPaymentMessage("Payment Failed");
      toast.error("Payment Failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const paymentOptions = [
    { id: "UPI", label: "UPI", icon: Smartphone },
    { id: "CARD", label: "CARD", icon: CreditCard },
    { id: "NETBANKING", label: "Netbanking", icon: Landmark },
    { id: "WALLET", label: "Demo Wallet", icon: WalletCards }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader className="w-8 h-8 text-[var(--color-accent)] animate-spin" />
        <p className="text-[8px] font-black uppercase tracking-widest text-[var(--text-muted)]">Decrypting wishlist registry...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" ref={containerRef}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 glass-panel p-6 rounded-3xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-[var(--color-primary)] fill-[var(--color-primary-glow)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--color-primary)] purple-glow">Secure Checkout Engine</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-[var(--text-color)]">Cart & Wishlist</h1>
          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">GST-ready iMart checkout with isolated demo payment rails</p>
        </div>

        <Link to="/imart" className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] text-[var(--text-color)] text-[10px] font-black uppercase tracking-widest transition-all">
          <ArrowLeft className="w-4 h-4" /> Continue Shopping
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-[var(--glass-border)] rounded-3xl bg-[var(--glass-card-bg)] text-center px-4">
          <ShoppingBag className="w-16 h-16 text-[var(--text-muted)] mb-4" />
          <h2 className="text-sm font-black text-[var(--text-color)] uppercase tracking-widest mb-2">Registry is Empty</h2>
          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider mb-6 max-w-sm">Add items from the marketplace to initialize your purchase ledger</p>
          <Link to="/imart" className="px-6 py-3.5 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-[var(--color-accent)]/20 text-[var(--color-accent)] text-[10px] font-black uppercase tracking-widest rounded-xl hover:from-purple-500/20 hover:to-indigo-500/20 transition-all">
            Explore marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {items.map((item) => {
              const product = item.product;
              const price = product.discountPrice || product.price;
              const image = product.images?.[0]?.url || "/placeholder-product.png";
              const isOutOfStock = product.stock < 1;

              return (
                <div key={item.id} className="wishlist-item flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-[var(--glass-card-bg)] border border-[var(--glass-border)] rounded-2xl relative overflow-hidden group hover:border-[var(--glass-border-hover)] transition-all">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex-shrink-0">
                      <img src={image} alt={product.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = `https://placehold.co/150x150/030012/f8fafc?text=${encodeURIComponent(product.name)}`; }} />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[8px] font-black text-[var(--color-accent)] uppercase tracking-widest">{product.category?.name}</span>
                      <h3 className="text-xs font-black text-[var(--text-color)] uppercase tracking-tight line-clamp-1 group-hover:text-[var(--color-primary)] transition-colors">{product.name}</h3>
                      <p className="text-[9px] text-[var(--text-secondary)] line-clamp-1">{product.description}</p>
                      <div className="flex items-center gap-4">
                        <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Stock: {product.stock}</span>
                        {isOutOfStock && <span className="text-[8px] font-black text-red-500 uppercase tracking-wider">Out of stock</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto border-t md:border-t-0 border-[var(--glass-border)] pt-4 md:pt-0">
                    <span className="text-[var(--text-color)] text-xs font-black tracking-tight">{formatCurrency(price)}</span>
                    <button disabled={removingId === product.id} onClick={() => removeItem(product.id)} className="p-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/30 transition-all">
                      {removingId === product.id ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="lg:col-span-1">
            <div className="summary-panel p-6 glass-panel rounded-3xl space-y-6 h-fit relative shine-sweep-active">
              <div className="flex items-center gap-2 border-b border-[var(--glass-border)] pb-3">
                <ReceiptText className="w-4 h-4 text-[var(--color-accent)]" />
                <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-color)]">GST Billing Ledger</h2>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[10px]"><span className="font-bold text-[var(--text-muted)] uppercase tracking-widest">Items</span><span className="font-black text-[var(--text-secondary)]">{items.length} units</span></div>
                <div className="flex justify-between text-[10px]"><span className="font-bold text-[var(--text-muted)] uppercase tracking-widest">Product subtotal</span><span className="font-black text-[var(--text-secondary)]">{formatCurrency(subtotal)}</span></div>
                <div className="flex justify-between text-[10px]"><span className="font-bold text-[var(--text-muted)] uppercase tracking-widest">GST 18%</span><span className="font-black text-[var(--text-secondary)]">{formatCurrency(gst)}</span></div>
                <div className="flex justify-between text-[10px]"><span className="font-bold text-[var(--text-muted)] uppercase tracking-widest">Network fee</span><span className="font-black text-emerald-500 uppercase tracking-widest">FREE</span></div>
                <div className="border-t border-[var(--glass-border)] pt-4 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-color)]">Final Payable</span>
                  <span className="text-lg font-black text-[var(--color-accent)] purple-glow">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <button onClick={() => setShowCheckoutModal(true)} className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-[10px] uppercase tracking-[0.15em] transition-all shadow-[0_0_20px_rgba(139,92,246,0.15)] hover:shadow-[0_0_35px_rgba(168,85,247,0.3)]">
                Proceed To Buy
              </button>

              <div className="flex items-center gap-2 bg-[var(--glass-input-bg)] p-3 rounded-xl border border-[var(--glass-border)]">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span className="text-[7.5px] font-black uppercase tracking-widest text-[var(--text-muted)] leading-normal">Secure iMart payment gateway is isolated from recharge, wallet topup, and NexGate rails</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {orders.length > 0 && (
        <section className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-[var(--color-accent)]" />
            <h2 className="text-xs font-black uppercase tracking-widest text-[var(--text-color)]">Order History & Invoices</h2>
          </div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {orders.slice(0, 6).map((order) => {
              const totals = getOrderTotals(order);
              return (
                <div key={order.id} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-card-bg)] p-4 space-y-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-color)]">Order #{order.id}</p>
                      <p className="text-[8px] uppercase tracking-widest text-[var(--text-muted)]">{new Date(order.createdAt).toLocaleString()}</p>
                    </div>
                    <span className="h-fit px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest">{order.paymentStatus}</span>
                  </div>
                  <div className="text-[9px] text-[var(--text-secondary)] space-y-1">
                    <div className="flex justify-between"><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
                    <div className="flex justify-between"><span>GST 18%</span><strong>{formatCurrency(totals.gst)}</strong></div>
                    <div className="flex justify-between text-[var(--text-color)]"><span>Final</span><strong>{formatCurrency(totals.total)}</strong></div>
                  </div>
                  <button onClick={() => setInvoiceOrder(order)} className="w-full py-2.5 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest text-[var(--color-accent)] flex items-center justify-center gap-2">
                    <ReceiptText className="w-3.5 h-3.5" /> View Invoice
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-modal p-6 rounded-3xl max-w-md w-full space-y-6 shadow-[var(--shadow-medium)]">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[var(--color-accent)]">
                <BadgeIndianRupee className="w-5 h-5" />
                <span className="text-[10px] font-black uppercase tracking-widest">GST Checkout Review</span>
              </div>
              <h2 className="text-base font-black text-[var(--text-color)] uppercase tracking-tight">Confirm iMart Billing</h2>
              <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider">18% GST applies only to ecommerce orders</p>
            </div>

            <div className="space-y-3 rounded-2xl bg-[var(--glass-input-bg)] border border-[var(--glass-border)] p-4">
              <div className="flex justify-between text-[10px] text-[var(--text-secondary)]"><span>Product subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              <div className="flex justify-between text-[10px] text-[var(--text-secondary)]"><span>GST 18%</span><strong>{formatCurrency(gst)}</strong></div>
              <div className="flex justify-between text-sm text-[var(--text-color)] border-t border-[var(--glass-border)] pt-3"><span className="font-black uppercase tracking-widest">Payable</span><strong>{formatCurrency(grandTotal)}</strong></div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-3 border border-[var(--glass-border)] bg-[var(--glass-button-bg)] text-[var(--text-color)] rounded-xl text-[9px] font-black uppercase tracking-widest">Cancel</button>
              <button onClick={openPaymentGateway} className="flex-1 py-3 bg-[var(--color-accent)] hover:opacity-90 text-white rounded-xl text-[9px] font-black uppercase tracking-widest">Pay Now</button>
            </div>
          </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div ref={paymentRef} className="glass-modal border border-[var(--color-accent)]/25 p-6 rounded-3xl max-w-lg w-full space-y-6 shadow-[var(--shadow-medium)] relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none neural-grid" />
            <div className="flex justify-between items-start border-b border-[var(--glass-border)] pb-4 relative z-10">
              <div>
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-[var(--color-accent)]">iMart Secure Payment Gateway</p>
                <h3 className="text-sm font-black text-[var(--text-color)] uppercase tracking-tight">Payment Terminal</h3>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">Amount Due</span>
                <span className="text-base font-black text-[var(--color-accent)]">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {paymentStatus === "IDLE" && (
              <div className="space-y-4 relative z-10">
                <div className="grid grid-cols-2 gap-3">
                  {paymentOptions.map((option) => {
                    const Icon = option.icon;
                    const active = paymentMethod === option.id;
                    return (
                      <button key={option.id} onClick={() => setPaymentMethod(option.id)} className={`p-4 rounded-2xl border text-left transition-all ${active ? "border-[var(--color-accent)] bg-[var(--color-primary-glow)] shadow-[0_0_18px_rgba(139,92,246,0.15)]" : "border-[var(--glass-border)] bg-[var(--glass-card-bg)] hover:border-[var(--glass-border-hover)]"}`}>
                        <Icon className={`w-5 h-5 mb-3 ${active ? "text-[var(--color-accent)]" : "text-[var(--text-secondary)]"}`} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-color)]">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button onClick={runSecurePayment} disabled={checkoutLoading} className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Authorize Payment
                </button>
              </div>
            )}

            {paymentStatus === "PROCESSING" && (
              <div className="bg-[var(--glass-input-bg)] border border-[var(--glass-border)] p-8 rounded-2xl text-center space-y-4 relative z-10">
                <div className="mx-auto w-16 h-16 rounded-full border-2 border-[var(--color-accent)]/20 border-t-[var(--color-accent)] animate-spin flex items-center justify-center">
                  <Loader className="w-6 h-6 text-[var(--color-accent)]" />
                </div>
                <h4 className="text-xs font-black text-[var(--text-color)] uppercase tracking-widest">Processing Payment</h4>
                <p className="text-[8px] text-[var(--text-muted)] uppercase tracking-widest leading-normal">{paymentMessage}</p>
              </div>
            )}

            {paymentStatus === "SUCCESS" && (
              <div className="bg-[var(--glass-input-bg)] border border-emerald-500/20 p-6 rounded-2xl text-center space-y-4 relative z-10">
                <div className="mx-auto w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="text-xs font-black text-[var(--text-color)] uppercase tracking-widest">Payment Successful</h4>
                <p className="text-[8.5px] text-[var(--text-secondary)] uppercase tracking-widest leading-relaxed">{paymentMessage}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setInvoiceOrder(latestOrder)} className="py-3 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest text-[var(--color-accent)] flex items-center justify-center gap-2">
                    <ReceiptText className="w-3.5 h-3.5" /> Invoice
                  </button>
                  <button onClick={() => setShowPaymentModal(false)} className="py-3 rounded-xl bg-[var(--color-accent)] text-white text-[9px] font-black uppercase tracking-widest">Done</button>
                </div>
              </div>
            )}

            {paymentStatus === "FAILED" && (
              <div className="bg-[var(--glass-input-bg)] border border-red-500/20 p-6 rounded-2xl text-center space-y-4 relative z-10">
                <div className="mx-auto w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                  <XCircle className="w-8 h-8 text-red-500" />
                </div>
                <h4 className="text-xs font-black text-[var(--text-color)] uppercase tracking-widest">Payment Failed</h4>
                <p className="text-[8.5px] text-[var(--text-secondary)] uppercase tracking-widest leading-relaxed">{paymentMessage}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setPaymentStatus("IDLE")} className="py-3 rounded-xl bg-[var(--color-accent)] text-white text-[9px] font-black uppercase tracking-widest">Try Again</button>
                  <button onClick={() => setShowPaymentModal(false)} className="py-3 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest text-[var(--text-color)]">Keep Cart</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {invoiceOrder && <InvoiceModal order={invoiceOrder} onClose={() => setInvoiceOrder(null)} />}
    </div>
  );
};

export default Wishlist;
