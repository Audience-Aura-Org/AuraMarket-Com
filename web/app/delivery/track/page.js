'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/services/api';
import {
  Package, MapPin, Clock, CheckCircle2, XCircle, Truck, AlertTriangle,
  Search, Loader2, Zap, User, MessageCircle, Send, Copy, Check,
  ArrowLeft, Navigation, Phone, Shield, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_FLOW = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
const STATUS_LABELS = ['Pending', 'Assigned', 'Picked Up', 'Transit', 'Delivering', 'Delivered'];
const STATUS_CONFIG = {
  pending:          { color: 'amber',   icon: Clock,         label: 'Pending',           sub: 'Awaiting assignment' },
  assigned:         { color: 'blue',    icon: Truck,         label: 'Assigned',          sub: 'Driver assigned to your delivery' },
  picked_up:        { color: 'indigo',  icon: Package,       label: 'Picked Up',         sub: 'Package collected from sender' },
  in_transit:       { color: 'blue',    icon: Truck,         label: 'In Transit',        sub: 'Package is on the way' },
  out_for_delivery: { color: 'violet',  icon: Navigation,    label: 'Out for Delivery',  sub: 'Almost there!' },
  delivered:        { color: 'emerald', icon: CheckCircle2,  label: 'Delivered',          sub: 'Successfully delivered' },
  failed:           { color: 'rose',    icon: AlertTriangle, label: 'Failed',            sub: 'Delivery could not be completed' },
  cancelled:        { color: 'gray',    icon: XCircle,       label: 'Cancelled',         sub: 'Delivery was cancelled' },
};

const COLORS = {
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600',   border: 'border-amber-500/20',   dot: 'bg-amber-500',   ring: 'ring-amber-500/20',   gradient: 'from-amber-500/15 to-amber-600/5' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600',    border: 'border-blue-500/20',    dot: 'bg-blue-500',    ring: 'ring-blue-500/20',    gradient: 'from-blue-500/15 to-blue-600/5' },
  indigo:  { bg: 'bg-indigo-500/10',  text: 'text-indigo-600',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500',  ring: 'ring-indigo-500/20',  gradient: 'from-indigo-500/15 to-indigo-600/5' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600',  border: 'border-violet-500/20',  dot: 'bg-violet-500',  ring: 'ring-violet-500/20',  gradient: 'from-violet-500/15 to-violet-600/5' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', dot: 'bg-emerald-500', ring: 'ring-emerald-500/20', gradient: 'from-emerald-500/15 to-emerald-600/5' },
  rose:    { bg: 'bg-rose-500/10',    text: 'text-rose-600',    border: 'border-rose-500/20',    dot: 'bg-rose-500',    ring: 'ring-rose-500/20',    gradient: 'from-rose-500/15 to-rose-600/5' },
  gray:    { bg: 'bg-gray-500/10',    text: 'text-gray-600',    border: 'border-gray-500/20',    dot: 'bg-gray-500',    ring: 'ring-gray-500/20',    gradient: 'from-gray-500/15 to-gray-600/5' },
};

function CountdownTimer({ estimatedDelivery }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    if (!estimatedDelivery) return;
    const tick = () => {
      const diff = new Date(estimatedDelivery).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Arrived'); return; }
      const d = Math.floor(diff / 86400000), h = Math.floor((diff / 3600000) % 24), m = Math.floor((diff / 60000) % 60), s = Math.floor((diff / 1000) % 60);
      setRemaining(d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [estimatedDelivery]);
  if (!remaining) return null;
  return (
    <div className="flex items-center gap-1.5 bg-[var(--accent)]/10 rounded-lg px-2.5 py-1.5">
      <Zap className="size-3 text-[var(--accent)]" />
      <span className="font-mono text-[11px] font-bold text-[var(--accent)]">{remaining}</span>
    </div>
  );
}

function StepProgress({ status }) {
  const idx = STATUS_FLOW.indexOf(status);
  const isFail = ['failed', 'cancelled'].includes(status);
  const isDone = status === 'delivered';

  return (
    <div className="py-1">
      {/* Steps */}
      <div className="flex items-start justify-between relative">
        {/* Connecting line */}
        <div className="absolute top-[11px] left-[11px] right-[11px] h-[2px] bg-[var(--glass-border)]/30 z-0" />
        <div
          className={`absolute top-[11px] left-[11px] h-[2px] z-[1] transition-all duration-700 ${
            isFail ? 'bg-rose-500' : isDone ? 'bg-emerald-500' : 'bg-[var(--accent)]'
          }`}
          style={{ width: isFail ? '0%' : `calc(${(Math.max(0, idx) / (STATUS_FLOW.length - 1)) * 100}% - 22px)` }}
        />

        {STATUS_FLOW.map((s, i) => {
          const reached = i <= idx && !isFail;
          const isCurrent = i === idx && !isFail;
          return (
            <div key={s} className="flex flex-col items-center z-[2]" style={{ width: `${100 / STATUS_FLOW.length}%` }}>
              <div className={`size-[22px] rounded-full flex items-center justify-center transition-all ${
                isCurrent
                  ? 'bg-[var(--accent)] ring-4 ring-[var(--accent)]/20 scale-110'
                  : reached
                    ? 'bg-[var(--accent)]'
                    : 'bg-[var(--bg-secondary)] border-2 border-[var(--glass-border)]/40'
              }`}>
                {reached && <Check className="size-3 text-white" />}
              </div>
              <p className={`text-[8px] font-bold mt-1.5 text-center leading-tight ${
                isCurrent ? 'text-[var(--accent)]' : reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/30'
              }`}>{STATUS_LABELS[i]}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrackDeliveryContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const [code, setCode] = useState(codeParam);
  const [shipment, setShipment] = useState(null);
  const [loading, setLoading] = useState(!!codeParam);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchShipment = useCallback(async (trackingCode) => {
    if (!trackingCode) return;
    setLoading(true); setError('');
    try {
      const res = await api.get(`/p2p/track/${trackingCode.trim().toUpperCase()}`);
      if (res.data?.success) setShipment(res.data.data.shipment);
      else { setError('Shipment not found'); setShipment(null); }
    } catch (err) { setError(err.response?.data?.message || 'Shipment not found'); setShipment(null); }
    setLoading(false);
  }, []);

  const fetchMessages = useCallback(async (id) => {
    try {
      const res = await api.get(`/messages/shipment/${id}`);
      if (res.data?.success) setMessages(res.data.data?.messages || []);
    } catch {}
  }, []);

  const sendMessage = async () => {
    if (!messageInput.trim() || !shipment) return;
    try {
      const res = await api.post(`/messages/shipment/${shipment._id}`, { text: messageInput.trim() });
      if (res.data?.success) {
        setMessageInput('');
        setMessages(prev => [...prev, res.data.data.message]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
    } catch {}
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(shipment?.tracking_code || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => { if (codeParam) fetchShipment(codeParam); }, [codeParam, fetchShipment]);
  useEffect(() => { if (shipment?._id) fetchMessages(shipment._id); }, [shipment?._id, fetchMessages]);
  useEffect(() => {
    if (!shipment || ['delivered', 'cancelled', 'failed'].includes(shipment.status)) return;
    const iv = setInterval(() => fetchShipment(shipment.tracking_code), 30000);
    return () => clearInterval(iv);
  }, [shipment, fetchShipment]);

  const config = shipment ? STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending : null;
  const colors = config ? COLORS[config.color] || COLORS.blue : null;
  const isTerminal = shipment && ['delivered', 'cancelled', 'failed'].includes(shipment.status);
  const addr = (a) => [a?.street, a?.quartier, a?.city].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)]/30">
        <div className="mx-auto max-w-lg px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/delivery" className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] active:scale-95 transition-all shrink-0">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">Track Delivery</h1>
              <p className="text-[10px] text-[var(--text-secondary)]/50">Live shipment tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]/30 pointer-events-none" />
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && fetchShipment(code)}
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2.5 text-sm font-mono font-bold outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:font-sans placeholder:font-normal placeholder:text-[var(--text-secondary)]/25 min-h-[44px]"
                placeholder="AURA-XXXXXX"
              />
            </div>
            <button
              onClick={() => fetchShipment(code)}
              disabled={loading || !code.trim()}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-white font-bold text-xs disabled:opacity-40 flex items-center gap-2 active:scale-95 transition-all min-h-[44px]"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Track'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-3 pt-4">
        {/* Error */}
        {error && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 mb-4 flex items-center gap-3">
            <AlertTriangle className="size-4 text-rose-500 shrink-0" />
            <p className="text-rose-600 text-xs font-semibold">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!shipment && !loading && !error && (
          <div className="py-24 text-center">
            <div className="size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/30 mx-auto flex items-center justify-center mb-4">
              <Package className="size-7 text-[var(--text-secondary)]/20" />
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] mb-1">Enter your tracking code</p>
            <p className="text-[11px] text-[var(--text-secondary)]/40">Paste or type your AURA-XXXXXX code above</p>
          </div>
        )}

        {/* Loading */}
        {loading && !shipment && (
          <div className="py-24 flex flex-col items-center gap-3">
            <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
            <p className="text-[11px] text-[var(--text-secondary)]/40 font-semibold">Looking up shipment...</p>
          </div>
        )}

        {/* Shipment */}
        {shipment && config && colors && (
          <div className="space-y-3">
            {/* Status Hero */}
            <div className={`rounded-2xl bg-gradient-to-br ${colors.gradient} border ${colors.border} p-4 relative overflow-hidden`}>
              <div className="absolute -right-8 -top-8 size-28 rounded-full bg-white/[0.03]" />

              <div className="flex items-center gap-3 mb-4">
                <div className={`size-11 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center shrink-0`}>
                  <config.icon className={`size-5 ${colors.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-base font-bold ${colors.text}`}>{config.label}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5">{config.sub}</p>
                </div>
                {shipment.estimated_delivery && !isTerminal && (
                  <CountdownTimer estimatedDelivery={shipment.estimated_delivery} />
                )}
              </div>

              <StepProgress status={shipment.status} />

              {/* Tracking + price */}
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                <button onClick={copyCode} className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-2.5 py-1.5 active:scale-95 transition-all">
                  <span className="font-mono text-[11px] font-bold text-[var(--text-primary)]">{shipment.tracking_code}</span>
                  {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-[var(--text-secondary)]/30" />}
                </button>
                <div className="flex items-center gap-2.5">
                  <span className="text-[12px] font-bold text-[var(--text-primary)]">{shipment.price?.toLocaleString()} XAF</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${
                    shipment.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>{shipment.payment_status === 'paid' ? 'Paid' : 'Pending'}</span>
                </div>
              </div>
            </div>

            {/* Route */}
            <div className="rounded-2xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center pt-0.5 shrink-0">
                  <div className="size-3 rounded-full bg-emerald-500 ring-[3px] ring-emerald-500/15" />
                  <div className="w-[2px] h-9 bg-gradient-to-b from-emerald-500/50 to-rose-500/50 my-1 rounded-full" />
                  <div className="size-3 rounded-full bg-rose-500 ring-[3px] ring-rose-500/15" />
                </div>
                <div className="flex-1 min-w-0 space-y-2.5">
                  <div>
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Pickup</p>
                    <p className="text-[12px] font-semibold text-[var(--text-primary)] mt-0.5 leading-snug">{addr(shipment.pickup_address) || '—'}</p>
                    {shipment.pickup_address?.name && <p className="text-[10px] text-[var(--text-secondary)]/40 mt-0.5">{shipment.pickup_address.name}</p>}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">Delivery</p>
                    <p className="text-[12px] font-semibold text-[var(--text-primary)] mt-0.5 leading-snug">{addr(shipment.delivery_address) || '—'}</p>
                    {shipment.delivery_address?.name && <p className="text-[10px] text-[var(--text-secondary)]/40 mt-0.5">{shipment.delivery_address.name}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Chips */}
            <div className="grid grid-cols-2 gap-2">
              {shipment.logistics_id?.company_name && (
                <div className="rounded-xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 p-3">
                  <Truck className="size-3.5 text-[var(--text-secondary)]/30 mb-1.5" />
                  <p className="text-[10px] text-[var(--text-secondary)]/40 font-bold">Provider</p>
                  <p className="text-[12px] font-bold text-[var(--text-primary)] truncate mt-0.5">{shipment.logistics_id.company_name}</p>
                </div>
              )}
              <div className="rounded-xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 p-3">
                <Send className="size-3.5 text-[var(--text-secondary)]/30 mb-1.5" />
                <p className="text-[10px] text-[var(--text-secondary)]/40 font-bold">Type</p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-0.5">{shipment.direction === 'send' ? 'Sending' : 'Pickup'}</p>
              </div>
              {shipment.estimated_delivery && (
                <div className="rounded-xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 p-3">
                  <Clock className="size-3.5 text-[var(--text-secondary)]/30 mb-1.5" />
                  <p className="text-[10px] text-[var(--text-secondary)]/40 font-bold">ETA</p>
                  <p className="text-[12px] font-bold text-[var(--text-primary)] mt-0.5">{new Date(shipment.estimated_delivery).toLocaleDateString()}</p>
                </div>
              )}
              <div className="rounded-xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 p-3">
                <Clock className="size-3.5 text-[var(--text-secondary)]/30 mb-1.5" />
                <p className="text-[10px] text-[var(--text-secondary)]/40 font-bold">Booked</p>
                <p className="text-[12px] font-bold text-[var(--text-primary)] mt-0.5">{new Date(shipment.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Package */}
            {shipment.package_details && (
              <div className="rounded-2xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <Package className="size-4 text-[var(--accent)]" />
                  <h3 className="text-[12px] font-bold text-[var(--text-primary)]">Package</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold bg-[var(--bg-primary)] border border-[var(--glass-border)]/20 rounded-lg px-2.5 py-1.5 capitalize">{shipment.package_details.category}</span>
                  <span className="text-[10px] font-bold bg-[var(--bg-primary)] border border-[var(--glass-border)]/20 rounded-lg px-2.5 py-1.5 capitalize">{shipment.package_details.weight_tier?.replace('_', ' ')}</span>
                  {shipment.package_details.declared_value > 0 && (
                    <span className="text-[10px] font-bold bg-[var(--bg-primary)] border border-[var(--glass-border)]/20 rounded-lg px-2.5 py-1.5">{shipment.package_details.declared_value?.toLocaleString()} XAF</span>
                  )}
                </div>
                {shipment.package_details.description && (
                  <p className="text-[11px] text-[var(--text-secondary)]/50 mt-2 leading-relaxed">{shipment.package_details.description}</p>
                )}
              </div>
            )}

            {/* Parties */}
            <div className="rounded-2xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <User className="size-4 text-[var(--accent)]" />
                <h3 className="text-[12px] font-bold text-[var(--text-primary)]">People</h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)]/10 p-3">
                  <p className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider mb-1.5">Sender</p>
                  {(shipment.booked_by || shipment.guest_booker) ? (
                    <>
                      <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">{(shipment.booked_by || shipment.guest_booker)?.name || '—'}</p>
                      {(shipment.booked_by || shipment.guest_booker)?.phone && (
                        <p className="text-[10px] text-[var(--text-secondary)]/40 mt-0.5 flex items-center gap-1 truncate">
                          <Phone className="size-2.5 shrink-0" />{(shipment.booked_by || shipment.guest_booker).phone}
                        </p>
                      )}
                    </>
                  ) : <p className="text-[11px] text-[var(--text-secondary)]/25">—</p>}
                </div>
                <div className="rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)]/10 p-3">
                  <p className="text-[8px] font-bold text-rose-600 uppercase tracking-wider mb-1.5">Recipient</p>
                  {shipment.other_party?.name ? (
                    <>
                      <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">{shipment.other_party.name}</p>
                      {shipment.other_party.phone && (
                        <p className="text-[10px] text-[var(--text-secondary)]/40 mt-0.5 flex items-center gap-1 truncate">
                          <Phone className="size-2.5 shrink-0" />{shipment.other_party.phone}
                        </p>
                      )}
                    </>
                  ) : <p className="text-[11px] text-[var(--text-secondary)]/25">—</p>}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="rounded-2xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 overflow-hidden">
              <button onClick={() => setShowMessages(!showMessages)}
                className="w-full flex items-center justify-between p-4 active:bg-white/[0.02] transition-colors min-h-[48px]">
                <div className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-[var(--accent)]" />
                  <h3 className="text-[12px] font-bold text-[var(--text-primary)]">Messages</h3>
                  {messages.length > 0 && (
                    <span className="size-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">{messages.length}</span>
                  )}
                </div>
                <ChevronDown className={`size-4 text-[var(--text-secondary)]/30 transition-transform ${showMessages ? 'rotate-180' : ''}`} />
              </button>
              {showMessages && (
                <div className="px-4 pb-4 border-t border-[var(--glass-border)]/15">
                  <div className="space-y-2 mb-3 max-h-64 overflow-y-auto pt-3">
                    {messages.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-secondary)]/30 text-center py-8">No messages yet</p>
                    ) : messages.map((msg, i) => (
                      <div key={i} className="rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)]/10 p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[10px] font-bold text-[var(--text-primary)]">{msg.sender_name || 'Unknown'}</p>
                          <p className="text-[8px] text-[var(--text-secondary)]/30 shrink-0">{new Date(msg.timestamp).toLocaleString()}</p>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]/70 leading-relaxed break-words">{msg.text}</p>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="flex gap-2">
                    <input value={messageInput} onChange={e => setMessageInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                      placeholder="Type a message..."
                      className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2.5 text-xs outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 placeholder:text-[var(--text-secondary)]/25 min-h-[40px]" />
                    <button onClick={sendMessage} disabled={!messageInput.trim()}
                      className="size-10 shrink-0 rounded-xl bg-[var(--accent)] text-white disabled:opacity-25 flex items-center justify-center active:scale-95 transition-all">
                      <Send className="size-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Timeline */}
            {shipment.shipment_logs?.length > 0 && (
              <div className="rounded-2xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 overflow-hidden">
                <button onClick={() => setShowTimeline(!showTimeline)}
                  className="w-full flex items-center justify-between p-4 active:bg-white/[0.02] transition-colors min-h-[48px]">
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-[var(--accent)]" />
                    <h3 className="text-[12px] font-bold text-[var(--text-primary)]">Timeline</h3>
                    <span className="text-[10px] text-[var(--text-secondary)]/30">{shipment.shipment_logs.length}</span>
                  </div>
                  <ChevronDown className={`size-4 text-[var(--text-secondary)]/30 transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
                </button>
                {showTimeline && (
                  <div className="px-4 pb-4 border-t border-[var(--glass-border)]/15 pt-3">
                    {[...shipment.shipment_logs].reverse().map((log, i, arr) => {
                      const lc = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                      const lcol = COLORS[lc.color] || COLORS.blue;
                      const isFirst = i === 0;
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex flex-col items-center shrink-0">
                            <div className={`size-2.5 rounded-full ${isFirst ? lcol.dot : 'bg-[var(--glass-border)]/40'} ${isFirst ? `ring-[3px] ${lcol.ring}` : ''}`} />
                            {i < arr.length - 1 && <div className="w-px h-7 bg-[var(--glass-border)]/20" />}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`text-[10px] font-bold capitalize ${isFirst ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/40'}`}>{log.status?.replace(/_/g, ' ')}</p>
                              <p className="text-[8px] text-[var(--text-secondary)]/30 shrink-0">{new Date(log.timestamp).toLocaleString()}</p>
                            </div>
                            {log.note && <p className="text-[9px] text-[var(--text-secondary)]/35 mt-0.5">{log.note}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Proof of Delivery */}
            {shipment.proof_of_delivery?.timestamp && (
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4">
                <div className="flex items-center gap-2 mb-2.5">
                  <Shield className="size-4 text-emerald-500" />
                  <h3 className="text-[12px] font-bold text-emerald-600">Proof of Delivery</h3>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {shipment.proof_of_delivery.receiver_name && (
                    <p className="text-[var(--text-secondary)]/60">Received by: <strong className="text-[var(--text-primary)]">{shipment.proof_of_delivery.receiver_name}</strong></p>
                  )}
                  {shipment.proof_of_delivery.note && (
                    <p className="text-[var(--text-secondary)]/60">Note: <span className="text-[var(--text-primary)]">{shipment.proof_of_delivery.note}</span></p>
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
        <div className="mt-6 flex gap-2.5">
          <Link href="/delivery" className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-white font-bold text-xs text-center active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2">
            <Send className="size-3.5" /> Book Delivery
          </Link>
          {shipment && (
            <Link href="/delivery/history" className="flex-1 rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 py-3 text-[var(--text-primary)] font-bold text-xs text-center active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2">
              <Package className="size-3.5" /> My Deliveries
            </Link>
          )}
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
      <TrackDeliveryContent />
    </Suspense>
  );
}
