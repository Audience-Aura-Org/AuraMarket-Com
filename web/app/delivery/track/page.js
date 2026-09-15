'use client';

import { useState, useEffect, Suspense, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/services/api';
import {
  Package, MapPin, Clock, CheckCircle2, XCircle, Truck, AlertTriangle,
  Search, Loader2, Zap, User, MessageCircle, Send, Copy, Check,
  ArrowLeft, Navigation, Phone, Mail, Shield, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_FLOW = ['pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered'];
const STATUS_CONFIG = {
  pending:          { color: 'amber',   bg: 'from-amber-500/20 to-amber-600/5',   icon: Clock,         label: 'Pending',           sub: 'Awaiting assignment' },
  assigned:         { color: 'blue',    bg: 'from-blue-500/20 to-blue-600/5',      icon: Truck,         label: 'Assigned',          sub: 'Driver assigned to your delivery' },
  picked_up:        { color: 'indigo',  bg: 'from-indigo-500/20 to-indigo-600/5',  icon: Package,       label: 'Picked Up',         sub: 'Package collected from sender' },
  in_transit:       { color: 'blue',    bg: 'from-blue-500/20 to-cyan-500/5',      icon: Truck,         label: 'In Transit',        sub: 'Package is on the way' },
  out_for_delivery: { color: 'violet',  bg: 'from-violet-500/20 to-purple-500/5',  icon: Navigation,    label: 'Out for Delivery',  sub: 'Almost there!' },
  delivered:        { color: 'emerald', bg: 'from-emerald-500/20 to-emerald-600/5', icon: CheckCircle2, label: 'Delivered',          sub: 'Package delivered successfully' },
  failed:           { color: 'rose',    bg: 'from-rose-500/20 to-rose-600/5',      icon: AlertTriangle, label: 'Failed',            sub: 'Delivery could not be completed' },
  cancelled:        { color: 'gray',    bg: 'from-gray-500/20 to-gray-600/5',      icon: XCircle,       label: 'Cancelled',         sub: 'Delivery was cancelled' },
};

const COLOR_MAP = {
  amber:   { dot: 'bg-amber-500',   ring: 'ring-amber-500/20',  text: 'text-amber-500',   badge: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  blue:    { dot: 'bg-blue-500',    ring: 'ring-blue-500/20',   text: 'text-blue-500',    badge: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  indigo:  { dot: 'bg-indigo-500',  ring: 'ring-indigo-500/20', text: 'text-indigo-500',  badge: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20' },
  violet:  { dot: 'bg-violet-500',  ring: 'ring-violet-500/20', text: 'text-violet-500',  badge: 'bg-violet-500/10 text-violet-600 border-violet-500/20' },
  emerald: { dot: 'bg-emerald-500', ring: 'ring-emerald-500/20', text: 'text-emerald-500', badge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  rose:    { dot: 'bg-rose-500',    ring: 'ring-rose-500/20',   text: 'text-rose-500',    badge: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
  gray:    { dot: 'bg-gray-500',    ring: 'ring-gray-500/20',   text: 'text-gray-500',    badge: 'bg-gray-500/10 text-gray-600 border-gray-500/20' },
};

function CountdownTimer({ estimatedDelivery }) {
  const [timeRemaining, setTimeRemaining] = useState('');

  useEffect(() => {
    if (!estimatedDelivery) return;
    const update = () => {
      const diff = new Date(estimatedDelivery).getTime() - Date.now();
      if (diff <= 0) { setTimeRemaining('Arrived'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff / 3600000) % 24);
      const m = Math.floor((diff / 60000) % 60);
      const s = Math.floor((diff / 1000) % 60);
      setTimeRemaining(d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [estimatedDelivery]);

  if (!estimatedDelivery || !timeRemaining) return null;

  return (
    <div className="flex items-center gap-2 bg-[var(--accent)]/10 rounded-xl px-3 py-2">
      <Zap className="size-3.5 text-[var(--accent)]" />
      <span className="font-mono text-xs font-bold text-[var(--accent)]">{timeRemaining}</span>
    </div>
  );
}

function ProgressBar({ status }) {
  const idx = STATUS_FLOW.indexOf(status);
  const isFinal = ['delivered', 'failed', 'cancelled'].includes(status);
  const steps = isFinal && status !== 'delivered' ? 0 : Math.max(0, idx);
  const pct = isFinal && status === 'delivered' ? 100 : Math.round((steps / (STATUS_FLOW.length - 1)) * 100);

  return (
    <div className="space-y-2">
      <div className="relative h-1.5 rounded-full bg-[var(--glass-border)]/50 overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
            status === 'delivered' ? 'bg-emerald-500' :
            status === 'failed' ? 'bg-rose-500' :
            status === 'cancelled' ? 'bg-gray-400' :
            'bg-[var(--accent)]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        {STATUS_FLOW.map((s, i) => {
          const reached = i <= idx && !['failed', 'cancelled'].includes(status);
          return (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className={`size-2 rounded-full transition-all ${reached ? 'bg-[var(--accent)] scale-110' : 'bg-[var(--glass-border)]/60'}`} />
              <span className={`text-[8px] font-semibold tracking-tight hidden sm:block ${reached ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/40'}`}>
                {STATUS_CONFIG[s]?.label}
              </span>
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
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/p2p/track/${trackingCode.trim().toUpperCase()}`);
      if (res.data?.success) setShipment(res.data.data.shipment);
      else { setError('Shipment not found'); setShipment(null); }
    } catch (err) {
      setError(err.response?.data?.message || 'Shipment not found');
      setShipment(null);
    }
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

  // Auto-refresh
  useEffect(() => {
    if (!shipment || ['delivered', 'cancelled', 'failed'].includes(shipment.status)) return;
    const iv = setInterval(() => fetchShipment(shipment.tracking_code), 30000);
    return () => clearInterval(iv);
  }, [shipment, fetchShipment]);

  const config = shipment ? STATUS_CONFIG[shipment.status] || STATUS_CONFIG.pending : null;
  const colors = config ? COLOR_MAP[config.color] || COLOR_MAP.blue : null;
  const isTerminal = shipment && ['delivered', 'cancelled', 'failed'].includes(shipment.status);
  const addr = (a) => [a?.street, a?.quartier, a?.city].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      {/* Sticky Search Header */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)]/30">
        <div className="mx-auto max-w-lg px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/delivery" className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] hover:border-[var(--accent)]/30 transition-all active:scale-95">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">Track Delivery</h1>
              <p className="text-[10px] font-semibold text-[var(--text-secondary)]/50 tracking-tight">Live shipment tracking</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]/40 pointer-events-none" />
              <input
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && fetchShipment(code)}
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] pl-10 pr-4 py-2.5 text-sm font-mono font-semibold outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:font-sans placeholder:text-[var(--text-secondary)]/30"
                placeholder="AURA-XXXXXX"
              />
            </div>
            <button
              onClick={() => fetchShipment(code)}
              disabled={loading || !code.trim()}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-white font-bold text-xs disabled:opacity-40 flex items-center gap-2 active:scale-95 transition-all"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : 'Track'}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4">
        {/* Error */}
        {error && (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 mb-4 flex items-center gap-3">
            <AlertTriangle className="size-5 text-rose-500 shrink-0" />
            <p className="text-rose-600 text-xs font-semibold">{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!shipment && !loading && !error && (
          <div className="py-20 text-center">
            <div className="size-20 rounded-3xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 mx-auto flex items-center justify-center mb-5">
              <Package className="size-8 text-[var(--text-secondary)]/30" />
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] mb-1">Enter your tracking code</p>
            <p className="text-xs text-[var(--text-secondary)]/50">Paste or type your AURA-XXXXXX code above</p>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !shipment && (
          <div className="py-20 flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
            <p className="text-xs font-semibold text-[var(--text-secondary)]/50">Looking up shipment...</p>
          </div>
        )}

        {/* Shipment Details */}
        {shipment && config && colors && (
          <div className="space-y-3">
            {/* Main Status Card */}
            <div className={`rounded-2xl bg-gradient-to-br ${config.bg} border border-[var(--glass-border)]/30 p-5 relative overflow-hidden`}>
              {/* Decorative */}
              <div className="absolute -right-6 -top-6 size-24 rounded-full bg-white/[0.03]" />

              <div className="flex items-start gap-3.5 mb-4">
                <div className={`size-12 rounded-2xl ${colors.badge} border flex items-center justify-center shrink-0`}>
                  <config.icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-lg font-bold ${colors.text}`}>{config.label}</p>
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)]/60 mt-0.5">{config.sub}</p>
                </div>
                {shipment.estimated_delivery && !isTerminal && (
                  <CountdownTimer estimatedDelivery={shipment.estimated_delivery} />
                )}
              </div>

              {/* Progress */}
              <ProgressBar status={shipment.status} />

              {/* Tracking code + quick stats */}
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
                <button onClick={copyCode} className="flex items-center gap-2 rounded-lg bg-white/[0.05] px-3 py-1.5 active:scale-95 transition-all">
                  <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{shipment.tracking_code}</span>
                  {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3 text-[var(--text-secondary)]/40" />}
                </button>
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="font-bold text-[var(--text-primary)]">{shipment.price?.toLocaleString()} XAF</span>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    shipment.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'
                  }`}>{shipment.payment_status === 'paid' ? 'Paid' : 'Pending'}</span>
                </div>
              </div>
            </div>

            {/* Route Card */}
            <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 p-4">
              <div className="flex items-start gap-3">
                {/* Vertical line connector */}
                <div className="flex flex-col items-center pt-1 shrink-0">
                  <div className="size-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10" />
                  <div className="w-0.5 h-10 bg-gradient-to-b from-emerald-500/60 to-rose-500/60 my-1" />
                  <div className="size-3 rounded-full bg-rose-500 ring-4 ring-rose-500/10" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Pickup</p>
                    <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 leading-snug">{addr(shipment.pickup_address) || '—'}</p>
                    {shipment.pickup_address?.name && (
                      <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5">{shipment.pickup_address.name}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Delivery</p>
                    <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5 leading-snug">{addr(shipment.delivery_address) || '—'}</p>
                    {shipment.delivery_address?.name && (
                      <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5">{shipment.delivery_address.name}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Provider */}
              {shipment.logistics_id?.company_name && (
                <div className="rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Truck className="size-3.5 text-[var(--text-secondary)]/40" />
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]/50 uppercase">Provider</span>
                  </div>
                  <p className="text-xs font-bold text-[var(--text-primary)] truncate">{shipment.logistics_id.company_name}</p>
                </div>
              )}
              {/* Direction */}
              <div className="rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Send className="size-3.5 text-[var(--text-secondary)]/40" />
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]/50 uppercase">Type</span>
                </div>
                <p className="text-xs font-bold text-[var(--text-primary)]">{shipment.direction === 'send' ? 'Sending' : 'Pickup Request'}</p>
              </div>
              {/* Estimated */}
              {shipment.estimated_delivery && (
                <div className="rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Clock className="size-3.5 text-[var(--text-secondary)]/40" />
                    <span className="text-[10px] font-bold text-[var(--text-secondary)]/50 uppercase">ETA</span>
                  </div>
                  <p className="text-xs font-bold text-[var(--text-primary)]">{new Date(shipment.estimated_delivery).toLocaleDateString()}</p>
                </div>
              )}
              {/* Created */}
              <div className="rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 p-3.5">
                <div className="flex items-center gap-2 mb-1.5">
                  <Clock className="size-3.5 text-[var(--text-secondary)]/40" />
                  <span className="text-[10px] font-bold text-[var(--text-secondary)]/50 uppercase">Booked</span>
                </div>
                <p className="text-xs font-bold text-[var(--text-primary)]">{new Date(shipment.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Package Details */}
            {shipment.package_details && (
              <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="size-4 text-[var(--accent)]" />
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">Package</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[var(--bg-primary)] border border-[var(--glass-border)]/30 rounded-lg px-2.5 py-1.5 capitalize">
                    {shipment.package_details.category}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[var(--bg-primary)] border border-[var(--glass-border)]/30 rounded-lg px-2.5 py-1.5 capitalize">
                    {shipment.package_details.weight_tier?.replace('_', ' ')}
                  </span>
                  {shipment.package_details.declared_value > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-[var(--bg-primary)] border border-[var(--glass-border)]/30 rounded-lg px-2.5 py-1.5">
                      {shipment.package_details.declared_value?.toLocaleString()} XAF
                    </span>
                  )}
                </div>
                {shipment.package_details.description && (
                  <p className="text-[11px] text-[var(--text-secondary)]/60 mt-2.5 leading-relaxed">{shipment.package_details.description}</p>
                )}
              </div>
            )}

            {/* Parties */}
            <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 p-4">
              <div className="flex items-center gap-2 mb-3">
                <User className="size-4 text-[var(--accent)]" />
                <h3 className="text-xs font-bold text-[var(--text-primary)]">People</h3>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl bg-[var(--bg-primary)] p-3">
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-2">Sender</p>
                  {(shipment.booked_by || shipment.guest_booker) ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{(shipment.booked_by || shipment.guest_booker)?.name || '—'}</p>
                      {(shipment.booked_by || shipment.guest_booker)?.phone && (
                        <p className="text-[10px] text-[var(--text-secondary)]/50 truncate flex items-center gap-1">
                          <Phone className="size-2.5 shrink-0" />
                          {(shipment.booked_by || shipment.guest_booker).phone}
                        </p>
                      )}
                    </div>
                  ) : <p className="text-[11px] text-[var(--text-secondary)]/30">—</p>}
                </div>
                <div className="rounded-xl bg-[var(--bg-primary)] p-3">
                  <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider mb-2">Recipient</p>
                  {shipment.other_party?.name ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-[var(--text-primary)] truncate">{shipment.other_party.name}</p>
                      {shipment.other_party.phone && (
                        <p className="text-[10px] text-[var(--text-secondary)]/50 truncate flex items-center gap-1">
                          <Phone className="size-2.5 shrink-0" />
                          {shipment.other_party.phone}
                        </p>
                      )}
                    </div>
                  ) : <p className="text-[11px] text-[var(--text-secondary)]/30">—</p>}
                </div>
              </div>
            </div>

            {/* Messages - Collapsible */}
            <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 overflow-hidden">
              <button
                onClick={() => setShowMessages(!showMessages)}
                className="w-full flex items-center justify-between p-4 active:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-[var(--accent)]" />
                  <h3 className="text-xs font-bold text-[var(--text-primary)]">Messages</h3>
                  {messages.length > 0 && (
                    <span className="size-5 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[10px] font-bold flex items-center justify-center">{messages.length}</span>
                  )}
                </div>
                <ChevronDown className={`size-4 text-[var(--text-secondary)]/40 transition-transform ${showMessages ? 'rotate-180' : ''}`} />
              </button>
              {showMessages && (
                <div className="px-4 pb-4 border-t border-[var(--glass-border)]/20">
                  <div className="space-y-2.5 mb-3 max-h-64 overflow-y-auto pt-3 scrollbar-thin">
                    {messages.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-secondary)]/40 text-center py-6">No messages yet</p>
                    ) : messages.map((msg, i) => (
                      <div key={i} className="rounded-xl bg-[var(--bg-primary)] p-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[11px] font-bold text-[var(--text-primary)]">{msg.sender_name || 'Unknown'}</p>
                          <p className="text-[9px] text-[var(--text-secondary)]/40 shrink-0">{new Date(msg.timestamp).toLocaleString()}</p>
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
                      className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-xs outline-none transition-all focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 placeholder:text-[var(--text-secondary)]/30"
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
              <div className="rounded-2xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/50 overflow-hidden">
                <button
                  onClick={() => setShowTimeline(!showTimeline)}
                  className="w-full flex items-center justify-between p-4 active:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-4 text-[var(--accent)]" />
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">Timeline</h3>
                  </div>
                  <ChevronDown className={`size-4 text-[var(--text-secondary)]/40 transition-transform ${showTimeline ? 'rotate-180' : ''}`} />
                </button>
                {showTimeline && (
                  <div className="px-4 pb-4 border-t border-[var(--glass-border)]/20 pt-3">
                    <div className="space-y-0">
                      {[...shipment.shipment_logs].reverse().map((log, i, arr) => {
                        const logConfig = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                        const logColors = COLOR_MAP[logConfig.color] || COLOR_MAP.blue;
                        const isFirst = i === 0;
                        const isLast = i === arr.length - 1;
                        return (
                          <div key={i} className="flex items-start gap-3">
                            <div className="flex flex-col items-center shrink-0">
                              <div className={`size-2.5 rounded-full ${isFirst ? logColors.dot : 'bg-[var(--glass-border)]/60'} ring-4 ${isFirst ? logColors.ring : 'ring-transparent'}`} />
                              {!isLast && <div className="w-px h-8 bg-[var(--glass-border)]/30" />}
                            </div>
                            <div className={`flex-1 min-w-0 ${!isLast ? 'pb-2' : ''}`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className={`text-[11px] font-bold capitalize ${isFirst ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/60'}`}>
                                  {log.status?.replace(/_/g, ' ')}
                                </p>
                                <p className="text-[9px] text-[var(--text-secondary)]/40 shrink-0">{new Date(log.timestamp).toLocaleString()}</p>
                              </div>
                              {log.note && <p className="text-[10px] text-[var(--text-secondary)]/50 mt-0.5 leading-relaxed">{log.note}</p>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Proof of Delivery */}
            {shipment.proof_of_delivery?.timestamp && (
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="size-4 text-emerald-500" />
                  <h3 className="text-xs font-bold text-emerald-600">Proof of Delivery</h3>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {shipment.proof_of_delivery.receiver_name && (
                    <p className="text-[var(--text-secondary)]">Received by: <strong className="text-[var(--text-primary)]">{shipment.proof_of_delivery.receiver_name}</strong></p>
                  )}
                  {shipment.proof_of_delivery.note && (
                    <p className="text-[var(--text-secondary)]">Note: <span className="text-[var(--text-primary)]">{shipment.proof_of_delivery.note}</span></p>
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
          <Link href="/delivery" className="flex-1 rounded-xl bg-[var(--accent)] px-5 py-3 text-white font-bold text-xs text-center active:scale-95 transition-all">
            Book a Delivery
          </Link>
          {shipment && (
            <Link href="/delivery/history" className="flex-1 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-5 py-3 text-[var(--text-primary)] font-bold text-xs text-center active:scale-95 transition-all">
              My Deliveries
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
