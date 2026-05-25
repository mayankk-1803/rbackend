import React, { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import { toast } from "react-hot-toast";
import {
  Calendar,
  ClipboardList,
  Download,
  Mail,
  Phone,
  Printer,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  User,
  X
} from "lucide-react";
import gsap from "gsap";
import { format } from "date-fns";

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

export const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [invoiceOrder, setInvoiceOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef(null);
  const invoiceRef = useRef(null);

  const fetchOrders = async () => {
    if (!localStorage.getItem("dizipay_admin_token")) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get("/imart/admin/orders");
      if (res.data?.success) setOrders(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      toast.error("Failed to load customer orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter ? order.status === statusFilter : true;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      String(order.id).includes(searchQuery) ||
      (order.user?.name || "").toLowerCase().includes(query) ||
      (order.user?.phone || "").toLowerCase().includes(query) ||
      (order.gatewayRef || "").toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  useEffect(() => {
    if (loading || filteredOrders.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(".order-row", { opacity: 0, x: -15 }, { opacity: 1, x: 0, stagger: 0.03, duration: 0.4, ease: "power2.out" });
    }, containerRef);
    return () => ctx.revert();
  }, [loading, statusFilter, searchQuery, orders]);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "SUCCESS":
      case "PAID":
      case "DELIVERED":
        return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      case "PROCESSING":
      case "SHIPPED":
        return "bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 shadow-[0_0_10px_var(--color-primary-glow)]";
      case "PENDING":
        return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "FAILED":
      case "CANCELLED":
        return "bg-rose-500/10 text-rose-500 border border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-500 border border-slate-500/20";
    }
  };

  const handleStatusUpdate = async (id, newStatus) => {
    try {
      setUpdatingId(id);
      const res = await api.put(`/imart/admin/orders/${id}/status`, { status: newStatus });
      if (res.data?.success) {
        toast.success(`Order status updated to ${newStatus}`);
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status: newStatus } : o)));
        if (selectedOrder?.id === id) setSelectedOrder((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  };

  const downloadInvoice = async () => {
    if (!invoiceRef.current || !invoiceOrder) return;
    const html2pdf = (await import("html2pdf.js")).default;
    const invoiceId = invoiceOrder.invoiceId || `IMART-${String(invoiceOrder.id).padStart(6, "0")}`;
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
    if (!invoiceRef.current || !invoiceOrder) return;
    const invoiceId = invoiceOrder.invoiceId || `IMART-${String(invoiceOrder.id).padStart(6, "0")}`;
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
    <div ref={containerRef} className="space-y-6 min-h-screen pb-12">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--text-color)] tracking-tight uppercase italic flex items-center gap-2">
            <ClipboardList className="w-8 h-8 text-[var(--color-primary)] drop-shadow-[0_0_8px_var(--color-primary-glow)]" />
            iMart <span className="text-[var(--color-primary)] cyan-glow">Orders</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] uppercase tracking-widest font-black mt-1">
            GST billing, invoices, and isolated fake gateway references
          </p>
        </div>

        <button onClick={fetchOrders} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border)] text-xs font-black uppercase tracking-widest text-[var(--text-color)] border border-[var(--glass-border)] transition-all cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-[var(--color-accent)]" : ""}`} />
          Refresh Registry
        </button>
      </header>

      <div className="p-4 md:p-6 rounded-2xl bg-[var(--glass-card-bg)] border border-[var(--glass-border)] flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] group-focus-within:text-[var(--color-primary)] transition-colors" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} type="text" placeholder="Search by order, customer, phone, or gateway ref..." className="w-full pl-12 pr-6 py-2.5 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] focus:border-[var(--color-primary)] rounded-xl text-xs font-black uppercase tracking-widest text-[var(--text-color)] outline-none focus:ring-4 focus:ring-[var(--color-primary)]/10" />
        </div>

        <div className="flex items-center gap-2 bg-[var(--glass-input-bg)] border border-[var(--glass-border)] rounded-xl px-4 py-2 w-full md:w-auto">
          <Tag className="w-4 h-4 text-[var(--text-secondary)]" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-xs font-black uppercase tracking-widest text-[var(--text-color)] outline-none cursor-pointer w-full md:w-44">
            <option value="" className="bg-[var(--glass-modal-bg)]">ALL STATUSES</option>
            <option value="PENDING" className="bg-[var(--glass-modal-bg)]">PENDING</option>
            <option value="PROCESSING" className="bg-[var(--glass-modal-bg)]">PROCESSING</option>
            <option value="SHIPPED" className="bg-[var(--glass-modal-bg)]">SHIPPED</option>
            <option value="DELIVERED" className="bg-[var(--glass-modal-bg)]">DELIVERED</option>
            <option value="CANCELLED" className="bg-[var(--glass-modal-bg)]">CANCELLED</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-card-bg)] overflow-hidden shadow-[var(--glass-shadow)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-[var(--glass-border)] bg-[var(--glass-button-bg)]">
                {["Order ID", "Customer", "Subtotal", "GST 18%", "Final Amount", "Payment", "Gateway Ref", "Fulfillment", "Date & Time", "Actions"].map((head) => (
                  <th key={head} className="p-4 text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)] last:text-right">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [1, 2, 3].map((n) => (
                  <tr key={n} className="border-b border-[var(--glass-border)]">
                    <td colSpan="10" className="p-6 text-center"><div className="h-6 w-full shimmer-element rounded-lg" /></td>
                  </tr>
                ))
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="10" className="p-16 text-center">
                    <ClipboardList className="w-12 h-12 text-[var(--text-secondary)] opacity-30 mx-auto mb-3" />
                    <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-color)]">No matching orders found</h3>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const totals = getOrderTotals(order);
                  return (
                    <tr key={order.id} className="order-row border-b border-[var(--glass-border)] hover:bg-[var(--glass-button-bg)] transition-colors duration-150">
                      <td className="p-4 text-xs font-mono font-black text-[var(--text-color)]">#{order.id}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black uppercase tracking-tight text-[var(--text-color)]">{order.user?.name}</span>
                          <span className="text-[10px] text-[var(--text-secondary)] font-mono">{order.user?.phone}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs font-black text-[var(--text-color)] font-mono">{formatCurrency(totals.subtotal)}</td>
                      <td className="p-4 text-xs font-black text-[var(--text-color)] font-mono">{formatCurrency(totals.gst)}</td>
                      <td className="p-4 text-xs font-black text-emerald-500 font-mono">{formatCurrency(totals.total)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${getStatusBadgeClass(order.paymentStatus)}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="p-4 text-[10px] text-[var(--text-secondary)] font-mono max-w-[150px] truncate">{order.gatewayRef || order.payment?.idempotencyKey || "N/A"}</td>
                      <td className="p-4">
                        <select value={order.status} disabled={updatingId === order.id} onChange={(e) => handleStatusUpdate(order.id, e.target.value)} className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest outline-none cursor-pointer border ${getStatusBadgeClass(order.status)}`}>
                          {["PENDING", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((status) => (
                            <option key={status} value={status} className="bg-[var(--glass-modal-bg)] text-[var(--text-color)]">{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4 text-xs text-[var(--text-secondary)]">{format(new Date(order.createdAt), "dd MMM yyyy HH:mm")}</td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setInvoiceOrder(order)} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 text-[9px] font-black uppercase tracking-widest text-emerald-500 border border-emerald-500/20 cursor-pointer transition-all">Invoice</button>
                          <button onClick={() => { setSelectedOrder(order); setModalOpen(true); }} className="px-3 py-1.5 rounded-lg bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest text-[var(--color-accent)] border border-[var(--glass-border)] cursor-pointer transition-all">Details</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-[var(--glass-modal-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)] p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)]" />
            <div className="flex justify-between items-center mb-6 border-b border-[var(--glass-border)] pb-4">
              <div>
                <h2 className="text-lg font-black uppercase tracking-tight text-[var(--text-color)] flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[var(--color-accent)] animate-pulse" /> Order #{selectedOrder.id} Details
                </h2>
                <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-wider font-mono mt-0.5">
                  Gateway: {selectedOrder.gatewayRef || selectedOrder.payment?.idempotencyKey || "N/A"}
                </p>
              </div>
              <button onClick={() => { setSelectedOrder(null); setModalOpen(false); }} className="p-1.5 rounded-lg bg-[var(--glass-button-bg)] hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-all cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <section className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-primary)] flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Customer</h3>
                  <div className="p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-button-bg)] space-y-2">
                    <p className="text-xs text-[var(--text-color)] font-black uppercase tracking-tight">{selectedOrder.user?.name}</p>
                    <p className="text-xs text-[var(--text-color)] font-black tracking-tight flex items-center gap-2"><Phone className="w-3 h-3 text-[var(--text-secondary)]" /> {selectedOrder.user?.phone}</p>
                    <p className="text-xs text-[var(--text-color)] font-black tracking-tight flex items-center gap-2"><Mail className="w-3 h-3 text-[var(--text-secondary)]" /> {selectedOrder.user?.email}</p>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-primary)] flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Payment Metadata</h3>
                  <div className="p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-button-bg)] space-y-2">
                    <p className="text-[10px] text-[var(--text-color)] font-black uppercase tracking-tight">Invoice: {selectedOrder.invoiceId || "N/A"}</p>
                    <p className="text-[10px] text-[var(--text-color)] font-black uppercase tracking-tight">Method: {selectedOrder.paymentMethod || "N/A"}</p>
                    <p className="text-[10px] text-[var(--text-color)] font-black uppercase tracking-tight">Created: {format(new Date(selectedOrder.createdAt), "dd MMM yyyy HH:mm:ss")}</p>
                  </div>
                </section>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-[var(--color-primary)] flex items-center gap-1.5"><ShoppingCart className="w-3.5 h-3.5" /> Purchased Items</h3>
                <div className="p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-button-bg)] space-y-3 max-h-56 overflow-y-auto">
                  {selectedOrder.items.map((item) => (
                    <div key={item.id} className="flex justify-between items-center border-b border-[var(--glass-border)] pb-2 last:border-b-0 last:pb-0">
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight text-[var(--text-color)] leading-tight">{item.product?.name}</p>
                        <p className="text-[9px] text-[var(--text-secondary)]">Qty: {item.quantity} x {formatCurrency(item.price)}</p>
                      </div>
                      <span className="text-xs font-black text-[var(--text-color)] font-mono">{formatCurrency(Number(item.price) * Number(item.quantity || 1))}</span>
                    </div>
                  ))}
                </div>

                {(() => {
                  const totals = getOrderTotals(selectedOrder);
                  return (
                    <div className="p-4 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-button-bg)] space-y-2">
                      <div className="flex justify-between text-[10px] text-[var(--text-secondary)]"><span>Subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
                      <div className="flex justify-between text-[10px] text-[var(--text-secondary)]"><span>GST 18%</span><strong>{formatCurrency(totals.gst)}</strong></div>
                      <div className="flex justify-between text-sm text-emerald-500 border-t border-[var(--glass-border)] pt-2"><span className="font-black uppercase tracking-widest">Final</span><strong>{formatCurrency(totals.total)}</strong></div>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-[var(--glass-border)] flex flex-col sm:flex-row gap-4 items-center justify-between">
              <button onClick={() => setInvoiceOrder(selectedOrder)} className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest flex items-center gap-2">
                <ReceiptText className="w-3.5 h-3.5" /> Open Invoice
              </button>
              <div className="flex gap-2 w-full sm:w-auto">
                {["PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"].map((status) => (
                  <button key={status} disabled={selectedOrder.status === status} onClick={() => handleStatusUpdate(selectedOrder.id, status)} className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all cursor-pointer ${selectedOrder.status === status ? "bg-[var(--glass-button-bg)] text-[var(--text-secondary)] border-[var(--glass-border)]" : "bg-[var(--glass-card-bg)] hover:bg-[var(--glass-border)] border-[var(--glass-border)] text-[var(--text-color)]"}`}>
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {invoiceOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-[var(--glass-modal-bg)] border border-[var(--glass-border)] shadow-[var(--glass-shadow)] p-6">
            <div className="flex flex-col sm:flex-row justify-between gap-3 mb-5">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--color-accent)]">Admin GST Invoice</p>
                <h2 className="text-lg font-black uppercase tracking-tight text-[var(--text-color)]">{invoiceOrder.invoiceId || `IMART-${String(invoiceOrder.id).padStart(6, "0")}`}</h2>
              </div>
              <div className="flex gap-2">
                <button onClick={downloadInvoice} className="px-3 py-2 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest text-[var(--text-color)] flex items-center gap-2"><Download className="w-3.5 h-3.5" /> Download</button>
                <button onClick={printInvoice} className="px-3 py-2 rounded-xl bg-[var(--glass-button-bg)] border border-[var(--glass-border)] text-[9px] font-black uppercase tracking-widest text-[var(--text-color)] flex items-center gap-2"><Printer className="w-3.5 h-3.5" /> Print</button>
                <button onClick={() => setInvoiceOrder(null)} className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-[9px] font-black uppercase tracking-widest text-red-500">Close</button>
              </div>
            </div>

            <div ref={invoiceRef} className="bg-white text-slate-950 rounded-2xl p-6 space-y-6">
              <div className="flex justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                  <h1 className="text-2xl font-black tracking-tight">DiziPay iMart</h1>
                  <p className="text-xs text-slate-500 uppercase tracking-widest">Tax invoice for ecommerce order</p>
                </div>
                <div className="text-right text-xs">
                  <p><strong>Invoice ID:</strong> {invoiceOrder.invoiceId || `IMART-${String(invoiceOrder.id).padStart(6, "0")}`}</p>
                  <p><strong>Order ID:</strong> #{invoiceOrder.id}</p>
                  <p><strong>Date:</strong> {new Date(invoiceOrder.createdAt).toLocaleString()}</p>
                  <p><strong>Status:</strong> {invoiceOrder.paymentStatus}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-black uppercase tracking-widest text-slate-500">Customer</p>
                  <p className="font-bold">{invoiceOrder.user?.name || "Customer"}</p>
                  <p>{invoiceOrder.user?.email || "Email not available"}</p>
                  <p>{invoiceOrder.user?.phone || "Phone not available"}</p>
                </div>
                <div className="sm:text-right">
                  <p className="font-black uppercase tracking-widest text-slate-500">Payment</p>
                  <p><strong>Method:</strong> {invoiceOrder.paymentMethod || "FAKE IMART"}</p>
                  <p><strong>Gateway Ref:</strong> {invoiceOrder.gatewayRef || "N/A"}</p>
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
                  {(invoiceOrder.items || []).map((item) => (
                    <tr key={item.id} className="border-b border-slate-200">
                      <td className="p-3 font-semibold">{item.product?.name || "iMart Product"}</td>
                      <td className="p-3 text-right">{item.quantity}</td>
                      <td className="p-3 text-right">{formatCurrency(item.price)}</td>
                      <td className="p-3 text-right">{formatCurrency(Number(item.price) * Number(item.quantity || 1))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(() => {
                const totals = getOrderTotals(invoiceOrder);
                return (
                  <div className="ml-auto max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between"><span>Product subtotal</span><strong>{formatCurrency(totals.subtotal)}</strong></div>
                    <div className="flex justify-between"><span>GST 18%</span><strong>{formatCurrency(totals.gst)}</strong></div>
                    <div className="flex justify-between border-t border-slate-300 pt-3 total"><span>Final payable</span><strong>{formatCurrency(totals.total)}</strong></div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
