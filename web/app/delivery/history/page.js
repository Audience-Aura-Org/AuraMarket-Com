'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import {
  Package, Send, ArrowDownToLine, Clock, CheckCircle2, XCircle,
  Truck, AlertTriangle, MapPin, Loader2, ArrowLeft, Navigation,
  ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG = {
  pending:          { color: 'amber',   icon: Clock,         label: 'Pending',          bg: 'bg-amber-500/10',   text: 'text-amber-600',   border: 'border-amber-500/20' },
  assigned:         { color: 'blue',    icon: Truck,         label: 'Assigned',         bg: 'bg-blue-500/10',    text: 'text-blue-600',    border: 'border-blue-500/20' },
  picked_up:        { color: 'indigo',  icon: Package,       label: 'Picked Up',        bg: 'bg-indigo-500/10',  text: 'text-indigo-600',  border: 'border-indigo-500/20' },
  in_transit:       { color: 'blue',    icon: Truck,         label: 'In Transit',       bg: 'bg-blue-500/10',    text: 'text-blue-600',    border: 'border-blue-500/20' },
  out_for_delivery: { color: 'violet',  icon: Navigation,    label: 'Out for Delivery', bg: 'bg-violet-500/10',  text: 'text-violet-600',  border: 'border-violet-500/20' },
  delivered:        { color: 'emerald', icon: CheckCircle2,  label: 'Delivered',        bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'border-emerald-500/20' },
  failed:           { color: 'rose',    icon: AlertTriangle, label: 'Failed',           bg: 'bg-rose-500/10',    text: 'text-rose-600',    border: 'border-rose-500/20' },
  cancelled:        { color: 'gray',    icon: XCircle,       label: 'Cancelled',        bg: 'bg-gray-500/10',    text: 'text-gray-600',    border: 'border-gray-500/20' },
};

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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[var(--bg-primary)]/80 backdrop-blur-xl border-b border-[var(--glass-border)]/30">
        <div className="mx-auto max-w-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/delivery" className="size-9 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/50 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] active:scale-95 transition-all shrink-0">
              <ArrowLeft className="size-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-[var(--text-primary)] tracking-tight">My Deliveries</h1>
              <p className="text-[10px] text-[var(--text-secondary)]/50">
                {loading ? 'Loading...' : `${total} total · ${activeCount} active`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-3 pt-4 space-y-4">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'all', label: 'All', count: counts.all, icon: Package },
            { key: 'booker', label: 'Sent', count: counts.booker, icon: Send },
            { key: 'recipient', label: 'Received', count: counts.recipient, icon: ArrowDownToLine },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-xl p-3 text-center transition-all active:scale-[0.97] ${
                tab === t.key
                  ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                  : 'bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)]/30'
              }`}
            >
              <t.icon className={`size-4 mx-auto mb-1.5 ${tab === t.key ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)]/40'}`} />
              <p className={`text-lg font-bold ${tab === t.key ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}`}>{t.count}</p>
              <p className={`text-[9px] font-bold ${tab === t.key ? 'text-[var(--accent)]/70' : 'text-[var(--text-secondary)]/40'}`}>{t.label}</p>
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="size-3.5 text-[var(--text-secondary)]/30 shrink-0" />
          <div className="flex-1 overflow-x-auto flex gap-1.5 pb-0.5 scrollbar-none">
            <button
              onClick={() => { setStatusFilter(''); setPage(1); }}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 ${
                !statusFilter ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)]/30'
              }`}
            >All</button>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <button
                key={k}
                onClick={() => { setStatusFilter(k); setPage(1); }}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all active:scale-95 ${
                  statusFilter === k ? `${v.bg} ${v.text} border ${v.border}` : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)]/30'
                }`}
              >{v.label}</button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
            <p className="text-[11px] text-[var(--text-secondary)]/40 font-semibold">Loading deliveries...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="size-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)]/30 mx-auto flex items-center justify-center mb-4">
              <Package className="size-7 text-[var(--text-secondary)]/20" />
            </div>
            <p className="text-sm font-bold text-[var(--text-primary)] mb-1">No deliveries yet</p>
            <p className="text-[11px] text-[var(--text-secondary)]/40 mb-4">
              {statusFilter ? 'Try a different filter' : 'Book your first delivery to get started'}
            </p>
            <Link href="/delivery" className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-white text-xs font-bold active:scale-95 transition-all">
              <Send className="size-3.5" /> Book a Delivery
            </Link>
          </div>
        )}

        {/* Shipment List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2.5">
            {filtered.map(s => {
              const config = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
              const StatusIcon = config.icon;
              const isSender = s.role === 'booker';
              const isActive = !['delivered', 'cancelled', 'failed'].includes(s.status);

              return (
                <Link
                  key={s._id}
                  href={`/delivery/track?code=${s.tracking_code}`}
                  className={`block rounded-2xl border bg-[var(--bg-secondary)]/30 p-4 transition-all active:scale-[0.99] ${
                    isActive ? 'border-[var(--accent)]/15 hover:border-[var(--accent)]/30' : 'border-[var(--glass-border)]/20 hover:border-[var(--glass-border)]/40'
                  }`}
                >
                  {/* Top row: icon + tracking + status */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`size-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
                      {isSender ? <Send className={`size-4 ${config.text}`} /> : <ArrowDownToLine className={`size-4 ${config.text}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[12px] font-bold text-[var(--text-primary)]">{s.tracking_code}</p>
                      <p className="text-[10px] text-[var(--text-secondary)]/40 mt-0.5">
                        {isSender ? 'You sent' : 'Sent to you'} · {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className={`shrink-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 ${config.bg} ${config.text} ${config.border}`}>
                      <StatusIcon className="size-3" />
                      <span className="text-[10px] font-bold">{config.label}</span>
                    </div>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className="size-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <p className="text-[11px] text-[var(--text-primary)] truncate font-medium">{s.pickup_address?.quartier || s.pickup_address?.city || '—'}</p>
                    </div>
                    <div className="w-8 h-px bg-[var(--glass-border)]/30 shrink-0 relative">
                      <ChevronRight className="size-3 text-[var(--text-secondary)]/20 absolute -right-1 top-1/2 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <p className="text-[11px] text-[var(--text-primary)] truncate font-medium text-right">{s.delivery_address?.quartier || s.delivery_address?.city || '—'}</p>
                      <div className="size-1.5 rounded-full bg-rose-500 shrink-0" />
                    </div>
                  </div>

                  {/* Bottom row: package + price */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-[var(--glass-border)]/10">
                    <div className="flex items-center gap-2">
                      {s.package_details?.category && (
                        <span className="text-[9px] font-bold bg-[var(--bg-primary)] border border-[var(--glass-border)]/20 rounded-md px-2 py-0.5 capitalize text-[var(--text-secondary)]">
                          {s.package_details.category}
                        </span>
                      )}
                      {s.package_details?.weight_tier && (
                        <span className="text-[9px] font-bold bg-[var(--bg-primary)] border border-[var(--glass-border)]/20 rounded-md px-2 py-0.5 capitalize text-[var(--text-secondary)]">
                          {s.package_details.weight_tier.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{s.price?.toLocaleString()} <span className="text-[9px] text-[var(--text-secondary)]/40 font-semibold">XAF</span></p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--glass-border)]/30 px-3.5 py-2 text-[11px] font-bold disabled:opacity-30 active:scale-95 transition-all"
            >
              <ChevronLeft className="size-3.5" /> Prev
            </button>
            <span className="text-[11px] font-mono text-[var(--text-secondary)]/40">{page} / {pages}</span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="inline-flex items-center gap-1 rounded-xl border border-[var(--glass-border)]/30 px-3.5 py-2 text-[11px] font-bold disabled:opacity-30 active:scale-95 transition-all"
            >
              Next <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="pt-2 flex gap-2.5">
          <Link href="/delivery" className="flex-1 rounded-xl bg-[var(--accent)] py-3 text-white font-bold text-xs text-center active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2">
            <Send className="size-3.5" /> Book Delivery
          </Link>
          <Link href="/delivery/track" className="flex-1 rounded-xl border border-[var(--glass-border)]/30 bg-[var(--bg-secondary)]/30 py-3 text-[var(--text-primary)] font-bold text-xs text-center active:scale-95 transition-all min-h-[44px] flex items-center justify-center gap-2">
            <MapPin className="size-3.5" /> Track Package
          </Link>
        </div>
      </div>
    </div>
  );
}
