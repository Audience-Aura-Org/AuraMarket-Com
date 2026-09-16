"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, ChevronLeft, MapPin,
  ShoppingBag, ShieldCheck, Truck, CheckCircle2,
  AlertTriangle, Loader2, XCircle, Star,
  CreditCard, Clock, Share2, Timer,
  Printer, Scale, Phone, Layers,
  Fingerprint, History, Zap, User, MessageCircle,
  RotateCcw, AlertCircle, ArrowRight, Send,
} from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import socketService from '@/services/socket';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { formatVariantLabel } from '@/utils/variants';

// ── Food-order helpers (mirrors kitchen page) ────────────────────────────────
const FOOD_STATUS_LABELS = {
  pending_acceptance: 'Awaiting Acceptance',
  preparing:          'Preparing',
  ready:              'Ready for Pickup',
  rider_arrived:      'Rider Arrived',
  picked_up:          'Picked Up',
  delivered:          'Delivered',
};
const FOOD_OVERRIDE_MS = 15 * 60_000; // 15 minutes

function getFoodReadyElapsed(order) {
  if (order?.food_status !== 'ready') return null;
  const log = [...(order.status_logs || [])].reverse().find(l => l.status === 'ready');
  return log ? Date.now() - new Date(log.timestamp).getTime() : null;
}

function isFoodLogisticsOverdue(order) {
  if (order?.shipping_method !== 'logistics_partner') return false;
  const elapsed = getFoodReadyElapsed(order);
  return elapsed !== null && elapsed >= FOOD_OVERRIDE_MS;
}
// ── ETA Countdown helpers ──────────────────────────────────────────────────────
function countdown(eta) {
  if (!eta) return null;
  const diff = new Date(eta).getTime() - Date.now();
  if (diff <= 0) return { text: 'Overdue', overdue: true };
  const totalSec = Math.floor(diff / 1000);
  const s = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const min = totalMin % 60;
  const totalHr = Math.floor(totalMin / 60);
  const hr = totalHr % 24;
  const d = Math.floor(totalHr / 24);
  if (d > 0) return { text: `${d}d ${hr}h ${min}m`, overdue: false };
  if (hr > 0) return { text: `${hr}h ${min}m ${s.toString().padStart(2, '0')}s`, overdue: false };
  if (min > 0) return { text: `${min}m ${s.toString().padStart(2, '0')}s`, overdue: false };
  return { text: `${s}s`, overdue: false };
}

function useLiveClock(active) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [active]);
}
// ─────────────────────────────────────────────────────────────────────────────

