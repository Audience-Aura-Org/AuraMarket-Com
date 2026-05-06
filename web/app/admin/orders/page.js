"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Package, Truck, CheckCircle2, Clock,
  ChevronDown, ChevronUp, RefreshCw, Filter,
  User, Mail, Phone, ShoppingBag, Store,
  MoreHorizontal, X, ArrowUpRight, Database,
  Loader2, Zap, ShieldCheck
} from 'lucide-react';
import api from '@/services/api';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

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

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [logisticsFirms, setLogisticsFirms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [expandedId, setExpandedId] = useState(null);
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [orderEdits, setOrderEdits] = useState({});
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const orderId = searchParams.get('orderId');
    if (orderId) setExpandedId(orderId);
  }, []);

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
        toast.success('Order sequence updated');
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

  const tabs = ['all', 'placed', 'processing', 'shipped', 'delivered', 'cancelled', 'refund_pending'];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-start md:items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6">
          <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
             <Package className="w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Order <span className="text-[var(--accent)]">Manifest</span> Ledger</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize truncate max-w-[200px]">Operational Pipeline // Node_Order_Control</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                type="text"
                placeholder="Reference, Customer, Store..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              />
           </div>
           
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 overflow-x-auto no-scrollbar max-w-full md:max-w-[400px]">
              {tabs.map(tab => (
                <button 
                  key={tab}
                  onClick={() => { setActiveTab(tab); setExpandedId(null); setCurrentPage(1); }}
                  className={`px-3 md:px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-semibold tracking-tight transition-all capitalize whitespace-nowrap ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab}
                </button>
              ))}
           </div>

           <button onClick={fetchOrders} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95 shrink-0">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-40">
         {/* Live Stats */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {[
               { label: 'Total Volume', value: stats ? stats.orders : '...', icon: Package, color: 'var(--accent)', sub: 'MANIFEST_TOTAL' },
               { label: 'Active Pipeline', value: stats ? stats.active_orders : '...', icon: Truck, color: '#6366f1', sub: 'IN_TRANSIT' },
               { label: 'Settled Payouts', value: stats ? `${(stats.revenue / 1000).toFixed(1)}k` : '...', icon: Zap, color: '#10b981', sub: 'CAPITAL_RESOLVED' },
               { label: 'Success Rate', value: '98.4%', icon: ShieldCheck, color: '#fbbf24', sub: 'FLOW_STABLE' }
            ].map(s => (
               <div key={s.label} className="group relative p-6 md:p-8 rounded-[2rem] md:rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                  <div className="relative flex flex-col justify-between h-full space-y-6 md:space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="size-10 md:size-12 rounded-[1rem] md:rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                           <s.icon className="w-4 h-4 md:w-5 md:h-5 opacity-40 group-hover:opacity-100" />
                        </div>
                        <span className="text-[9px] md:text-[10px] lg:text-[12px] font-semibold tracking-[0.3em] capitalize opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                     </div>
                     <div>
                        <p className="text-[9px] md:text-[10px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-1 md:mb-2 capitalize opacity-40">{s.label}</p>
                        <h3 className="text-xl md:text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Order Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Platform Order Ledger
               </h3>
               <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Global Synchronization Active</p>
            </div>

            <div className="space-y-4">
              {loading ? (
                 <LoadingSpinner />
              ) : currentOrders.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4 p-6 lg:p-10">
                   {currentOrders.map(order => {
                     const isExpanded = expandedId === order._id;
                     const status = STATUS_CONFIG[order.order_status] || STATUS_CONFIG.placed;
                     const payment = PAYMENT_STATUS[order.payment_status] || PAYMENT_STATUS.pending;
                     const customer = order.customer_id;

                     return (
                        <div 
                           key={order._id} 
                           className={`group relative rounded-[2rem] md:rounded-[2.5rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col ${isExpanded ? 'ring-2 ring-[var(--accent)]/20 shadow-2xl' : ''}`}
                        >
                           <div 
                              className="p-5 md:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-8 cursor-pointer"
                              onClick={() => setExpandedId(isExpanded ? null : order._id)}
                           >
                              <div className="flex items-center gap-4 w-full sm:w-auto">
                                 <div className={`size-12 md:size-14 rounded-[1.25rem] md:rounded-[1.5rem] ${status.bg} ${status.color} flex items-center justify-center shrink-0 border ${status.color.replace('text-', 'border-')}/10 shadow-inner`}>
                                    <Package className="w-5 h-5 md:w-7 md:h-7" />
                                 </div>
                                 <div className="sm:hidden flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                       <span className="text-[11px] font-semibold text-[var(--text-primary)] tracking-tight">Order Trace</span>
                                       <time className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-30 tracking-widest flex items-center gap-1 capitalize">
                                          <Clock className="w-2.5 h-2.5" /> {new Date(order.createdAt).toLocaleDateString()}
                                       </time>
                                    </div>
                                    <div className={`mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-widest border inline-block ${status.bg} ${status.color} ${status.color.replace('text-', 'border-')}/20 capitalize`}>
                                       {status.label}
                                    </div>
                                 </div>
                              </div>

                              <div className="flex-1 min-w-0 w-full sm:w-auto">
                                 <div className="hidden sm:flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                       <span className="text-[11px] lg:text-[12px] md:text-[13px] font-semibold text-[var(--text-primary)] tracking-tight capitalize">Order Trace</span>
                                       <span className={`px-3 py-1 rounded-full text-[10px] lg:text-[12px] font-semibold tracking-widest border ${status.bg} ${status.color} ${status.color.replace('text-', 'border-')}/20 capitalize`}>
                                          {status.label}
                                       </span>
                                    </div>
                                    <time className="text-[10px] lg:text-[12px] font-semibold text-[var(--text-secondary)] opacity-30 tracking-widest flex items-center gap-2 capitalize">
                                       <Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleDateString()}
                                    </time>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-60 truncate">
                                       <span className="font-mono text-[var(--accent)] font-bold">#{order._id.slice(-8).toUpperCase()}</span>
                                       <span className="hidden sm:inline">•</span>
                                       <span className="truncate max-w-full sm:max-w-md">{customer?.name} → {order.vendor_id?.store_name}</span>
                                    </div>
                                 </div>
                              </div>

                              <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-[var(--glass-border)] pt-4 sm:pt-0 shrink-0">
                                 <p className="text-lg md:text-2xl font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{order.total_amount?.toLocaleString()} <span className="text-[10px] lg:text-[12px] opacity-30 ml-1">XAF</span></p>
                                 <div className="flex items-center gap-3 sm:mt-2">
                                    <span className={`px-2 py-0.5 rounded text-[9px] md:text-[10px] lg:text-[12px] font-semibold tracking-widest capitalize border ${payment.bg} ${payment.color} ${payment.color.replace('text-', 'border-')}/20`}>
                                       {payment.label}
                                    </span>
                                    <div className="size-6 rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-sm">
                                       {customer?.avatar ? <img src={customer.avatar} className="size-full object-cover" /> : <User className="size-full p-1 opacity-20" />}
                                    </div>
                                 </div>
                              </div>
                           </div>
v>

                           <AnimatePresence>
                              {isExpanded && (
                                 <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                 >
                                    <div className="px-5 md:px-8 pb-5 md:pb-8 grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                                       {/* Order Details */}
                                       <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-6 rounded-3xl space-y-4">
                                          <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-2 opacity-50 capitalize flex items-center gap-2">
                                             <Database className="w-3 h-3" /> Entity Metadata
                                          </p>
                                          <div className="grid grid-cols-2 gap-4">
                                             <div>
                                                <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-1">Customer</p>
                                                <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)]">{customer?.name}</p>
                                                <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-50">{customer?.email}</p>
                                             </div>
                                             <div>
                                                <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-1">Store Node</p>
                                                <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)]">{order.vendor_id?.store_name}</p>
                                             </div>
                                             <div className="col-span-2">
                                                <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-1">Shipping Terminal</p>
                                                <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)]">{order.shipping_address?.quartier}, {order.shipping_address?.address}</p>
                                             </div>
                                          </div>
                                       </div>

                                       {/* Line Items */}
                                       <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-6 rounded-3xl space-y-4">
                                          <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-2 opacity-50 capitalize flex items-center gap-2">
                                             <ShoppingBag className="w-3 h-3" /> Manifest Payload
                                          </p>
                                          <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                                             {order.products?.map((it, idx) => (
                                                <div key={idx} className="flex items-center gap-3 p-2 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)]">
                                                   <div className="size-8 rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)]">
                                                      {it.image ? <img src={it.image} className="size-full object-cover" /> : <Package className="size-full p-1.5 opacity-20" />}
                                                   </div>
                                                   <div className="flex-1 min-w-0">
                                                      <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-primary)] truncate">{it.name}</p>
                                                      <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-50">x{it.quantity} @ {it.price?.toLocaleString()} XAF</p>
                                                   </div>
                                                </div>
                                             ))}
                                          </div>
                                       </div>

                                       {/* Admin Controls */}
                                       <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-6 rounded-3xl space-y-4">
                                          <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-2 opacity-50 capitalize flex items-center gap-2">
                                             <Zap className="w-3 h-3" /> Pipeline Override
                                          </p>
                                          <div className="space-y-3">
                                             <select
                                                value={orderEdits[order._id]?.order_status ?? order.order_status}
                                                onChange={(e) => setOrderEditField(order._id, 'order_status', e.target.value)}
                                                className="w-full h-11 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl px-4 text-[11px] lg:text-[12px]  font-semibold outline-none focus:border-[var(--accent)]"
                                             >
                                                {Object.keys(STATUS_CONFIG).map((s) => (
                                                   <option key={s} value={s}>{STATUS_CONFIG[s].label.toUpperCase()}</option>
                                                ))}
                                             </select>
                                             <select
                                                value={orderEdits[order._id]?.logistics_company_id ?? order.logistics_company_id?._id ?? order.logistics_company_id ?? ''}
                                                onChange={(e) => setOrderEditField(order._id, 'logistics_company_id', e.target.value || null)}
                                                className="w-full h-11 bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-xl px-4 text-[11px] lg:text-[12px]  font-semibold outline-none focus:border-[var(--accent)]"
                                             >
                                                <option value="">MANUAL SHIPMENT</option>
                                                {logisticsFirms.map((f) => (
                                                   <option key={f._id} value={f._id}>{f.company_name.toUpperCase()}</option>
                                                ))}
                                             </select>
                                             <button
                                                onClick={() => saveOrderControl(order)}
                                                disabled={savingOrderId === order._id || !orderEdits[order._id]}
                                                className="w-full h-12 bg-[var(--accent)] text-white rounded-xl  font-semibold text-[10px] lg:text-[12px] tracking-widest capitalize shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                             >
                                                {savingOrderId === order._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                                                Patch Sequence
                                             </button>
                                          </div>
                                       </div>
                                    </div>
                                 </motion.div>
                              )}
                           </AnimatePresence>
                        </div>
                     );
                   })}
                 </div>
              ) : (
                 <div className="py-40 flex flex-col items-center justify-center opacity-20 px-10 text-center">
                    <Database className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                    <p className="text-sm  font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No operational manifests detected in this node.</p>
                 </div>
              )}
            </div>

            <div className="p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10">
               <Pagination 
                   currentPage={currentPage}
                   totalPages={totalPages}
                   onPageChange={setCurrentPage}
               />
            </div>
         </div>
      </div>
    </div>
  );
}
