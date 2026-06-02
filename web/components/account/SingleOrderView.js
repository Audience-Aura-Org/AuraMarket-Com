"use client";

import { useState, useEffect } from 'react';
import {
  Package, ChevronLeft, MapPin,
  ShoppingBag, ShieldCheck, Truck, CheckCircle2,
  AlertTriangle, Loader2, XCircle, Star,
  CreditCard, Clock, Share2,
  Printer, Scale, Phone, Layers,
  Fingerprint, History, Zap, User
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import socketService from '@/services/socket';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function SingleOrderView({ orderId, onBack }) {
  const [order, setOrder] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [escrow, setEscrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputeData, setDisputeData] = useState({ reason: 'item_not_received', description: '' });
  const [disputeLoading, setDisputeLoading] = useState(false);

  const [reviewModal, setReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '', product_id: null });
  const [reviewLoading, setReviewLoading] = useState(false);

  const { user } = useAuthStore();

  const fetchOrderManifest = async () => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      if (res.data.success) {
        setOrder(res.data.data.order);
        setShipments(res.data.data.shipments || []);
        setEscrow(res.data.data.escrow || null);
      }
    } catch (err) {
      toast.error("Failed to load order manifest.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async () => {
    const toastId = toast.loading('Generating invoice PDF...');
    try {
      const response = await api.get(`/orders/${orderId}/invoice`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${orderId}.pdf`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1500);
      toast.success('Invoice downloaded!', { id: toastId });
    } catch (err) {
      toast.error('Failed to download invoice.', { id: toastId });
    }
  };

  const handleShareInvoice = async () => {
    const toastId = toast.loading('Preparing invoice...');
    try {
      const response = await api.get(`/orders/${orderId}/invoice`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const file = new File([blob], `invoice-${orderId}.pdf`, { type: 'application/pdf' });

      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: `Auradime invoice #${orderId.slice(-8).toUpperCase()}`,
          text: 'Auradime order invoice',
          files: [file],
        });
        toast.success('Invoice ready to share.', { id: toastId });
        return;
      }

      await navigator.clipboard?.writeText(window.location.href);
      toast.success('Order link copied.', { id: toastId });
    } catch (err) {
      if (err?.name === 'AbortError') {
        toast.dismiss(toastId);
        return;
      }
      toast.error('Failed to share invoice.', { id: toastId });
    }
  };

  useEffect(() => {
    if (orderId) fetchOrderManifest();
  }, [orderId]);

  useEffect(() => {
    if (!orderId || !user?._id) return;
    const handleUpdate = (payload) => {
      const metaOrderId = payload?.metadata?.order_id?.toString();
      if (metaOrderId && metaOrderId === orderId.toString()) {
        fetchOrderManifest();
        const label = payload?.title || 'Order updated';
        toast.success(label, {
          icon: '⚡',
          style: { borderRadius: '12px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--accent)', fontSize: '11px', fontWeight: 'bold' }
        });
      }
    };
    socketService.on('notification', handleUpdate);
    socketService.on('order_update', handleUpdate);
    return () => {
      socketService.off('notification', handleUpdate);
      socketService.off('order_update', handleUpdate);
    };
  }, [orderId, user?._id]);

  const handleRaiseDispute = async (e) => {
    e.preventDefault();
    setDisputeLoading(true);
    try {
      const res = await api.post('/disputes', { order_id: orderId, reason: disputeData.reason, description: disputeData.description });
      if (res.data.success) {
        toast.success("Dispute formal protocol initiated.");
        setDisputeModal(false);
        fetchOrderManifest();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Protocol handshake failed.");
    } finally {
      setDisputeLoading(false);
    }
  };

  const applyManifestPayload = (data) => {
    if (!data) return;
    if (data.order) setOrder(data.order);
    if (data.shipments) setShipments(data.shipments);
    if (data.escrow !== undefined) setEscrow(data.escrow);
  };

  const handleConfirmDelivery = async () => {
    if (!confirm("Confirm asset arrival? This releases escrowed funds to the vendor node.")) return;
    try {
      const res = await api.post(`/escrow/release/${orderId}`);
      if (res.data.success) {
        toast.success("Funds released. Order finalized.");
        if (res.data.data) applyManifestPayload(res.data.data);
        else fetchOrderManifest();
        // Prompt for review if there are products
        if (order.products?.length > 0) {
          setReviewData({ ...reviewData, product_id: order.products[0].product_id?._id || order.products[0].product_id });
          setReviewModal(true);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Release vector blocked.");
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    const toastId = toast.loading(`Updating protocol to ${newStatus.toUpperCase()}...`);
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { order_status: newStatus });
      if (res.data.success) {
        toast.success(`Protocol updated: ${newStatus.toUpperCase()}`, { id: toastId });
        if (res.data.data) applyManifestPayload(res.data.data);
        else fetchOrderManifest();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Protocol update failed.", { id: toastId });
    }
  };

  const handleVendorConfirmDelivery = async () => {
    if (!confirm("Confirm asset delivery completion? This notifies the customer to finalize the manifest.")) return;
    const toastId = toast.loading('Synchronizing delivery status...');
    try {
      const res = await api.post(`/escrow/confirm-delivery/${orderId}`);
      if (res.data.success) {
        toast.success("Delivery confirmed. Awaiting customer release.", { id: toastId });
        if (res.data.data) applyManifestPayload(res.data.data);
        else fetchOrderManifest();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Delivery confirmation failed.", { id: toastId });
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setReviewLoading(true);
    try {
      const res = await api.post('/reviews', { order_id: orderId, product_id: reviewData.product_id, rating: reviewData.rating, comment: reviewData.comment });
      if (res.data.success) {
        toast.success("Feedback broadcasted to Aura network.");
        setReviewModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Protocol failure.");
    } finally {
      setReviewLoading(false);
    }
  };

  if (loading) return (
    <div className="font-order-detail flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 px-4 py-14 sm:rounded-3xl sm:px-6 sm:py-16">
      <div className="size-11 rounded-full border-2 border-[var(--accent)]/20 border-t-[var(--accent)] animate-spin" />
      <p className="text-[11px] font-semibold tracking-wide text-[var(--text-secondary)]">Loading order…</p>
    </div>
  );

  if (!order) return (
    <div className="font-order-detail flex flex-col items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 px-6 py-16 text-center sm:rounded-3xl sm:px-8 sm:py-20">
      <AlertTriangle className="mb-4 size-11 text-amber-500/80" />
      <h1 className="mb-2 text-xl font-bold tracking-tight text-[var(--text-primary)]">Order not found</h1>
      <p className="mb-6 max-w-sm text-[12px] text-[var(--text-secondary)]">We couldn&apos;t load this order. It may have been removed or you may not have access.</p>
      <button
        type="button"
        onClick={onBack}
        className="rounded-full bg-[var(--accent)] px-8 py-2.5 text-[11px] font-semibold tracking-tight text-white shadow-lg shadow-[var(--accent)]/25 transition hover:opacity-95"
      >
        Back to orders
      </button>
    </div>
  );

  const getStatusConfig = (orderStatus, shipmentStatus) => {
    if (['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(shipmentStatus?.toLowerCase())) {
      const labels = {
        assigned: 'Assigned to Carrier',
        picked_up: 'Picked Up',
        in_transit: 'In Transit',
        out_for_delivery: 'Out for Delivery'
      };
      return { color: 'blue', label: labels[shipmentStatus?.toLowerCase()] || 'In Transit', icon: Truck, step: 3 };
    }

    switch (orderStatus?.toLowerCase()) {
      case 'completed':
      case 'delivered': return { color: 'emerald', label: 'Delivered', icon: CheckCircle2, step: 4 };
      case 'shipped': return { color: 'blue', label: 'In transit', icon: Truck, step: 3 };
      case 'processing': return { color: 'amber', label: 'Processing', icon: Clock, step: 2 };
      case 'placed': return { color: 'indigo', label: 'Placed', icon: Package, step: 1 };
      case 'cancelled':
      case 'refunded': return { color: 'rose', label: 'Ended', icon: XCircle, step: 0 };
      default: return { color: 'indigo', label: orderStatus ? orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1) : 'Unknown', icon: Package, step: 1 };
    }
  };

  const shipment =
    Array.isArray(shipments) && shipments.length > 0
      ? [...shipments].sort(
          (a, b) =>
            new Date(b?.createdAt || b?.created_at || 0) -
            new Date(a?.createdAt || a?.created_at || 0)
        )[0]
      : null;
  const shipmentStatusNorm = (shipment?.status || '').toLowerCase();
  const status = getStatusConfig(order.order_status, shipment?.status);
  const isVendor = user?.role === 'vendor' || user?._id === order?.vendor_id?._id || user?._id === order?.vendor_id;
  /** Match backend `orderUsesLogistics`: partner flag on order OR an actual logistics shipment ticket */
  const isLogisticsOrder = !!(
    order.shipping_method === 'logistics_partner' ||
    order.logistics_company_id ||
    shipment?.logistics_id
  );
  /** Courier has taken over movement — vendor manual ship is blocked / irrelevant */
  const carrierLaunched =
    !!shipment &&
    ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'].includes(shipmentStatusNorm);
  const assignmentTime = shipment?.createdAt || order?.createdAt;
  const hoursSinceAssignment = assignmentTime ? (Date.now() - new Date(assignmentTime).getTime()) / (1000 * 60 * 60) : 0;
  const graceHoursRemaining = Math.max(0, 6 - hoursSinceAssignment);
  const logisticsGraceActive = isLogisticsOrder && hoursSinceAssignment < 6 && !carrierLaunched;
  const isProtectedByGracePeriod = logisticsGraceActive && order.order_status === 'processing';
  const customer = order.customer_id;
  const escrowStatus = escrow?.status || null;
  const isEscrowOrder = !!(
    escrow ||
    order.escrow_enabled ||
    order.payment_method === 'escrow'
  );
  const escrowCanRelease = isEscrowOrder && (!escrowStatus || escrowStatus === 'held' || escrowStatus === 'pending_release');
  const vendorCanMarkDelivered =
    isVendor &&
    order.order_status === 'shipped';
  const vendorCanRequestEscrowRelease =
    isVendor &&
    escrowCanRelease &&
    !vendorCanMarkDelivered &&
    (order.order_status === 'delivered' || order.order_status === 'completed' || shipmentStatusNorm === 'delivered');
  const autoReleaseAt = escrow?.auto_release_at ? new Date(escrow.auto_release_at) : null;
  const autoReleaseLabel = autoReleaseAt && Number.isFinite(autoReleaseAt.getTime())
    ? autoReleaseAt.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  const STEPS = [
    { label: 'Ordered', icon: ShoppingBag },
    { label: 'Verified', icon: ShieldCheck },
    { label: 'Transit', icon: Truck },
    { label: 'Delivered', icon: CheckCircle2 }
  ];

  const toneMap = {
    emerald: {
      pill: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
      glow: 'shadow-emerald-500/10',
      headline: 'text-emerald-600 dark:text-emerald-400'
    },
    blue: {
      pill: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25',
      glow: 'shadow-sky-500/10',
      headline: 'text-sky-600 dark:text-sky-400'
    },
    amber: {
      pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25',
      glow: 'shadow-amber-500/10',
      headline: 'text-amber-700 dark:text-amber-400'
    },
    indigo: {
      pill: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/25',
      glow: 'shadow-indigo-500/10',
      headline: 'text-indigo-600 dark:text-indigo-400'
    },
    rose: {
      pill: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/25',
      glow: 'shadow-rose-500/10',
      headline: 'text-rose-600 dark:text-rose-400'
    }
  };

  const tone = toneMap[status.color] || toneMap.indigo;

  const progressPct =
    status.step <= 0 ? 0 : Math.min(100, Math.max(0, ((status.step - 1) / (STEPS.length - 1)) * 100));

  const sectionTitle = (text) => (
    <div className="mb-4 flex items-center gap-2">
      <span className="h-4 w-0.5 rounded-full bg-[var(--accent)]" aria-hidden />
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)] opacity-80">
        {text}
      </h3>
    </div>
  );

  const cardBase = 'rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 backdrop-blur-sm shadow-sm';
  const paymentMeta = (() => {
    if (order.payment_method === 'pay_on_delivery') {
      return {
        label: 'Pay on delivery',
        detail: 'Payment will be collected at delivery.',
        classes: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400',
      };
    }
    if (order.payment_status === 'paid') {
      return {
        label: 'Paid',
        detail: 'Gateway payment confirmed.',
        classes: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    }
    if (order.payment_status === 'failed') {
      return {
        label: 'Payment failed',
        detail: 'The payment attempt did not complete.',
        classes: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
      };
    }
    return {
      label: 'Payment pending',
      detail: 'Awaiting gateway confirmation.',
      classes: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  })();

  return (
    <div className="font-order-detail flex w-full min-w-0 flex-1 flex-col gap-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-0 sm:gap-8 sm:pb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Top bar */}
      <header className="flex flex-col gap-5 border-b border-[var(--glass-border)] pb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-6 sm:pb-6">
        <div className="min-w-0 space-y-3 sm:space-y-4">
          <button
            type="button"
            onClick={onBack}
            className="group inline-flex min-h-[44px] items-center gap-2 rounded-xl py-2 text-[11px] font-semibold text-[var(--text-secondary)] transition active:opacity-80 sm:min-h-0 sm:py-1.5 sm:hover:text-[var(--text-primary)]"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] transition group-active:border-[var(--accent)]/40 group-active:text-[var(--accent)] sm:size-8 sm:group-hover:border-[var(--accent)]/40 sm:group-hover:text-[var(--accent)]">
              <ChevronLeft className="size-4" />
            </span>
            Back to orders
          </button>

          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)] opacity-60">
              Order detail
            </p>
            <h1 className="mt-1 truncate text-2xl font-bold tracking-tighter text-[var(--text-primary)] sm:text-3xl md:text-4xl">
              #{order._id.slice(-8).toUpperCase()}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[var(--text-secondary)] sm:text-[11px]">
              <Clock className="size-3.5 shrink-0 opacity-60" />
              <span className="break-all">{new Date(order.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </p>
            <div className={`mt-3 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${paymentMeta.classes}`}>
              <CreditCard className="size-3.5 shrink-0" />
              <span className="truncate">{paymentMeta.label}</span>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
          <button
            type="button"
            onClick={handleDownloadInvoice}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-[11px] font-semibold text-[var(--text-primary)] transition active:bg-[var(--accent)]/15 sm:min-h-10 sm:flex-initial sm:px-3.5 sm:hover:border-[var(--accent)]/35 sm:hover:bg-[var(--accent)]/10"
          >
            <Printer className="size-3.5 opacity-70" />
            Invoice
          </button>
          <button
            type="button"
            onClick={handleShareInvoice}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 text-[11px] font-semibold text-[var(--text-primary)] transition active:bg-[var(--accent)]/15 sm:min-h-10 sm:flex-initial sm:px-3.5 sm:hover:border-[var(--accent)]/35 sm:hover:bg-[var(--accent)]/10"
          >
            <Share2 className="size-3.5 opacity-70" />
            Share
          </button>
          <div
            className={`col-span-2 hidden min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 sm:col-span-1 sm:inline-flex ${tone.pill}`}
          >
            <Fingerprint className="size-3.5 shrink-0 opacity-80" />
            <span className="font-mono text-[11px] font-bold tracking-wide">REF · {order._id.slice(-8).toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* Status + actions */}
      <section className={`relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-secondary)]/80 to-[var(--bg-primary)]/40 p-4 shadow-lg sm:rounded-3xl sm:p-6 md:p-8 ${tone.glow}`}>
        <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-[var(--accent)]/[0.06] blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,var(--glass-border)_1px,transparent_0)] [background-size:20px_20px] opacity-[0.35]" />

        <div className="relative flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3 sm:space-y-4">
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${tone.pill}`}>
              <span className={`size-1.5 rounded-full ${status.color === 'emerald' ? 'bg-emerald-500' : status.color === 'blue' ? 'bg-sky-500' : status.color === 'amber' ? 'bg-amber-500' : status.color === 'rose' ? 'bg-rose-500' : 'bg-indigo-500'} animate-pulse`} />
              Current status
            </div>
            <div>
              <p className={`text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl ${tone.headline}`}>{status.label}</p>
              <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-90 sm:text-[12px]">
                Track fulfillment, carrier updates, and settlement from this workspace.
              </p>
              <div className={`mt-4 inline-flex max-w-full items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-semibold tracking-tight ${paymentMeta.classes}`}>
                <CreditCard className="size-4 shrink-0" />
                <span className="truncate">{paymentMeta.detail}</span>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 xs:flex-row xs:flex-wrap sm:w-auto sm:gap-2 lg:max-w-md lg:justify-end">
            {isVendor && order.order_status === 'placed' && logisticsGraceActive && (
              <div className="flex w-full flex-col gap-2 xs:flex-row xs:flex-wrap xs:items-stretch">
                <div className="inline-flex min-h-[48px] w-full flex-1 items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-[11px] font-medium leading-snug text-[var(--text-primary)] xs:min-h-0 sm:py-2.5">
                  <Clock className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                  <span>
                    Logistics priority window — manual &ldquo;Mark shipped&rdquo; unlocks in{' '}
                    <strong className="font-semibold tabular-nums">
                      {graceHoursRemaining >= 1
                        ? `${Math.ceil(graceHoursRemaining)}h`
                        : `${Math.max(1, Math.ceil(graceHoursRemaining * 60))}m`}
                    </strong>
                    . Acknowledge prep below if you&apos;re getting the order ready.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleUpdateStatus('processing')}
                  className="inline-flex min-h-[48px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-primary)] shadow-sm transition active:border-[var(--accent)]/40 xs:w-auto sm:min-h-[44px] sm:py-2.5 sm:hover:border-[var(--accent)]/40"
                >
                  <Package className="size-4" /> Acknowledge prep
                </button>
              </div>
            )}
            {isVendor && order.order_status === 'placed' && !logisticsGraceActive && (
              <button
                type="button"
                onClick={() => handleUpdateStatus('processing')}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md shadow-[var(--accent)]/25 transition active:opacity-90 xs:w-auto sm:min-h-[44px] sm:py-2.5 sm:hover:opacity-95"
              >
                <Zap className="size-4" /> Start processing
              </button>
            )}
            {isVendor && order.order_status === 'processing' && (!isLogisticsOrder || !carrierLaunched) && (
              <button
                type="button"
                onClick={() => handleUpdateStatus('shipped')}
                disabled={isProtectedByGracePeriod}
                className={`inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[11px] font-semibold uppercase tracking-wide transition xs:w-auto sm:min-h-[44px] sm:py-2.5 ${
                  isProtectedByGracePeriod
                    ? 'cursor-not-allowed border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] opacity-50'
                    : 'border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm active:border-[var(--accent)]/40 sm:hover:border-[var(--accent)]/40'
                }`}
              >
                <Truck className="size-4" /> {isProtectedByGracePeriod ? 'Awaiting carrier' : 'Mark shipped'}
              </button>
            )}
            {/* CUSTOMER / ADMIN ACTION: release held escrow, even for older orders already marked finalized. */}
            {!isVendor && escrowCanRelease && (
              <button
                type="button"
                onClick={handleConfirmDelivery}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md shadow-emerald-500/25 transition active:opacity-90 xs:w-auto sm:min-h-[44px] sm:py-2.5 sm:hover:opacity-95"
              >
                <CheckCircle2 className="size-4" /> Release escrow
              </button>
            )}

            {/* VENDOR ACTION: confirm delivery/request customer escrow release, regardless of finalized order status. */}
            {isVendor && vendorCanRequestEscrowRelease && (
              <button
                type="button"
                onClick={handleVendorConfirmDelivery}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md shadow-emerald-500/25 transition active:opacity-90 xs:w-auto sm:min-h-[44px] sm:py-2.5 sm:hover:opacity-95"
              >
                <ShieldCheck className="size-4" /> Request escrow release
              </button>
            )}

            {/* VENDOR ACTION: Mark Delivered (For self-managed/non-logistics shipments) */}
            {vendorCanMarkDelivered && (
              <button
                type="button"
                onClick={handleVendorConfirmDelivery}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-white shadow-md shadow-[var(--accent)]/25 transition active:opacity-90 xs:w-auto sm:min-h-[44px] sm:py-2.5 sm:hover:opacity-95"
              >
                <Package className="size-4" /> Mark as delivered
              </button>
            )}

            <button
              type="button"
              onClick={() => setDisputeModal(true)}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-rose-600 transition active:bg-rose-500 active:text-white xs:w-auto sm:min-h-[44px] sm:py-2.5 dark:text-rose-400 sm:hover:bg-rose-500 sm:hover:text-white"
            >
              <Scale className="size-4" /> Open dispute
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="relative mt-7 border-t border-[var(--glass-border)] pt-6 sm:mt-10 sm:pt-10">
          <div className="absolute left-4 right-4 top-[2.25rem] hidden h-px bg-[var(--glass-border)] sm:block" />
          <div
            className="absolute left-4 top-[2.25rem] hidden h-px bg-[var(--accent)] transition-all duration-700 sm:block"
            style={{ width: `calc(${progressPct}% - 2rem)` }}
          />

          <div className="relative sm:hidden">
            <div className="absolute left-[12.5%] right-[12.5%] top-[1.125rem] h-1 rounded-full bg-[var(--glass-border)]/70" />
            <div
              className="absolute left-[12.5%] top-[1.125rem] h-1 rounded-full bg-[var(--accent)] transition-all duration-700"
              style={{ width: `${progressPct * 0.75}%` }}
            />
            <div className="relative grid grid-cols-4 gap-1">
              {STEPS.map((s, idx) => {
                const isActive = status.step > idx;
                const isCurrent = status.step === idx + 1;
                return (
                  <div key={s.label} className="flex min-w-0 flex-col items-center gap-2 text-center">
                    <div
                      className={`relative z-10 flex size-9 items-center justify-center rounded-xl border transition-all duration-300 ${
                        isActive
                          ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30'
                          : isCurrent
                            ? 'border-[var(--accent)] bg-[var(--bg-primary)] text-[var(--accent)] ring-2 ring-[var(--accent)]/25'
                            : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-60'
                      }`}
                    >
                      <s.icon className="size-4" />
                    </div>
                    <span
                      className={`block w-full truncate text-[9px] font-semibold uppercase leading-none tracking-normal ${
                        isActive || isCurrent ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-50'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative hidden sm:flex sm:justify-between sm:gap-2 md:gap-4">
            {STEPS.map((s, idx) => {
              const isActive = status.step > idx;
              const isCurrent = status.step === idx + 1;
              return (
                <div key={s.label} className="flex min-w-0 flex-col items-center gap-2 text-center sm:gap-3 sm:flex-1">
                  <div
                    className={`relative z-10 flex size-12 items-center justify-center rounded-2xl border transition-all duration-300 ${
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30'
                        : isCurrent
                          ? 'border-[var(--accent)] bg-[var(--bg-primary)] text-[var(--accent)] ring-2 ring-[var(--accent)]/25'
                          : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] opacity-60'
                    }`}
                  >
                    <s.icon className="size-5" />
                  </div>
                  <span
                    className={`max-w-[5.5rem] text-[9px] font-semibold uppercase leading-tight tracking-[0.12em] xs:max-w-none xs:text-[10px] ${
                      isActive || isCurrent ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-50'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-10">
        <div className="order-2 flex min-h-0 flex-col space-y-8 sm:space-y-10 lg:order-1 lg:col-span-8">
          <div>
            {sectionTitle('Shipment activity')}
            <div className={`${cardBase} p-4 sm:p-5 md:p-6`}>
              {shipment && shipment.shipment_logs?.length > 0 ? (
                <ul className="space-y-0">
                  {shipment.shipment_logs.slice().reverse().map((log, lIdx) => (
                    <li key={log._id} className="relative flex gap-3 pb-5 sm:gap-4 sm:pb-6">
                      <div className="flex flex-col items-center">
                        <span className="relative z-[1] mt-1.5 size-2.5 shrink-0 rounded-full border-2 border-[var(--accent)] bg-[var(--bg-primary)]" />
                        {lIdx < shipment.shipment_logs.length - 1 && (
                          <span className="mt-1 min-h-[2.5rem] w-px flex-1 bg-[var(--glass-border)]" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                        <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-2">
                          <h4 className="text-[12px] font-semibold capitalize text-[var(--text-primary)]">
                            {log.status.replace('_', ' ')}
                          </h4>
                          <time className="font-mono text-[10px] text-[var(--text-secondary)] opacity-70 sm:whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                            {new Date(log.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </time>
                        </div>
                        {log.note && (
                          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-85">{log.note}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center py-10 text-center">
                  <History className="mb-3 size-9 text-[var(--text-secondary)] opacity-25" />
                  <p className="text-[12px] font-medium text-[var(--text-secondary)] opacity-60">No carrier updates yet</p>
                </div>
              )}
            </div>
          </div>

          <div>
            {sectionTitle('Line items')}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {order.products.map((item, idx) => (
                <div
                  key={item._id || idx}
                  className={`${cardBase} flex gap-3 p-3 transition active:border-[var(--accent)]/25 sm:p-4 sm:hover:border-[var(--accent)]/25`}
                >
                  <div className="relative size-[52px] shrink-0 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] sm:size-14">
                    <img
                      src={item.image || '/placeholder.png'}
                      className="size-full object-cover"
                      alt=""
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[12px] font-semibold leading-snug text-[var(--text-primary)]">{item.name}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)]">
                      <span className="font-mono text-[var(--accent)]">{(item.price || 0).toLocaleString()} XAF</span>
                      <span className="opacity-40">·</span>
                      <span>Qty {item.quantity}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {order.order_status === 'completed' && !isVendor && (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewData({ ...reviewData, product_id: item.product_id?._id || item.product_id });
                            setReviewModal(true);
                          }}
                          className="min-h-10 rounded-lg bg-[var(--accent)] px-4 py-2 text-[10px] font-semibold text-white shadow-sm transition active:opacity-90 sm:hover:opacity-95"
                        >
                          Review
                        </button>
                      )}
                      <button
                        type="button"
                        className="min-h-10 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] transition active:bg-[var(--bg-primary)] sm:hover:text-[var(--text-primary)]"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="order-1 flex min-h-0 flex-col space-y-4 sm:space-y-6 lg:order-2 lg:col-span-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto lg:self-start">
          <div className={`${cardBase} p-4 sm:p-5`}>
            <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-80">
              <User className="size-3.5 text-[var(--accent)]" /> Customer
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 text-sm font-bold text-[var(--accent)]">
                {customer?.name?.[0] || 'C'}
              </div>
              <div className="min-w-0">
                <h4 className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{customer?.name || 'Customer'}</h4>
                <p className="truncate text-[11px] text-[var(--text-secondary)] opacity-70">{customer?.email || '—'}</p>
              </div>
            </div>
            {(order.shipping_address?.phone || customer?.phone) ? (
              <a
                href={`tel:${String(order.shipping_address?.phone || customer?.phone).replace(/\s/g, '')}`}
                className="mt-4 flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 px-3 py-2.5 transition active:bg-[var(--accent)]/10 sm:min-h-0"
              >
                <Phone className="size-3.5 shrink-0 text-[var(--accent)]" />
                <span className="font-mono text-[11px] tracking-wide text-[var(--text-primary)]">
                  {order.shipping_address?.phone || customer?.phone}
                </span>
              </a>
            ) : (
              <div className="mt-4 flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 px-3 py-2.5 opacity-60 sm:min-h-0">
                <Phone className="size-3.5 shrink-0 text-[var(--accent)]" />
                <span className="font-mono text-[11px] tracking-wide text-[var(--text-primary)]">—</span>
              </div>
            )}
          </div>

          <div className={`${cardBase} p-4 sm:p-5`}>
            <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-80">
              <Truck className="size-3.5 text-[var(--accent)]" /> Carrier
            </h3>
            {shipment && (shipment.logistics_id || shipment.logistics_company_id) ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-4">
                  <h4 className="text-[12px] font-semibold capitalize text-[var(--text-primary)]">
                    {(shipment.logistics_id?.company_name || shipment.logistics_company_id?.company_name || 'Carrier').slice(0, 24)}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-secondary)] opacity-80">
                    <Phone className="size-3 opacity-60" />
                    {shipment.logistics_id?.contact_phone || '—'}
                  </div>
                </div>
                <div className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-[var(--glass-border)] px-3 py-2 sm:min-h-0">
                  <code className="min-w-0 truncate font-mono text-[11px] font-semibold text-[var(--accent)]">
                    {shipment.tracking_code || 'Pending'}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      if (shipment.tracking_code) {
                        navigator.clipboard.writeText(shipment.tracking_code);
                        toast.success('Copied');
                      }
                    }}
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--text-secondary)] transition active:bg-[var(--bg-secondary)] active:text-[var(--accent)] sm:size-9 sm:hover:text-[var(--accent)]"
                    aria-label="Copy tracking code"
                  >
                    <Layers className="size-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 px-4 py-6 text-center">
                <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">No carrier assigned yet</p>
              </div>
            )}
          </div>

          <div className={`${cardBase} p-4 sm:p-5`}>
            <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-80">
              <CreditCard className="size-3.5 text-[var(--accent)]" /> Settlement
            </h3>
            <div className="space-y-2 border-b border-[var(--glass-border)] pb-4 text-[11px]">
              <div className="flex justify-between gap-4 font-medium text-[var(--text-secondary)] opacity-80">
                <span>Subtotal</span>
                <span className="font-mono">{(order.total_amount - (order.shipping_fee || 0)).toLocaleString()} XAF</span>
              </div>
              <div className="flex justify-between gap-4 font-medium text-[var(--text-secondary)] opacity-80">
                <span>Shipping</span>
                <span className="font-mono">{(order.shipping_fee || 0).toLocaleString()} XAF</span>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">Total</span>
              <p className="text-xl font-bold tabular-nums tracking-tight text-[var(--text-primary)]">
                {order.total_amount.toLocaleString()} <span className="text-[11px] font-medium opacity-40">XAF</span>
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-3.5" />
                {escrowStatus === 'released' ? 'Escrow released' : 'Escrow tracked'}
              </div>
              {escrowCanRelease && (
                <p className="mt-2 text-[10px] font-medium leading-relaxed text-[var(--text-secondary)] opacity-70">
                  Auto-release runs 6 hours after delivery if no dispute is opened
                  {autoReleaseLabel ? `: ${autoReleaseLabel}` : '.'}
                </p>
              )}
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
                <div className="h-full w-full rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>

          <div className={`${cardBase} p-4 sm:p-5`}>
            <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-80">
              <MapPin className="size-3.5 text-[var(--accent)]" /> Ship to
            </h3>
            <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-3 sm:p-4">
              <h4 className="text-[13px] font-semibold text-[var(--text-primary)]">
                {order.shipping_address?.full_name || customer?.name || 'Recipient'}
              </h4>
              <div className="mt-3 flex flex-col gap-2 text-[11px] leading-relaxed text-[var(--text-secondary)]">
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)] opacity-80" />
                  <span>
                    {[
                      order.shipping_address?.street || order.shipping_address?.address,
                      order.shipping_address?.quartier,
                      order.shipping_address?.city,
                      order.shipping_address?.region,
                      order.shipping_address?.zipCode || order.shipping_address?.zip
                    ]
                      .filter(Boolean)
                      .join(', ') || 'Address on file'}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <Phone className="size-3.5 shrink-0 text-[var(--accent)] opacity-70" />
                  {order.shipping_address?.phone || customer?.phone || '—'}
                </div>
              </div>
            </div>

            {order.delivery_description && (
              <div className="mt-4 border-t border-[var(--glass-border)] pt-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-70">
                  Delivery notes
                </p>
                <p className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-[11px] italic leading-relaxed text-indigo-700 dark:text-indigo-300">
                  &ldquo;{order.delivery_description}&rdquo;
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <AnimatePresence>
        {disputeModal && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDisputeModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: 14, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 14, scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:p-8"
            >
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Open dispute</h2>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Describe the issue so our team can review.</p>
              <form onSubmit={handleRaiseDispute} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Reason</label>
                  <select
                    value={disputeData.reason}
                    onChange={(e) => setDisputeData({ ...disputeData, reason: e.target.value })}
                    className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] font-medium outline-none focus:border-[var(--accent)]"
                  >
                    <option value="item_not_received">Asset not manifested</option>
                    <option value="item_not_as_described">Registry mismatch</option>
                    <option value="faulty_item">Structural defects</option>
                    <option value="other">Protocol violation</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Details</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Document violation..."
                    value={disputeData.description}
                    onChange={(e) => setDisputeData({ ...disputeData, description: e.target.value })}
                    className="w-full resize-none rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisputeModal(false)}
                    className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] py-3 text-[12px] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={disputeLoading}
                    className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 text-[12px] font-semibold text-white disabled:opacity-60"
                  >
                    {disputeLoading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Submit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reviewModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-[var(--glass-border)] border-b-0 bg-[var(--bg-primary)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:border-b sm:p-8"
            >
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Leave a review</h2>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Share feedback for this product.</p>
              <form onSubmit={handleSubmitReview} className="mt-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setReviewData({ ...reviewData, rating: s })}
                        className={`flex size-11 items-center justify-center rounded-xl border transition-all ${
                          reviewData.rating >= s
                            ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                            : 'border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                        }`}
                      >
                        <Star className="size-4" />
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Comment</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="How was the asset?"
                    value={reviewData.comment}
                    onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                    className="w-full resize-none rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-3 text-[12px] outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReviewModal(false)}
                    className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] py-3 text-[12px] font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={reviewLoading}
                    className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-[12px] font-semibold text-white disabled:opacity-60"
                  >
                    {reviewLoading ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Submit
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
