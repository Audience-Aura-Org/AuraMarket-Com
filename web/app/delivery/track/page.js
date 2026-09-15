'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/services/api';
import {
  Package, MapPin, Clock, CheckCircle2, XCircle, Truck, AlertTriangle,
  Search, Loader2, User, MessageCircle, Send, Copy, Check,
  ArrowLeft, Navigation, Phone, Shield, ChevronDown, Zap,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_FLOW = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = ['Pending', 'Assigned', 'Picked Up', 'Transit', 'Delivering', 'Delivered'];
const STATUS_META = {
  pending:          { color: 'amber',   icon: Clock,         label: 'Pending',          sub: 'Awaiting assignment' },
  assigned:         { color: 'blue',    icon: Truck,         label: 'Assigned',         sub: 'Driver assigned' },
  picked_up:        { color: 'indigo',  icon: Package,       label: 'Picked Up',        sub: 'Package collected' },
  in_transit:       { color: 'blue',    icon: Truck,         label: 'In Transit',       sub: 'On the way' },
  out_for_delivery: { color: 'violet',  icon: Navigation,    label: 'Out for Delivery', sub: 'Almost there!' },
  delivered:        { color: 'emerald', icon: CheckCircle2,  label: 'Delivered',        sub: 'Successfully delivered' },
  failed:           { color: 'rose',    icon: AlertTriangle, label: 'Failed',           sub: 'Could not deliver' },
  cancelled:        { color: 'gray',    icon: XCircle,       label: 'Cancelled',        sub: 'Cancelled' },
};

const C = {
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600',   border: 'border-amber-500/20',   dot: 'bg-amber-500',   ring: 'ring-amber-500/20',   grad: 'from-amber-500/10 to-amber-600/5' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600',    border: 'border-blue-500/20',    dot: 'bg-blue-500',    ring: 'ring-blue-500/20',    grad: 'from-blue-500/10 to-blue-600/5' },
  indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-600',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500',  ring: 'ring-indigo-500/20',  grad: 'from-indigo-500/10 to-indigo-600/5' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600',  border: 'border-violet-500/20',  dot: 'bg-violet-500',  ring: 'ring-violet-500/20',  grad: 'from-violet-500/10 to-violet-600/5' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', dot: 'bg-emerald-500', ring: 'ring-emerald-500/20', grad: 'from-emerald-500/10 to-emerald-600/5' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600',    border: 'border-rose-500/20',    dot: 'bg-rose-500',    ring: 'ring-rose-500/20',    grad: 'from-rose-500/10 to-rose-600/5' },
  gray:    { bg: 'bg-gray-500/10',    text: 'text-gray-600',    border: 'border-gray-500/20',    dot: 'bg-gray-500',    ring: 'ring-gray-500/20',    grad: 'from-gray-500/10 to-gray-600/5' },
};

