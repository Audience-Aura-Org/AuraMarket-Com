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

const STATUS_CONFIG = {
  placed:         { label: 'Placed',      color: 'text-purple-600',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  dot: 'bg-purple-500' },
  processing:     { label: 'Processing',  color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    dot: 'bg-blue-500' },
  shipped:        { label: 'Shipped',     color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  dot: 'bg-indigo-500' },
  delivered:      { label: 'Delivered',   color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  cancelled:      { label: 'Cancelled',   color: 'text-red-600',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-500' },
  refund_pending: { label: 'Refund',      color: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  refunded:       { label: 'Refunded',    color: 'text-sky-600',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20',     dot: 'bg-sky-500' },
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
  const [expandedId, setExpandedId] = useState(null);
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
     setUpdatingId(orderId);
     try {
        const res = await api.patch(`/vendors/orders/${orderId}/status`, { status: newStatus });
        if (res.data.success) {
           setOrders(prev => prev.map(o => o._id === orderId ? { ...o, order_status: newStatus } : o));
           toast.success(`Pipeline updated: ${newStatus.toUpperCase()}`);
        }
     } catch (err) {
        toast.error(err.response?.data?.message || 'Sequence update failed');
     } finally {
        setUpdatingId(null);
     }
  };

  const filtered = orders.filter(o => {
    const status = o.order_status || 'placed';
    const customerName = o.customer_id?.name || 'Customer';
    const matchesTab = activeTab === 'all' || status === activeTab;
    const matchesSearch = (o._id || '').includes(search) || customerName.toLowerCase().includes(search.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const currentOrders = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const pendingCount = orders.filter(o => ['placed','processing'].includes(o.order_status)).length;

  if (user?.role !== 'vendor' || !user.onboarded) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
             <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight ">Sales <span className="text-[var(--accent)]">Manifest</span> Ledger</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_rgba(var(--accent-rgb),0.5)] animate-pulse" />
               <p className="text-[11px] lg:text-[12px] font-bold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize">Merchant Pipeline // Node_{user.store_name?.replace(/\s/g, '_')}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                type="text"
                placeholder="Reference, Customer..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px] font-bold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
                value={search}
                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              />
           </div>
           
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 overflow-x-auto no-scrollbar max-w-[300px]">
              {['all', 'placed', 'processing', 'shipped'].map(tab => (
                <button 
                  key={tab}
                  onClick={() => { setActiveTab(tab); setExpandedId(null); setCurrentPage(1); }}
                  className={`px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-bold tracking-tight transition-all capitalize whitespace-nowrap ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {tab}
                </button>
              ))}
           </div>

           <button onClick={fetchOrders} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className={viewingOrderId ? "w-full" : "p-10 space-y-8 pb-40"}>
         {viewingOrderId ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 p-10 pb-40">
               <SingleOrderView 
                  orderId={viewingOrderId} 
                  onBack={handleBack} 
                  isAdmin={user?.role === 'admin'}
               />
            </div>
         ) : (
            <>
               {/* Live Stats */}
               <div className="grid grid-cols-3 gap-6">
                  {[
                     { label: 'Total Revenue', value: `${totalRevenue.toLocaleString()} XAF`, icon: Database, color: 'var(--accent)', sub: 'ACCUMULATED_XAF' },
                     { label: 'Pending Payouts', value: pendingCount, icon: Zap, color: '#6366f1', sub: 'LOCKED_NODES' },
                     { label: 'Success Nodes', value: orders.length, icon: ShieldCheck, color: '#10b981', sub: 'MANIFEST_COMPLETE' }
                  ].map(s => (
                     <div key={s.label} className="group relative p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                        <div className="relative flex flex-col justify-between h-full space-y-8">
                           <div className="flex items-center justify-between">
                              <div className="size-12 rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                                 <s.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                              </div>
                              <span className="text-[10px] lg:text-[12px] font-bold tracking-[0.3em] capitalize opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                           </div>
                           <div>
                              <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] tracking-[0.2em] mb-2 capitalize opacity-40">{s.label}</p>
                              <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>

               {/* Sales Ledger */}
               <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
                  <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
                     <h3 className="text-[11px] lg:text-[12px] font-bold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                        <Database className="w-4 h-4 text-[var(--accent)]" /> 
                        Store Sales Ledger
                     </h3>
                     <p className="text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Real-time Order Resolution</p>
                  </div>

                  <div className="space-y-4">
                  {loading ? (
                     <LoadingSpinner text="Synchronizing Sales Pipeline" />
                  ) : currentOrders.length > 0 ? (
                     <div className="grid grid-cols-1 gap-4 p-6 lg:p-10">
                        {currentOrders.map(order => {
                        const status = STATUS_CONFIG[order.order_status] || STATUS_CONFIG.placed;
                        const customer = order.customer_id;

                        return (
                              <button 
                                 key={order._id} 
                                 className={`group relative w-full text-left rounded-[2.5rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col`}
                                 onClick={() => handleViewOrder(order._id)}
                              >
                                 <div className="p-6 lg:p-8 flex items-center gap-6 md:gap-8">
                                    <div className={`size-12 md:size-14 rounded-[1.5rem] ${status.bg} ${status.color} flex items-center justify-center shrink-0 border ${status.color.replace('text-', 'border-')}/10 shadow-inner`}>
                                       <Package className="w-6 h-6 md:w-7 md:h-7" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                       <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-3">
                                             <span className="text-[11px] lg:text-[12px] md:text-[13px] font-bold text-[var(--text-primary)] tracking-tight capitalize">Order Trace</span>
                                             <span className={`px-3 py-1 rounded-full text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px] font-bold tracking-widest border ${status.bg} ${status.color} ${status.color.replace('text-', 'border-')}/20 capitalize`}>
                                                {status.label}
                                             </span>
                                          </div>
                                          <time className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-30 tracking-widest flex items-center gap-2 capitalize">
                                             <Clock className="w-3 h-3" /> {new Date(order.createdAt).toLocaleDateString()}
                                          </time>
                                       </div>
                                       <div className="flex items-center gap-4">
                                          <div className="flex items-center gap-2 text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-60 truncate">
                                             <span className="font-mono text-[var(--accent)] font-bold">#{order._id.slice(-8).toUpperCase()}</span>
                                             <span>•</span>
                                             <span className="truncate max-w-[200px] md:max-w-md">{customer?.name || 'GUEST'} → Delivery Node: {order.shipping_address?.quartier}</span>
                                          </div>
                                       </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                       <p className="text-xl md:text-2xl font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{order.total_amount?.toLocaleString()} <span className="text-[10px] lg:text-[12px] md:text-[12px] opacity-30 ml-1">XAF</span></p>
                                       <div className="flex items-center justify-end gap-3 mt-2">
                                          <span className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px] font-bold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">{order.products?.length || 1} Payload Node(s)</span>
                                          <div className="size-6 rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-sm">
                                             {customer?.avatar ? <img src={customer.avatar} className="size-full object-cover" /> : <User className="size-full p-1 opacity-20" />}
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              </button>
                        );
                        })}
                     </div>
                  ) : (
                     <div className="py-40 flex flex-col items-center justify-center opacity-20 px-10 text-center">
                        <Database className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                        <p className="text-sm font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No sales manifests detected in this vector.</p>
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
            </>
         )}
      </div>
    </div>
  );
}
