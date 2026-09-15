"use client";

import { useState, useEffect, useRef } from "react";
import {
  Loader2,
  Truck,
  MapPin,
  Package,
  Phone,
  Store,
  Banknote,
  User,
  ExternalLink,
  ClipboardList,
  ChevronRight,
  ChevronLeft,
  MessageCircle,
  Send,
  ArrowDownToLine,
  Timer,
  Clock,
} from "lucide-react";
import { formatVariantLabel } from "@/utils/variants";
import { useChat } from "@/context/ChatContext";
import api from "@/services/api";

const FAILURE_OPTIONS = [
  { value: "unreachable", label: "Customer Unreachable" },
  { value: "wrong address", label: "Wrong Address" },
  { value: "other", label: "Other" },
];

function elapsedStr(from, to) {
  if (!from) return '';
  const s = Math.floor(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

function timeAgoStr(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h ago`;
}

function formatAddress(addr) {
  if (!addr || typeof addr !== "object") {
    return { lines: [], phone: null };
  }
  const parts = [
    addr.street,
    addr.quartier,
    addr.city,
    addr.region,
    addr.country,
  ].filter(Boolean);
  const phone = addr.phone || null;
  const lines = parts.length ? parts : ["—"];
  return { lines, phone };
}

function orderRef(order) {
  const id = order?._id || order;
  if (!id) return "—";
  return String(id).slice(-8).toUpperCase();
}

/**
 * ShipmentStatusModal — supports both marketplace and P2P shipments
 * Includes sender/recipient info and shipment message thread
 */
export default function ShipmentStatusModal({
  open,
  embedded = false,
  shipment,
  updateData,
  setUpdateData,
  updating,
  onClose,
  onBack,
  onSubmit,
}) {
  const { openChat } = useChat();
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const msgEndRef = useRef(null);

  // Order-level messages (for marketplace orders)
  const [orderMessages, setOrderMessages] = useState([]);
  const [orderMsgText, setOrderMsgText] = useState("");
  const [sendingOrderMsg, setSendingOrderMsg] = useState(false);
  const [loadingOrderMsgs, setLoadingOrderMsgs] = useState(false);
  const orderMsgEndRef = useRef(null);

  // Live timer tick (updates every 30s for active shipments)
  const [, setTick] = useState(0);
  const isActiveShipment = shipment && !["delivered", "failed", "cancelled"].includes(shipment?.status);
  useEffect(() => {
    if (!isActiveShipment) return;
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, [isActiveShipment]);

  const visible = embedded ? !!shipment : open && !!shipment;
  const shipmentId = shipment?._id;
  const orderId = shipment?.order_id?._id || (typeof shipment?.order_id === 'string' ? shipment?.order_id : null);

  // Fetch messages for this shipment
  useEffect(() => {
    if (!visible || !shipmentId) return;
    let cancelled = false;
    const fetchMsgs = async () => {
      setLoadingMsgs(true);
      try {
        const res = await api.get(`/messages/shipment/${shipmentId}`);
        if (!cancelled && res.data?.success) {
          setMessages(res.data.data?.messages || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoadingMsgs(false);
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [visible, shipmentId]);

  // Auto-scroll messages
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMsg = async (e) => {
    e.preventDefault();
    if (!msgText.trim() || !shipmentId) return;
    setSendingMsg(true);
    try {
      const res = await api.post(`/messages/shipment/${shipmentId}`, { text: msgText.trim() });
      if (res.data?.success) {
        setMessages(prev => [...prev, res.data.data.message]);
        setMsgText("");
      }
    } catch { /* ignore */ }
    setSendingMsg(false);
  };

  // Fetch order-level messages (marketplace only)
  useEffect(() => {
    if (!visible || !orderId) return;
    let cancelled = false;
    const fetchOrderMsgs = async () => {
      setLoadingOrderMsgs(true);
      try {
        const res = await api.get(`/messages/order/${orderId}`);
        if (!cancelled && res.data?.success) {
          setOrderMessages(res.data.data?.messages || []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoadingOrderMsgs(false);
    };
    fetchOrderMsgs();
    const interval = setInterval(fetchOrderMsgs, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [visible, orderId]);

  useEffect(() => {
    orderMsgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [orderMessages]);

  const handleSendOrderMsg = async (e) => {
    e.preventDefault();
    if (!orderMsgText.trim() || !orderId) return;
    setSendingOrderMsg(true);
    try {
      const res = await api.post(`/messages/order/${orderId}`, { text: orderMsgText.trim() });
      if (res.data?.success) {
        setOrderMessages(prev => [...prev, res.data.data.message]);
        setOrderMsgText("");
      }
    } catch { /* ignore */ }
    setSendingOrderMsg(false);
  };

  if (!visible) return null;

  const isP2P = shipment.type === 'p2p';
  const order = shipment.order_id;
  const vendor = shipment.vendor_id;
  const customer = typeof order?.customer_id === "object" ? order.customer_id : null;

  // P2P sender info
  const senderUser = typeof shipment.booked_by === 'object' ? shipment.booked_by : null;
  const guestBooker = shipment.guest_booker;
  const senderName = senderUser?.name || guestBooker?.name || 'Sender';
  const senderPhone = senderUser?.phone || guestBooker?.phone || shipment.pickup_address?.phone || null;
  const senderEmail = senderUser?.email || guestBooker?.email || null;

  // P2P recipient info
  const otherParty = shipment.other_party;
  const otherPartyUser = typeof otherParty?.user_id === 'object' ? otherParty.user_id : null;
  const recipientNameP2P = otherPartyUser?.name || otherParty?.name || 'Recipient';
  const recipientPhoneP2P = otherPartyUser?.phone || otherParty?.phone || shipment.delivery_address?.phone || null;
  const recipientEmailP2P = otherPartyUser?.email || otherParty?.email || null;

  // Messaging helpers
  const vendorUserId = vendor?.user_id?._id || vendor?.user_id || null;
  const vendorName = vendor?.store_name || vendor?.name || "Vendor";
  const customerId = customer?._id || (typeof order?.customer_id === "string" ? order.customer_id : null);
  const orderLabel = `Shipment #${String(shipment.tracking_code || shipment._id).slice(-8).toUpperCase()}`;
  const isTerminal = ["delivered", "failed", "cancelled"].includes(shipment.status);

  const openVendorChat = () => {
    if (!vendorUserId) return;
    openChat(vendorUserId, null, { store_name: vendorName }, false, orderLabel);
  };
  const openCustomerChat = () => {
    if (!customerId) return;
    openChat(customerId, null, { name: customer?.name || "Customer" }, false, orderLabel);
  };

  const pickup = formatAddress(shipment.pickup_address);
  const drop = formatAddress(shipment.delivery_address);
  const noteBlock = shipment.delivery_description || order?.delivery_description || null;

  // Marketplace recipient
  const shipAddr = order?.shipping_address;
  const recipientLabel = shipAddr?.full_name || shipAddr?.name || customer?.name || "Recipient";
  const recipientLines = shipAddr
    ? [shipAddr.street, shipAddr.quartier, shipAddr.city, shipAddr.region, shipAddr.country].filter(Boolean)
    : [];

  const products = Array.isArray(order?.products) ? order.products : [];
  const pkgDetails = shipment.package_details;

  const cardShellClass = embedded
    ? "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-[0_28px_90px_-28px_rgba(0,0,0,0.18)] ring-1 ring-black/5 dark:ring-white/10"
    : "relative z-10 flex h-[85dvh] max-h-[min(95dvh,1000px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] sm:h-auto sm:rounded-[2rem]";

  const headerShell = embedded
    ? "shrink-0 border-b border-[var(--glass-border)] bg-gradient-to-br from-[var(--bg-secondary)]/50 via-[var(--bg-primary)] to-[var(--bg-secondary)]/30 px-4 py-5 sm:px-10 sm:py-8"
    : "shrink-0 bg-gradient-to-b from-[var(--bg-secondary)]/50 to-transparent px-6 py-6 sm:px-8 sm:py-7";

  const scrollPad = embedded ? "px-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-10 sm:pb-10 lg:px-12" : "px-4 pb-8 sm:px-8";
  const formShell = embedded
    ? "shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:p-6 sm:pb-8 sm:px-10 lg:px-12"
    : "shrink-0 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8";

  const panel = (
    <div className={cardShellClass}>

        {/* Header Section */}
        <div className={headerShell}>
          {embedded && onBack ? (
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <button
                type="button"
                onClick={onBack}
                className="group inline-flex w-fit min-h-[44px] shrink-0 items-center gap-2 rounded-xl py-2 text-[11px] font-semibold text-[var(--text-secondary)] transition active:opacity-80 sm:min-h-0 sm:py-1.5 sm:hover:text-[var(--text-primary)]"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/80 transition group-active:border-[var(--accent)]/40 group-active:text-[var(--accent)] sm:size-9 sm:group-hover:border-[var(--accent)]/40 sm:group-hover:text-[var(--accent)]">
                  <ChevronLeft className="size-4" />
                </span>
                Back to manifests
              </button>
              <div className="min-w-0 flex-1 space-y-2 sm:text-right sm:space-y-1">
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <div className="flex h-6 items-center rounded-full bg-[var(--accent)]/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] border border-[var(--accent)]/20">
                    {String(shipment.status || "pending").replace(/_/g, " ")}
                  </div>
                  {isP2P && (
                    <div className="flex h-6 items-center rounded-full bg-violet-500/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 border border-violet-500/20">
                      P2P
                    </div>
                  )}
                  {!isP2P && (
                    <span className="font-mono text-[11px] font-bold tracking-tight text-[var(--text-secondary)] opacity-70">
                      #{orderRef(order)}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-black tracking-tight text-[var(--text-primary)] sm:text-3xl md:text-[2rem] md:leading-tight">
                  {shipment.tracking_code}
                </h3>
                <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">
                    Created{" "}
                    {new Date(shipment.createdAt || order?.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2.5 py-0.5 text-[10px] font-bold text-[var(--accent)]">
                    <Timer className="size-3" />
                    {elapsedStr(shipment.createdAt || order?.createdAt)} elapsed
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 items-center rounded-full bg-[var(--accent)]/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)] border border-[var(--accent)]/20">
                      {String(shipment.status || "pending").replace(/_/g, " ")}
                    </div>
                    {isP2P ? (
                      <div className="flex h-6 items-center rounded-full bg-violet-500/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-violet-600 border border-violet-500/20">
                        P2P
                      </div>
                    ) : (
                      <>
                        <span className="text-[11px] font-medium text-[var(--text-secondary)] opacity-40">·</span>
                        <span className="font-mono text-[11px] font-bold tracking-tight text-[var(--text-secondary)]">
                          #{orderRef(order)}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                    {shipment.tracking_code}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">
                      Created{" "}
                      {new Date(shipment.createdAt || order?.createdAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-2 py-0.5 text-[9px] font-bold text-[var(--accent)]">
                      <Timer className="size-2.5" />
                      {elapsedStr(shipment.createdAt || order?.createdAt)}
                    </span>
                  </div>
                </div>
                {!embedded && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)] text-[var(--text-primary)] transition-all hover:bg-[var(--bg-secondary)] active:scale-95"
                  >
                    <ExternalLink className="size-4 opacity-60" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Scrollable Content */}
        <div className={`min-h-0 flex-1 overflow-y-auto ${scrollPad}`}>
          <div className={`space-y-8 ${embedded ? "mx-auto max-w-6xl lg:max-w-none" : ""}`}>

            {/* Quick Stats Grid */}
            {embedded ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50 md:p-5">
                  <Banknote className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04] transition-transform group-hover:scale-110" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">Your earnings</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-black tracking-tight text-[var(--text-primary)] md:text-2xl">{(shipment.price ?? 0).toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40">XAF</span>
                  </div>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50 md:p-5">
                  <Store className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04] transition-transform group-hover:scale-110" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">{isP2P ? 'Type' : 'Vendor'}</p>
                  <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-[var(--text-primary)] md:text-sm">
                    {isP2P ? (shipment.p2p_type === 'request_pickup' ? 'Pickup Request' : 'Send Package') : (vendor?.store_name || "Merchant")}
                  </p>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50 md:p-5">
                  <Package className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04] transition-transform group-hover:scale-110" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--accent)] opacity-80">Pickup</p>
                  <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-[var(--text-primary)] md:text-sm">
                    {shipment.pickup_address?.quartier || pickup.lines[0] || "—"}
                  </p>
                </div>
                <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50 md:p-5">
                  <MapPin className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04] transition-transform group-hover:scale-110" />
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">Drop-off</p>
                  <p className="mt-1 line-clamp-2 text-[13px] font-bold leading-snug text-[var(--text-primary)] md:text-sm">
                    {shipment.delivery_address?.quartier || drop.lines[0] || "—"}
                  </p>
                </div>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:bg-[var(--bg-secondary)]/50">
                <Banknote className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.03] transition-transform group-hover:scale-110" />
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">Your Earnings</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-lg font-bold text-[var(--text-primary)]">{(shipment.price ?? 0).toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40">XAF</span>
                </div>
              </div>
              <div className="group relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-4 transition-all hover:bg-[var(--bg-secondary)]/50">
                <Store className="absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.03] transition-transform group-hover:scale-110" />
                <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--text-secondary)] opacity-60">{isP2P ? 'Type' : 'Vendor'}</p>
                <p className="mt-1 truncate text-[13px] font-bold text-[var(--text-primary)]">
                  {isP2P ? (shipment.p2p_type === 'request_pickup' ? 'Pickup Request' : 'Send Package') : (vendor?.store_name || "Merchant")}
                </p>
              </div>
            </div>
            )}

            {/* Shipment Timeline */}
            <div className={`relative space-y-6 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-gradient-to-b before:from-[var(--accent)] before:to-[var(--accent)]/10 ${embedded ? "lg:rounded-3xl lg:border lg:border-[var(--glass-border)] lg:bg-[var(--bg-secondary)]/15 lg:p-6 lg:pl-8 xl:p-8" : ""}`}>
              {/* Pickup Point */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 size-[23px] rounded-full bg-[var(--bg-primary)] border-2 border-[var(--accent)] shadow-[0_0_12px_rgba(var(--accent-rgb),0.3)] flex items-center justify-center">
                  <div className="size-1.5 rounded-full bg-[var(--accent)]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Pickup Location</p>
                  <div className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                    {pickup.lines.map((l, i) => <span key={i}>{l}{i < pickup.lines.length - 1 ? ", " : ""}</span>)}
                  </div>
                  {pickup.phone && (
                    <a href={`tel:${pickup.phone}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                      <Phone className="size-3 opacity-60" />
                      {pickup.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Delivery Point */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 size-[23px] rounded-full bg-[var(--bg-primary)] border-2 border-[var(--text-secondary)]/30 flex items-center justify-center">
                  <MapPin className="size-3 text-[var(--text-secondary)] opacity-60" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">Delivery Destination</p>
                  <div className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                    {drop.lines.map((l, i) => <span key={i}>{l}{i < drop.lines.length - 1 ? ", " : ""}</span>)}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-4">
                    {drop.phone && (
                      <a href={`tel:${drop.phone}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]">
                        <Phone className="size-3" />
                        {drop.phone}
                      </a>
                    )}
                    {!isP2P && shipAddr?.email && (
                      <span className="text-[11px] font-medium text-[var(--text-secondary)] opacity-50">{shipAddr.email}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Sender & Recipient Section (P2P) */}
            {isP2P ? (
              <div className={`grid gap-4 ${embedded ? "lg:grid-cols-2 lg:gap-6" : "sm:grid-cols-2"}`}>
                {/* Sender */}
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Send className="size-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Sender</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{senderName}</p>
                    {senderPhone && (
                      <a href={`tel:${senderPhone}`} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] opacity-70 mt-1.5 hover:text-[var(--accent)] transition-colors">
                        <Phone className="size-3" />
                        {senderPhone}
                      </a>
                    )}
                    {senderEmail && (
                      <p className="text-[11px] text-[var(--text-secondary)] opacity-50 mt-1">{senderEmail}</p>
                    )}
                  </div>
                  {shipment.pickup_address && (
                    <div className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-70 pt-2 border-t border-emerald-500/10">
                      {pickup.lines.join(", ")}
                    </div>
                  )}
                </div>

                {/* Recipient */}
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-rose-600">
                    <ArrowDownToLine className="size-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Recipient</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{recipientNameP2P}</p>
                    {recipientPhoneP2P && (
                      <a href={`tel:${recipientPhoneP2P}`} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] opacity-70 mt-1.5 hover:text-[var(--accent)] transition-colors">
                        <Phone className="size-3" />
                        {recipientPhoneP2P}
                      </a>
                    )}
                    {recipientEmailP2P && (
                      <p className="text-[11px] text-[var(--text-secondary)] opacity-50 mt-1">{recipientEmailP2P}</p>
                    )}
                  </div>
                  {shipment.delivery_address && (
                    <div className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-70 pt-2 border-t border-rose-500/10">
                      {drop.lines.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Marketplace Recipient & Notes */
              <div className={`grid gap-4 ${embedded ? "lg:grid-cols-2 lg:gap-6" : "sm:grid-cols-2"}`}>
                <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-5 space-y-3">
                  <div className="flex items-center gap-2 opacity-50">
                    <User className="size-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Recipient</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{recipientLabel}</p>
                    {customer?.name && customer.name !== recipientLabel && (
                      <p className="text-[11px] text-[var(--text-secondary)] opacity-60 mt-1">({customer.name})</p>
                    )}
                    {customer?.phone && (
                      <a href={`tel:${customer.phone}`} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] opacity-60 mt-1 hover:text-[var(--accent)] transition-colors">
                        <Phone className="size-3" />
                        {customer.phone}
                      </a>
                    )}
                  </div>
                  {recipientLines.length > 0 && (
                    <div className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-70 pt-2 border-t border-[var(--glass-border)]">
                      {recipientLines.join(", ")}
                    </div>
                  )}
                  {/* Logistics chat buttons */}
                  {!isTerminal && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-[var(--glass-border)]">
                      {customerId && (
                        <button
                          type="button"
                          onClick={openCustomerChat}
                          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3 py-2.5 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/15 sm:min-h-0 sm:hover:bg-[var(--accent)] sm:hover:text-white"
                        >
                          <MessageCircle className="size-4" />
                          Message Customer
                        </button>
                      )}
                      {vendorUserId && (
                        <button
                          type="button"
                          onClick={openVendorChat}
                          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/8 px-3 py-2.5 text-[11px] font-semibold text-[var(--accent)] transition active:bg-[var(--accent)]/15 sm:min-h-0 sm:hover:bg-[var(--accent)] sm:hover:text-white"
                        >
                          <MessageCircle className="size-4" />
                          Message Vendor
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--accent)]/10 bg-[var(--accent)]/[0.03] p-5 space-y-3">
                  <div className="flex items-center gap-2 text-[var(--accent)]/60">
                    <ClipboardList className="size-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Delivery Notes</span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-[var(--text-primary)] italic">
                    {noteBlock || "No specific instructions provided."}
                  </p>
                </div>
              </div>
            )}

            {/* Delivery Notes (P2P) */}
            {isP2P && noteBlock && (
              <div className="rounded-2xl border border-[var(--accent)]/10 bg-[var(--accent)]/[0.03] p-5 space-y-3">
                <div className="flex items-center gap-2 text-[var(--accent)]/60">
                  <ClipboardList className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Delivery Notes</span>
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--text-primary)] italic">{noteBlock}</p>
              </div>
            )}

            {/* Package Details (P2P) or Products List (Marketplace) */}
            {isP2P ? (
              pkgDetails && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 opacity-60">
                    <Package className="size-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Package Details</span>
                  </div>
                  <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-4 space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {pkgDetails.category && (
                        <span className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] font-bold capitalize text-[var(--text-primary)]">
                          {pkgDetails.category}
                        </span>
                      )}
                      {pkgDetails.weight_tier && (
                        <span className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] font-bold capitalize text-[var(--text-primary)]">
                          {pkgDetails.weight_tier.replace('_', ' ')}
                        </span>
                      )}
                      {pkgDetails.declared_value > 0 && (
                        <span className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[11px] font-bold text-amber-600">
                          Value: {pkgDetails.declared_value.toLocaleString()} XAF
                        </span>
                      )}
                    </div>
                    {pkgDetails.description && (
                      <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] pt-2 border-t border-[var(--glass-border)]/50">
                        {pkgDetails.description}
                      </p>
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 opacity-60">
                    <Package className="size-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Order Manifest ({products.length})</span>
                  </div>
                </div>
                <div className="divide-y divide-[var(--glass-border)]/50 overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20">
                  {products.map((item, idx) => {
                    const pname = (typeof item.product_id === "object" && item.product_id?.name) || item.name || "Item";
                    const variantLabel = formatVariantLabel(item.variant);
                    return (
                      <div key={idx} className="flex items-center justify-between p-4 hover:bg-[var(--bg-secondary)]/40 transition-colors">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{pname}</p>
                          {variantLabel && (
                            <p className="mt-0.5 truncate text-[10px] font-semibold text-[var(--accent)]/80">{variantLabel}</p>
                          )}
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-60">Unit price: {(item.price || 0).toLocaleString()} XAF</p>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-primary)] px-3 py-1.5 border border-[var(--glass-border)]">
                          <span className="text-[10px] font-bold text-[var(--text-secondary)]">Qty</span>
                          <span className="text-xs font-bold text-[var(--accent)]">{item.quantity ?? 1}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Message Thread */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 opacity-60">
                <MessageCircle className="size-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Shipment Messages {messages.length > 0 && `(${messages.length})`}
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 overflow-hidden">
                {/* Messages list */}
                <div className="max-h-[300px] overflow-y-auto p-4 space-y-3">
                  {loadingMsgs && messages.length === 0 && (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
                    </div>
                  )}
                  {!loadingMsgs && messages.length === 0 && (
                    <p className="text-center text-[11px] text-[var(--text-secondary)] opacity-40 py-6">
                      No messages yet. Start the conversation below.
                    </p>
                  )}
                  {messages.map((msg, i) => {
                    const isLogistics = msg.sender_role === 'logistics';
                    return (
                      <div key={msg._id || i} className={`flex ${isLogistics ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                          isLogistics
                            ? 'bg-[var(--accent)] text-white rounded-br-md'
                            : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 text-[var(--text-primary)] rounded-bl-md'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-bold uppercase ${isLogistics ? 'text-white/70' : 'text-[var(--text-secondary)] opacity-50'}`}>
                              {msg.sender_name || msg.sender_role}
                            </span>
                            <span className={`text-[9px] ${isLogistics ? 'text-white/40' : 'text-[var(--text-secondary)] opacity-30'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[12px] leading-relaxed">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgEndRef} />
                </div>

                {/* Send message form */}
                {!isTerminal && (
                  <form onSubmit={handleSendMsg} className="flex items-center gap-2 border-t border-[var(--glass-border)]/30 p-3">
                    <input
                      value={msgText}
                      onChange={(e) => setMsgText(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-[12px] font-medium outline-none focus:border-[var(--accent)]/30 transition-colors placeholder:text-[var(--text-secondary)] placeholder:opacity-30"
                    />
                    <button
                      type="submit"
                      disabled={sendingMsg || !msgText.trim()}
                      className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all active:scale-95 disabled:opacity-30"
                    >
                      {sendingMsg ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Order Message Thread (marketplace orders only) */}
            {!isP2P && orderId && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 opacity-60">
                  <MessageCircle className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Order Messages {orderMessages.length > 0 && `(${orderMessages.length})`}
                  </span>
                </div>
                <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 overflow-hidden">
                  <div className="max-h-[300px] overflow-y-auto p-4 space-y-3">
                    {loadingOrderMsgs && orderMessages.length === 0 && (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
                      </div>
                    )}
                    {!loadingOrderMsgs && orderMessages.length === 0 && (
                      <p className="text-center text-[11px] text-[var(--text-secondary)] opacity-40 py-6">
                        No order messages yet. Message buyer or vendor about this order.
                      </p>
                    )}
                    {orderMessages.map((msg, i) => {
                      const isLogisticsMsg = msg.sender_role === 'logistics';
                      const roleColors = {
                        buyer: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
                        vendor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
                        logistics: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
                        admin: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
                      };
                      const roleBadge = roleColors[msg.sender_role] || roleColors.buyer;
                      return (
                        <div key={msg._id || i} className={`flex ${isLogisticsMsg ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                            isLogisticsMsg
                              ? 'bg-[var(--accent)] text-white rounded-br-md'
                              : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 text-[var(--text-primary)] rounded-bl-md'
                          }`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[8px] font-bold uppercase ${
                                isLogisticsMsg ? 'bg-white/15 text-white/80 border-white/20' : roleBadge
                              }`}>
                                {msg.sender_role}
                              </span>
                              <span className={`text-[9px] ${isLogisticsMsg ? 'text-white/60' : 'text-[var(--text-secondary)] opacity-40'}`}>
                                {msg.sender_name}
                              </span>
                              <span className={`text-[9px] ${isLogisticsMsg ? 'text-white/40' : 'text-[var(--text-secondary)] opacity-30'}`}>
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
                  {!isTerminal && (
                    <form onSubmit={handleSendOrderMsg} className="flex items-center gap-2 border-t border-[var(--glass-border)]/30 p-3">
                      <input
                        value={orderMsgText}
                        onChange={(e) => setOrderMsgText(e.target.value)}
                        placeholder="Message about this order..."
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
            )}

          </div>
        </div>

        {/* Update Form Section */}
        <div className={formShell}>
          {/* Last update timer */}
          {(() => {
            const logs = shipment.shipment_logs;
            const lastLog = logs?.length ? logs[logs.length - 1] : null;
            const lastTs = lastLog?.timestamp || shipment.createdAt;
            return (
              <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-[var(--glass-border)]/50 bg-[var(--bg-primary)]/60 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="size-3.5 text-[var(--text-secondary)] opacity-40" />
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">Last status update</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-[var(--text-primary)]">{timeAgoStr(lastTs)}</span>
                  <span className="text-[9px] text-[var(--text-secondary)] opacity-30">
                    ({new Date(lastTs).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })})
                  </span>
                </div>
              </div>
            );
          })()}
          <form onSubmit={onSubmit} className={`space-y-5 ${embedded ? "mx-auto max-w-4xl" : ""}`}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50 ml-1">New Shipment Status</label>
                <div className="relative">
                  {(() => {
                    const ALLOWED_TRANSITIONS = {
                      pending: ['assigned', 'cancelled'],
                      assigned: ['picked_up', 'failed', 'cancelled'],
                      picked_up: ['in_transit', 'failed', 'cancelled'],
                      in_transit: ['out_for_delivery', 'failed'],
                      out_for_delivery: ['delivered', 'failed'],
                      failed: ['assigned', 'cancelled'],
                      delivered: [],
                      cancelled: [],
                    };
                    const STATUS_LABELS = {
                      pending: 'Pending Approval',
                      assigned: 'Assigned Courier',
                      picked_up: 'Picked Up',
                      in_transit: 'In Transit',
                      out_for_delivery: 'Out For Delivery',
                      delivered: 'Delivered Successfully',
                      failed: 'Delivery Failed',
                      cancelled: 'Cancelled',
                    };
                    const currentStatus = shipment.status || 'pending';
                    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
                    // Include current status + valid next statuses
                    const options = [currentStatus, ...allowed];
                    return (
                      <select
                        value={updateData.status}
                        onChange={(e) => setUpdateData({ ...updateData, status: e.target.value })}
                        className="w-full appearance-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none ring-[var(--accent)]/20 focus:ring-4 transition-all"
                      >
                        {options.map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s] || s}{s === currentStatus ? ' (current)' : ''}</option>
                        ))}
                      </select>
                    );
                  })()}
                  <Truck className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 opacity-30" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50 ml-1">Operational Note</label>
                <input
                  placeholder="e.g. Traffic delay, ready for pickup..."
                  value={updateData.note}
                  onChange={(e) => setUpdateData({ ...updateData, note: e.target.value })}
                  className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none ring-[var(--accent)]/20 focus:ring-4 transition-all placeholder:text-[11px] placeholder:font-normal placeholder:opacity-30"
                />
              </div>
            </div>

            {/* ETA field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50 ml-1">Estimated Delivery (ETA)</label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={updateData.estimated_delivery || ""}
                  onChange={(e) => setUpdateData({ ...updateData, estimated_delivery: e.target.value })}
                  className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none ring-[var(--accent)]/20 focus:ring-4 transition-all"
                />
                <Clock className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 opacity-30" />
              </div>
              {shipment.estimated_delivery && (
                <p className="text-[10px] text-[var(--text-secondary)] opacity-40 ml-1">
                  Current ETA: {new Date(shipment.estimated_delivery).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}
            </div>

            {updateData.status === "delivered" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <input
                  placeholder="Receiver name"
                  value={updateData.receiver_name}
                  onChange={(e) => setUpdateData({ ...updateData, receiver_name: e.target.value })}
                  className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none"
                />
                <input
                  placeholder="Proof image URL (optional)"
                  value={updateData.proof_image}
                  onChange={(e) => setUpdateData({ ...updateData, proof_image: e.target.value })}
                  className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none"
                />
              </div>
            )}

            {updateData.status === "failed" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <select
                  value={updateData.failure_reason}
                  onChange={(e) => setUpdateData({ ...updateData, failure_reason: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-4 py-3.5 text-[13px] font-bold outline-none"
                >
                  <option value="">Select failure reason</option>
                  {FAILURE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={updating}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[var(--text-primary)] px-6 py-4 transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {updating ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <>
                  <span className="text-[12px] font-black uppercase tracking-[0.2em] text-[var(--bg-primary)]">Update Shipment</span>
                  <ChevronRight className="size-4 text-[var(--bg-primary)] transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>

      </div>
  );

  if (embedded) {
    return (
      <div className="mx-auto flex h-full w-full max-w-[1400px] min-h-0 flex-1 flex-col">
        {panel}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[620] flex items-end justify-center p-0 backdrop-blur-md sm:items-center sm:p-4 lg:p-8">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {panel}
    </div>
  );
}
