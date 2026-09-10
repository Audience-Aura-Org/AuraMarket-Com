"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
  Package, Search, Loader2, RefreshCw, MapPin, Truck,
  ChevronDown, Clock, CheckCircle2, XCircle, AlertTriangle,
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';

const STATUS_OPTIONS = ['all', 'pending', 'assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled', 'failed'];

const statusColor = (s) => {
  const map = {
    pending: 'text-yellow-500 bg-yellow-500/10',
    assigned: 'text-blue-500 bg-blue-500/10',
    picked_up: 'text-indigo-500 bg-indigo-500/10',
    in_transit: 'text-purple-500 bg-purple-500/10',
    out_for_delivery: 'text-cyan-500 bg-cyan-500/10',
    delivered: 'text-emerald-500 bg-emerald-500/10',
    cancelled: 'text-rose-500 bg-rose-500/10',
    failed: 'text-red-600 bg-red-600/10',
  };
  return map[s] || 'text-[var(--text-secondary)] bg-[var(--bg-secondary)]';
};

export default function AdminP2PPage() {
  const [shipments, setShipments] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  const fetchShipments = async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 30 });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (search) params.set('search', search);
      const res = await api.get(`/admin/p2p/shipments?${params}`);
      if (res.data?.success) {
        setShipments(res.data.data.shipments || []);
        setTotal(res.data.total || 0);
        setPage(p);
      }
    } catch {
      toast.error('Failed to load P2P shipments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchShipments(); }, [statusFilter]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchShipments(1);
  };

  // Stats
  const stats = {
    total: total,
    active: shipments.filter(s => ['assigned', 'picked_up', 'in_transit', 'out_for_delivery'].includes(s.status)).length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    pending: shipments.filter(s => s.status === 'pending').length,
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
            <Truck className="size-5 text-blue-500" /> P2P Deliveries
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">Manage all person-to-person delivery shipments</p>
        </div>
        <button onClick={() => fetchShipments(page)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)] transition">
          <RefreshCw className="size-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Total</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
          <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.pending}</p>
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Active</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-4">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Delivered</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] mt-1">{stats.delivered}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by tracking code..."
              className="w-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50"
            />
          </div>
          <button type="submit" className="px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white text-[12px] font-bold">
            Search
          </button>
        </form>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_OPTIONS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition ${
                statusFilter === s
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--accent)]/10'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Shipments List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-7 animate-spin text-[var(--accent)]" />
        </div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-16">
          <Package className="mx-auto size-10 text-[var(--text-secondary)]/30 mb-3" />
          <p className="text-[13px] text-[var(--text-secondary)]">No P2P shipments found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shipments.map(s => (
            <div key={s._id} className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)] overflow-hidden">
              {/* Shipment Row */}
              <button
                onClick={() => setExpanded(expanded === s._id ? null : s._id)}
                className="w-full text-left p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[13px] font-bold text-[var(--accent)]">{s.tracking_code}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${statusColor(s.status)}`}>
                      {s.status?.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] font-medium text-[var(--text-secondary)] bg-[var(--bg-primary)] px-2 py-0.5 rounded-full capitalize">
                      {s.direction === 'send' ? 'Sending' : 'Pickup'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-[var(--text-secondary)]">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{s.pickup_address?.city || '—'}</span>
                    <span>&rarr;</span>
                    <span className="truncate">{s.delivery_address?.city || '—'}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[14px] font-bold text-[var(--text-primary)]">{s.price?.toLocaleString()} XAF</p>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                    {s.payment_status === 'paid' ? 'Paid' : s.payment_status === 'refunded' ? 'Refunded' : 'Unpaid'}
                  </p>
                </div>
                <ChevronDown className={`size-4 text-[var(--text-secondary)] transition-transform ${expanded === s._id ? 'rotate-180' : ''}`} />
              </button>

              {/* Expanded Details */}
              {expanded === s._id && (
                <div className="border-t border-[var(--glass-border)] p-4 space-y-3 bg-[var(--bg-primary)]/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[12px]">
                    {/* Booker */}
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Booked By</p>
                      {s.booked_by ? (
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">{s.booked_by.name}</p>
                          <p className="text-[var(--text-secondary)]">{s.booked_by.email}</p>
                          {s.booked_by.phone && <p className="text-[var(--text-secondary)]">{s.booked_by.phone}</p>}
                        </div>
                      ) : s.guest_booker ? (
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">{s.guest_booker.name} <span className="text-[10px] text-[var(--text-secondary)]">(Guest)</span></p>
                          {s.guest_booker.phone && <p className="text-[var(--text-secondary)]">{s.guest_booker.phone}</p>}
                        </div>
                      ) : <p className="text-[var(--text-secondary)] italic">Unknown</p>}
                    </div>

                    {/* Provider */}
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Provider</p>
                      {s.logistics_id ? (
                        <div className="flex items-center gap-2">
                          {s.logistics_id.logo ? (
                            <img src={s.logistics_id.logo} className="size-6 rounded-lg object-cover" alt="" />
                          ) : (
                            <div className="size-6 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] text-[9px] font-bold">
                              {s.logistics_id.company_name?.[0]}
                            </div>
                          )}
                          <div>
                            <p className="font-semibold text-[var(--text-primary)]">{s.logistics_id.company_name}</p>
                            {s.logistics_id.contact_phone && <p className="text-[var(--text-secondary)]">{s.logistics_id.contact_phone}</p>}
                          </div>
                        </div>
                      ) : <p className="text-[var(--text-secondary)] italic">Not assigned</p>}
                    </div>

                    {/* Pickup Address */}
                    <div>
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Pickup</p>
                      <p className="text-[var(--text-primary)]">{s.pickup_address?.street || '—'}</p>
                      <p className="text-[var(--text-secondary)]">{[s.pickup_address?.quartier, s.pickup_address?.city].filter(Boolean).join(', ')}</p>
                      {s.pickup_address?.phone && <p className="text-[var(--text-secondary)]">{s.pickup_address.phone}</p>}
                    </div>

                    {/* Dropoff Address */}
                    <div>
                      <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">Delivery</p>
                      <p className="text-[var(--text-primary)]">{s.delivery_address?.street || '—'}</p>
                      <p className="text-[var(--text-secondary)]">{[s.delivery_address?.quartier, s.delivery_address?.city].filter(Boolean).join(', ')}</p>
                      {s.delivery_address?.phone && <p className="text-[var(--text-secondary)]">{s.delivery_address.phone}</p>}
                    </div>

                    {/* Package Details */}
                    {s.package_details && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Package</p>
                        <p className="text-[var(--text-primary)] capitalize">{s.package_details.category} &middot; {s.package_details.weight_tier?.replace(/_/g, ' ')}</p>
                        {s.package_details.declared_value > 0 && <p className="text-[var(--text-secondary)]">Value: {s.package_details.declared_value.toLocaleString()} XAF</p>}
                        {s.package_details.description && <p className="text-[var(--text-secondary)] mt-0.5">{s.package_details.description}</p>}
                      </div>
                    )}

                    {/* Other Party */}
                    {s.other_party && (
                      <div>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1">Other Party</p>
                        <p className="text-[var(--text-primary)]">{s.other_party.name}</p>
                        {s.other_party.phone && <p className="text-[var(--text-secondary)]">{s.other_party.phone}</p>}
                        {s.other_party.email && <p className="text-[var(--text-secondary)]">{s.other_party.email}</p>}
                      </div>
                    )}
                  </div>

                  {/* Timeline */}
                  {s.shipment_logs?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Timeline</p>
                      <div className="space-y-1.5">
                        {s.shipment_logs.map((log, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px]">
                            <span className={`size-1.5 rounded-full shrink-0 ${statusColor(log.status).split(' ')[0].replace('text-', 'bg-')}`} />
                            <span className="font-semibold capitalize text-[var(--text-primary)]">{log.status?.replace(/_/g, ' ')}</span>
                            {log.note && <span className="text-[var(--text-secondary)]">— {log.note}</span>}
                            <span className="text-[var(--text-secondary)] ml-auto">{log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-[var(--text-secondary)]">
                    Created: {new Date(s.createdAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {total > 30 && (
            <div className="flex justify-center gap-2 pt-4">
              <button
                onClick={() => fetchShipments(page - 1)}
                disabled={page <= 1}
                className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[12px] font-semibold disabled:opacity-30"
              >
                Previous
              </button>
              <span className="flex items-center text-[12px] text-[var(--text-secondary)] px-3">
                Page {page} of {Math.ceil(total / 30)}
              </span>
              <button
                onClick={() => fetchShipments(page + 1)}
                disabled={page >= Math.ceil(total / 30)}
                className="px-4 py-2 rounded-xl border border-[var(--glass-border)] text-[12px] font-semibold disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
