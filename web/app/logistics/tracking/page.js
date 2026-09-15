"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import {
  Loader2, MapPin, RefreshCw, ChevronRight, ChevronLeft,
  LayoutDashboard, List, LineChart, Package, Clock, Truck,
  CheckCircle2, XCircle, AlertTriangle, Send, MessageCircle,
  ArrowLeft, Copy, Check, Navigation, User, Phone, ChevronDown,
  Camera, FileText,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/services/api";
import { toast } from "react-hot-toast";
import { useAuthStore } from "@/hooks/useAuth";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import StatCard from "@/components/layout/StatCard";
import {
  LogisticsSubpageHeader,
  LogisticsShortcutsRow,
} from "@/components/logistics/LogisticsSubpageShell";
import { summarizeLineItems, destinationLine } from "@/lib/logistics";

const PAGE_SIZE = 10;

const STATUS_CONFIG = {
  pending:          { color: 'amber',   icon: Clock,         label: 'Pending' },
  assigned:         { color: 'blue',    icon: Truck,         label: 'Assigned' },
  picked_up:        { color: 'indigo',  icon: Package,       label: 'Picked Up' },
  in_transit:       { color: 'blue',    icon: Truck,         label: 'In Transit' },
  out_for_delivery: { color: 'violet',  icon: Navigation,    label: 'Out for Delivery' },
  delivered:        { color: 'emerald', icon: CheckCircle2,  label: 'Delivered' },
  failed:           { color: 'rose',    icon: AlertTriangle, label: 'Failed' },
  cancelled:        { color: 'gray',    icon: XCircle,       label: 'Cancelled' },
};

const ALLOWED_TRANSITIONS = {
  pending:          ['assigned', 'cancelled'],
  assigned:         ['picked_up', 'failed', 'cancelled'],
  picked_up:        ['in_transit', 'failed', 'cancelled'],
  in_transit:       ['out_for_delivery', 'failed'],
  out_for_delivery: ['delivered', 'failed'],
  failed:           ['assigned', 'cancelled'],
  delivered:        [],
  cancelled:        [],
};

const STATUS_FLOW = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];

