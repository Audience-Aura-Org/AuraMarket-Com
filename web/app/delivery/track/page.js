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
const STATUS_LABELS = ['Pending', 'Assigned', 'Pickup', 'Transit', 'Delivery', 'Done'];
const STATUS_META = {
  pending:          { color: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500',   icon: Clock,         label: 'Pending',          sub: 'Awaiting assignment' },
  assigned:         { color: 'text-blue-600',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500',    icon: Truck,         label: 'Assigned',         sub: 'Driver assigned' },
  picked_up:        { color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500',  icon: Package,       label: 'Picked Up',        sub: 'Package collected' },
  in_transit:       { color: 'text-blue-600',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500',    icon: Truck,         label: 'In Transit',       sub: 'On the way' },
  out_for_delivery: { color: 'text-violet-600',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20',  dot: 'bg-violet-500',  icon: Navigation,    label: 'Out for Delivery', sub: 'Almost there' },
  delivered:        { color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500', icon: CheckCircle2,  label: 'Delivered',        sub: 'Successfully delivered' },
  failed:           { color: 'text-rose-600',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    dot: 'bg-rose-500',    icon: AlertTriangle, label: 'Failed',           sub: 'Delivery failed' },
  cancelled:        { color: 'text-gray-600',    bg: 'bg-gray-500/10',    border: 'border-gray-500/20',    dot: 'bg-gray-500',    icon: XCircle,       label: 'Cancelled',        sub: 'Cancelled' },
};

/* ── Card wrapper ──────────────────────────────────────────────────── */
const Card = ({ children, className = '' }) => (
  <div className={`rounded-2xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/40 p-4 ${className}`}>
    {children}
  </div>
);

/* ── Section label ─────────────────────────────────────────────────── */
const Label = ({ children, className = '' }) => (
  <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 ${className}`}>{children}</p>
);

/* ── Progress Bar ──────────────────────────────────────────────────── */
function StepProgress({ status }) {
  const idx = STATUS_FLOW.indexOf(status);
  const isFail = ['failed', 'cancelled'].includes(status);
  const done = status === 'delivered';
  const pct = isFail ? 0 : (Math.max(0, idx) / (STATUS_FLOW.length - 1)) * 100;
  return (
    <div className="pt-2 pb-1">
      <div className="relative h-1.5 rounded-full bg-[var(--glass-border)]/15 overflow-hidden mb-3">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${isFail ? 'bg-rose-500' : done ? 'bg-emerald-500' : 'bg-[var(--accent)]'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        {STATUS_FLOW.map((s, i) => {
          const reached = i <= idx && !isFail;
          const current = i === idx && !isFail;
          return (
            <div key={s} className="flex flex-col items-center gap-1" style={{ width: `${100 / STATUS_FLOW.length}%` }}>
              <div className={`size-2 rounded-full transition-all ${
                current ? 'bg-[var(--accent)] ring-2 ring-[var(--accent)]/20' : reached ? 'bg-[var(--accent)]' : 'bg-[var(--glass-border)]/30'
              }`} />
              <p className={`text-[7px] font-bold text-center leading-none ${current ? 'text-[var(--accent)]' : reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/20'}`}>
                {STATUS_LABELS[i]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Collapsible section ───────────────────────────────────────────── */
const Collapsible = ({ icon: Icon, title, badge, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="!p-0 overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3 active:bg-white/[0.02]">
        <Icon className="size-4 text-[var(--accent)] shrink-0" />
        <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1 text-left">{title}</span>
        {badge != null && (
          <span className="size-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[9px] font-bold flex items-center justify-center">{badge}</span>
        )}
        <ChevronDown className={`size-3.5 text-[var(--text-secondary)]/25 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="border-t border-[var(--glass-border)]/10">{children}</div>}
    </Card>
  );
};

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

      <div className="mx-auto max-w-md px-4 pt-5 space-y-3">
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
          <>
            {/* Status + Progress */}
            <Card>
              <div className="flex items-center gap-3 mb-1">
                <div className={`size-10 rounded-xl ${m.bg} border ${m.border} flex items-center justify-center shrink-0`}>
                  <m.icon className={`size-5 ${m.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-bold ${m.color}`}>{m.label}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]/40">{m.sub}</p>
                </div>
                {eta && !isEnd && (
                  <div className="flex items-center gap-1 bg-[var(--accent)]/10 rounded-lg px-2 py-1">
                    <Zap className="size-3 text-[var(--accent)]" />
                    <span className="font-mono text-[10px] font-bold text-[var(--accent)]">
                      {new Date(eta).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
              <StepProgress status={shipment.status} />
            </Card>

            {/* Tracking code + price bar */}
            <Card className="!py-3 flex items-center justify-between">
              <button onClick={copyCode} className="flex items-center gap-2 active:scale-95 transition-all">
                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{shipment.tracking_code}</span>
                {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-[var(--text-secondary)]/25" />}
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)]">{shipment.price?.toLocaleString()} XAF</span>
                <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${
                  shipment.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                }`}>{shipment.payment_status === 'paid' ? 'Paid' : 'Pending'}</span>
              </div>
            </Card>

            {/* Pickup Location */}
            <Card>
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="size-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-emerald-600">Pickup Location</Label>
                  <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{addr(shipment.pickup_address) || '—'}</p>
                  {shipment.pickup_address?.phone && (
                    <a href={`tel:${shipment.pickup_address.phone}`} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]/50 mt-1.5 hover:text-[var(--accent)]">
                      <Phone className="size-3" />{shipment.pickup_address.phone}
                    </a>
                  )}
                </div>
              </div>
            </Card>

            {/* Delivery Location */}
            <Card>
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="size-4 text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <Label className="text-rose-600">Delivery Location</Label>
                  <p className="text-xs font-semibold text-[var(--text-primary)] leading-snug">{addr(shipment.delivery_address) || '—'}</p>
                  {shipment.delivery_address?.phone && (
                    <a href={`tel:${shipment.delivery_address.phone}`} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]/50 mt-1.5 hover:text-[var(--accent)]">
                      <Phone className="size-3" />{shipment.delivery_address.phone}
                    </a>
                  )}
                </div>
              </div>
            </Card>

            {/* Sender + Recipient side by side */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <Label className="text-emerald-600">Sender</Label>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{senderObj?.name || '—'}</p>
                {senderObj?.phone && (
                  <a href={`tel:${senderObj.phone}`} className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]/50 mt-1 hover:text-[var(--accent)]">
                    <Phone className="size-3 shrink-0" /><span className="truncate">{senderObj.phone}</span>
                  </a>
                )}
              </Card>
              <Card>
                <Label className="text-rose-600">Recipient</Label>
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">{recipientObj?.name || '—'}</p>
                {recipientObj?.phone && (
                  <a href={`tel:${recipientObj.phone}`} className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)]/50 mt-1 hover:text-[var(--accent)]">
                    <Phone className="size-3 shrink-0" /><span className="truncate">{recipientObj.phone}</span>
                  </a>
                )}
              </Card>
            </div>

            {/* Package Details */}
            {pkg && (
              <Card>
                <Label className="text-[var(--accent)]">Package Details</Label>
                <div className="flex flex-wrap gap-1.5">
                  {pkg.category && (
                    <span className="text-[10px] font-semibold bg-[var(--bg-primary)] border border-[var(--glass-border)]/20 rounded-lg px-2.5 py-1 capitalize text-[var(--text-primary)]">
                      {pkg.category}
                    </span>
                  )}
                  {pkg.weight_tier && (
                    <span className="text-[10px] font-semibold bg-[var(--bg-primary)] border border-[var(--glass-border)]/20 rounded-lg px-2.5 py-1 capitalize text-[var(--text-primary)]">
                      {pkg.weight_tier.replace('_', ' ')}
                    </span>
                  )}
                  {pkg.declared_value > 0 && (
                    <span className="text-[10px] font-semibold bg-amber-500/10 border border-amber-500/15 rounded-lg px-2.5 py-1 text-amber-600">
                      Value: {pkg.declared_value.toLocaleString()} XAF
                    </span>
                  )}
                </div>
                {pkg.description && (
                  <p className="text-[11px] text-[var(--text-secondary)]/60 mt-2 leading-relaxed">{pkg.description}</p>
                )}
              </Card>
            )}

            {/* Carrier + Booked */}
            <div className="grid grid-cols-2 gap-3">
              {shipment.logistics_id?.company_name && (
                <Card>
                  <Label className="text-[var(--text-secondary)]/50">Carrier</Label>
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-[var(--text-secondary)]/30 shrink-0" />
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">{shipment.logistics_id.company_name}</p>
                  </div>
                </Card>
              )}
              <Card>
                <Label className="text-[var(--text-secondary)]/50">Booked</Label>
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-[var(--text-secondary)]/30 shrink-0" />
                  <p className="text-xs font-bold text-[var(--text-primary)]">{new Date(shipment.createdAt).toLocaleDateString()}</p>
                </div>
              </Card>
            </div>

            {/* Messages */}
            <Collapsible icon={MessageCircle} title="Shipment Messages" badge={messages.length || null} defaultOpen={messages.length > 0}>
              <div className="max-h-[280px] overflow-y-auto p-4 space-y-2">
                {messages.length === 0 ? (
                  <p className="text-[11px] text-[var(--text-secondary)]/25 text-center py-6">No messages yet</p>
                ) : messages.map((msg, i) => {
                  const roleColor = { shipper: 'text-blue-600', recipient: 'text-rose-600', logistics: 'text-violet-600', admin: 'text-amber-600' };
                  return (
                    <div key={i} className="rounded-xl bg-[var(--bg-primary)] p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-[10px] font-bold ${roleColor[msg.sender_role] || 'text-[var(--text-primary)]'}`}>
                          {msg.sender_name}
                        </span>
                        <span className="text-[8px] text-[var(--text-secondary)]/30">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed break-words">{msg.text}</p>
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
            </Collapsible>

            {/* Timeline */}
            {shipment.shipment_logs?.length > 0 && (
              <Collapsible icon={Clock} title="Timeline" badge={shipment.shipment_logs.length} defaultOpen={false}>
                <div className="p-4 space-y-0">
                  {[...shipment.shipment_logs].reverse().map((log, i, arr) => {
                    const lm = STATUS_META[log.status] || STATUS_META.pending;
                    const first = i === 0;
                    return (
                      <div key={i} className="flex items-start gap-3">
                        <div className="flex flex-col items-center shrink-0">
                          <div className={`size-2.5 rounded-full ${first ? lm.dot : 'bg-[var(--glass-border)]/30'} ${first ? 'ring-[3px] ring-[var(--accent)]/10' : ''}`} />
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
              </Collapsible>
            )}

            {/* Proof of Delivery */}
            {shipment.proof_of_delivery?.timestamp && (
              <Card className="!border-emerald-500/15 !bg-emerald-500/5">
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
              </Card>
            )}
          </>
        )}

        {/* Bottom CTA */}
        <div className="pt-3 flex gap-2.5">
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
