"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, Package, Truck, CheckCircle2, 
  Clock, ChevronRight, MoreHorizontal, ArrowLeft,
  Plus, RefreshCw, ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/services/api';
import RoleSidebar from '@/components/layout/RoleSidebar';
import { useAuthStore } from '@/hooks/useAuth';

export const dynamic = 'force-dynamic';

const STATUS_CONFIG = {
  placed:         { label: 'Placed',     color: 'text-purple-600',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  Icon: Clock },
  processing:     { label: 'Processing', color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    Icon: Package },
  shipped:        { label: 'Shipped',    color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  border: 'border-indigo-500/20',  Icon: Truck },
  delivered:      { label: 'Delivered',  color: 'text-emerald-600', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', Icon: CheckCircle2 },
  cancelled:      { label: 'Cancelled',  color: 'text-red-600',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    Icon: MoreHorizontal },
  refund_pending: { label: 'Refund',     color: 'text-amber-600',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   Icon: Clock },
};

const NEXT_STATUSES = {
  placed:     ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped:    ['delivered'],
};

import Pagination from '@/components/common/Pagination';

export default function VendorOrdersPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [openDetails, setOpenDetails] = useState(null);

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
  }, []);

  useEffect(() => { 
    if (!user || user.role !== 'vendor' || !user.onboarded) return;
    fetchOrders(); 
  }, [fetchOrders, user]);

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
    <>
      <header className="h-20 lg:h-24 flex flex-col lg:flex-row lg:items-center justify-between px-6 lg:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)] shrink-0 z-10 py-4 lg:py-0 gap-4 lg:gap-0 text-[var(--text-primary)]">
        <div className="flex items-center gap-4 lg:gap-6">
          <h2 className="text-fluid-lg lg:text-fluid-xl font-black text-[var(--text-primary)] tracking-tight uppercase">Sales <span className="text-[var(--accent)]">History</span></h2>
          <div className="hidden sm:block h-6 w-px bg-[var(--glass-border)] opacity-30" />
          <p className="text-[var(--text-secondary)] text-[8px] lg:text-[9px] font-black uppercase tracking-[0.3em] opacity-40"><span>{orders.length}</span> Orders</p>
        </div>

        <div className="flex items-center gap-3 lg:gap-4 self-end lg:self-auto">
          <div className="flex items-center bg-[var(--bg-secondary)] rounded-xl border border-[var(--glass-border)] p-1">
             {['all', 'placed', 'processing'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => { setActiveTab(tab); setCurrentPage(1); }} 
                 className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg text-[8px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[var(--accent)] text-white shadow-lg' : 'hover:bg-[var(--accent)]/10 text-[var(--text-secondary)]'}`}
               >
                 {tab}
               </button>
             ))}
          </div>
          <button onClick={fetchOrders} className="p-2 lg:p-2.5 rounded-xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 transition-all text-[var(--text-secondary)]">
            <RefreshCw className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="p-4 lg:p-10 space-y-6 lg:space-y-10 pb-32">
           {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-6 mt-2">
                {[
                  { label: 'Total Revenue', value: `${totalRevenue.toLocaleString()} XAF`, color: 'emerald' },
                  { label: 'Current Orders', value: pendingCount, color: 'accent' },
                  { label: 'All Orders', value: orders.length, color: 'blue' }
                ].map(s => (
                  <div key={s.label} className="glass-panel p-4 lg:p-6 rounded-[24px] lg:rounded-[40px] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:-translate-y-1 transition-all shadow-sm group">
                     <p className="text-[7px] lg:text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-secondary)] opacity-50 mb-1 lg:mb-2 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden text-ellipsis">{s.label}</p>
                     <p className="text-fluid-base lg:text-fluid-2xl font-black text-[var(--text-primary)] tracking-tight font-mono whitespace-nowrap">{s.value}</p>
                  </div>
                ))}
            </div>

           {/* Orders Table */}
           <div className="glass-panel rounded-[28px] lg:rounded-[48px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 shadow-2xl relative">
               <div className="p-6 lg:p-10 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] animate-pulse" />
                  <h3 className="text-sm lg:text-lg font-black text-[var(--text-primary)] uppercase tracking-tight">Order Tracking</h3>
                </div>
              </div>

              <div className="overflow-x-auto scroll-smooth no-scrollbar">
                <table className="w-full text-left font-sm min-w-[900px]">
                  <thead>
                    <tr className="text-[8px] lg:text-[10px] tracking-[0.3em] text-[var(--text-secondary)] bg-[var(--bg-secondary)]/30 border-b border-[var(--glass-border)] uppercase shadow-sm">
                      <th className="px-8 py-5 font-black">Order ID</th>
                      <th className="px-6 py-5 font-black">Customer</th>
                      <th className="px-6 py-5 font-black">Amount</th>
                      <th className="px-6 py-5 font-black">Status</th>
                      <th className="px-8 py-5 text-right font-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--glass-border)]/50">
                    {currentOrders.map(order => {
                      const status = STATUS_CONFIG[order.order_status || 'placed'] || STATUS_CONFIG.placed;
                      const isOpen = openDetails === order._id;
                      return (
                        <React.Fragment key={order._id}>
                        <tr className="hover:bg-[var(--accent)]/5 transition-all group/row border-transparent hover:border-[var(--glass-border)]">
                           <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                 <div className={`size-3 rounded-full ${status.bg} border-2 ${status.border} shadow-lg relative flex items-center justify-center`}>
                                   <div className={`size-1 rounded-full ${status.color.replace('text', 'bg')}`} />
                                 </div>
                                 <div className="min-w-0">
                                   <h3 className="font-black text-[var(--text-primary)] text-xs lg:text-sm font-mono tracking-tighter uppercase group-hover/row:text-[var(--accent)] transition-colors">#{order._id?.slice(-8).toUpperCase()}</h3>
                                   <p className="text-[7px] lg:text-[8px] font-black text-[var(--text-secondary)] opacity-30 uppercase tracking-widest mt-0.5">Verified Transaction</p>
                                 </div>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                              <p className="text-xs lg:text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">{order.customer_id?.name || 'GUEST CUSTOMER'}</p>
                              <div className="flex items-center gap-2 mt-1 lg:mt-1.5">
                                <span className="text-[7px] lg:text-[8px] text-[var(--text-secondary)] font-black opacity-30 uppercase tracking-[0.2em]">{new Date(order.createdAt).toLocaleDateString([], {month: 'short', day: '2-digit'})}</span>
                                <span className="size-1 rounded-full bg-[var(--glass-border)]" />
                                <span className="text-[7px] lg:text-[8px] text-[var(--accent)] font-black uppercase tracking-widest">{order.products?.length || 1} Item(s)</span>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                              <div className="flex flex-col">
                                 <span className="text-xs lg:text-sm font-black text-[var(--text-primary)] font-mono">{(order.total_amount || 0).toLocaleString()}</span>
                                 <span className="text-[7px] lg:text-[8px] font-black text-[var(--accent)] uppercase tracking-tighter opacity-40">XAF Total</span>
                              </div>
                           </td>
                           <td className="px-6 py-5">
                              <span className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl text-[7px] lg:text-[8px] font-black uppercase tracking-[0.2em] border shadow-sm inline-block transition-all ${status.bg} ${status.color} ${status.border}`}>
                                {status.label}
                              </span>
                           </td>
                           <td className="px-8 py-5 text-right whitespace-nowrap">
                               <button onClick={() => setOpenDetails(isOpen ? null : order._id)} className={`px-4 lg:px-6 py-2 lg:py-3 rounded-xl lg:rounded-2xl text-[8px] lg:text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isOpen ? 'bg-[var(--accent)] text-white shadow-[var(--accent)]/20' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] hover:border-[var(--accent)]/30 shadow-sm'}`}>
                                 View Details
                               </button>
                           </td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-[var(--bg-primary)]/40">
                            <td colSpan={5} className="px-6 py-5 border-t border-[var(--glass-border)]">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-[var(--glass-border)] p-4">
                                  <p className="text-[8px] uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mb-2">Customer</p>
                                  <p className="text-sm font-black text-[var(--text-primary)]">{order.customer_id?.name || 'Customer'}</p>
                                  <p className="text-[10px] text-[var(--text-secondary)]">{order.customer_id?.email || 'No email'}</p>
                                  <p className="text-[10px] text-[var(--text-secondary)]">{order.customer_id?.phone || 'No phone'}</p>
                                  <p className="text-[10px] mt-2 text-[var(--text-secondary)] uppercase tracking-widest">Address</p>
                                  <p className="text-[10px] text-[var(--text-primary)]">
                                    {[order.shipping_address?.street, order.shipping_address?.quartier, order.shipping_address?.city].filter(Boolean).join(', ') || 'No address'}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-[var(--glass-border)] p-4 lg:col-span-2">
                                  <p className="text-[8px] uppercase tracking-widest text-[var(--text-secondary)] opacity-60 mb-2">Items</p>
                                  <div className="space-y-2">
                                    {(order.products || []).map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between rounded-xl bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="text-xs font-black text-[var(--text-primary)] truncate uppercase">{item.name}</p>
                                          <p className="text-[9px] text-[var(--text-secondary)] uppercase tracking-widest">qty {item.quantity}</p>
                                        </div>
                                        <p className="text-xs font-black text-[var(--text-primary)]">{(item.price * item.quantity).toLocaleString()} XAF</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      )
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-8 py-24 text-center">
                           <div className="flex flex-col items-center gap-6 opacity-10">
                              <Package className="size-12 lg:size-16" />
                               <p className="text-[10px] lg:text-[12px] font-black uppercase tracking-[0.4em] italic leading-relaxed">
                                  {loading ? 'Fetching orders...' : 'No orders found.\nYour history is empty.'}
                                </p>
                           </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
           </div>

           <Pagination 
             currentPage={currentPage} 
             totalPages={totalPages} 
             onPageChange={setCurrentPage} 
           />
      </div>
    </>
  );
}
