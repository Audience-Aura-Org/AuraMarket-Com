"use client";

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Package, Truck, CheckCircle2, 
  Clock, ChevronRight, MoreHorizontal, ArrowLeft,
  Plus, RefreshCw, ChevronDown, Database,
  Zap, ShieldCheck, User, ShoppingBag, Loader2,
  XCircle, Filter
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/services/api';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import SingleOrderView from '@/components/account/SingleOrderView';
import StatCard from '@/components/layout/StatCard';
import { formatVariantLabel } from '@/utils/variants';

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
  pending:  { label: 'Unpaid', color: 'text-amber-600', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  paid:     { label: 'Paid', color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  failed:   { label: 'Failed', color: 'text-rose-600', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  refunded: { label: 'Refunded', color: 'text-sky-600', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
};

const NEXT_STATUSES = {
  placed:     ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered'],
};

export default function VendorOrdersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [updatingId, setUpdatingId] = useState(null);
  const [viewingOrderId, setViewingOrderId] = useState(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const orderId = searchParams.get('orderId');
    if (orderId) setViewingOrderId(orderId);
  }, []);

  const handleViewOrder = (id) => {
    setViewingOrderId(id);
    const url = new URL(window.location);
    url.searchParams.set('orderId', id);
    window.history.pushState({}, '', url);
  };

  const handleBack = () => {
    setViewingOrderId(null);
    const url = new URL(window.location);
    url.searchParams.delete('orderId');
    window.history.pushState({}, '', url);
  };

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/vendors/orders');
      if (res.data.success) setOrders(res.data.data.orders || []);
    } catch (err) {
      if (err.response?.status === 404) {
        if (updateUser) updateUser({ onboarded: false });
        router.push('/onboarding');
        return;
      }
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [router, updateUser]);

  useEffect(() => { 
    if (!user || user.role !== 'vendor' || !user.onboarded) return;
    fetchOrders(); 
  }, [fetchOrders, user]);

  // Real-time: re-fetch when logistics updates a shipment status
  useEffect(() => {
    const handleOrderUpdate = () => fetchOrders();
    socketService.on('order_update', handleOrderUpdate);
    socketService.on('notification', handleOrderUpdate);
    return () => {
      socketService.off('order_update', handleOrderUpdate);
      socketService.off('notification', handleOrderUpdate);
    };
  }, [fetchOrders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
     if (updatingId) return;
     setUpdatingId(orderId);
     try {
        const res = await api.patch(`/orders/${orderId}/status`, { order_status: newStatus });
        if (res.data.success) {
           const synced = res.data.data?.order?.order_status || newStatus;
           setOrders(prev => prev.map(o => {
              if (o._id !== orderId) return o;
              return {
                 ...o,
                 ...(res.data.data?.order || {}),
                 order_status: synced,
                 shipment: res.data.data?.shipments?.[0] || o.shipment,
              };
           }));
           toast.success(`Order status updated to: ${synced.toUpperCase()}`);
           fetchOrders();
        }
     } catch (err) {
        const serverOrder = err.response?.data?.data?.order;
        if (serverOrder) {
           setOrders(prev => prev.map(o => o._id === orderId ? { ...o, ...serverOrder } : o));
        }
        toast.error(err.response?.data?.message || 'Failed to update order status');
     } finally {
        setUpdatingId(null);
     }
  };

  const filtered = orders.filter(o => {
    const status = o.order_status || 'placed';
    const customerName = o.customer_id?.name || 'Customer';
    const firstItem = o.products?.[0];
    const productText = `${firstItem?.name || ''} ${formatVariantLabel(firstItem?.variant)}`.toLowerCase();
    const matchesTab = activeTab === 'all' || status === activeTab || (activeTab === 'failed' && o.payment_status === 'failed');
    const query = search.toLowerCase();
    const matchesSearch = (o._id || '').includes(search) || customerName.toLowerCase().includes(query) || productText.includes(query);
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentOrders = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalRevenue = orders.filter((o) => o.payment_status !== 'failed').reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const pendingCount = orders.filter(o => ['placed','processing'].includes(o.order_status)).length;
  const colorMap = {
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', bar: 'bg-emerald-500', badgeBg: 'bg-emerald-500/10', badgeText: 'text-emerald-600', glow: '#10b981', w: '70%' },
    primary: { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', bar: 'bg-[var(--accent)]', badgeBg: 'bg-[var(--accent)]/10', badgeText: 'text-[var(--accent)]', glow: 'var(--accent)', w: '55%' },
    blue: { bg: 'bg-indigo-600/10', text: 'text-indigo-600', bar: 'bg-indigo-600', badgeBg: 'bg-indigo-600/10', badgeText: 'text-indigo-600', glow: '#4f46e5', w: '85%' },
    purple: { bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', bar: '', badgeBg: '', badgeText: '', glow: 'var(--accent)', w: '60%' },
  };

  const completedCount = orders.filter(o => ['delivered', 'completed'].includes(o.order_status)).length;
  const recentRevenue = orders.filter(o => {
    const d = new Date(o.createdAt);
    const now = new Date();
    return (now - d) < (24 * 60 * 60 * 1000); // last 24h
  }).filter((o) => o.payment_status !== 'failed').reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const openOrdersCount = orders.filter(o => o.payment_status !== 'failed' && !['delivered', 'completed', 'cancelled', 'refunded'].includes(o.order_status)).length;

  const completionRate = orders.length > 0 ? Math.round((completedCount / orders.length) * 100) : 0;
  const openRate       = orders.length > 0 ? Math.round((openOrdersCount / orders.length) * 100) : 0;
  const pendingRate    = orders.length > 0 ? Math.round((pendingCount / orders.length) * 100) : 0;

  const stats = [
    { label: 'Total Revenue',   value: `${totalRevenue.toLocaleString()} XAF`, icon: 'payments',       color: 'emerald', pct: `${completedCount} done`,  sub: `+${recentRevenue.toLocaleString()} recent`, progress: completionRate, footer: `${completedCount} orders complete` },
    { label: 'Open Orders',     value: String(openOrdersCount),                  icon: 'shopping_bag',   color: 'primary', pct: `${orders.length} total`, sub: `${orders.filter(o => o.payment_status === 'failed').length} failed`,       progress: openRate,       footer: `${orders.length} orders total` },
    { label: 'Pending Payouts', value: String(pendingCount),                     icon: 'account_balance', color: 'purple', pct: 'Held in Escrow',         sub: 'Pending Delivery',                            progress: pendingRate,    footer: 'Held in escrow' },
    { label: 'Completed Orders', value: String(completedCount),                  icon: 'verified',       color: 'blue',   pct: 'Fully Completed',         sub: 'Delivered and Settled',                       progress: completionRate, footer: `${completedCount} fulfilled` },
  ];

  if (user?.role !== 'vendor' || !user.onboarded) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg-primary)]">
      {/* Redesigned Header */}
      <header className="relative sticky top-0 md:top-16 z-40 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-2xl">
        {/* Accent gradient line */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />
        <div className="mx-auto max-w-[1600px] px-4 py-3 sm:px-5 md:px-8">
          {/* Row 1 */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 md:gap-4 min-w-0">
              <div className="size-10 md:size-11 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-indigo-600/10 flex items-center justify-center text-[var(--accent)] border border-[var(--accent)]/20 shrink-0 shadow-lg shadow-[var(--accent)]/5">
                 <ShoppingBag className="size-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base md:text-lg font-bold text-[var(--text-primary)] tracking-tight font-[Poppins]">Orders</h2>
                <div className="flex items-center gap-2 mt-0.5">
                   <div className="size-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
                   <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 tracking-tight truncate max-w-[150px] font-[Poppins]">{user.store_name || 'STORE_ID'}</p>
                </div>
              </div>
            </div>
            <button onClick={fetchOrders} className="size-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/50 text-[var(--text-secondary)] flex items-center justify-center hover:text-[var(--accent)] hover:border-[var(--accent)]/30 active:scale-95 transition-all">
               <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {/* Row 2: Search + Desktop filters */}
          <div className="mt-3 flex items-center gap-3">
            <div className="relative flex-1 md:max-w-xs group">
               <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
               <input
                 type="text"
                 placeholder="Find Reference..."
                 className="w-full h-10 bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] rounded-xl pl-10 pr-4 text-xs font-medium tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/40 focus:bg-[var(--bg-secondary)] transition-all font-[Poppins]"
                 value={search}
                 onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
               />
            </div>
            <div className="hidden md:flex bg-[var(--bg-secondary)]/50 border border-[var(--glass-border)] rounded-xl p-1">
               {['all', 'placed', 'processing', 'shipped', 'delivered', 'failed'].map(tab => (
                 <button
                   key={tab}
                   onClick={() => { setActiveTab(tab); setExpandedId(null); setCurrentPage(1); }}
                   className={`px-3.5 py-1.5 rounded-lg text-[10px] lg:text-[11px] font-semibold tracking-tight transition-all capitalize font-[Poppins] ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-50'}`}
                 >
                   {tab}
                 </button>
               ))}
            </div>
          </div>
          {/* Mobile Filter Tabs */}
          <div className="flex md:hidden w-full overflow-x-auto no-scrollbar pt-3 -mb-1">
             <div className="flex items-center gap-2 pr-4">
               {['all', 'placed', 'processing', 'shipped', 'delivered', 'failed', 'cancelled'].map(tab => (
                 <button
                   key={tab}
                   onClick={() => { setActiveTab(tab); setExpandedId(null); setCurrentPage(1); }}
                   className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-tight transition-all capitalize whitespace-nowrap border font-[Poppins] ${activeTab === tab ? 'bg-[var(--accent)] border-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20' : 'bg-[var(--bg-secondary)] border-[var(--glass-border)] text-[var(--text-secondary)] opacity-60'}`}
                 >
                   {tab}
                 </button>
               ))}
             </div>
          </div>
        </div>
      </header>

      <div className={viewingOrderId ? "flex min-h-0 w-full flex-1 flex-col" : "p-4 md:p-10 space-y-8 pb-40"}>
         {viewingOrderId ? (
            <div className="flex min-h-0 flex-1 flex-col px-3 pb-28 pt-1 animate-in fade-in slide-in-from-bottom-3 duration-500 xs:px-4 sm:px-6 md:px-10 md:pb-40 md:pt-6">
               <SingleOrderView orderId={viewingOrderId} onBack={handleBack} />
            </div>
         ) : (
            <>
               {/* Live Stats */}
               <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                  {stats.map((stat) => (
                    <StatCard
                      key={stat.label}
                      label={stat.label}
                      value={stat.value}
                      icon={stat.icon}
                      color={stat.color}
                      pct={stat.pct}
                      sub={stat.sub}
                      progress={stat.progress}
                      footer={stat.footer}
                    />
                  ))}
               </div>

               {/* Sales History */}
               <section className="overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-sm">
                  <div className="flex items-center justify-between border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 px-4 py-3 sm:px-5">
                     <h3 className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary)]">
                        <Database className="size-3.5 text-[var(--accent)]" />
                        Sales History
                     </h3>
                     <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-1 text-[10px] font-medium text-[var(--text-secondary)]">
                        {filtered.length} orders
                     </span>
                  </div>

                  <div>
                  {loading ? (
                     <LoadingSpinner />
                  ) : currentOrders.length > 0 ? (
                     <div className="grid grid-cols-1 gap-3 p-3 sm:gap-3.5 sm:p-4">
                        {currentOrders.map(order => {
                        const status = STATUS_CONFIG[order.order_status] || STATUS_CONFIG.placed;
                        const payment = PAYMENT_STATUS[order.payment_status] || PAYMENT_STATUS.pending;
                        const customer = order.customer_id;
                        const firstItem = order.products?.[0];
                        const variantLabel = formatVariantLabel(firstItem?.variant);

                        return (
                              <button 
                                 key={order._id} 
                                 className="group relative w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] text-left transition hover:border-[var(--accent)]/30"
                                 onClick={() => handleViewOrder(order._id)}
                              >
                                 <div className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                                    <div className="flex min-w-0 items-center gap-3">
                                       <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${status.bg} ${status.color}`}>
                                          <Package className="size-4.5" />
                                       </div>
                                       <div className="min-w-0">
                                          <div className="flex flex-wrap items-center gap-2">
                                             <span className="text-[12px] font-semibold text-[var(--text-primary)]">Order #{order._id.slice(-8).toUpperCase()}</span>
                                             <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.bg} ${status.color} ${status.border}`}>
                                                {status.label}
                                             </span>
                                             <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${payment.bg} ${payment.color} ${payment.border}`}>
                                                {payment.label}
                                             </span>
                                          </div>
                                          <p className="mt-1 truncate text-[11px] text-[var(--text-secondary)]">
                                             {customer?.name || 'Guest'} • {order.shipping_address?.quartier || 'No area'}
                                          </p>
                                          {firstItem && (
                                             <p className="mt-1 truncate text-[10px] font-semibold text-[var(--text-primary)]/80">
                                                {firstItem.name}{variantLabel ? ` - ${variantLabel}` : ''}
                                             </p>
                                          )}
                                          <time className="mt-1 inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)]/70">
                                             <Clock className="size-3" />
                                             {new Date(order.createdAt).toLocaleDateString()}
                                          </time>
                                       </div>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-[var(--glass-border)] pt-2 sm:border-t-0 sm:pt-0 sm:text-right">
                                       <div>
                                          <p className="text-[16px] font-semibold tracking-tight text-[var(--text-primary)]">
                                             {order.total_amount?.toLocaleString()} <span className="text-[10px] text-[var(--text-secondary)]">XAF</span>
                                          </p>
                                          <p className="text-[10px] text-[var(--text-secondary)]">
                                             {order.products?.length || 1} item{(order.products?.length || 1) > 1 ? 's' : ''}
                                          </p>
                                       </div>
                                       <div className="ml-3 flex size-8 items-center justify-center rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] transition group-hover:text-[var(--accent)]">
                                          <ChevronRight className="size-4" />
                                       </div>
                                    </div>
                                 </div>
                              </button>
                        );
                        })}
                     </div>
                  ) : (
                     <div className="px-6 py-16 text-center">
                        <Database className="mx-auto mb-3 size-8 text-[var(--text-secondary)]/40" />
                        <p className="text-sm font-medium text-[var(--text-secondary)]">No orders found.</p>
                     </div>
                  )}
                  </div>

                  <div className="border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 px-3 py-3 sm:px-4">
                     <Pagination 
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                     />
                  </div>
               </section>
            </>
         )}
      </div>
    </div>
  );
}
