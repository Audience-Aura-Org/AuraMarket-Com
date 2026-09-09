'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import {
  Package, Send, ArrowDownToLine, Clock, CheckCircle2, XCircle, Truck, AlertTriangle, MapPin, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_CONFIG = {
  pending:          { color: 'amber',   icon: Clock,         label: 'Pending' },
  assigned:         { color: 'blue',    icon: Truck,         label: 'Assigned' },
  picked_up:        { color: 'blue',    icon: Package,       label: 'Picked Up' },
  in_transit:       { color: 'blue',    icon: Truck,         label: 'In Transit' },
  out_for_delivery: { color: 'violet',  icon: MapPin,        label: 'Out for Delivery' },
  delivered:        { color: 'emerald', icon: CheckCircle2,  label: 'Delivered' },
  failed:           { color: 'rose',    icon: AlertTriangle, label: 'Failed' },
  cancelled:        { color: 'gray',    icon: XCircle,       label: 'Cancelled' },
};

export default function DeliveryHistoryPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all'); // all, booker, recipient
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
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
      }
    } catch {
      setShipments([]);
    }
    setLoading(false);
  };

  const filtered = tab === 'all' ? shipments
    : tab === 'booker' ? shipments.filter(s => s.role === 'booker')
    : shipments.filter(s => s.role === 'recipient');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-32 pt-4">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">My Deliveries</h1>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">Your P2P pickup & delivery history</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {[
            { key: 'all', label: 'All' },
            { key: 'booker', label: 'Sent' },
            { key: 'recipient', label: 'Received' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all ${
                tab === t.key
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)]'
              }`}>
              {t.label}
            </button>
          ))}
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="ml-auto shrink-0 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-secondary)] outline-none">
            <option value="">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-[var(--accent)]" />
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="text-center py-16">
            <Package className="mx-auto size-12 text-[var(--text-secondary)] opacity-30 mb-3" />
            <p className="text-[var(--text-secondary)] text-[13px]">No deliveries yet</p>
            <Link href="/delivery" className="text-[var(--accent)] text-[13px] font-semibold mt-2 inline-block">Book a Delivery</Link>
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map(s => {
              const config = STATUS_CONFIG[s.status] || STATUS_CONFIG.pending;
              return (
                <Link key={s._id} href={`/delivery/track?code=${s.tracking_code}`}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4 transition-all hover:border-[var(--accent)]/30">
                  <div className={`size-10 rounded-xl bg-${config.color}-500/10 flex items-center justify-center shrink-0`}>
                    {s.role === 'booker'
                      ? <Send className={`size-4 text-${config.color}-500`} />
                      : <ArrowDownToLine className={`size-4 text-${config.color}-500`} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-mono font-bold text-[var(--text-primary)]">{s.tracking_code}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-${config.color}-500/10 text-${config.color}-600`}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
                      {s.pickup_address?.city || '?'} → {s.delivery_address?.city || '?'}
                      {s.package_details?.category && <span className="capitalize"> · {s.package_details.category}</span>}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] font-bold text-[var(--text-primary)]">{s.price?.toLocaleString()} XAF</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{new Date(s.createdAt).toLocaleDateString()}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-[12px] font-semibold disabled:opacity-30">
              Previous
            </button>
            <span className="text-[12px] text-[var(--text-secondary)] py-1.5">{page} / {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="rounded-lg border border-[var(--glass-border)] px-3 py-1.5 text-[12px] font-semibold disabled:opacity-30">
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