/* ── Progress Bar ───────────────────────────────────────────────────── */
function StepProgress({ status }) {
  const idx = STATUS_FLOW.indexOf(status);
  const isFail = ['failed', 'cancelled'].includes(status);
  const done = status === 'delivered';
  return (
    <div className="py-2">
      <div className="flex items-start justify-between relative">
        <div className="absolute top-3 left-3 right-3 h-[2px] bg-[var(--glass-border)]/20 z-0 rounded-full" />
        <div className={`absolute top-3 left-3 h-[2px] z-[1] rounded-full transition-all duration-700 ${isFail ? 'bg-rose-500' : done ? 'bg-emerald-500' : 'bg-[var(--accent)]'}`}
          style={{ width: isFail ? '0%' : `calc(${(Math.max(0, idx) / (STATUS_FLOW.length - 1)) * 100}% - 24px)` }} />
        {STATUS_FLOW.map((s, i) => {
          const reached = i <= idx && !isFail;
          const current = i === idx && !isFail;
          return (
            <div key={s} className="flex flex-col items-center z-[2]" style={{ width: `${100 / STATUS_FLOW.length}%` }}>
              <div className={`size-6 rounded-full flex items-center justify-center transition-all ${
                current ? 'bg-[var(--accent)] ring-4 ring-[var(--accent)]/15 scale-110' : reached ? 'bg-[var(--accent)]' : 'bg-[var(--bg-secondary)] border-2 border-[var(--glass-border)]/30'
              }`}>
                {reached && <Check className="size-3 text-white" />}
              </div>
              <p className={`text-[8px] font-bold mt-1.5 text-center leading-tight ${current ? 'text-[var(--accent)]' : reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/25'}`}>
                {STATUS_LABELS[i]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Section wrapper ────────────────────────────────────────────────── */
const Section = ({ icon: Icon, title, badge, children, collapsible, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-[var(--glass-border)]/15 bg-[var(--bg-secondary)]/20 overflow-hidden">
      <button type="button" onClick={() => collapsible && setOpen(!open)}
        className={`w-full flex items-center gap-2.5 px-4 py-3.5 ${collapsible ? 'active:bg-white/[0.02]' : ''}`}>
        <Icon className="size-4 text-[var(--accent)] shrink-0" />
        <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1 text-left">{title}</span>
        {badge != null && (
          <span className="size-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[9px] font-bold flex items-center justify-center">{badge}</span>
        )}
        {collapsible && <ChevronDown className={`size-3.5 text-[var(--text-secondary)]/25 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      {(!collapsible || open) && <div className="border-t border-[var(--glass-border)]/10">{children}</div>}
    </div>
  );
};

/* ── Main content ───────────────────────────────────────────────────── */
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
    const iv = setInterval(() => fetchShipment(shipment.tracking_code), 30000);
    return () => clearInterval(iv);
  }, [shipment, fetchShipment]);

  const m = shipment ? STATUS_META[shipment.status] || STATUS_META.pending : null;
  const c = m ? C[m.color] || C.blue : null;
  const isEnd = shipment && ['delivered', 'cancelled', 'failed'].includes(shipment.status);
  const addr = (a) => [a?.street, a?.quartier, a?.city].filter(Boolean).join(', ');
  const senderObj = shipment?.booked_by || shipment?.guest_booker;
  const recipientObj = shipment?.other_party;
  const pkg = shipment?.package_details;
  const eta = shipment?.estimated_delivery;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      {/* ── Sticky Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)]/20">
        <div className="mx-auto max-w-md px-4 py-3 space-y-3">
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

      <div className="mx-auto max-w-md px-4 pt-5 space-y-4">
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
        {shipment && m && c && (
          <div className="space-y-3">

            {/* 1. Status Card + Progress */}
            <div className={`rounded-2xl bg-gradient-to-br ${c.grad} border ${c.border} p-4 relative overflow-hidden`}>
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/[0.03]" />
              <div className="flex items-center gap-3 mb-3">
                <div className={`size-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center`}>
                  <m.icon className={`size-5 ${c.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-bold ${c.text}`}>{m.label}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]/40 mt-0.5">{m.sub}</p>
                </div>
                {eta && !isEnd && (
                  <div className="flex items-center gap-1.5 bg-[var(--accent)]/10 rounded-lg px-2.5 py-1.5">
                    <Zap className="size-3 text-[var(--accent)]" />
                    <span className="font-mono text-[10px] font-bold text-[var(--accent)]">
                      {new Date(eta).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
              <StepProgress status={shipment.status} />
            </div>

            {/* 2. Tracking Code + Price (compact bar) */}
            <div className="flex items-center justify-between rounded-xl border border-[var(--glass-border)]/15 bg-[var(--bg-secondary)]/30 px-4 py-3">
              <button onClick={copyCode} className="flex items-center gap-2 active:scale-95 transition-all">
                <span className="font-mono text-[12px] font-bold text-[var(--text-primary)]">{shipment.tracking_code}</span>
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-[var(--text-secondary)]/25" />}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-[var(--text-primary)]">{shipment.price?.toLocaleString()} XAF</span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${
                  shipment.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                }`}>{shipment.payment_status === 'paid' ? 'Paid' : 'Pending'}</span>
              </div>
            </div>

            {/* 3. Route Card */}
            <Section icon={MapPin} title="Route">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center pt-0.5 shrink-0">
                    <div className="size-3 rounded-full bg-emerald-500 ring-[3px] ring-emerald-500/10" />
                    <div className="w-[2px] h-10 bg-gradient-to-b from-emerald-500/40 to-rose-500/40 my-1 rounded-full" />
                    <div className="size-3 rounded-full bg-rose-500 ring-[3px] ring-rose-500/10" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <div>
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-0.5">From</p>
                      <p className="text-[12px] font-semibold text-[var(--text-primary)] leading-snug">{addr(shipment.pickup_address) || '—'}</p>
                      {shipment.pickup_address?.phone && (
                        <a href={`tel:${shipment.pickup_address.phone}`} className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)]/40 mt-1 hover:text-[var(--accent)]">
                          <Phone className="size-2.5" />{shipment.pickup_address.phone}
                        </a>
                      )}
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider mb-0.5">To</p>
                      <p className="text-[12px] font-semibold text-[var(--text-primary)] leading-snug">{addr(shipment.delivery_address) || '—'}</p>
                      {shipment.delivery_address?.phone && (
                        <a href={`tel:${shipment.delivery_address.phone}`} className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)]/40 mt-1 hover:text-[var(--accent)]">
                          <Phone className="size-2.5" />{shipment.delivery_address.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {/* 4. People (sender + recipient side-by-side) */}
            <Section icon={User} title="People">
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-[var(--bg-primary)]/60 border border-emerald-500/10 p-3">
                  <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Sender</p>
                  <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">{senderObj?.name || '—'}</p>
                  {senderObj?.phone && (
                    <a href={`tel:${senderObj.phone}`} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]/40 mt-1 hover:text-[var(--accent)]">
                      <Phone className="size-2.5 shrink-0" /><span className="truncate">{senderObj.phone}</span>
                    </a>
                  )}
                </div>
                <div className="rounded-xl bg-[var(--bg-primary)]/60 border border-rose-500/10 p-3">
                  <p className="text-[8px] font-bold text-rose-600 uppercase tracking-wider mb-2">Recipient</p>
                  <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">{recipientObj?.name || '—'}</p>
                  {recipientObj?.phone && (
                    <a href={`tel:${recipientObj.phone}`} className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]/40 mt-1 hover:text-[var(--accent)]">
                      <Phone className="size-2.5 shrink-0" /><span className="truncate">{recipientObj.phone}</span>
                    </a>
                  )}
                </div>
              </div>
            </Section>

            {/* 5. Package + Details row */}
            <div className="grid grid-cols-2 gap-3">
              {pkg && (
                <div className="rounded-2xl border border-[var(--glass-border)]/15 bg-[var(--bg-secondary)]/20 p-3.5">
                  <Package className="size-4 text-[var(--accent)] mb-2" />
                  <p className="text-[9px] font-bold text-[var(--text-secondary)]/40 uppercase tracking-wider mb-1.5">Package</p>
                  <p className="text-[12px] font-bold text-[var(--text-primary)] capitalize">{pkg.category || '—'}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]/35 capitalize mt-0.5">{pkg.weight_tier?.replace('_', ' ')}</p>
                  {pkg.declared_value > 0 && (
                    <p className="text-[10px] font-bold text-amber-600 mt-1">{pkg.declared_value.toLocaleString()} XAF</p>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {shipment.logistics_id?.company_name && (
                  <div className="rounded-2xl border border-[var(--glass-border)]/15 bg-[var(--bg-secondary)]/20 p-3.5">
                    <Truck className="size-4 text-[var(--text-secondary)]/25 mb-2" />
                    <p className="text-[9px] font-bold text-[var(--text-secondary)]/40 uppercase tracking-wider mb-1">Carrier</p>
                    <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">{shipment.logistics_id.company_name}</p>
                  </div>
                )}
                <div className="rounded-2xl border border-[var(--glass-border)]/15 bg-[var(--bg-secondary)]/20 p-3.5">
                  <Clock className="size-4 text-[var(--text-secondary)]/25 mb-2" />
                  <p className="text-[9px] font-bold text-[var(--text-secondary)]/40 uppercase tracking-wider mb-1">Booked</p>
                  <p className="text-[12px] font-bold text-[var(--text-primary)]">{new Date(shipment.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* 6. Package description (if any) */}
            {pkg?.description && (
              <div className="rounded-2xl border border-[var(--glass-border)]/15 bg-[var(--bg-secondary)]/20 p-4">
                <p className="text-[9px] font-bold text-[var(--text-secondary)]/40 uppercase tracking-wider mb-2">Description</p>
                <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">{pkg.description}</p>
              </div>
            )}

            {/* 7. Messages */}
            <Section icon={MessageCircle} title="Messages" badge={messages.length || null} collapsible defaultOpen={messages.length > 0}>
              <div className="max-h-[280px] overflow-y-auto p-4 space-y-2">
                {messages.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-secondary)]/25 text-center py-8">No messages yet</p>
                ) : messages.map((msg, i) => {
                  const isMe = msg.sender_role === 'logistics';
                  const roleColor = { shipper: 'text-blue-600', recipient: 'text-rose-600', logistics: 'text-violet-600', admin: 'text-amber-600' };
                  return (
                    <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                        isMe ? 'bg-[var(--accent)] text-white rounded-br-sm' : 'bg-[var(--bg-primary)] border border-[var(--glass-border)]/15 rounded-bl-sm'
                      }`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[9px] font-bold ${isMe ? 'text-white/70' : roleColor[msg.sender_role] || 'text-[var(--text-primary)]'}`}>
                            {msg.sender_name}
                          </span>
                          <span className={`text-[8px] ${isMe ? 'text-white/35' : 'text-[var(--text-secondary)]/25'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed break-words">{msg.text}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEnd} />
              </div>
              <div className="flex gap-2 p-3 border-t border-[var(--glass-border)]/10">
                <input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMsg())}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-primary)] px-3 py-2.5 text-xs outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-secondary)]/20 min-h-[40px]" />
                <button onClick={sendMsg} disabled={!msgInput.trim()}
                  className="size-10 shrink-0 rounded-xl bg-[var(--accent)] text-white disabled:opacity-20 flex items-center justify-center active:scale-95 transition-all">
                  <Send className="size-3.5" />
                </button>
              </div>
            </Section>

            {/* 8. Timeline */}
            {shipment.shipment_logs?.length > 0 && (
              <Section icon={Clock} title="Timeline" badge={shipment.shipment_logs.length} collapsible defaultOpen={false}>
                <div className="p-4 space-y-0">
                  {[...shipment.shipment_logs].reverse().map((log, i, arr) => {
                    const lm = STATUS_META[log.status] || STATUS_META.pending;
                    const lc = C[lm.color] || C.blue;
                    const first = i === 0;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`size-2.5 rounded-full ${first ? lc.dot : 'bg-[var(--glass-border)]/30'} ${first ? `ring-[3px] ${lc.ring}` : ''}`} />
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
              </Section>
            )}

            {/* 9. Proof of Delivery */}
            {shipment.proof_of_delivery?.timestamp && (
              <div className="rounded-2xl border border-emerald-500/15 bg-gradient-to-br from-emerald-500/8 to-emerald-500/3 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="size-4 text-emerald-500" />
                  <h3 className="text-[11px] font-bold text-emerald-600">Proof of Delivery</h3>
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
        <div className="pt-4 flex gap-2.5">
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