export default function SingleOrderView({ orderId, onBack }) {
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [escrow, setEscrow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [disputeModal, setDisputeModal] = useState(false);
  const [disputeData, setDisputeData] = useState({ reason: 'item_not_received', description: '' });
  const [disputeLoading, setDisputeLoading] = useState(false);

  const [reviewModal, setReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '', product_id: null, order_id: null, product_name: '' });
  const [reviewLoading, setReviewLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);

  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderResult, setReorderResult] = useState(null);

  // Order message thread state
  const [orderMessages, setOrderMessages] = useState([]);
  const [orderMsgText, setOrderMsgText] = useState('');
  const [sendingOrderMsg, setSendingOrderMsg] = useState(false);
  const [loadingOrderMsgs, setLoadingOrderMsgs] = useState(false);
  const orderMsgEndRef = useRef(null);

  const { user } = useAuthStore();
  const { openChat } = useChat();

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

  // Fetch order messages
  useEffect(() => {
    if (!orderId || !user?._id) return;
    let cancelled = false;
    const fetchOrderMsgs = async () => {
      setLoadingOrderMsgs(true);
      try {
        const res = await api.get(`/messages/order/${orderId}`);
        if (!cancelled && res.data?.success) {
          setOrderMessages(res.data.data?.messages || []);
        }
      } catch { /* ignore auth errors for non-parties */ }
      if (!cancelled) setLoadingOrderMsgs(false);
    };
    fetchOrderMsgs();
    const interval = setInterval(fetchOrderMsgs, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [orderId, user?._id]);

  // Auto-scroll order messages
  useEffect(() => {
    orderMsgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orderMessages]);

  const handleSendOrderMsg = async (e) => {
    e.preventDefault();
    if (!orderMsgText.trim() || !orderId || sendingOrderMsg) return;
    setSendingOrderMsg(true);
    try {
      const res = await api.post(`/messages/order/${orderId}`, { text: orderMsgText.trim() });
      if (res.data?.success) {
        setOrderMessages(prev => [...prev, res.data.data.message]);
        setOrderMsgText('');
      }
    } catch (err) {
      toast.error('Failed to send message');
    }
    setSendingOrderMsg(false);
  };

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

  // ── ETA countdown (must be called before any early returns to satisfy React hooks rules) ──
  const _latestShipment =
    Array.isArray(shipments) && shipments.length > 0
      ? [...shipments].sort(
          (a, b) =>
            new Date(b?.createdAt || b?.created_at || 0) -
            new Date(a?.createdAt || a?.created_at || 0)
        )[0]
      : null;
  const _orderEta = _latestShipment?.estimated_delivery;
  const _isTerminal = ['delivered', 'completed', 'cancelled', 'refunded'].includes(order?.order_status);
  useLiveClock(!!_orderEta && !_isTerminal);

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

  const handleReorder = async () => {
    setReorderLoading(true);
    try {
      const res = await api.post(`/orders/${orderId}/reorder`);
      if (res.data.success) {
        const result = res.data.data;
        const hasIssues = (result.items_changed?.length || 0) > 0 || (result.items_unavailable?.length || 0) > 0;
        if (hasIssues) {
          setReorderResult(result);
        } else {
          toast.success('Items added to cart!');
          router.push('/checkout');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not reorder.');
    } finally {
      setReorderLoading(false);
    }
  };

  const applyManifestPayload = (data) => {
    if (!data) return;
    if (data.order) setOrder(data.order);
    if (data.shipments) setShipments(data.shipments);
    if (data.escrow !== undefined) setEscrow(data.escrow);
  };

  const getOrderItemProductId = (item) => item?.product_id?._id || item?.product_id || item?.product?._id || item?.product || null;

  const openItemReview = (item) => {
    const productId = getOrderItemProductId(item);
    if (!productId) {
      toast.error('Product detail is missing for this order item.');
      return;
    }
    setReviewData({
      rating: 5,
      comment: '',
      product_id: productId,
      order_id: order?._id || orderId,
      product_name: item?.name || item?.product_id?.name || 'Ordered item',
    });
    setReviewModal(true);
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
          openItemReview(order.products[0]);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Release vector blocked.");
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    if (statusUpdating) return;
    setStatusUpdating(newStatus);
    const toastId = toast.loading(`Updating protocol to ${newStatus.toUpperCase()}...`);
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { order_status: newStatus });
      if (res.data.success) {
        const synced = res.data.data?.order?.order_status || newStatus;
        toast.success(`Protocol updated: ${synced.toUpperCase()}`, { id: toastId });
        if (res.data.data) applyManifestPayload(res.data.data);
        else fetchOrderManifest();
      }
    } catch (err) {
      if (err.response?.data?.data) applyManifestPayload(err.response.data.data);
      toast.error(err.response?.data?.message || "Protocol update failed.", { id: toastId });
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleVendorConfirmDelivery = async () => {
    if (!confirm("Confirm asset delivery completion? This notifies the customer to finalize the manifest.")) return;
    const toastId = toast.loading('Synchronizing delivery status...');
    try {
      const res = await api.post(`/escrow/confirm-delivery/${orderId}`);
      if (res.data.success) {
        toast.success(res.data.message || "Delivery confirmed. Awaiting customer release.", { id: toastId });
        if (res.data.data) applyManifestPayload(res.data.data);
        else fetchOrderManifest();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Delivery confirmation failed.", { id: toastId });
    }
  };

  const handleUpdateFoodStatus = async (newStatus) => {
    if (statusUpdating) return;
    setStatusUpdating(newStatus);
    const toastId = toast.loading('Updating kitchen status...');
    try {
      const res = await api.patch(`/orders/${orderId}/food-status`, { food_status: newStatus });
      if (res.data.success) {
        const msgs = {
          preparing: 'Order accepted — cooking!',
          ready:     'Marked ready for pickup',
          picked_up: 'Rider dispatched — in transit',
          delivered: 'Order delivered!',
        };
        toast.success(msgs[newStatus] || 'Kitchen status updated', { id: toastId });
        fetchOrderManifest();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Kitchen update failed.', { id: toastId });
    } finally {
      setStatusUpdating(null);
    }
  };

  const handleCancelOrder = async () => {
    const paid = order?.payment_status === 'paid';
    const message = paid
      ? 'Cancel this order and refund the payment to your Auradime wallet? This is only available within 30 minutes before fulfilment starts.'
      : 'Cancel this unpaid order and stop pending payment attempts?';
    if (!confirm(message)) return;

    const toastId = toast.loading(paid ? 'Cancelling and refunding order...' : 'Cancelling order...');
    try {
      const res = await api.post(`/orders/${orderId}/cancel`, {
        reason: paid ? 'Customer cancelled within 30-minute refund window.' : 'Customer cancelled unpaid checkout.',
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Order cancelled.', { id: toastId });
        if (res.data.data) applyManifestPayload(res.data.data);
        else fetchOrderManifest();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Order cancellation failed.', { id: toastId });
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setReviewLoading(true);
    try {
      const res = await api.post('/reviews', {
        order_id: reviewData.order_id || orderId,
        product_id: reviewData.product_id,
        rating: reviewData.rating,
        comment: reviewData.comment,
      });
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
      case 'refunded': return { color: 'emerald', label: 'Refunded to wallet', icon: CheckCircle2, step: 0 };
      case 'refund_pending': return { color: 'amber', label: 'Refund pending', icon: Clock, step: 0 };
      case 'shipped': return { color: 'blue', label: 'In transit', icon: Truck, step: 3 };
      case 'processing': return { color: 'amber', label: 'Processing', icon: Clock, step: 2 };
      case 'placed': return { color: 'indigo', label: 'Placed', icon: Package, step: 1 };
      case 'cancelled':
        return { color: 'rose', label: 'Cancelled', icon: XCircle, step: 0 };
      default: return { color: 'indigo', label: orderStatus ? orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1) : 'Unknown', icon: Package, step: 1 };
    }
  };

  const shipment = _latestShipment;
  const orderEta = _orderEta;
  const isOrderTerminal = _isTerminal;

  const shipmentLogs = shipment?.shipment_logs || [];
  const orderActivity = [
    {
      status: 'placed',
      timestamp: order.createdAt,
      note: 'Order placed.',
    },
    order.payment_status === 'paid' && {
      status: 'paid',
      timestamp: order.paid_at || order.payment_confirmed_at || order.updatedAt || order.createdAt,
      note: 'Payment confirmed.',
    },
    ['processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'refund_pending'].includes(order.order_status) && {
      status: order.order_status,
      timestamp: order.delivered_at || order.shipped_at || order.updatedAt || order.createdAt,
      note:
        order.order_status === 'shipped'
          ? 'Vendor marked this order as shipped.'
          : order.order_status === 'delivered'
            ? 'Order marked as delivered.'
            : order.order_status === 'completed'
              ? 'Order completed.'
              : order.order_status === 'cancelled'
                ? 'Order cancelled.'
                : order.order_status === 'refunded'
                  ? 'Order refunded.'
                  : order.order_status === 'refund_pending'
                    ? 'Refund is pending.'
                    : 'Order moved into processing.',
    },
  ].filter(Boolean);
  const activityEntries = [
    ...shipmentLogs.map((log) => ({
      status: log.status,
      timestamp: log.timestamp || log.createdAt || shipment?.updatedAt || shipment?.createdAt,
      note: log.note,
      _id: log._id,
      source: 'shipment',
    })),
    ...orderActivity.map((log, idx) => ({ ...log, _id: `order-${idx}`, source: 'order' })),
  ]
    .filter((log) => log.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const shipmentStatusNorm = (shipment?.status || '').toLowerCase();
  const status = getStatusConfig(order.order_status, shipment?.status);
  const isVendor = user?.role === 'vendor' || user?._id === order?.vendor_id?._id || user?._id === order?.vendor_id;
  const isLogistics = user?.role === 'logistics';
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
  const paymentIsSettled = order.payment_status === 'paid' || order.payment_method === 'pay_on_delivery';
  const isEscrowOrder = !!(
    escrow ||
    order.escrow_enabled ||
    order.payment_method === 'escrow'
  );
  const escrowCanRelease = paymentIsSettled && isEscrowOrder && (!escrowStatus || escrowStatus === 'held' || escrowStatus === 'pending_release');
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
  const orderAgeMs = order?.createdAt ? Date.now() - new Date(order.createdAt).getTime() : Number.POSITIVE_INFINITY;
  const cancellationWindowOpen = orderAgeMs <= 30 * 60 * 1000;
  // ── Food order derived state ─────────────────────────────────────────────────
  const isFoodOrder = !!order.food_status;

  const customerCanCancel =
    !isVendor &&
    ['placed', 'processing'].includes(order.order_status) &&
    (
      order.payment_status === 'pending' ||
      (order.payment_status === 'paid' && cancellationWindowOpen)
    ) &&
    !shipment &&   // blocked once any logistics carrier is assigned
    (!isFoodOrder || order.food_status === 'pending_acceptance');  // food: pre-acceptance only
  const isVendorManagedFood = order.shipping_method === 'vendor_managed';
  const foodLogisticsOverdue = isFoodOrder && isFoodLogisticsOverdue(order);
  const foodNextStatus = isFoodOrder ? (({
    pending_acceptance: 'preparing',
    preparing:          'ready',
    ready:              (isVendorManagedFood || foodLogisticsOverdue) ? 'picked_up' : null,
    picked_up:          'delivered',
  })[order.food_status] ?? null) : null;
  const foodActionLabel = (() => {
    if (!isFoodOrder || !foodNextStatus) return null;
    if (order.food_status === 'pending_acceptance') return 'Accept & Start Cooking';
    if (order.food_status === 'preparing')          return 'Mark Ready for Pickup';
    if (order.food_status === 'ready' && isVendorManagedFood)   return 'Rider Picked Up';
    if (order.food_status === 'ready' && foodLogisticsOverdue)  return 'No Rider — Take Over';
    if (order.food_status === 'picked_up') return 'Mark as Delivered';
    return null;
  })();
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Logistics chat ──────────────────────────────────────────────────────────
  const logisticsUser = shipment?.logistics_id?.user_id || shipment?.logistics_company_id?.user_id;
  const logisticsUserId = logisticsUser?._id || logisticsUser;
  const carrierName = shipment?.logistics_id?.company_name || shipment?.logistics_company_id?.company_name || 'Carrier';
  const canMessageCarrier = (
    !isVendor &&
    !isLogistics &&
    isLogisticsOrder &&
    !!shipment &&
    !!logisticsUserId &&
    !['cancelled', 'refunded', 'failed', 'completed', 'delivered'].includes(order.order_status)
  );
  const openCarrierChat = () => {
    const firstProduct = order.products?.[0];
    const contextProduct = firstProduct ? {
      _id: firstProduct.product_id?._id || firstProduct._id,
      name: firstProduct.name,
      images: firstProduct.image ? [firstProduct.image] : [],
      price: firstProduct.price,
    } : null;
    openChat(
      logisticsUserId,
      contextProduct,
      { store_name: carrierName },
      false,
      `Order #${order._id.slice(-8).toUpperCase()}`,
    );
  };

  // ── Vendor chat (customer → vendor) ─────────────────────────────────────
  const vendorUserId = order.vendor_id?.user_id?._id || order.vendor_id?.user_id || null;
  const vendorStoreName = order.vendor_id?.store_name || order.vendor_id?.user_id?.branding?.store_name || order.vendor_id?.name || 'Vendor';
  const canMessageVendor =
    !isVendor &&
    !!vendorUserId &&
    !['cancelled', 'refunded', 'failed'].includes(order.order_status);
  const openVendorChat = () => {
    const firstProduct = order.products?.[0];
    const contextProduct = firstProduct ? {
      _id: firstProduct.product_id?._id || firstProduct._id,
      name: firstProduct.name,
      images: firstProduct.image ? [firstProduct.image] : [],
      price: firstProduct.price,
    } : null;
    openChat(vendorUserId, contextProduct, { store_name: vendorStoreName }, false, `Order #${order._id.slice(-8).toUpperCase()}`);
  };

  // ── Customer chat (vendor → customer) ───────────────────────────────────
  const customerId = customer?._id || order.customer_id;
  const canVendorMessageCustomer =
    isVendor &&
    !!customerId &&
    !['cancelled', 'refunded'].includes(order.order_status);
  const openCustomerChat = () => {
    openChat(customerId, null, { name: customer?.name || 'Customer' }, false, `Order #${order._id.slice(-8).toUpperCase()}`);
  };

  // ── Carrier chat from vendor side ───────────────────────────────────────
  const canVendorMessageCarrier =
    isVendor &&
    isLogisticsOrder &&
    !!shipment &&
    !!logisticsUserId &&
    !['cancelled', 'refunded', 'failed', 'completed', 'delivered'].includes(order.order_status);
  const openVendorCarrierChat = () => {
    openChat(logisticsUserId, null, { store_name: carrierName }, false, `Order #${order._id.slice(-8).toUpperCase()}`);
  };

  // ── Logistics → Vendor / Logistics → Customer chat ───────────────────────
  const canLogisticsMessageVendor =
    isLogistics &&
    !!vendorUserId &&
    !['cancelled', 'refunded', 'failed'].includes(order.order_status);
  const openLogisticsVendorChat = () => {
    openChat(vendorUserId, null, { store_name: vendorStoreName }, false, `Order #${order._id.slice(-8).toUpperCase()}`);
  };
  const canLogisticsMessageCustomer =
    isLogistics &&
    !!customerId &&
    !['cancelled', 'refunded'].includes(order.order_status);
  const openLogisticsCustomerChat = () => {
    openChat(customerId, null, { name: customer?.name || 'Customer' }, false, `Order #${order._id.slice(-8).toUpperCase()}`);
  };

  const STEPS = [
    { key: 'placed',     icon: ShoppingBag,  label: 'Ordered' },
    { key: 'processing', icon: Clock,         label: 'Processing' },
    { key: 'shipped',    icon: Truck,         label: 'Shipped' },
    { key: 'delivered',  icon: CheckCircle2,  label: 'Delivered' },
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
    const method = order.payment_method;
    const statusValue = order.payment_status;

    if (order.order_status === 'cancelled') {
      return {
        label: 'Order cancelled',
        detail: 'No payment collected',
        classes: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
      };
    }

    if (statusValue === 'refunded' || order.order_status === 'refunded') {
      return {
        label: 'Refunded',
        detail: 'Refunded to wallet',
        classes: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    }

    if (order.payment_method === 'pay_on_delivery') {
      return {
        label: 'Pay on delivery',
        detail: 'Due on delivery',
        classes: 'border-sky-500/25 bg-sky-500/10 text-sky-600 dark:text-sky-400',
      };
    }
    if (statusValue === 'paid') {
      return {
        label: 'Paid',
        detail: 'Paid',
        classes: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      };
    }
    if (statusValue === 'failed') {
      return {
        label: 'Payment failed',
        detail: 'Payment failed',
        classes: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
      };
    }

    if (method === 'wallet') {
      return {
        label: 'Awaiting wallet payment',
        detail: 'Awaiting wallet payment',
        classes: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      };
    }

    if (method === 'escrow') {
      return {
        label: 'Awaiting escrow payment',
        detail: 'Awaiting escrow payment',
        classes: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
      };
    }

    return {
      label: 'Awaiting payment',
      detail: 'Awaiting payment',
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
          {!isVendor && ['completed', 'delivered', 'cancelled'].includes(order.order_status) && (
            <button
              type="button"
              onClick={handleReorder}
              disabled={reorderLoading}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/8 px-3 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/20 disabled:opacity-60 sm:min-h-10 sm:flex-initial sm:px-3.5 sm:hover:bg-[var(--accent)]/15"
            >
              {reorderLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
              Reorder
            </button>
          )}
          <div
            className={`col-span-2 hidden min-h-10 items-center justify-center gap-2 rounded-xl border px-3.5 sm:col-span-1 sm:inline-flex ${tone.pill}`}
          >
            <Fingerprint className="size-3.5 shrink-0 opacity-80" />
            <span className="font-mono text-[11px] font-bold tracking-wide">REF · {order._id.slice(-8).toUpperCase()}</span>
          </div>
        </div>
      </header>

      {/* ── Status + Horizontal Progress ───────────────────────────────── */}
      <section className="space-y-6">
        {/* Status badge + label */}
        <div className="space-y-2">
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${tone.pill}`}>
            <span className={`size-1.5 rounded-full ${status.color === 'emerald' ? 'bg-emerald-500' : status.color === 'blue' ? 'bg-sky-500' : status.color === 'amber' ? 'bg-amber-500' : status.color === 'rose' ? 'bg-rose-500' : 'bg-indigo-500'} animate-pulse`} />
            {status.label}
          </div>
          {isFoodOrder && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-[11px] font-semibold text-orange-600 ml-2">
              <span className="size-1.5 rounded-full bg-orange-500 animate-pulse" />
              Kitchen: {FOOD_STATUS_LABELS[order.food_status] || order.food_status?.replace(/_/g, ' ')}
            </div>
          )}
        </div>

        {/* Horizontal progress bar (matching delivery track page) */}
        <div className="space-y-4">
          <div className="flex items-center gap-0">
            {STEPS.map((step, i) => {
              const StepIcon = step.icon;
              const isCancelled = ['cancelled', 'refunded', 'refund_pending'].includes(order.order_status);
              const reached = !isCancelled && status.step > i;
              const isCurrent = !isCancelled && status.step === i + 1;
              const isLast = i === STEPS.length - 1;
              return (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div className={`size-9 rounded-full flex items-center justify-center transition-all ${
                      isCurrent
                        ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/30'
                        : reached
                          ? 'bg-[var(--accent)] text-white'
                          : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)]/30 text-[var(--text-secondary)]/20'
                    }`}>
                      {reached && !isCurrent
                        ? <CheckCircle2 className="size-4" />
                        : <StepIcon className={`size-3.5 ${!reached && !isCurrent ? 'opacity-30' : ''}`} />
                      }
                    </div>
                  </div>
                  {!isLast && (
                    <div className={`flex-1 h-[2px] mx-0.5 rounded-full transition-all ${
                      !isCancelled && status.step > i + 1 ? 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]/15'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="text-center">
            <p className={`text-sm font-bold ${['cancelled', 'refunded'].includes(order.order_status) ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
              {status.label}
            </p>
            <p className="text-[11px] font-medium mt-0.5 text-[var(--text-secondary)] opacity-50">
              {order.order_status === 'cancelled' ? 'This order was cancelled'
                : order.order_status === 'refunded' ? 'This order was refunded'
                : order.order_status === 'completed' || order.order_status === 'delivered' ? 'Successfully delivered'
                : 'Track fulfillment and settlement'}
            </p>
          </div>
        </div>

        {/* Quick Info Row (matching delivery track page) */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
            <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50">Total</p>
            <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{(order.total_amount ?? 0).toLocaleString()} <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40">XAF</span></p>
          </div>
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
            <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50">Shipping</p>
            <p className="mt-1 text-[12px] font-bold text-[var(--text-primary)]">{(order.shipping_fee ?? 0).toLocaleString()} XAF</p>
          </div>
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
            <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50">Payment</p>
            <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${paymentMeta.classes}`}>{paymentMeta.label}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {/* Food order actions */}
          {isVendor && isFoodOrder && foodNextStatus && (
            <button type="button" onClick={() => handleUpdateFoodStatus(foodNextStatus)} disabled={!!statusUpdating}
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-semibold text-white shadow-md transition active:opacity-90 disabled:opacity-60 ${
                foodLogisticsOverdue && order.food_status === 'ready' ? 'bg-amber-500' : order.food_status === 'picked_up' ? 'bg-emerald-600' : order.food_status === 'pending_acceptance' ? 'bg-purple-600' : 'bg-orange-500'
              }`}>
              {statusUpdating === foodNextStatus ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />}
              {foodActionLabel}
            </button>
          )}
          {isVendor && isFoodOrder && !foodNextStatus && order.food_status === 'ready' && (
            <div className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-5 py-2.5 text-[11px] font-semibold text-blue-600">
              <Clock className="size-4" /> Awaiting logistics rider
            </div>
          )}
          {/* Retail order actions */}
          {!isFoodOrder && isVendor && order.order_status === 'placed' && logisticsGraceActive && (
            <>
              <div className="w-full inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-[11px] font-medium text-[var(--text-primary)]">
                <Clock className="size-4 shrink-0 text-sky-600" />
                <span>Logistics priority window — manual ship unlocks in <strong>{graceHoursRemaining >= 1 ? `${Math.ceil(graceHoursRemaining)}h` : `${Math.max(1, Math.ceil(graceHoursRemaining * 60))}m`}</strong></span>
              </div>
              <button type="button" onClick={() => handleUpdateStatus('processing')} disabled={!!statusUpdating}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-5 py-2.5 text-[11px] font-semibold text-[var(--text-primary)] transition active:border-[var(--accent)]/40 disabled:opacity-60">
                {statusUpdating === 'processing' ? <Loader2 className="size-4 animate-spin" /> : <Package className="size-4" />} Acknowledge prep
              </button>
            </>
          )}
          {!isFoodOrder && isVendor && order.order_status === 'placed' && !logisticsGraceActive && (
            <button type="button" onClick={() => handleUpdateStatus('processing')} disabled={!!statusUpdating}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-[11px] font-semibold text-white shadow-md shadow-[var(--accent)]/25 transition active:opacity-90 disabled:opacity-60">
              {statusUpdating === 'processing' ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} Start processing
            </button>
          )}
          {!isFoodOrder && isVendor && order.order_status === 'processing' && (!isLogisticsOrder || !carrierLaunched) && (
            <button type="button" onClick={() => handleUpdateStatus('shipped')} disabled={isProtectedByGracePeriod || !!statusUpdating}
              className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 py-2.5 text-[11px] font-semibold transition ${
                isProtectedByGracePeriod ? 'cursor-not-allowed border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] opacity-50' : 'border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-sm active:border-[var(--accent)]/40'
              }`}>
              {statusUpdating === 'shipped' ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />} {isProtectedByGracePeriod ? 'Awaiting carrier' : 'Mark shipped'}
            </button>
          )}
          {!isVendor && escrowCanRelease && (
            <button type="button" onClick={handleConfirmDelivery}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/25 transition active:opacity-90">
              <CheckCircle2 className="size-4" /> Release escrow
            </button>
          )}
          {!isFoodOrder && isVendor && vendorCanRequestEscrowRelease && (
            <button type="button" onClick={handleVendorConfirmDelivery}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-[11px] font-semibold text-white shadow-md shadow-emerald-500/25 transition active:opacity-90">
              <ShieldCheck className="size-4" /> Request escrow release
            </button>
          )}
          {!isFoodOrder && vendorCanMarkDelivered && (
            <button type="button" onClick={handleVendorConfirmDelivery}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-[11px] font-semibold text-white shadow-md shadow-[var(--accent)]/25 transition active:opacity-90">
              <Package className="size-4" /> Mark as delivered
            </button>
          )}
          {customerCanCancel && (
            <button type="button" onClick={handleCancelOrder}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-5 py-2.5 text-[11px] font-semibold text-amber-700 transition active:bg-amber-500 active:text-white dark:text-amber-300">
              <XCircle className="size-4" /> {order.payment_status === 'paid' ? 'Cancel & refund' : 'Cancel order'}
            </button>
          )}
          {order.order_status !== 'cancelled' && (
            <button type="button" onClick={() => setDisputeModal(true)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-500/25 bg-rose-500/10 px-5 py-2.5 text-[11px] font-semibold text-rose-600 transition active:bg-rose-500 active:text-white dark:text-rose-400">
              <Scale className="size-4" /> Open dispute
            </button>
          )}
        </div>
      </section>

      {/* ── ETA Countdown ───────────────────────────────────────────────── */}
      {orderEta && !isOrderTerminal && (() => {
        const cd = countdown(orderEta);
        const isOverdue = cd?.overdue;
        const parts = cd && !isOverdue ? cd.text.split(' ') : [];
        return (
          <div className={`rounded-2xl border p-5 ${
            isOverdue
              ? 'border-rose-500/20 bg-rose-500/[0.04]'
              : 'border-[var(--accent)]/15 bg-[var(--accent)]/[0.04]'
          }`}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`size-11 rounded-xl flex items-center justify-center ${
                  isOverdue ? 'bg-rose-500/10 text-rose-500' : 'bg-[var(--accent)]/10 text-[var(--accent)]'
                }`}>
                  <Timer className={`size-5 ${!isOverdue ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <p className={`text-[9px] font-bold uppercase tracking-widest ${isOverdue ? 'text-rose-500/60' : 'text-[var(--text-secondary)] opacity-40'}`}>
                    {isOverdue ? 'Past Due' : 'Estimated Arrival'}
                  </p>
                  <p className={`text-[11px] font-medium ${isOverdue ? 'text-rose-500/50' : 'text-[var(--text-secondary)] opacity-50'}`}>
                    {new Date(orderEta).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isOverdue ? (
                  <span className="text-lg font-black text-rose-500 tracking-tight">Overdue</span>
                ) : parts.map((p, i) => {
                  const num = p.replace(/[^\d]/g, '');
                  const unit = p.replace(/[\d]/g, '');
                  return (
                    <div key={i} className="flex items-baseline">
                      <span className="text-2xl font-black tabular-nums text-[var(--accent)] tracking-tight">{num}</span>
                      <span className="text-[10px] font-bold text-[var(--accent)]/50 ml-0.5">{unit}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-12 lg:items-stretch lg:gap-10">
        <div className="order-2 flex min-h-0 flex-col space-y-8 sm:space-y-10 lg:order-1 lg:col-span-8">
          <div>
            {sectionTitle('Shipment activity')}
            <div className={`${cardBase} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/25 px-4 py-3 sm:px-5">
                <p className="text-[12px] font-semibold text-[var(--text-primary)]">Sales History</p>
                <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                  {activityEntries.length} updates
                </span>
              </div>
              <div className="p-4 sm:p-5 md:p-6">
              {activityEntries.length > 0 ? (
                <ul className="space-y-2">
                  {activityEntries.slice().reverse().map((log, lIdx) => (
                    <li key={log._id || lIdx} className="relative rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3.5 sm:p-4">
                      <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-[var(--accent)]/40" />
                      <div className="min-w-0 space-y-1.5 pl-2">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="text-[12px] font-semibold capitalize text-[var(--text-primary)]">
                            {String(log.status || 'update').replace('_', ' ')}
                          </h4>
                          <time className="font-mono text-[10px] text-[var(--text-secondary)] opacity-75 sm:whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
                            {new Date(log.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </time>
                        </div>
                        {log.note ? (
                          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-90">{log.note}</p>
                        ) : (
                          <p className="text-[11px] text-[var(--text-secondary)] opacity-65">No extra note for this update.</p>
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
          </div>

          <div>
            {sectionTitle('Line items')}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(order.products ?? []).map((item, idx) => {
                const variantLabel = formatVariantLabel(item.variant);
                const itemOptions = item.selected_options || [];
                return (
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
                    {variantLabel && (
                      <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--accent)]/80">{variantLabel}</p>
                    )}
                    {itemOptions.length > 0 && (
                      <p className="mt-0.5 text-[10px] text-[var(--text-secondary)] leading-snug">
                        {itemOptions.map(o => o.option_label).join(' · ')}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium text-[var(--text-secondary)]">
                      <span className="font-mono text-[var(--accent)]">{(item.price || 0).toLocaleString()} XAF</span>
                      {item.sale_price && item.regular_price && (
                        <span className="line-through opacity-60">{(item.regular_price || 0).toLocaleString()} XAF</span>
                      )}
                      <span className="opacity-40">·</span>
                      <span>Qty {item.quantity}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {order.order_status === 'completed' && !isVendor && (
                        <button
                          type="button"
                          onClick={() => openItemReview(item)}
                          className="min-h-10 rounded-lg bg-[var(--accent)] px-4 py-2 text-[10px] font-semibold text-white shadow-sm transition active:opacity-90 sm:hover:opacity-95"
                        >
                          Review
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openItemReview(item)}
                        className="min-h-10 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-4 py-2 text-[10px] font-semibold text-[var(--text-secondary)] transition active:bg-[var(--bg-primary)] sm:hover:text-[var(--text-primary)]"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Parties (matching delivery track page design) ──────────────── */}
        <div className="order-1 lg:order-2 lg:col-span-4 space-y-4">
          {/* Customer / Buyer Card */}
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/[0.03] p-5 space-y-3">
            <div className="flex items-center gap-2 text-blue-600">
              <User className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Customer</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{customer?.name || 'Customer'}</p>
              {customer?.email && <p className="text-[11px] text-[var(--text-secondary)] opacity-50 mt-1">{customer.email}</p>}
              {(order.shipping_address?.phone || customer?.phone) && (
                <a href={`tel:${String(order.shipping_address?.phone || customer?.phone).replace(/\s/g, '')}`}
                  className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] opacity-70 mt-1.5 hover:text-[var(--accent)] transition-colors">
                  <Phone className="size-3" />
                  {order.shipping_address?.phone || customer?.phone}
                </a>
              )}
            </div>
            {order.shipping_address && (
              <div className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-70 pt-2 border-t border-blue-500/10">
                {[order.shipping_address?.street || order.shipping_address?.address, order.shipping_address?.quartier, order.shipping_address?.city, order.shipping_address?.region].filter(Boolean).join(', ') || 'Address on file'}
              </div>
            )}
            {/* Chat buttons */}
            <div className="flex flex-wrap gap-2 pt-1">
              {canVendorMessageCustomer && (
                <button type="button" onClick={openCustomerChat}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3.5 py-2 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/15">
                  <MessageCircle className="size-3.5" /> Message
                </button>
              )}
              {canLogisticsMessageCustomer && (
                <button type="button" onClick={openLogisticsCustomerChat}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3.5 py-2 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/15">
                  <MessageCircle className="size-3.5" /> Message
                </button>
              )}
            </div>
          </div>

          {/* Vendor Card */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-600">
              <ShoppingBag className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Vendor</span>
            </div>
            <div>
              <p className="text-sm font-bold text-[var(--text-primary)]">{vendorStoreName}</p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {canMessageVendor && (
                <button type="button" onClick={openVendorChat}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3.5 py-2 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/15">
                  <MessageCircle className="size-3.5" /> Message Vendor
                </button>
              )}
              {canLogisticsMessageVendor && (
                <button type="button" onClick={openLogisticsVendorChat}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3.5 py-2 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/15">
                  <MessageCircle className="size-3.5" /> Message Vendor
                </button>
              )}
            </div>
          </div>

          {/* Carrier Card */}
          <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.03] p-5 space-y-3">
            <div className="flex items-center gap-2 text-violet-600">
              <Truck className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Carrier</span>
            </div>
            {shipment && (shipment.logistics_id || shipment.logistics_company_id) ? (
              <>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">
                    {(shipment.logistics_id?.company_name || shipment.logistics_company_id?.company_name || 'Carrier').slice(0, 24)}
                  </p>
                  {(shipment.logistics_id?.contact_phone || shipment.logistics_company_id?.contact_phone) && (
                    <a href={`tel:${shipment.logistics_id?.contact_phone || shipment.logistics_company_id?.contact_phone}`}
                      className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] opacity-70 mt-1.5 hover:text-[var(--accent)] transition-colors">
                      <Phone className="size-3" />
                      {shipment.logistics_id?.contact_phone || shipment.logistics_company_id?.contact_phone}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-violet-500/10">
                  <code className="font-mono text-[11px] font-semibold text-[var(--accent)] flex-1">{shipment.tracking_code || 'Pending'}</code>
                  <button type="button" onClick={() => { if (shipment.tracking_code) { navigator.clipboard.writeText(shipment.tracking_code); toast.success('Copied'); } }}
                    className="size-8 flex items-center justify-center rounded-lg text-[var(--text-secondary)] transition active:text-[var(--accent)]">
                    <Layers className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canMessageCarrier && (
                    <button type="button" onClick={openCarrierChat}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3.5 py-2 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/15">
                      <MessageCircle className="size-3.5" /> Message
                    </button>
                  )}
                  {canVendorMessageCarrier && (
                    <button type="button" onClick={openVendorCarrierChat}
                      className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3.5 py-2 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/15">
                      <MessageCircle className="size-3.5" /> Message
                    </button>
                  )}
                </div>
              </>
            ) : order.logistics_company_id?.company_name ? (
              <div>
                <p className="text-sm font-bold text-[var(--text-primary)]">{order.logistics_company_id.company_name.slice(0, 24)}</p>
                <p className="mt-1 text-[10px] text-[var(--text-secondary)] opacity-50">Awaiting pickup assignment</p>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-secondary)] opacity-50">No carrier assigned yet</p>
            )}
          </div>

          {/* Settlement Card */}
          <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-5 space-y-3">
            <div className="flex items-center gap-2 opacity-60">
              <CreditCard className="size-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Settlement</span>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between gap-4 text-[var(--text-secondary)] opacity-80">
                <span>Subtotal</span>
                <span className="font-mono">{(order.total_amount - (order.shipping_fee || 0)).toLocaleString()} XAF</span>
              </div>
              <div className="flex justify-between gap-4 text-[var(--text-secondary)] opacity-80">
                <span>Shipping</span>
                <span className="font-mono">{(order.shipping_fee || 0).toLocaleString()} XAF</span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-4 pt-3 border-t border-[var(--glass-border)]/50">
              <span className="text-[11px] font-semibold text-[var(--accent)]">Total</span>
              <p className="text-xl font-black tabular-nums tracking-tight text-[var(--text-primary)]">
                {order.total_amount.toLocaleString()} <span className="text-[9px] font-bold opacity-40">XAF</span>
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-3">
              <div className="flex items-center gap-2 text-[11px] font-semibold text-emerald-600">
                <ShieldCheck className="size-3.5" />
                {escrowStatus === 'released' ? 'Escrow released' : 'Escrow tracked'}
              </div>
              {escrowCanRelease && (
                <p className="mt-2 text-[10px] text-[var(--text-secondary)] opacity-70">
                  Auto-release in 6h after delivery{autoReleaseLabel ? `: ${autoReleaseLabel}` : ''}
                </p>
              )}
            </div>
          </div>

          {/* Delivery Notes */}
          {order.delivery_description && (
            <div className="rounded-2xl border border-[var(--accent)]/10 bg-[var(--accent)]/[0.03] p-5 space-y-3">
              <div className="flex items-center gap-2 text-[var(--accent)]/60">
                <MapPin className="size-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Delivery Notes</span>
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--text-primary)] italic">{order.delivery_description}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Order Message Thread ──────────────────────────────────────────── */}
      <div className={`${cardBase} mt-6 p-4 sm:p-5`}>
        <h3 className="mb-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)] opacity-80">
          <MessageCircle className="size-3.5 text-[var(--accent)]" /> Order Messages
          {orderMessages.length > 0 && (
            <span className="ml-auto rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[9px] font-bold text-[var(--accent)]">
              {orderMessages.length}
            </span>
          )}
        </h3>

        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 overflow-hidden">
          {/* Messages list */}
          <div className="max-h-[350px] overflow-y-auto p-4 space-y-3">
            {loadingOrderMsgs && orderMessages.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
              </div>
            )}
            {!loadingOrderMsgs && orderMessages.length === 0 && (
              <p className="text-center text-[11px] text-[var(--text-secondary)] opacity-40 py-8">
                No messages yet. Start a conversation with the other parties.
              </p>
            )}
            {orderMessages.map((msg, i) => {
              const isMe = msg.sender_id === user?._id;
              const roleColors = {
                buyer: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                vendor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                logistics: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
                admin: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
              };
              const roleBadge = roleColors[msg.sender_role] || roleColors.buyer;

              return (
                <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                    isMe
                      ? 'bg-[var(--accent)] text-white rounded-br-md'
                      : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 text-[var(--text-primary)] rounded-bl-md'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                        isMe ? 'bg-white/15 text-white/80 border-white/20' : roleBadge
                      }`}>
                        {msg.sender_role}
                      </span>
                      <span className={`text-[9px] font-medium ${isMe ? 'text-white/60' : 'text-[var(--text-secondary)] opacity-40'}`}>
                        {msg.sender_name}
                      </span>
                      <span className={`text-[9px] ${isMe ? 'text-white/40' : 'text-[var(--text-secondary)] opacity-30'}`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              );
            })}
            <div ref={orderMsgEndRef} />
          </div>

          {/* Send message form */}
          {!['cancelled', 'refunded'].includes(order.order_status) && (
            <form onSubmit={handleSendOrderMsg} className="flex items-center gap-2 border-t border-[var(--glass-border)]/30 p-3">
              <input
                value={orderMsgText}
                onChange={(e) => setOrderMsgText(e.target.value)}
                placeholder="Message buyer, vendor, or logistics..."
                className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-[12px] font-medium outline-none focus:border-[var(--accent)]/30 transition-colors placeholder:text-[var(--text-secondary)] placeholder:opacity-30"
              />
              <button
                type="submit"
                disabled={sendingOrderMsg || !orderMsgText.trim()}
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all active:scale-95 disabled:opacity-30"
              >
                {sendingOrderMsg ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </button>
            </form>
          )}
        </div>
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
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 md:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: 14, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 14, scale: 0.98, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl sm:p-8"
            >
              <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Leave a review</h2>
              <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                Share feedback for {reviewData.product_name || 'this product'}.
              </p>
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

      {/* Reorder confirmation sheet */}
      <AnimatePresence>
        {reorderResult && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm"
              onClick={() => setReorderResult(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[1000] max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-2xl flex flex-col pb-[max(1.5rem,env(safe-area-inset-bottom))]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-2 shrink-0">
                <div className="h-1 w-10 rounded-full bg-[var(--glass-border)]" />
              </div>
              <div className="px-5 pb-2 border-b border-[var(--glass-border)]">
                <h2 className="text-[15px] font-bold text-[var(--text-primary)] font-[Poppins]">Review your reorder</h2>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Some items have changed since your last order.</p>
              </div>
              <div className="px-5 py-4 space-y-4 flex-1">
                {reorderResult.items_unavailable?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="size-4 text-rose-500 shrink-0" />
                      <p className="text-[11px] font-bold text-rose-600 uppercase tracking-wide">Unavailable items (skipped)</p>
                    </div>
                    <div className="space-y-2">
                      {reorderResult.items_unavailable.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-500/5 px-3 py-2.5">
                          <div className="size-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                            <XCircle className="size-4 text-rose-500" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{item.name}</p>
                            <p className="text-[10px] text-rose-500 mt-0.5">{item.reason || 'No longer available'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reorderResult.items_changed?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="size-4 text-amber-500 shrink-0" />
                      <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">Price changes</p>
                    </div>
                    <div className="space-y-2">
                      {reorderResult.items_changed.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
                          <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate min-w-0">{item.name}</p>
                          <div className="flex items-center gap-2 shrink-0 text-[11px]">
                            <span className="line-through text-[var(--text-secondary)]">{(item.old_price || 0).toLocaleString()} XAF</span>
                            <ArrowRight className="size-3 text-[var(--text-secondary)]" />
                            <span className="font-bold text-amber-600">{(item.new_price || 0).toLocaleString()} XAF</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {reorderResult.items_added?.length > 0 && (
                  <div>
                    <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wide mb-2">
                      {reorderResult.items_added.length} item{reorderResult.items_added.length > 1 ? 's' : ''} added to cart
                    </p>
                  </div>
                )}
              </div>
              <div className="px-5 pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setReorderResult(null)}
                  className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] py-3 text-[12px] font-semibold text-[var(--text-secondary)]"
                >
                  Cancel
                </button>
                {(reorderResult.items_added?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => { setReorderResult(null); router.push('/checkout'); }}
                    className="flex-[1.4] inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 text-[12px] font-bold text-white shadow-md shadow-[var(--accent)]/25"
                  >
                    <ShoppingBag className="size-4" />
                    Go to checkout
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
