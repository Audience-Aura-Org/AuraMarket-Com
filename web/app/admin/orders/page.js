"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Package, Truck, CheckCircle2, Clock,
  ChevronDown, ChevronUp, RefreshCw, Filter,
  User, Mail, Phone, ShoppingBag, Store,
  MoreHorizontal, X, ArrowUpRight
} from 'lucide-react';
import api from '@/services/api';
import RoleSidebar from '@/components/layout/RoleSidebar';
import Link from 'next/link';

const STATUS_CONFIG = {
  placed:         { label: 'Placed',      color: 'text-purple-600',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  dot: 'bg-purple-500' },
  processing:     { label: 'Processing',  color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
  shipped:        { label: 'Shipped',     color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500' },
  delivered:      { label: 'Delivered',   color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  cancelled:      { label: 'Cancelled',   color: 'text-red-600',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-500' },
  refund_pending: { label: 'Refund',      color: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  refunded:       { label: 'Refunded',    color: 'text-sky-600',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-500' },
};

const PAYMENT_STATUS = {
  pending:  { label: 'Unpaid',   color: 'text-amber-500',  bg: 'bg-amber-500/10' },
  paid:     { label: 'Paid',     color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  refunded: { label: 'Refunded', color: 'text-sky-500',    bg: 'bg-sky-500/10' },
};

import Pagination from '@/components/common/Pagination';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [logisticsFirms, setLogisticsFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [expanded, setExpanded] = useState(null);
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [orderEdits, setOrderEdits] = useState({});
  const [stats, setStats] = useState(null);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/analytics');
      if (res.data.success) {
        setStats(res.data.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch platform metrics');
    }
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeTab !== 'all' ? { status: activeTab } : {};
      const res = await api.get('/admin/orders', { params });
      if (res.data.success) setOrders(res.data.data.orders || []);
    } catch (err) {
      console.error('Failed to fetch admin orders:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { 
    fetchOrders(); 
    fetchStats();
    setCurrentPage(1);
  }, [fetchOrders]);

  useEffect(() => {
    const fetchLogistics = async () => {
      try {
        const res = await api.get('/admin/logistics/firms');
        if (res.data.success) setLogisticsFirms(res.data.data.firms || []);
      } catch (err) {
        console.error('Failed to fetch logistics firms:', err);
      }
    };
    fetchLogistics();
  }, []);

  const setOrderEditField = (orderId, key, value) => {
    setOrderEdits((prev) => ({
      ...prev,
      [orderId]: {
        ...(prev[orderId] || {}),
        [key]: value,
      },
    }));
  };

  const saveOrderControl = async (order) => {
    const patch = orderEdits[order._id];
    if (!patch) return;
    setSavingOrderId(order._id);
    try {
      const res = await api.patch(`/admin/orders/${order._id}`, patch);
      if (res.data.success) {
        setOrders((prev) =>
          prev.map((o) => (o._id === order._id ? { ...o, ...res.data.data.order } : o))
        );
      }
    } catch (err) {
      console.error('Failed to update order:', err);
    } finally {
      setSavingOrderId(null);
    }
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      o._id?.toLowerCase().includes(q) ||
      o.customer_id?.name?.toLowerCase().includes(q) ||
      o.customer_id?.email?.toLowerCase().includes(q) ||
      o.vendor_id?.store_name?.toLowerCase().includes(q) ||
      o.products?.some(p => p.name?.toLowerCase().includes(q))
    );
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentOrders = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalRevenue = filtered.reduce((s, o) => s + (o.total_amount || 0), 0);

  const tabs = ['all', 'placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refund_pending'];

  return (
    <>
      <header className="h-20 flex items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 text-[var(--text-primary)]">
        <div>
          <h1 className="text-lg lg:text-xl font-bold tracking-tight text-[var(--text-primary)] ">Orders <span className="text-[var(--accent)]">Management</span></h1>
          <p className="hidden md:block text-[10px] text-[var(--text-secondary)] font-bold mt-0.5 tracking-tight opacity-60">Full platform order visibility</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchOrders} disabled={loading} className="p-2 lg:p-2.5 rounded-xl glass-panel border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
            <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="p-4 lg:p-8 space-y-6 pb-20">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
           {[
              { label: 'Total Orders', value: stats ? stats.orders : '...', icon: Package, color: 'var(--accent)', sub: 'ORDER_MANIFEST' },
              { label: 'Total Revenue', value: stats ? `${(stats.revenue / 1000).toFixed(1)}k` : '...', icon: ArrowUpRight, color: '#10b981', sub: 'FINANCIAL_RESOLUTION' },
              { label: 'Delivered Nodes', value: stats ? stats.delivered_orders : '...', icon: CheckCircle2, color: '#6366f1', sub: 'LOGISTICS_END' },
              { label: 'Active Pipeline', value: stats ? stats.active_orders : '...', icon: Truck, color: '#f59e0b', sub: 'FLOW_ACTIVE' }
           ].map(s => (
              <div key={s.label} className="group relative p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                 {/* Decorative Radial Glow */}
                 <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                 
                 <div className="relative flex flex-col justify-between h-full space-y-8">
                    <div className="flex items-center justify-between">
                       <div className="size-12 rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                          <s.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                       </div>
                       <span className="text-[9px] font-bold tracking-[0.3em] uppercase opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                    </div>

                    <div>
                       <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-[0.2em] mb-2 uppercase opacity-40">{s.label}</p>
                       <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                    </div>
                 </div>
              </div>
           ))}
        </div>

        {/* Search & Tabs */}
        <div className="space-y-4">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-40 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="Search ID, Customer, Store..."
              className="w-full pl-11 pr-4 py-3.5 lg:py-4 rounded-2xl lg:rounded-3xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]/30 transition-all text-sm font-bold glass-panel"
            />
            {search && (
              <button onClick={() => { setSearch(''); setCurrentPage(1); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-rose-500 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 lg:gap-3 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setExpanded(null); setCurrentPage(1); }}
                className={`h-9 px-4 lg:px-6 rounded-xl lg:rounded-full text-[8px] lg:text-[11px] font-bold tracking-tight flex-shrink-0 transition-all  whitespace-nowrap ${
                  activeTab === tab
                    ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                    : 'bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]'
                }`}
              >
                {tab === 'all' ? 'All Orders' : STATUS_CONFIG[tab]?.label || tab}
              </button>
            ))}
          </div>
        </div>

        {/* Orders Table/List */}
        <div className="space-y-8">
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 lg:h-24 rounded-[20px] lg:rounded-[32px] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 lg:py-32 flex flex-col items-center text-center opacity-30">
              <ShoppingBag className="w-16 h-16 lg:w-20 lg:h-20 mb-6 opacity-10" />
              <h3 className="text-sm lg:text-lg font-bold tracking-tight">No matching orders detected</h3>
            </div>
          ) : (
            <div className="space-y-12">
              <div className="space-y-3 lg:space-y-4 min-h-[600px]">
                {currentOrders.map(order => {
                const statusKey = order.order_status || 'placed';
                const status = STATUS_CONFIG[statusKey] || STATUS_CONFIG.placed;
                const payment = PAYMENT_STATUS[order.payment_status] || PAYMENT_STATUS.pending;
                const isOpen = expanded === order._id;
                const customer = order.customer_id;
                const products = order.products || [];

                return (
                  <div key={order._id} className={`rounded-[24px] lg:rounded-[32px] glass-panel border transition-all duration-500 bg-[var(--bg-primary)]/40 overflow-hidden ${isOpen ? 'border-[var(--accent)]/40 shadow-xl shadow-[var(--accent)]/5' : 'border-[var(--glass-border)] hover:border-[var(--accent)]/20 shadow-sm'}`}>
                    
                    <button
                      onClick={() => setExpanded(isOpen ? null : order._id)}
                      className="w-full flex flex-col sm:flex-row sm:items-center gap-4 p-5 lg:p-6 text-left relative"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={`size-2.5 lg:size-3 rounded-full flex-shrink-0 ${status.dot} shadow-[0_0_10px_currentColor]`} />
                        <div className="flex-shrink-0 w-24 lg:w-32">
                          <p className="font-bold text-[var(--text-primary)] text-[10px] lg:text-[12px] tracking-tight font-mono ">#{order._id?.slice(-8)}</p>
                          <p className="text-[8px] lg:text-[9px] text-[var(--text-secondary)] font-bold mt-0.5 opacity-50 tracking-tight">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-8 lg:size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center flex-shrink-0 text-[var(--accent)] font-bold text-xs lg:text-sm border border-[var(--accent)]/20">
                            {customer?.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[var(--text-primary)] text-xs lg:text-sm truncate tracking-tight">{customer?.name || 'Unknown'}</p>
                            <p className="hidden sm:block text-[9px] text-[var(--text-secondary)] font-bold truncate opacity-60">{customer?.email || 'No email'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 lg:gap-12 border-t sm:border-t-0 pt-4 sm:pt-0 border-[var(--glass-border)]/20">
                        <div className="hidden lg:block w-40">
                          <span className="text-[11px] font-bold text-[var(--text-secondary)]  tracking-[0.2em] opacity-40 block mb-1">Store Node</span>
                          {order.vendor_id && (
                            <Link 
                              href={`/stores/${order.vendor_id._id}`}
                              className="flex items-center gap-1.5 group/vendor"
                            >
                              <div className="size-4 rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                                 <img 
                                  src={order.vendor_id?.user_id?.branding?.logo || order.vendor_id?.store?.logo || order.vendor_id?.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${order.vendor_id?.store_name}&backgroundColor=var(--accent)`} 
                                  className="size-full object-cover"
                                  alt="Store"
                                />
                              </div>
                              <span className="text-[11px] font-bold text-[var(--text-secondary)] group-hover/vendor:text-[var(--accent)] transition-colors truncate max-w-[100px]">
                                {order.vendor_id?.store_name}
                              </span>
                            </Link>
                          )}
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <span className="text-[11px] font-bold text-[var(--text-secondary)]  tracking-[0.2em] opacity-40 block mb-1 sm:hidden">Total Amount</span>
                          <p className="font-bold text-[var(--text-primary)] text-sm lg:text-base">{order.total_amount?.toLocaleString()} <span className="text-[9px] text-[var(--text-secondary)]">XAF</span></p>
                        </div>

                        <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                           <div className={`px-2.5 py-1 rounded-lg text-[7px] lg:text-[11px] font-bold tracking-tight border  transition-all ${status.bg} ${status.color} ${status.border} shadow-sm`}>
                             {status.label}
                           </div>
                           <div className="size-8 lg:size-10 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--accent)] transition-all">
                              {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                           </div>
                        </div>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-[var(--glass-border)]/50 divide-y sm:divide-y-0 sm:grid sm:grid-cols-2 lg:grid-cols-3 animate-in fade-in slide-in-from-top-4 duration-300">
                        <div className="p-6 lg:p-8 space-y-6 bg-gradient-to-br from-transparent to-[var(--bg-secondary)]/30">
                           <div className="flex items-center gap-3">
                              <User className="size-4 text-[var(--accent)]" />
                              <h4 className="text-[11px] font-bold tracking-tight text-[var(--text-primary)] ">Customer Identity</h4>
                           </div>
                           <div className="space-y-4">
                              <div className="flex gap-4 p-4 rounded-2xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] shadow-inner">
                                 <div className="size-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center text-xl font-bold shadow-lg shadow-[var(--accent)]/20">
                                    {customer?.name?.[0]?.toUpperCase() || '?'}
                                 </div>
                                 <div className="min-w-0">
                                    <p className="font-bold text-sm  truncate">{customer?.name}</p>
                                    <p className="text-[11px] font-bold text-[var(--text-secondary)] tracking-tight mt-0.5">{customer?.email}</p>
                                 </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                 {[
                                   { label: 'Payment', val: order.payment_method },
                                   { label: 'Shipping', val: order.shipping_method },
                                   { label: 'Logistics', val: order.logistics_company_id?.company_name || 'Not Assigned' },
                                   { label: 'Date', val: new Date(order.createdAt).toLocaleDateString() },
                                   { label: 'Status', val: payment.label, color: payment.color }
                                 ].map(it => (
                                   <div key={it.label} className="p-3 rounded-xl bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)]">
                                      <p className="text-[7px] font-bold text-[var(--text-secondary)] tracking-tight mb-1 opacity-50">{it.label}</p>
                                      <p className={`text-[11px] font-bold  ${it.color || 'text-[var(--text-primary)]'}`}>{it.val || '—'}</p>
                                   </div>
                                 ))}
                              </div>

                              <div className="space-y-2">
                                <p className="text-[11px] font-bold text-[var(--text-secondary)] tracking-tight opacity-60">Admin Control</p>
                                <div className="grid grid-cols-1 gap-2">
                                  <select
                                    value={orderEdits[order._id]?.order_status ?? order.order_status}
                                    onChange={(e) => setOrderEditField(order._id, 'order_status', e.target.value)}
                                    className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2 text-[11px] font-bold tracking-tight"
                                  >
                                    {Object.keys(STATUS_CONFIG).map((s) => (
                                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                                    ))}
                                  </select>
                                  <select
                                    value={orderEdits[order._id]?.shipping_method ?? order.shipping_method}
                                    onChange={(e) => setOrderEditField(order._id, 'shipping_method', e.target.value)}
                                    className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2 text-[11px] font-bold tracking-tight"
                                  >
                                    <option value="vendor_managed">Vendor Managed</option>
                                    <option value="logistics_partner">Logistics Partner</option>
                                  </select>
                                  <select
                                    value={orderEdits[order._id]?.logistics_company_id ?? order.logistics_company_id?._id ?? order.logistics_company_id ?? ''}
                                    onChange={(e) => setOrderEditField(order._id, 'logistics_company_id', e.target.value || null)}
                                    className="w-full rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 py-2 text-[11px] font-bold tracking-tight"
                                  >
                                    <option value="">No Logistics Firm</option>
                                    {logisticsFirms.map((f) => (
                                      <option key={f._id} value={f._id}>{f.company_name}</option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={() => saveOrderControl(order)}
                                    disabled={savingOrderId === order._id}
                                    className="rounded-xl bg-[var(--accent)] text-white px-3 py-2 text-[11px] font-bold tracking-tight disabled:opacity-50"
                                  >
                                    {savingOrderId === order._id ? 'Saving...' : 'Save Changes'}
                                  </button>
                                </div>
                              </div>
                           </div>
                        </div>

                        <div className="p-6 lg:p-8 lg:col-span-2 bg-gradient-to-bl from-transparent to-[var(--bg-secondary)]/50">
                           <div className="flex items-center justify-between mb-6">
                              <div className="flex items-center gap-3">
                                 <Package className="size-4 text-[var(--accent)]" />
                                 <h4 className="text-[11px] font-bold tracking-tight text-[var(--text-primary)] ">Manifest Data</h4>
                              </div>
                              {order.vendor_id && (
                                <Link 
                                  href={`/stores/${order.vendor_id._id}`}
                                  className="flex items-center gap-1.5 group/vendor"
                                >
                                  <div className="size-4 rounded-full overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                                    <img 
                                      src={order.vendor_id?.user_id?.branding?.logo || order.vendor_id?.store?.logo || order.vendor_id?.user_id?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${order.vendor_id?.store_name}&backgroundColor=var(--accent)`} 
                                      className="size-full object-cover"
                                      alt="Store"
                                    />
                                  </div>
                                  <span className="text-[11px] font-bold text-[var(--accent)] tracking-tight truncate max-w-[120px]">
                                    {order.vendor_id?.store_name}
                                  </span>
                                </Link>
                              )}
                           </div>
                           
                           <div className="space-y-4">
                              {products.map((item, i) => (
                                <div key={i} className="flex items-center gap-4 p-3 lg:p-4 rounded-2xl bg-[var(--bg-primary)]/80 border border-[var(--glass-border)] group hover:border-[var(--accent)]/30 transition-all shadow-sm">
                                  <div className="size-12 lg:size-16 rounded-xl overflow-hidden bg-[var(--bg-secondary)] flex-shrink-0 border border-[var(--glass-border)] shadow-inner">
                                    {item.image ? (
                                      <img src={item.image} alt="" className="size-full object-cover" />
                                    ) : (
                                      <div className="size-full flex items-center justify-center opacity-20"><Package className="size-6" /></div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-[var(--text-primary)] text-xs lg:text-sm  truncate mb-1">{item.name}</p>
                                    <div className="flex items-center gap-3">
                                      <span className="px-2 py-0.5 rounded bg-[var(--bg-secondary)] text-[8px] lg:text-[11px] font-bold text-[var(--accent)] tracking-tight">x{item.quantity}</span>
                                      <span className="text-[11px] font-bold text-[var(--text-secondary)] opacity-50 tracking-tight">{item.price?.toLocaleString()} XAF / UNIT</span>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-[var(--text-primary)] text-xs lg:text-sm">{(item.price * item.quantity).toLocaleString()} <span className="text-[9px] opacity-40">XAF</span></p>
                                  </div>
                                </div>
                              ))}

                              <div className="mt-6 p-5 lg:p-6 rounded-[24px] bg-[var(--accent)]/5 border border-[var(--accent)]/10 flex flex-col gap-3 shadow-inner">
                                 <div className="flex justify-between items-center text-[11px] font-bold tracking-tight opacity-60">
                                    <span>Subtotal Node</span>
                                    <span>{order.subtotal?.toLocaleString() || order.total_amount?.toLocaleString()} XAF</span>
                                 </div>
                                 <div className="flex justify-between items-center text-[11px] font-bold tracking-tight opacity-60">
                                    <span>Shipping Pipeline</span>
                                    <span className="text-emerald-500">{order.shipping_fee > 0 ? `${order.shipping_fee.toLocaleString()} XAF` : 'ZERO-COST'}</span>
                                 </div>
                                 <div className="h-px bg-[var(--accent)]/10 my-1" />
                                 <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold  tracking-[0.2em]">Total Resolution</span>
                                    <span className="text-lg lg:text-xl font-bold text-[var(--accent)]">{order.total_amount?.toLocaleString()} <span className="text-[10px]">XAF</span></span>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>

              <Pagination 
                currentPage={currentPage} 
                totalPages={totalPages} 
                onPageChange={setCurrentPage} 
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}


