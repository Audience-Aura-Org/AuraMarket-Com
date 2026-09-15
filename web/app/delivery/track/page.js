'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/services/api';
import {
  Package, MapPin, Clock, CheckCircle2, XCircle, Truck, AlertTriangle,
  Search, Loader2, User, MessageCircle, Send, Copy, Check,
  ArrowLeft, Navigation, Phone, Shield, ChevronDown,
  Banknote, ArrowDownToLine, ClipboardList, Timer,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_FLOW = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
const STATUS_META = {
  pending:          { color: 'text-amber-600',   bg: 'bg-amber-500/10',   dot: 'bg-amber-500',   border: 'border-amber-500/20',   icon: Clock,         label: 'Pending',          sub: 'Awaiting courier assignment' },
  assigned:         { color: 'text-blue-600',    bg: 'bg-blue-500/10',    dot: 'bg-blue-500',    border: 'border-blue-500/20',    icon: Truck,         label: 'Assigned',         sub: 'Courier assigned to pickup' },
  picked_up:        { color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  dot: 'bg-indigo-500',  border: 'border-indigo-500/20',  icon: Package,       label: 'Picked Up',        sub: 'Package collected from sender' },
  in_transit:       { color: 'text-blue-600',    bg: 'bg-blue-500/10',    dot: 'bg-blue-500',    border: 'border-blue-500/20',    icon: Truck,         label: 'In Transit',       sub: 'On the way to destination' },
  out_for_delivery: { color: 'text-violet-600',  bg: 'bg-violet-500/10',  dot: 'bg-violet-500',  border: 'border-violet-500/20',  icon: Navigation,    label: 'Out for Delivery', sub: 'Courier is near drop-off' },
  delivered:        { color: 'text-emerald-600', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500', border: 'border-emerald-500/20', icon: CheckCircle2,  label: 'Delivered',        sub: 'Successfully delivered' },
  failed:           { color: 'text-rose-600',    bg: 'bg-rose-500/10',    dot: 'bg-rose-500',    border: 'border-rose-500/20',    icon: AlertTriangle, label: 'Failed',           sub: 'Delivery attempt failed' },
  cancelled:        { color: 'text-gray-600',    bg: 'bg-gray-500/10',    dot: 'bg-gray-500',    border: 'border-gray-500/20',    icon: XCircle,       label: 'Cancelled',        sub: 'Shipment was cancelled' },
};

/* ── Elapsed time helper ──────────────────────────────────────────── */
function timeAgo(date) {
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

function elapsed(from, to) {
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

/* ── Live Timer Hook ──────────────────────────────────────────────── */
function useLiveClock(active) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const iv = setInterval(() => setTick(t => t + 1), 30000); // update every 30s
    return () => clearInterval(iv);
  }, [active]);
}

/* ── Step-by-step Status Progress ─────────────────────────────────── */
function StatusStepper({ status, logs, createdAt, eta }) {
  const currentIdx = STATUS_FLOW.indexOf(status);
  const isFail = ['failed', 'cancelled'].includes(status);

  // Build timestamp map from logs
  const logMap = {};
  if (logs) {
    for (const log of logs) {
      if (log.status && log.timestamp) logMap[log.status] = log.timestamp;
    }
  }

  const stepList = isFail
    ? [...STATUS_FLOW.slice(0, Math.max(0, currentIdx) + 1).map(s => ({ key: s, ...STATUS_META[s] })), { key: status, ...STATUS_META[status] }]
    : STATUS_FLOW.map(s => ({ key: s, ...STATUS_META[s] }));

  // Deduplicate
  const seen = new Set();
  const uniqueSteps = stepList.filter(s => { if (seen.has(s.key)) return false; seen.add(s.key); return true; });

  return (
    <div className="space-y-8 pl-4 relative">
      {/* Vertical track line */}
      <div className="absolute left-[23px] top-4 bottom-4 w-[3px] rounded-full bg-[var(--glass-border)]/15" />

      {uniqueSteps.map((step, i) => {
        const StepIcon = step.icon;
        const reached = isFail ? i <= uniqueSteps.length - 1 : i <= currentIdx;
        const isCurrent = isFail ? i === uniqueSteps.length - 1 : i === currentIdx;
        const ts = logMap[step.key] || (step.key === 'pending' ? createdAt : null);

        return (
          <div key={step.key} className="flex gap-5 relative group">
            {/* Circle */}
            <div className={`z-10 size-10 rounded-full flex-shrink-0 flex items-center justify-center border-[3px] border-[var(--bg-primary)] shadow-md transition-all ${
              isCurrent
                ? `${step.dot} text-white shadow-lg`
                : reached
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)]/20'
            }`}>
              {reached && !isCurrent
                ? <CheckCircle2 className="size-5" />
                : isCurrent
                  ? <div className="size-2.5 rounded-full bg-white animate-ping" />
                  : <div className="size-2.5 rounded-full bg-[var(--glass-border)]/30" />
              }
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-baseline justify-between gap-2 mb-0.5">
                <h4 className={`text-[13px] font-bold tracking-tight ${
                  isCurrent ? step.color : reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/20'
                }`}>{step.label}</h4>
                {ts && reached && (
                  <span className="text-[10px] font-semibold text-[var(--text-secondary)]/30 tracking-tight shrink-0">
                    {new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <p className={`text-[11px] font-medium leading-relaxed ${
                isCurrent ? 'text-[var(--text-secondary)]/60' : reached ? 'text-[var(--text-secondary)]/40' : 'text-[var(--text-secondary)]/15'
              }`}>{step.sub}</p>
            </div>
          </div>
        );
      })}

      {/* ETA row at bottom */}
      {eta && (
        <div className="flex gap-5 relative">
          <div className="z-10 size-10 rounded-full flex-shrink-0 flex items-center justify-center border-[3px] border-[var(--bg-primary)] bg-[var(--accent)]/10 text-[var(--accent)]">
            <Clock className="size-4" />
          </div>
          <div className="flex-1 min-w-0 pt-1">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-wider">Estimated Delivery</p>
            <p className="text-[13px] font-bold text-[var(--accent)] mt-0.5">
              {new Date(eta).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function formatAddress(addr) {
  if (!addr || typeof addr !== 'object') return { lines: [], phone: null };
  const parts = [addr.street, addr.quartier, addr.city, addr.region, addr.country].filter(Boolean);
  return { lines: parts.length ? parts : ['—'], phone: addr.phone || null };
}

/* ── Main content ──────────────────────────────────────────────────── */
function TrackContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const [code, setCode] = useState(codeParam);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(!!codeParam);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [msgInput, setMsgInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const msgEnd = useRef(null);

  const fetchShipment = useCallback(async (tc) => {
    if (!tc) return;
    setLoading(true); setError('');
    try {
      const res = await api.get(`/p2p/track/${tc.trim().toUpperCase()}`);
      if (res.data?.success) setShipment(res.data.data.shipment);
      else { setError('Shipment not found'); setShipment(null); }
    } catch (err) { setError(err.response?.data?.message || 'Shipment not found'); setShipment(null); }
    setLoading(false);
  }, []);

  const fetchMsgs = useCallback(async (id) => {
    try {
      const res = await api.get(`/messages/shipment/${id}`);
      if (res.data?.success) setMessages(res.data.data?.messages || []);
    } catch {}
  }, []);

  const sendMsg = async () => {
    if (!msgInput.trim() || !shipment) return;
    try {
      const res = await api.post(`/messages/shipment/${shipment._id}`, { text: msgInput.trim() });
      if (res.data?.success) {
        setMsgInput('');
        setMessages(prev => [...prev, res.data.data.message]);
        setTimeout(() => msgEnd.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch {}
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(shipment?.tracking_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => { if (codeParam) fetchShipment(codeParam); }, [codeParam, fetchShipment]);
  useEffect(() => { if (shipment?._id) fetchMsgs(shipment._id); }, [shipment?._id, fetchMsgs]);
  useEffect(() => {
    if (!shipment || ['delivered', 'cancelled', 'failed'].includes(shipment.status)) return;
    const iv = setInterval(() => { fetchShipment(shipment.tracking_code); fetchMsgs(shipment._id); }, 30000);
    return () => clearInterval(iv);
  }, [shipment, fetchShipment, fetchMsgs]);

  const m = shipment ? STATUS_META[shipment.status] || STATUS_META.pending : null;
  const isTerminal = shipment && ['delivered', 'cancelled', 'failed'].includes(shipment.status);
  useLiveClock(!isTerminal && !!shipment);
  const pickup = shipment ? formatAddress(shipment.pickup_address) : { lines: [], phone: null };
  const drop = shipment ? formatAddress(shipment.delivery_address) : { lines: [], phone: null };
  const senderObj = shipment?.booked_by || shipment?.guest_booker;
  const recipientObj = shipment?.other_party;
  const pkg = shipment?.package_details;
  const eta = shipment?.estimated_delivery;
  const noteBlock = shipment?.delivery_description || null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      {/* ── Sticky Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)]/20">
        <div className="mx-auto max-w-2xl px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/delivery" className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/40 flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition-all shrink-0">
              <ArrowLeft className="size-4" />
            </Link>
            <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight flex-1">Track Delivery</h1>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]/25 pointer-events-none" />
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && fetchShipment(code)}
                className="w-full rounded-xl border border-[var(--glass-border)]/40 bg-[var(--bg-secondary)]/60 pl-10 pr-4 py-2.5 text-sm font-mono font-bold outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 placeholder:font-sans placeholder:font-normal placeholder:text-[var(--text-secondary)]/20 min-h-[44px]"
                placeholder="AURA-XXXXXX"
              />
            </div>
            <button onClick={() => fetchShipment(code)} disabled={loading || !code.trim()}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-white font-bold text-xs disabled:opacity-40 flex items-center gap-2 active:scale-95 transition-all min-h-[44px]">
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Track'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-5">
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 flex items-center gap-3">
            <AlertTriangle className="size-4 text-rose-500 shrink-0" />
            <p className="text-rose-600 text-xs font-semibold">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!shipment && !loading && !error && (
          <div className="py-24 text-center">
            <div className="size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/20 mx-auto flex items-center justify-center mb-4">
              <Package className="size-7 text-[var(--text-secondary)]/15" />
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] mb-1">Enter your tracking code</p>
            <p className="text-[11px] text-[var(--text-secondary)]/35">Paste or type your AURA-XXXXXX code above</p>
          </div>
        )}

        {/* Loading state */}
        {loading && !shipment && (
          <div className="py-24 flex flex-col items-center gap-3">
            <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
            <p className="text-[11px] text-[var(--text-secondary)]/35 font-semibold">Looking up shipment...</p>
          </div>
        )}

        {/* ── Shipment detail ──────────────────────────────────────── */}
        {shipment && m && (
          <div className="space-y-8">

            {/* ── Header: Status + Tracking Code ──────────────────── */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                  {shipment.tracking_code}
                </h2>
                <button onClick={copyCode} className="active:scale-95 transition-all">
                  {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4 text-[var(--text-secondary)]/25" />}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={`flex h-6 items-center rounded-full ${m.bg} px-2.5 text-[10px] font-bold uppercase tracking-wider ${m.color} border ${m.border}`}>
                  {m.label}
                </div>
                {eta && !isTerminal && (
                  <div className="flex h-6 items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2.5 text-[10px] font-bold text-[var(--accent)] border border-[var(--accent)]/20">
                    <Clock className="size-3" />
                    ETA {new Date(eta).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
              <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">
                Created {new Date(shipment.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>

            {/* ── Step-by-step Status Progress ─────────────────────── */}
            <StatusStepper
              status={shipment.status}
              logs={shipment.shipment_logs}
              createdAt={shipment.createdAt}
              eta={eta}
            />

            {/* ── Quick Info Row (price + carrier + payment) ──────── */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
                <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50">Price</p>
                <p className="mt-1 text-sm font-black text-[var(--text-primary)]">{(shipment.price ?? 0).toLocaleString()} <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40">XAF</span></p>
              </div>
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
                <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50">Carrier</p>
                <p className="mt-1 text-[12px] font-bold text-[var(--text-primary)] truncate">{shipment.logistics_id?.company_name || '—'}</p>
              </div>
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3">
                <p className="text-[8px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-50">Payment</p>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  shipment.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                }`}>{shipment.payment_status === 'paid' ? 'Paid' : 'Pending'}</span>
              </div>
            </div>

            {/* ── Route Timeline ───────────────────────────────────── */}
            <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-gradient-to-b before:from-[var(--accent)] before:to-[var(--accent)]/10">
              {/* Pickup */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 size-[23px] rounded-full bg-[var(--bg-primary)] border-2 border-[var(--accent)] shadow-[0_0_12px_rgba(var(--accent-rgb),0.3)] flex items-center justify-center">
                  <div className="size-1.5 rounded-full bg-[var(--accent)]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">Pickup Location</p>
                  <p className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                    {pickup.lines.join(', ')}
                  </p>
                  {pickup.phone && (
                    <a href={`tel:${pickup.phone}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors">
                      <Phone className="size-3 opacity-60" />
                      {pickup.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Delivery */}
              <div className="relative pl-8">
                <div className="absolute left-0 top-1 size-[23px] rounded-full bg-[var(--bg-primary)] border-2 border-[var(--text-secondary)]/30 flex items-center justify-center">
                  <MapPin className="size-3 text-[var(--text-secondary)] opacity-60" />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)] opacity-60">Delivery Destination</p>
                  <p className="text-[13px] font-medium leading-relaxed text-[var(--text-primary)]">
                    {drop.lines.join(', ')}
                  </p>
                  {drop.phone && (
                    <a href={`tel:${drop.phone}`} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--accent)]">
                      <Phone className="size-3" />
                      {drop.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* ── Sender & Recipient ───────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Sender */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <Send className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Sender</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[var(--text-primary)]">{senderObj?.name || '—'}</p>
                  {senderObj?.phone && (
                    <a href={`tel:${senderObj.phone}`} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] opacity-70 mt-1.5 hover:text-[var(--accent)] transition-colors">
                      <Phone className="size-3" />
                      {senderObj.phone}
                    </a>
                  )}
                  {senderObj?.email && (
                    <p className="text-[11px] text-[var(--text-secondary)] opacity-50 mt-1">{senderObj.email}</p>
                  )}
                </div>
                {shipment.pickup_address && (
                  <div className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-70 pt-2 border-t border-emerald-500/10">
                    {pickup.lines.join(', ')}
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
                  <p className="text-sm font-bold text-[var(--text-primary)]">{recipientObj?.name || '—'}</p>
                  {recipientObj?.phone && (
                    <a href={`tel:${recipientObj.phone}`} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] opacity-70 mt-1.5 hover:text-[var(--accent)] transition-colors">
                      <Phone className="size-3" />
                      {recipientObj.phone}
                    </a>
                  )}
                  {recipientObj?.email && (
                    <p className="text-[11px] text-[var(--text-secondary)] opacity-50 mt-1">{recipientObj.email}</p>
                  )}
                </div>
                {shipment.delivery_address && (
                  <div className="text-[11px] leading-relaxed text-[var(--text-secondary)] opacity-70 pt-2 border-t border-rose-500/10">
                    {drop.lines.join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* ── Delivery Notes ────────────────────────────────────── */}
            {noteBlock && (
              <div className="rounded-2xl border border-[var(--accent)]/10 bg-[var(--accent)]/[0.03] p-5 space-y-3">
                <div className="flex items-center gap-2 text-[var(--accent)]/60">
                  <ClipboardList className="size-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Delivery Notes</span>
                </div>
                <p className="text-[12px] leading-relaxed text-[var(--text-primary)] italic">{noteBlock}</p>
              </div>
            )}

            {/* ── Package Details ───────────────────────────────────── */}
            {pkg && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 opacity-60">
                  <Package className="size-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Package Details</span>
                </div>
                <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {pkg.category && (
                      <span className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] font-bold capitalize text-[var(--text-primary)]">
                        {pkg.category}
                      </span>
                    )}
                    {pkg.weight_tier && (
                      <span className="rounded-lg border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-1.5 text-[11px] font-bold capitalize text-[var(--text-primary)]">
                        {pkg.weight_tier.replace('_', ' ')}
                      </span>
                    )}
                    {pkg.declared_value > 0 && (
                      <span className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-1.5 text-[11px] font-bold text-amber-600">
                        Value: {pkg.declared_value.toLocaleString()} XAF
                      </span>
                    )}
                  </div>
                  {pkg.description && (
                    <p className="text-[12px] leading-relaxed text-[var(--text-secondary)] pt-2 border-t border-[var(--glass-border)]/50">
                      {pkg.description}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* ── Shipment Messages ─────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 opacity-60">
                <MessageCircle className="size-4" />
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Shipment Messages {messages.length > 0 && `(${messages.length})`}
                </span>
              </div>
              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 overflow-hidden">
                <div className="max-h-[300px] overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-center text-[11px] text-[var(--text-secondary)] opacity-40 py-6">
                      No messages yet. Start the conversation below.
                    </p>
                  ) : messages.map((msg, i) => {
                    const isMe = msg.sender_role === 'shipper';
                    const roleColors = { shipper: 'text-blue-600', recipient: 'text-rose-600', logistics: 'text-violet-600', admin: 'text-amber-600' };
                    return (
                      <div key={msg._id || i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 ${
                          isMe
                            ? 'bg-[var(--accent)] text-white rounded-br-md'
                            : 'bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 text-[var(--text-primary)] rounded-bl-md'
                        }`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-bold uppercase ${isMe ? 'text-white/70' : (roleColors[msg.sender_role] || 'text-[var(--text-secondary)] opacity-50')}`}>
                              {msg.sender_name || msg.sender_role}
                            </span>
                            <span className={`text-[9px] ${isMe ? 'text-white/40' : 'text-[var(--text-secondary)] opacity-30'}`}>
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[12px] leading-relaxed break-words">{msg.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={msgEnd} />
                </div>
                <form onSubmit={e => { e.preventDefault(); sendMsg(); }} className="flex items-center gap-2 border-t border-[var(--glass-border)]/30 p-3">
                  <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3.5 py-2.5 text-[12px] font-medium outline-none focus:border-[var(--accent)]/30 transition-colors placeholder:text-[var(--text-secondary)] placeholder:opacity-30 min-h-[40px]" />
                  <button type="submit" disabled={!msgInput.trim()}
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-white transition-all active:scale-95 disabled:opacity-30">
                    <Send className="size-4" />
                  </button>
                </form>
              </div>
            </div>

            {/* ── Timeline ──────────────────────────────────────────── */}
            {shipment.shipment_logs?.length > 0 && (
              <div className="space-y-3">
                <button type="button" onClick={() => setShowTimeline(!showTimeline)} className="flex items-center gap-2 w-full">
                  <Clock className="size-4 opacity-60" />
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60 flex-1 text-left">
                    Timeline ({shipment.shipment_logs.length} events)
                  </span>
                  <ChevronDown className={`size-4 text-[var(--text-secondary)]/30 transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
                </button>
                {showTimeline && (
                  <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 p-4 space-y-0">
                    {[...shipment.shipment_logs].reverse().map((log, i, arr) => {
                      const lm = STATUS_META[log.status] || STATUS_META.pending;
                      const first = i === 0;
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className={`size-2.5 rounded-full ${first ? lm.bg.replace('/10', '') || 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]/30'} ${first ? 'ring-[3px] ring-[var(--accent)]/10' : ''}`} />
                            {i < arr.length - 1 && <div className="w-px h-8 bg-[var(--glass-border)]/15" />}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-[10px] font-bold capitalize ${first ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/35'}`}>
                                {log.status?.replace(/_/g, ' ')}
                              </p>
                              <p className="text-[8px] text-[var(--text-secondary)]/25 shrink-0">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                            {log.note && <p className="text-[9px] text-[var(--text-secondary)]/30 mt-0.5">{log.note}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Proof of Delivery ─────────────────────────────────── */}
            {shipment.proof_of_delivery?.timestamp && (
              <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="size-4 text-emerald-500" />
                  <h3 className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Proof of Delivery</h3>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {shipment.proof_of_delivery.receiver_name && (
                    <p className="text-[var(--text-secondary)]/50">Received by: <strong className="text-[var(--text-primary)]">{shipment.proof_of_delivery.receiver_name}</strong></p>
                  )}
                  {shipment.proof_of_delivery.note && (
                    <p className="text-[var(--text-secondary)]/50">Note: <span className="text-[var(--text-primary)]">{shipment.proof_of_delivery.note}</span></p>
                  )}
                  <p className="text-emerald-600 font-semibold">{new Date(shipment.proof_of_delivery.timestamp).toLocaleString()}</p>
                  {shipment.proof_of_delivery.image_url && (
                    <img src={shipment.proof_of_delivery.image_url} alt="Proof" className="mt-2 rounded-xl max-h-40 object-cover w-full" />
                  )}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Bottom CTA */}
        <div className="pt-6 flex gap-2.5">
          <Link href="/delivery" className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-white font-bold text-xs text-center active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2">
            <Send className="size-3.5" /> Book Delivery
          </Link>
          <Link href="/delivery/history" className="flex-1 rounded-xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 py-3 text-[var(--text-primary)] font-bold text-xs text-center active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2">
            <Package className="size-3.5" /> My Deliveries
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TrackDeliveryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
      </div>
    }>
      <TrackContent />
    </Suspense>
  );
}
