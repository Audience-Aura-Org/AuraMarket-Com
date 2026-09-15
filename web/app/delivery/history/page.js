'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import {
  Package, Send, ArrowDownToLine, Clock, CheckCircle2, XCircle,
  Truck, AlertTriangle, MapPin, Loader2, ArrowLeft, Navigation,
  ChevronLeft, ChevronRight, Filter, ChevronDown, Phone, Timer,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG = {
  pending:          { icon: Clock,         label: 'Pending',          bg: 'bg-amber-500/10',   text: 'text-amber-600',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  assigned:         { icon: Truck,         label: 'Assigned',         bg: 'bg-blue-500/10',    text: 'text-blue-600',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
  picked_up:        { icon: Package,       label: 'Picked Up',        bg: 'bg-indigo-500/10',  text: 'text-indigo-600',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500' },
  in_transit:       { icon: Truck,         label: 'In Transit',       bg: 'bg-blue-500/10',    text: 'text-blue-600',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
  out_for_delivery: { icon: Navigation,    label: 'Out for Delivery', bg: 'bg-violet-500/10',  text: 'text-violet-600',  border: 'border-violet-500/20',  dot: 'bg-violet-500' },
  delivered:        { icon: CheckCircle2,  label: 'Delivered',        bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  failed:           { icon: AlertTriangle, label: 'Failed',           bg: 'bg-rose-500/10',    text: 'text-rose-600',    border: 'border-rose-500/20',    dot: 'bg-rose-500' },
  cancelled:        { icon: XCircle,       label: 'Cancelled',        bg: 'bg-gray-500/10',    text: 'text-gray-600',    border: 'border-gray-500/20',    dot: 'bg-gray-500' },
};

const TABS = [
  { key: 'all',       label: 'All',      icon: Package },
  { key: 'booker',    label: 'Sent',     icon: Send },
  { key: 'recipient', label: 'Received', icon: ArrowDownToLine },
];

function timeAgo(date) {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function DeliveryHistoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    if (!user) { router.push('/login'); return; }
    fetchDeliveries();
  }, [user, statusFilter, page]);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/p2p/my-deliveries?${params}`);
      if (res.data?.success) {
        setShipments(res.data.data.shipments || []);
        setPages(res.data.pages || 1);
        setTotal(res.data.total || res.data.data.shipments?.length || 0);
      }
    } catch { setShipments([]); }
    setLoading(false);
  };

  const filtered = tab === 'all' ? shipments
    : tab === 'booker' ? shipments.filter(s => s.role === 'booker')
    : shipments.filter(s => s.role === 'recipient');

  const counts = {
    all: shipments.length,
    booker: shipments.filter(s => s.role === 'booker').length,
    recipient: shipments.filter(s => s.role === 'recipient').length,
  };

  const activeCount = shipments.filter(s => !['delivered', 'cancelled', 'failed'].includes(s.status)).length;

  const addr = (a) => [a?.quartier, a?.city].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      {/* ── Sticky Header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)]/20">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/delivery" className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/40 flex items-center justify-center text-[var(--text-secondary)] active:scale-95 transition-all shrink-0">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-[15px] font-bold text-[var(--text-primary)] tracking-tight">My Deliveries</h1>
              <p className="text-[10px] text-[var(--text-secondary)]/40">
                {loading ? 'Loading...' : `${total} total · ${activeCount} active`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-5 space-y-4">
        {/* ── Role Tabs (All / Sent / Received) ────────────────────── */}
        <div className="grid grid-cols-3 gap-3">
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-center transition-all active:scale-[0.97] ${
                  active
                    ? 'bg-[var(--accent)]/10 border-[var(--accent)]/25'
                    : 'bg-[var(--bg-secondary)]/30 border-[var(--glass-border)]/15 hover:border-[var(--accent)]/20 hover:bg-[var(--bg-secondary)]/50'
                }`}
              >
                <t.icon className={`absolute -right-2 -top-2 size-12 rotate-12 opacity-[0.04]`} />
                <t.icon className={`size-4 mx-auto mb-2 ${active ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]/30'}`} />
                <p className={`text-xl font-black leading-none tracking-tight ${active ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{counts[t.key]}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider mt-1.5 ${active ? 'text-[var(--accent)]/70' : 'text-[var(--text-secondary)]/30'}`}>{t.label}</p>
              </button>
            );
          })}
        </div>

        {/* ── Status Filter (collapsible) ──────────────────────────── */}
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setFilterOpen(!filterOpen)}
            className="w-full flex items-center gap-2.5 px-4 py-3 active:bg-white/[0.02]"
          >
            <Filter className="size-4 text-[var(--accent)] shrink-0" />
            <span className="text-[11px] font-bold text-[var(--text-primary)] flex-1 text-left">
              Status Filter
            </span>
            {statusFilter && (
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${STATUS_CONFIG[statusFilter]?.bg} ${STATUS_CONFIG[statusFilter]?.text}`}>
                {STATUS_CONFIG[statusFilter]?.label}
              </span>
            )}
            <ChevronDown className={`size-3.5 text-[var(--text-secondary)]/25 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterOpen && (
            <div className="border-t border-[var(--glass-border)]/30 p-3">
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => { setStatusFilter(''); setPage(1); }}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 ${
                    !statusFilter ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--glass-border)]/20'
                  }`}
                >All</button>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => { setStatusFilter(k); setPage(1); }}
                    className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 ${
                      statusFilter === k ? `${v.bg} ${v.text} border ${v.border}` : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--glass-border)]/20'
                    }`}
                  >{v.label}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Loading ──────────────────────────────────────────────── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
            <p className="text-[11px] text-[var(--text-secondary)]/35 font-semibold">Loading deliveries...</p>
          </div>
        )}

        {/* ── Empty ───────────────────────────────────────────────── */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/20 mx-auto flex items-center justify-center mb-4">
              <Package className="size-7 text-[var(--text-secondary)]/15" />
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] mb-1">No deliveries yet</p>
            <p className="text-[11px] text-[var(--text-secondary)]/35 mb-5">
              {statusFilter ? 'Try a different filter' : 'Book your first delivery to get started'}
            </p>
            <Link href="/delivery" className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-white text-xs font-bold active:scale-95 transition-all min-h-[44px]">
              <Send className="size-3.5" /> Book a Delivery
            </Link>
          </div>
        )}

        {/* ── Shipment List ───────────────────────────────────────── */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(s => {
              const config = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
              const StatusIcon = config.icon;
              const isSender = s.role === 'booker';
              const isActive = !['delivered', 'cancelled', 'failed'].includes(s.status);

              return (
                <Link
                  key={s._id}
                  href={`/delivery/track?code=${s.tracking_code}`}
                  className={`block rounded-2xl border overflow-hidden transition-all active:scale-[0.99] ${
                    isActive ? 'border-[var(--accent)]/15 hover:border-[var(--accent)]/30' : 'border-[var(--glass-border)] hover:border-[var(--glass-border)]/60'
                  } bg-[var(--bg-secondary)]/10`}
                >
                  {/* Status stripe */}
                  <div className={`h-[3px] ${config.dot}`} />

                  <div className="p-4 space-y-3">
                    {/* Row 1: Role icon + tracking code + status badge + time */}
                    <div className="flex items-center gap-3">
                      <div className={`size-10 rounded-xl ${config.bg} border ${config.border} flex items-center justify-center shrink-0`}>
                        {isSender ? <Send className={`size-4 ${config.text}`} /> : <ArrowDownToLine className={`size-4 ${config.text}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-[12px] font-bold text-[var(--text-primary)] tracking-wide">{s.tracking_code}</p>
                          <span className="text-[9px] font-mono text-[var(--text-secondary)]/25">{timeAgo(s.createdAt)}</span>
                        </div>
                        <p className="text-[10px] text-[var(--text-secondary)]/40 mt-0.5">
                          {isSender ? 'You sent' : 'Sent to you'} · {new Date(s.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                        </p>
                      </div>
                      <div className={`shrink-0 flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${config.bg} ${config.text} ${config.border}`}>
                        <StatusIcon className="size-3" />
                        <span className="text-[9px] font-bold">{config.label}</span>
                      </div>
                    </div>

                    {/* Row 2: Route timeline style */}
                    <div className="relative pl-6 space-y-3 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-gradient-to-b before:from-emerald-500/40 before:to-rose-500/40">
                      <div className="relative">
                        <div className="absolute -left-6 top-0.5 size-[15px] rounded-full bg-[var(--bg-primary)] border-2 border-emerald-500 flex items-center justify-center">
                          <div className="size-1 rounded-full bg-emerald-500" />
                        </div>
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">From</p>
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{addr(s.pickup_address) || '—'}</p>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-6 top-0.5 size-[15px] rounded-full bg-[var(--bg-primary)] border-2 border-rose-500/40 flex items-center justify-center">
                          <MapPin className="size-2 text-rose-500 opacity-60" />
                        </div>
                        <p className="text-[9px] font-bold text-rose-600 uppercase tracking-wider">To</p>
                        <p className="text-[12px] font-semibold text-[var(--text-primary)] truncate">{addr(s.delivery_address) || '—'}</p>
                      </div>
                    </div>

                    {/* Row 3: Package tags + Price */}
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--glass-border)]/15">
                      <div className="flex items-center gap-1.5">
                        {s.package_details?.category && (
                          <span className="text-[9px] font-bold bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-lg px-2 py-0.5 capitalize text-[var(--text-primary)]">
                            {s.package_details.category}
                          </span>
                        )}
                        {s.package_details?.weight_tier && (
                          <span className="text-[9px] font-bold bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-lg px-2 py-0.5 capitalize text-[var(--text-primary)]">
                            {s.package_details.weight_tier.replace('_', ' ')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-[var(--text-primary)]">{s.price?.toLocaleString()}</span>
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40">XAF</span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* ── Pagination ──────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex items-center justify-between rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 px-4 py-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--glass-border)] px-3.5 py-2 text-[11px] font-bold disabled:opacity-25 active:scale-95 transition-all min-h-[36px]"
            >
              <ChevronLeft className="size-3.5" /> Prev
            </button>
            <span className="text-[11px] font-mono text-[var(--text-secondary)] opacity-40 font-bold">{page} / {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--glass-border)] px-3.5 py-2 text-[11px] font-bold disabled:opacity-25 active:scale-95 transition-all min-h-[36px]"
            >
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}

        {/* ── Bottom CTAs ─────────────────────────────────────────── */}
        <div className="pt-2 flex gap-2.5">
          <Link href="/delivery" className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-white font-bold text-xs text-center active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2">
            <Send className="size-3.5" /> Book Delivery
          </Link>
          <Link href="/delivery/track" className="flex-1 rounded-xl border border-[var(--glass-border)]/20 bg-[var(--bg-secondary)]/30 py-3 text-[var(--text-primary)] font-bold text-xs text-center active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2">
            <MapPin className="size-3.5" /> Track Package
          </Link>
        </div>
      </div>
    </div>
  );
}
