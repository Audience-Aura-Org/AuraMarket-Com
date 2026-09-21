"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import {
  Truck, Calendar, Filter, Search, RefreshCw,
  ChevronDown, Clock, Package, MapPin, AlertTriangle,
  CheckCircle2, Download, Loader2, TrendingUp, Activity
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import StatCard from '@/components/layout/StatCard';

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

export default function AdminLogisticsAuditPage() {
  const [mounted, setMounted] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [firms, setFirms] = useState([]);
  const [shipStats, setShipStats] = useState(null);
  const [totalShipments, setTotalShipments] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedFirm, setSelectedFirm] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30days'); // 7days, 30days, 90days, all
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setMounted(true);
    fetchAuditData();
  }, []);

  const fetchAuditData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: 100 });
      if (selectedFirm !== 'all') params.set('firm_id', selectedFirm);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (dateRange !== 'all') {
        const days = parseInt(dateRange);
        const date = new Date();
        date.setDate(date.getDate() - days);
        params.set('since', date.toISOString());
      }

      const [shipRes, firmRes] = await Promise.all([
        api.get(`/admin/logistics/shipments?${params}`),
        api.get('/admin/logistics/firms')
      ]);

      if (shipRes.data?.success) {
        setShipments(shipRes.data.data.shipments || []);
        if (shipRes.data.data.stats) setShipStats(shipRes.data.data.stats);
        if (shipRes.data.total != null) setTotalShipments(shipRes.data.total);
      }
      if (firmRes.data?.success) {
        setFirms(firmRes.data.data.firms || []);
      }
    } catch (err) {
      console.error('Failed to fetch audit data:', err);
      toast.error('Failed to load logistics audit');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mounted) fetchAuditData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFirm, statusFilter, dateRange]);

  const handleExportCSV = () => {
    if (filteredShipments.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = ['Tracking Code', 'Status', 'Firm', 'Origin', 'Destination', 'Price', 'Created', 'Updated'];
    const rows = filteredShipments.map(s => [
      s.tracking_code || 'N/A',
      s.status,
      s.logistics_id?.company_name || 'Unknown',
      s.pickup_address?.quartier || s.pickup_address?.city || 'N/A',
      s.delivery_address?.quartier || s.delivery_address?.city || 'N/A',
      s.price || 0,
      new Date(s.createdAt).toLocaleDateString(),
      new Date(s.updatedAt).toLocaleDateString()
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logistics-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export completed');
  };

  const filteredShipments = shipments.filter(s => {
    if (search) {
      const query = search.toLowerCase();
      return (
        s.tracking_code?.toLowerCase().includes(query) ||
        s.vendor_id?.store_name?.toLowerCase().includes(query) ||
        s.booked_by?.phone?.includes(query)
      );
    }
    return true;
  });

  const totalCount = shipStats?.total || totalShipments || filteredShipments.length;
  const deliveredCount = shipStats?.delivered ?? filteredShipments.filter(s => s.status === 'delivered').length;
  const failedCount = shipStats?.failed ?? filteredShipments.filter(s => s.status === 'failed' || s.status === 'cancelled').length;
  const activeCount = (shipStats?.in_transit || 0) + (shipStats?.out_for_delivery || 0) + (shipStats?.assigned || 0) + (shipStats?.picked_up || 0);
  const onTimeRate = totalCount > 0
    ? Math.round((deliveredCount / totalCount) * 100)
    : 0;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
              <Activity className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Logistics <span className="text-[var(--accent)]">Audit</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Shipment Trail</p>
              </div>
            </div>
          </div>
          <button onClick={fetchAuditData} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button onClick={handleExportCSV} className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] lg:text-[12px] font-bold tracking-tight hover:bg-[var(--accent)] hover:text-white transition-all">
            <Download className="size-3" /> CSV
          </button>
          <button onClick={fetchAuditData} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
        {/* KPI Stats */}
        {(() => {
          return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Shipments" value={totalCount} icon={Package} color="primary" sub="Audit period" progress={Math.min(totalCount, 100)} footer={`${totalCount} tracked`} />
              <StatCard label="Delivered" value={`${onTimeRate}%`} icon={TrendingUp} color="emerald" sub="Success rate" progress={onTimeRate} footer={`${deliveredCount} delivered`} />
              <StatCard label="Failed/Cancelled" value={failedCount} icon={AlertTriangle} color="rose" sub="Issues" progress={totalCount > 0 ? Math.round((failedCount / totalCount) * 100) : 0} footer={`${failedCount} issue${failedCount !== 1 ? 's' : ''}`} />
              <StatCard label="Active Firms" value={firms.length} icon={Truck} color="indigo" sub="Logistics partners" progress={Math.min(firms.length * 15, 100)} footer={`${firms.length} providers`} />
            </div>
          );
        })()}

        {/* Filters */}
        <div className="flex flex-col gap-4 p-4 md:p-6 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-sm">
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
            {/* Search */}
            <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] group focus-within:border-[var(--accent)] transition-colors">
              <Search className="size-4 text-[var(--text-secondary)] opacity-40" />
              <input
                type="text"
                placeholder="Search tracking code, vendor, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[11px] lg:text-[12px] font-semibold text-[var(--text-primary)] placeholder-[var(--text-secondary)] placeholder-opacity-40"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex gap-2 flex-wrap">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
                <Calendar className="size-3 text-[var(--text-secondary)] opacity-40" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="bg-transparent text-[10px] lg:text-[11px] font-bold text-[var(--text-primary)] outline-none"
                >
                  <option value="7days">Last 7 days</option>
                  <option value="30days">Last 30 days</option>
                  <option value="90days">Last 90 days</option>
                  <option value="all">All time</option>
                </select>
              </div>

              <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
                <Truck className="size-3 text-[var(--text-secondary)] opacity-40" />
                <select
                  value={selectedFirm}
                  onChange={(e) => setSelectedFirm(e.target.value)}
                  className="bg-transparent text-[10px] lg:text-[11px] font-bold text-[var(--text-primary)] outline-none max-w-[150px]"
                >
                  <option value="all">All Firms</option>
                  {firms.map(f => (
                    <option key={f._id} value={f._id}>{f.company_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
                <CheckCircle2 className="size-3 text-[var(--text-secondary)] opacity-40" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-[10px] lg:text-[11px] font-bold text-[var(--text-primary)] outline-none"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="picked_up">Picked Up</option>
                  <option value="in_transit">In Transit</option>
                  <option value="out_for_delivery">Out for Delivery</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
            {filteredShipments.length} result{filteredShipments.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Shipment List */}
        <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
            <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
              <Package className="size-4 text-[var(--accent)]" /> Shipment Records
            </h3>
            <div className="hidden md:flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">
              <Filter className="size-3" /> Active
            </div>
          </div>

          <div className="divide-y divide-[var(--glass-border)]/30">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20">
                <Loader2 className="animate-spin size-10" />
                <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Loading Records...</p>
              </div>
            ) : filteredShipments.length > 0 ? (
              filteredShipments.map((shipment) => {
                const firm = shipment.logistics_id; // populated object
                const isExpanded = expanded === shipment._id;
                return (
                  <div key={shipment._id} className="border-b border-[var(--glass-border)]/10 last:border-b-0">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : shipment._id)}
                      className="w-full p-6 md:p-8 hover:bg-[var(--accent)]/[0.02] transition-colors group text-left flex flex-col gap-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-3">
                            <div className="flex items-center gap-2">
                              <Package className="size-4 text-[var(--accent)] shrink-0" />
                              <p className="text-xs font-bold text-[var(--text-primary)] tracking-tight font-mono">
                                {shipment.tracking_code || 'No Code'}
                              </p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-widest uppercase border ${statusColor(shipment.status)}`}>
                              {shipment.status?.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">
                            <div>
                              <p className="opacity-40 uppercase tracking-widest mb-1">Firm</p>
                              <p className="text-[var(--text-primary)]">{firm?.company_name || 'Unknown'}</p>
                            </div>
                            <div>
                              <p className="opacity-40 uppercase tracking-widest mb-1">Price</p>
                              <p className="text-[var(--text-primary)] font-mono">{(shipment.price || 0).toLocaleString()} XAF</p>
                            </div>
                            <div>
                              <p className="opacity-40 uppercase tracking-widest mb-1">Origin</p>
                              <p className="text-[var(--text-primary)] truncate">{shipment.pickup_address?.quartier || shipment.pickup_address?.city || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="opacity-40 uppercase tracking-widest mb-1">Destination</p>
                              <p className="text-[var(--text-primary)] truncate">{shipment.delivery_address?.quartier || shipment.delivery_address?.city || 'N/A'}</p>
                            </div>
                          </div>
                        </div>

                        <ChevronDown className={`size-5 text-[var(--text-secondary)] opacity-30 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-[var(--glass-border)]/20 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Left Column */}
                            <div className="space-y-4">
                              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-4 rounded-xl">
                                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 opacity-40">Vendor</p>
                                <p className="text-[11px] font-semibold text-[var(--text-primary)]">{shipment.vendor_id?.store_name || (shipment.type === 'p2p' ? 'P2P Shipment' : 'Unknown')}</p>
                                <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 mt-1 capitalize">{shipment.type || 'marketplace'}</p>
                              </div>

                              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-4 rounded-xl">
                                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 opacity-40">Booked By</p>
                                <p className="text-[11px] font-semibold text-[var(--text-primary)]">{shipment.booked_by?.name || shipment.guest_booker?.name || 'Guest'}</p>
                                <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 mt-1">{shipment.booked_by?.phone || shipment.guest_booker?.phone || 'N/A'}</p>
                              </div>
                            </div>

                            {/* Right Column */}
                            <div className="space-y-4">
                              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-4 rounded-xl">
                                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 opacity-40">Timeline</p>
                                <div className="space-y-2 text-[10px] font-semibold text-[var(--text-secondary)]">
                                  <div className="flex items-center justify-between">
                                    <span className="opacity-60">Created:</span>
                                    <span className="text-[var(--text-primary)] font-mono">{new Date(shipment.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="opacity-60">Updated:</span>
                                    <span className="text-[var(--text-primary)] font-mono">{new Date(shipment.updatedAt).toLocaleDateString()}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-4 rounded-xl">
                                <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-3 opacity-40">Package</p>
                                <div className="space-y-2 text-[10px] font-semibold text-[var(--text-secondary)]">
                                  <div className="flex items-center justify-between">
                                    <span className="opacity-60">Weight:</span>
                                    <span className="text-[var(--text-primary)] font-mono">{shipment.package_details?.weight_tier || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="opacity-60">Category:</span>
                                    <span className="text-[var(--text-primary)] font-mono capitalize">{shipment.package_details?.category || 'N/A'}</span>
                                  </div>
                                  {shipment.package_details?.declared_value > 0 && (
                                    <div className="flex items-center justify-between">
                                      <span className="opacity-60">Declared Value:</span>
                                      <span className="text-[var(--text-primary)] font-mono">{shipment.package_details.declared_value.toLocaleString()} XAF</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Status Timeline */}
                          {shipment.shipment_logs?.length > 0 && (
                            <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-4 rounded-xl">
                              <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] mb-4 opacity-40 flex items-center gap-2">
                                <Clock className="size-3" /> Status History
                              </p>
                              <div className="space-y-3">
                                {shipment.shipment_logs.map((log, idx) => (
                                  <div key={idx} className="flex items-start gap-3">
                                    <div className={`size-2 rounded-full mt-2 shrink-0 ${log.status === 'delivered' ? 'bg-emerald-500' : log.status === 'failed' || log.status === 'cancelled' ? 'bg-rose-500' : 'bg-[var(--accent)]'}`} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-bold text-[var(--text-primary)]">{log.status?.replace('_', ' ').toUpperCase()}</p>
                                      <p className="text-[9px] font-semibold text-[var(--text-secondary)] opacity-40">{log.note || 'No note'}</p>
                                      <p className="text-[9px] font-mono text-[var(--text-secondary)] opacity-30 mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="py-40 flex flex-col items-center justify-center opacity-10 px-10 text-center gap-6">
                <Package className="w-16 h-16 text-[var(--text-secondary)]" />
                <p className="text-xs font-bold tracking-[0.4em] uppercase max-w-sm">No Shipments Found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