const COLOR_STYLES = {
  amber:   { badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20', dot: 'bg-amber-500' },
  blue:    { badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20', dot: 'bg-blue-500' },
  indigo:  { badge: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20', dot: 'bg-indigo-500' },
  violet:  { badge: 'bg-violet-500/10 text-violet-600 border-violet-500/20', dot: 'bg-violet-500' },
  emerald: { badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', dot: 'bg-emerald-500' },
  rose:    { badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20', dot: 'bg-rose-500' },
  gray:    { badge: 'bg-gray-500/10 text-gray-600 border-gray-500/20', dot: 'bg-gray-500' },
};

/* ─── Progress Bar ─── */
function ProgressBar({ status }) {
  const idx = STATUS_FLOW.indexOf(status);
  const isFinal = ['delivered', 'failed', 'cancelled'].includes(status);
  const pct = status === 'delivered' ? 100 : isFinal ? 0 : Math.round((Math.max(0, idx) / (STATUS_FLOW.length - 1)) * 100);
  return (
    <div className="space-y-2">
      <div className="relative h-1.5 rounded-full bg-[var(--glass-border)]/40 overflow-hidden">
        <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
          status === 'delivered' ? 'bg-emerald-500' : status === 'failed' ? 'bg-rose-500' : status === 'cancelled' ? 'bg-gray-400' : 'bg-[var(--accent)]'
        }`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between">
        {STATUS_FLOW.map((s, i) => {
          const reached = i <= idx && !['failed', 'cancelled'].includes(status);
          return (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className={`size-2 rounded-full transition-all ${reached ? 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]/50'}`} />
              <span className={`text-[7px] font-bold tracking-tight ${reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/30'}`}>
                {STATUS_CONFIG[s]?.label?.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Shipment Detail View ─── */
function ShipmentDetail({ shipmentId, onBack }) {
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [showMessages, setShowMessages] = useState(true);
  const [showTimeline, setShowTimeline] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');
  const [pendingStatus, setPendingStatus] = useState(null);
  const messagesEndRef = useRef(null);

  const fetchShipment = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/logistics/shipments/${shipmentId}`);
      if (res.data.success) setShipment(res.data.data.shipment);
    } catch (err) {
      toast.error('Failed to load shipment');
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get(`/messages/shipment/${shipmentId}`);
      if (res.data?.success) setMessages(res.data.data?.messages || []);
    } catch {}
  }, [shipmentId]);

  const sendMessage = async () => {
    if (!messageInput.trim()) return;
    try {
      const res = await api.post(`/messages/shipment/${shipmentId}`, { text: messageInput.trim() });
      if (res.data?.success) {
        setMessageInput('');
        setMessages(prev => [...prev, res.data.data.message]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch {
      toast.error('Failed to send message');
    }
  };

  const updateStatus = async (newStatus) => {
    if (newStatus === 'failed' && !failureReason.trim()) {
      toast.error('Please provide a reason for failure');
      return;
    }
    if (newStatus === 'delivered' && !statusNote.trim()) {
      toast.error('Please provide proof of delivery note');
      return;
    }

    setUpdating(true);
    try {
      const body = {
        status: newStatus,
        note: statusNote || `Status updated to ${newStatus.replace(/_/g, ' ')}`,
      };
      if (newStatus === 'failed') body.failure_reason = failureReason;
      if (newStatus === 'delivered') {
        body.receiver_name = receiverName;
      }
      if (estimatedDelivery) body.estimated_delivery = estimatedDelivery;

      const res = await api.patch(`/logistics/shipments/${shipmentId}/status`, body);
      if (res.data?.success) {
        toast.success(`Status updated to ${newStatus.replace(/_/g, ' ')}`);
        setShipment(res.data.data.shipment);
        setPendingStatus(null);
        setStatusNote('');
        setFailureReason('');
        setReceiverName('');
        setEstimatedDelivery('');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(shipment?.tracking_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => { fetchShipment(); }, [fetchShipment]);
  useEffect(() => { fetchMessages(); }, [fetchMessages]);
  // Auto-refresh
  useEffect(() => {
    if (!shipment || ['delivered', 'cancelled', 'failed'].includes(shipment.status)) return;
    const iv = setInterval(() => { fetchShipment(); fetchMessages(); }, 30000);
    return () => clearInterval(iv);
  }, [shipment, fetchShipment, fetchMessages]);

  if (loading && !shipment) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-50" />
      </div>
    );
  }
  if (!shipment) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-[var(--text-secondary)]">Shipment not found</p>
        <button onClick={onBack} className="mt-4 text-[var(--accent)] text-xs font-bold">Go back</button>
      </div>
    );
  }

  const config = STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending;
  const colors = COLOR_STYLES[config.color] || COLOR_STYLES.blue;
  const transitions = ALLOWED_TRANSITIONS[shipment.status] || [];
  const isTerminal = ['delivered', 'cancelled', 'failed'].includes(shipment.status);
  const isP2P = shipment.type === 'p2p';
  const order = shipment.order_id;
  const addr = (a) => [a?.street, a?.quartier, a?.city].filter(Boolean).join(', ');

  return (
    <div className="space-y-3 pb-8">
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onBack} className="size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] active:scale-95 transition-all shrink-0">
          <ArrowLeft className="size-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={copyCode} className="flex items-center gap-1.5 font-mono text-sm font-bold text-[var(--accent)] active:scale-95">
              {shipment.tracking_code}
              {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 opacity-40" />}
            </button>
            {isP2P && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-600">P2P</span>}
          </div>
          <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5">{isP2P ? 'Peer-to-peer delivery' : 'Marketplace order'}</p>
        </div>
        <button onClick={() => { fetchShipment(); fetchMessages(); }} className="size-10 rounded-xl border border-[var(--glass-border)]/50 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] active:scale-95 transition-all shrink-0">
          <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Status Card */}
      <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`size-10 rounded-xl ${colors.badge} border flex items-center justify-center shrink-0`}>
            <config.icon className="size-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-[var(--text-primary)]">{config.label}</p>
            <p className="text-[10px] text-[var(--text-secondary)]/50">{shipment.status.replace(/_/g, ' ')} since {new Date(shipment.shipment_logs?.[shipment.shipment_logs.length - 1]?.timestamp || shipment.updatedAt).toLocaleString()}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-sm font-bold text-[var(--text-primary)]">{shipment.price?.toLocaleString()} XAF</p>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md inline-block mt-0.5 ${
              shipment.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
            }`}>{shipment.payment_status === 'paid' ? 'Paid' : 'Unpaid'}</span>
          </div>
        </div>
        <ProgressBar status={shipment.status} />
      </div>

      {/* ─── STATUS UPDATE ACTIONS ─── */}
      {transitions.length > 0 && (
        <div className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent)]/5 p-4 space-y-3">
          <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Truck className="size-4 text-[var(--accent)]" />
            Update Status
          </h4>

          {/* Quick action buttons */}
          {!pendingStatus && (
            <div className="flex flex-wrap gap-2">
              {transitions.map(t => {
                const tc = STATUS_CONFIG[t] || STATUS_CONFIG.pending;
                const tColors = COLOR_STYLES[tc.color] || COLOR_STYLES.blue;
                const needsConfirm = ['delivered', 'failed', 'cancelled'].includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => needsConfirm ? setPendingStatus(t) : updateStatus(t)}
                    disabled={updating}
                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all active:scale-95 disabled:opacity-40 ${tColors.badge} hover:opacity-80`}
                  >
                    <tc.icon className="size-3.5" />
                    {tc.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Confirmation form for delivered/failed/cancelled */}
          {pendingStatus && (
            <div className="space-y-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)]/30 p-3.5">
              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                Confirm: <span className="capitalize text-[var(--accent)]">{pendingStatus.replace(/_/g, ' ')}</span>
              </p>

              {pendingStatus === 'delivered' && (
                <input
                  value={receiverName}
                  onChange={e => setReceiverName(e.target.value)}
                  placeholder="Receiver's name"
                  className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              )}

              {pendingStatus === 'failed' && (
                <input
                  value={failureReason}
                  onChange={e => setFailureReason(e.target.value)}
                  placeholder="Reason for failure *"
                  className="w-full rounded-lg border border-rose-500/30 bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none focus:border-rose-500"
                />
              )}

              <input
                value={statusNote}
                onChange={e => setStatusNote(e.target.value)}
                placeholder={pendingStatus === 'delivered' ? 'Delivery note / proof *' : 'Additional note (optional)'}
                className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)]"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => { setPendingStatus(null); setStatusNote(''); setFailureReason(''); setReceiverName(''); }}
                  className="flex-1 rounded-lg border border-[var(--glass-border)] py-2 text-xs font-bold text-[var(--text-secondary)] active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateStatus(pendingStatus)}
                  disabled={updating}
                  className="flex-1 rounded-lg bg-[var(--accent)] py-2 text-xs font-bold text-white active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  {updating ? <Loader2 className="size-3 animate-spin" /> : <CheckCircle2 className="size-3" />}
                  Confirm
                </button>
              </div>
            </div>
          )}

          {/* Estimated delivery */}
          {!isTerminal && (
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-[var(--text-secondary)]/40 shrink-0" />
              <input
                type="datetime-local"
                value={estimatedDelivery}
                onChange={e => setEstimatedDelivery(e.target.value)}
                className="flex-1 rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[10px] outline-none focus:border-[var(--accent)]"
                placeholder="Set ETA"
              />
              {estimatedDelivery && (
                <button
                  onClick={() => updateStatus(shipment.status)}
                  disabled={updating}
                  className="rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] px-2.5 py-1.5 text-[10px] font-bold active:scale-95"
                >
                  Save ETA
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Route */}
      <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 p-4">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center pt-1 shrink-0">
            <div className="size-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
            <div className="w-0.5 h-10 bg-gradient-to-b from-emerald-500/60 to-rose-500/60 my-1" />
            <div className="size-3 rounded-full bg-rose-500 ring-4 ring-rose-500/10" />
          </div>
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Pickup</p>
              <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">{addr(shipment.pickup_address) || addr(shipment.order_id?.shipping_address) || '—'}</p>
              {(shipment.pickup_address?.name || shipment.pickup_address?.phone) && (
                <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5 flex items-center gap-1.5">
                  {shipment.pickup_address.name && <><User className="size-2.5" />{shipment.pickup_address.name}</>}
                  {shipment.pickup_address.phone && <><Phone className="size-2.5 ml-2" />{shipment.pickup_address.phone}</>}
                </p>
              )}
            </div>
            <div>
              <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">Delivery</p>
              <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">{addr(shipment.delivery_address) || '—'}</p>
              {(shipment.delivery_address?.name || shipment.delivery_address?.phone) && (
                <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5 flex items-center gap-1.5">
                  {shipment.delivery_address.name && <><User className="size-2.5" />{shipment.delivery_address.name}</>}
                  {shipment.delivery_address.phone && <><Phone className="size-2.5 ml-2" />{shipment.delivery_address.phone}</>}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order / Package Info */}
      <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <Package className="size-4 text-[var(--accent)]" />
          <h4 className="text-xs font-bold text-[var(--text-primary)]">{isP2P ? 'Package' : 'Order'} Details</h4>
        </div>
        {isP2P && shipment.package_details ? (
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-semibold bg-[var(--bg-primary)] border border-[var(--glass-border)]/30 rounded-lg px-2.5 py-1.5 capitalize">{shipment.package_details.category}</span>
            <span className="text-[10px] font-semibold bg-[var(--bg-primary)] border border-[var(--glass-border)]/30 rounded-lg px-2.5 py-1.5 capitalize">{shipment.package_details.weight_tier?.replace('_', ' ')}</span>
            {shipment.package_details.declared_value > 0 && (
              <span className="text-[10px] font-semibold bg-[var(--bg-primary)] border border-[var(--glass-border)]/30 rounded-lg px-2.5 py-1.5">{shipment.package_details.declared_value?.toLocaleString()} XAF</span>
            )}
            {shipment.package_details.description && (
              <p className="w-full text-[10px] text-[var(--text-secondary)]/60 mt-1">{shipment.package_details.description}</p>
            )}
          </div>
        ) : order ? (
          <div className="space-y-1.5">
            <p className="text-[11px] text-[var(--text-secondary)]">{summarizeLineItems(order)}</p>
            <div className="flex flex-wrap gap-3 text-[10px]">
              {order.total_amount && <span className="font-semibold">Total: {order.total_amount?.toLocaleString()} XAF</span>}
              {order.shipping_fee && <span className="text-[var(--text-secondary)]/60">Shipping: {order.shipping_fee?.toLocaleString()} XAF</span>}
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[var(--text-secondary)]/40">No details available</p>
        )}
      </div>

      {/* Parties (P2P) */}
      {isP2P && (
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 p-3">
            <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">Sender</p>
            {(shipment.booked_by || shipment.guest_booker) ? (
              <>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{(shipment.booked_by || shipment.guest_booker)?.name || '—'}</p>
                {(shipment.booked_by || shipment.guest_booker)?.phone && (
                  <p className="text-[10px] text-[var(--text-secondary)]/50 truncate mt-0.5">{(shipment.booked_by || shipment.guest_booker).phone}</p>
                )}
              </>
            ) : <p className="text-[11px] text-[var(--text-secondary)]/30">—</p>}
          </div>
          <div className="rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 p-3">
            <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider mb-1.5">Recipient</p>
            {shipment.other_party?.name ? (
              <>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{shipment.other_party.name}</p>
                {shipment.other_party.phone && (
                  <p className="text-[10px] text-[var(--text-secondary)]/50 truncate mt-0.5">{shipment.other_party.phone}</p>
                )}
              </>
            ) : <p className="text-[11px] text-[var(--text-secondary)]/30">—</p>}
          </div>
        </div>
      )}

      {/* Vendor (marketplace) */}
      {!isP2P && shipment.vendor_id && (
        <div className="rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 p-3 flex items-center gap-3">
          {shipment.vendor_id.branding?.logo && (
            <img src={shipment.vendor_id.branding.logo} className="size-9 rounded-xl object-cover" alt="" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-[var(--text-primary)] truncate">{shipment.vendor_id.store_name}</p>
            {shipment.vendor_id.phone && <p className="text-[10px] text-[var(--text-secondary)]/50">{shipment.vendor_id.phone}</p>}
          </div>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600">Vendor</span>
        </div>
      )}

      {/* ─── MESSAGES ─── */}
      <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 overflow-hidden">
        <button
          onClick={() => setShowMessages(!showMessages)}
          className="w-full flex items-center justify-between p-4 active:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2">
            <MessageCircle className="size-4 text-[var(--accent)]" />
            <h4 className="text-xs font-bold text-[var(--text-primary)]">Messages</h4>
            {messages.length > 0 && (
              <span className="size-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">{messages.length}</span>
            )}
          </div>
          <ChevronDown className={`size-4 text-[var(--text-secondary)]/40 transition-transform ${showMessages ? 'rotate-180' : ''}`} />
        </button>
        {showMessages && (
          <div className="px-4 pb-4 border-t border-[var(--glass-border)]/20">
            <div className="space-y-2 mb-3 max-h-72 overflow-y-auto pt-3">
              {messages.length === 0 ? (
                <p className="text-[11px] text-[var(--text-secondary)]/40 text-center py-6">No messages yet — start the conversation</p>
              ) : messages.map((msg, i) => (
                <div key={i} className="rounded-xl bg-[var(--bg-primary)] p-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] font-bold text-[var(--text-primary)]">{msg.sender_name || 'Unknown'}</p>
                    <p className="text-[8px] text-[var(--text-secondary)]/40 shrink-0">{new Date(msg.timestamp).toLocaleString()}</p>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed break-words">{msg.text}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-2">
              <input
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Type a message..."
                className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-xs outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:text-[var(--text-secondary)]/30"
              />
              <button
                onClick={sendMessage}
                disabled={!messageInput.trim()}
                className="size-9 shrink-0 rounded-xl bg-[var(--accent)] text-white disabled:opacity-30 flex items-center justify-center active:scale-95 transition-all"
              >
                <Send className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timeline - Collapsible */}
      {shipment.shipment_logs?.length > 0 && (
        <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 overflow-hidden">
          <button
            onClick={() => setShowTimeline(!showTimeline)}
            className="w-full flex items-center justify-between p-4 active:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-[var(--accent)]" />
              <h4 className="text-xs font-bold text-[var(--text-primary)]">Timeline</h4>
              <span className="text-[10px] text-[var(--text-secondary)]/40">{shipment.shipment_logs.length} events</span>
            </div>
            <ChevronDown className={`size-4 text-[var(--text-secondary)]/40 transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
          </button>
          {showTimeline && (
            <div className="px-4 pb-4 border-t border-[var(--glass-border)]/20 pt-3">
              {[...shipment.shipment_logs].reverse().map((log, i, arr) => {
                const lc = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                const lColors = COLOR_STYLES[lc.color] || COLOR_STYLES.blue;
                const isFirst = i === 0;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={`size-2.5 rounded-full ${isFirst ? lColors.dot : 'bg-[var(--glass-border)]/50'}`} />
                      {i < arr.length - 1 && <div className="w-px h-7 bg-[var(--glass-border)]/30" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-[10px] font-bold capitalize ${isFirst ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/50'}`}>
                          {log.status?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[8px] text-[var(--text-secondary)]/40 shrink-0">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                      {log.note && <p className="text-[9px] text-[var(--text-secondary)]/40 mt-0.5">{log.note}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Proof of delivery */}
      {shipment.proof_of_delivery?.timestamp && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <h4 className="text-xs font-bold text-emerald-600">Proof of Delivery</h4>
          </div>
          <div className="space-y-1 text-[11px]">
            {shipment.proof_of_delivery.receiver_name && <p className="text-[var(--text-secondary)]">Received by: <strong className="text-[var(--text-primary)]">{shipment.proof_of_delivery.receiver_name}</strong></p>}
            {shipment.proof_of_delivery.note && <p className="text-[var(--text-secondary)]">Note: {shipment.proof_of_delivery.note}</p>}
            <p className="text-emerald-600 font-semibold">{new Date(shipment.proof_of_delivery.timestamp).toLocaleString()}</p>
            {shipment.proof_of_delivery.image_url && <img src={shipment.proof_of_delivery.image_url} alt="Proof" className="mt-2 rounded-xl max-h-40 object-cover w-full" />}
          </div>
        </div>
      )}

      {/* Failure info */}
      {shipment.failure_reason && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-4 text-rose-500" />
            <h4 className="text-xs font-bold text-rose-600">Failure Reason</h4>
          </div>
          <p className="text-[11px] text-rose-600">{shipment.failure_reason}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
function TrackingContent() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const searchParams = useSearchParams();
  const shipmentId = searchParams.get('shipment');
  const { displayedBalance: balance } = useWalletBalance();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("order_placed");
  const [counts, setCounts] = useState({ pending: 0, active: 0, delivered: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const shipRes = await api.get("/logistics/shipments/firm", {
        params: { page, limit: PAGE_SIZE, status: filterStatus, sortBy },
      });
      if (shipRes.data.success) {
        const list = shipRes.data.data?.shipments ?? shipRes.data.shipments ?? [];
        setShipments(list);
        setTotal(shipRes.data.total ?? list.length);
        setPages(shipRes.data.pages ?? 1);
        const m = shipRes.data.meta?.counts;
        setCounts({ pending: m?.pending ?? 0, active: m?.active ?? 0, delivered: m?.delivered ?? 0 });
      }
    } catch { toast.error("Failed to load live tracking"); }
    finally { setLoading(false); }
  }, [page, filterStatus, sortBy]);

  useEffect(() => {
    if (!user || user.role !== "logistics") return;
    if (!shipmentId) fetchData();
  }, [user, fetchData, shipmentId]);

  if (user?.role !== "logistics") return null;

  /* ── Detail View ── */
  if (shipmentId) {
    return (
      <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(6rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-12">
        <div className="w-full min-w-0 px-3 py-4 sm:px-5 md:px-8">
          <ShipmentDetail
            shipmentId={shipmentId}
            onBack={() => router.push('/logistics/tracking')}
          />
        </div>
      </div>
    );
  }

  /* ── List View ── */
  return (
    <div className="flex w-full min-w-0 flex-col bg-[var(--bg-primary)] pb-[max(6rem,env(safe-area-inset-bottom,1.25rem))] text-[var(--text-primary)] lg:pb-12">
      <LogisticsSubpageHeader
        Icon={MapPin}
        title="Live"
        accentTitle="tracking"
        tag="Signal stream"
        hint="Tap a shipment to view details, update status, and send messages."
        fullWidth
        actions={
          <button
            type="button"
            onClick={() => fetchData()}
            className="flex size-11 min-h-[2.75rem] min-w-[2.75rem] touch-manipulation items-center justify-center rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] transition hover:bg-white/5"
            aria-label="Refresh"
          >
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="w-full min-w-0 space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-6 md:px-8 md:py-8">
        {(() => {
          const totalShipments = counts.active + counts.pending + counts.delivered || 1;
          const activePct  = Math.round((counts.active / totalShipments) * 100);
          const pendingPct = Math.round((counts.pending / totalShipments) * 100);
          const delivPct   = Math.round((counts.delivered / totalShipments) * 100);
          return (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatCard label="Wallet" value={`${balance.toLocaleString()} XAF`} sub="Settlement balance" icon="account_balance_wallet" color="purple" href="/logistics/wallet" footer="Tap to manage funds" />
              <StatCard label="In transit" value={String(counts.active)} sub="Pickup → delivery" icon="local_shipping" color="indigo" progress={activePct} footer={`${activePct}% of workload`} />
              <StatCard label="Awaiting pickup" value={String(counts.pending)} sub="New tickets" icon="schedule" color="amber" progress={pendingPct} footer={`${pendingPct}% of workload`} />
              <StatCard label="Delivered" value={String(counts.delivered)} sub="Completed" icon="verified" color="emerald" progress={delivPct} footer={`${delivPct}% success rate`} />
            </div>
          );
        })()}

        <LogisticsShortcutsRow
          links={[
            { label: "Dashboard", sub: "Overview", href: "/logistics/dashboard", icon: LayoutDashboard },
            { label: "Manifests", sub: "Update status", href: "/logistics/manifests", icon: List },
            { label: "Route pricing", sub: "Zones & fees", href: "/logistics/pricing", icon: LineChart },
          ]}
        />

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[11px] font-semibold outline-none sm:w-auto sm:min-h-10"
          >
            <option value="order_placed">Recent orders first</option>
            <option value="assignment">Recent assignments first</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="min-h-11 w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-[11px] font-semibold outline-none sm:w-auto sm:min-h-10"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">In transit (active)</option>
            <option value="assigned">Assigned</option>
            <option value="picked_up">Picked up</option>
            <option value="in_transit">In transit</option>
            <option value="out_for_delivery">Out for delivery</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <section className="overflow-hidden rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
          <div className="border-b border-[var(--glass-border)] px-4 py-4 md:px-8">
            <p className="font-mono text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">
              {total} log{total === 1 ? "" : "s"} · page {page}/{pages || 1}
            </p>
          </div>

          <div className="p-3 md:p-6">
            {loading && shipments.length === 0 ? (
              <div className="flex justify-center py-20">
                <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-50" />
              </div>
            ) : shipments.length === 0 ? (
              <p className="py-16 text-center text-[12px] font-medium text-[var(--text-secondary)] opacity-60">
                No shipment activity for this filter.
              </p>
            ) : (
              <div className="space-y-2">
                {shipments.map((s) => {
                  const order = s.order_id;
                  const dest = destinationLine(s);
                  const isP2P = s.type === 'p2p';
                  const sc = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
                  const sColors = COLOR_STYLES[sc.color] || COLOR_STYLES.blue;
                  const placed = order?.createdAt
                    ? new Date(order.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
                    : isP2P ? new Date(s.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
                  return (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => router.push(`/logistics/tracking?shipment=${s._id}`)}
                      className="flex w-full touch-manipulation flex-col gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 p-4 text-left transition hover:border-[var(--accent)]/30 active:scale-[0.99] md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-[12px] font-bold text-[var(--accent)]">{s.tracking_code}</p>
                          {isP2P && <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-600">P2P</span>}
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)] opacity-70">
                          {isP2P ? addr(s.pickup_address) + ' → ' + addr(s.delivery_address) : (dest.main + (dest.sub ? ` · ${dest.sub}` : ''))}
                        </p>
                        {!isP2P && <p className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">{summarizeLineItems(order)}</p>}
                        {isP2P && s.package_details && <p className="text-[10px] text-[var(--text-secondary)]/60 capitalize">{s.package_details.category} · {s.package_details.weight_tier?.replace('_', ' ')}</p>}
                        <p className="text-[10px] font-medium opacity-45">{isP2P ? 'Booked' : 'Order placed'} {placed}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold text-[var(--text-primary)]">{s.price?.toLocaleString()} XAF</span>
                        <span className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold capitalize ${sColors.badge}`}>
                          {(s.status || "").replace(/_/g, " ")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {total > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-[var(--glass-border)] px-4 py-5 md:flex-row md:px-8">
              <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-70">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              </p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:opacity-40">
                  <ChevronLeft className="size-4" /> Prev
                </button>
                <span className="min-w-[4rem] text-center font-mono text-[11px] opacity-70">{page} / {pages || 1}</span>
                <button type="button" disabled={page >= pages || loading} onClick={() => setPage((p) => (p < pages ? p + 1 : p))}
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[var(--glass-border)] px-3 py-2 text-[11px] font-semibold transition enabled:hover:bg-[var(--bg-secondary)] disabled:opacity-40">
                  Next <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );

  function addr(a) { return [a?.street, a?.quartier, a?.city].filter(Boolean).join(', '); }
}

export default function LogisticsTrackingPage() {
  return (
    <Suspense fallback={
      <div className="flex w-full min-h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="size-8 animate-spin text-[var(--accent)] opacity-50" />
      </div>
    }>
      <TrackingContent />
    </Suspense>
  );
}
