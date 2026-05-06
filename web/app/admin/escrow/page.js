"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Unlock, History, 
  DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Search, Filter, Database, Loader2, Zap, CreditCard,
  AlertCircle, Clock, XCircle
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function AdminEscrow() {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    setMounted(true);
    fetchEscrow();
  }, []);

  const fetchEscrow = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/escrow/logs');
      if (res.data?.success) {
        setLogs(res.data.data.logs || []);
        setStats(res.data.data.stats || []);
      }
    } catch (err) {
      console.error('Failed to fetch escrow data:', err);
      toast.error('Failed to sync with secure vault');
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => {
    const query = searchQuery.toLowerCase();
    return (
       l.order_id?._id?.toLowerCase().includes(query) ||
       l.buyer_id?.name?.toLowerCase().includes(query) ||
       l.vendor_id?.store_name?.toLowerCase().includes(query) ||
       l._id?.toLowerCase().includes(query)
    );
  });

  const handleRelease = async (orderId) => {
    if (!orderId) {
      toast.error('Invalid order reference');
      return;
    }
    if (!window.confirm('Are you sure you want to FORCE RELEASE funds to the vendor? This action is irreversible.')) return;
    
    setLoadingAction(orderId);
    try {
      const res = await api.post(`/escrow/release/${orderId}`);
      if (res.data?.success) {
        toast.success('Funds released successfully');
        fetchEscrow();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to release funds');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleRefund = async (orderId) => {
    if (!orderId) {
      toast.error('Invalid order reference');
      return;
    }
    if (!window.confirm('Are you sure you want to FORCE REFUND funds to the customer? This action is irreversible.')) return;
    
    setLoadingAction(orderId);
    try {
      const res = await api.post(`/escrow/refund/${orderId}`, { reason: 'Admin override' });
      if (res.data?.success) {
        toast.success('Funds refunded successfully');
        fetchEscrow();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refund funds');
    } finally {
      setLoadingAction(null);
    }
  };

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const currentLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const heldTotal = stats.find(s => s._id === 'held')?.totalAmount || 0;
  const releasedTotal = stats.find(s => s._id === 'released')?.totalAmount || 0;
  const disputedTotal = stats.find(s => s._id === 'disputed')?.totalAmount || 0;

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
             <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl  font-bold text-[var(--text-primary)] tracking-tight ">Escrow <span className="text-[var(--accent)]">Vault</span> Monitoring</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize">Protocol Active // Node_Escrow_Master</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                type="text"
                placeholder="Order ID, Customer, Store..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
           </div>
           
           <button onClick={fetchEscrow} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-10 space-y-8 pb-40">
         {/* Live Stats */}
         <div className="grid grid-cols-4 gap-6">
            {[
               { label: 'Funds Under Custody', value: `${heldTotal.toLocaleString()} XAF`, icon: Lock, color: 'var(--accent)', sub: 'LOCKED_NODES' },
               { label: 'Settled Capital', value: `${releasedTotal.toLocaleString()} XAF`, icon: Unlock, color: '#10b981', sub: 'RELEASED_FEED' },
               { label: 'Contested Funds', value: `${disputedTotal.toLocaleString()} XAF`, icon: AlertCircle, color: '#f43f5e', sub: 'DISPUTE_LOG' },
               { label: 'System Trust', value: 'High', icon: Zap, color: '#fbbf24', sub: 'INTEGRITY_INDEX' }
            ].map(s => (
               <div key={s.label} className="group relative p-8 rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 overflow-hidden shadow-lg hover:shadow-2xl hover:-translate-y-1 backdrop-blur-2xl">
                  <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 size-32 rounded-full blur-[80px] opacity-10 transition-opacity group-hover:opacity-30" style={{ backgroundColor: s.color }} />
                  <div className="relative flex flex-col justify-between h-full space-y-8">
                     <div className="flex items-center justify-between">
                        <div className="size-12 rounded-[1.25rem] flex items-center justify-center border border-[var(--glass-border)] bg-[var(--bg-secondary)] shadow-inner text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-all duration-500">
                           <s.icon className="w-5 h-5 opacity-40 group-hover:opacity-100" />
                        </div>
                        <span className="text-[10px] lg:text-[12px]  font-semibold tracking-[0.3em] capitalize opacity-20 group-hover:opacity-40 transition-opacity font-mono">{s.sub}</span>
                     </div>
                     <div>
                        <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-2 capitalize opacity-40">{s.label}</p>
                        <h3 className="text-2xl  font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Escrow Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Global Escrow Trace Ledger
               </h3>
               <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Displaying secure vault logs</p>
            </div>

            <div className="space-y-4">
              {loading ? (
                 <LoadingSpinner />
              ) : currentLogs.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4 p-6 lg:p-10">
                   {currentLogs.map(l => {
                     const isExpanded = expandedId === l._id;
                     const statusColor = 
                        l.status === 'held' ? 'text-amber-500' : 
                        l.status === 'pending_release' ? 'text-blue-500' :
                        l.status === 'disputed' ? 'text-rose-600' :
                        l.status === 'released' ? 'text-emerald-500' : 'text-rose-500';
                     const statusBg = statusColor.replace('text-', 'bg-').concat('/10');

                     return (
                        <div 
                           key={l._id} 
                           className={`group relative rounded-[2.5rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col ${isExpanded ? 'ring-2 ring-[var(--accent)]/20 shadow-2xl' : ''}`}
                        >
                           <div 
                              className="p-6 lg:p-8 flex items-center gap-6 md:gap-8 cursor-pointer"
                              onClick={() => setExpandedId(isExpanded ? null : l._id)}
                           >
                              <div className={`size-12 md:size-14 rounded-[1.5rem] ${statusBg} ${statusColor} flex items-center justify-center shrink-0 border ${statusColor.replace('text-', 'border-')}/10 shadow-inner`}>
                                 {l.status === 'held' ? <Lock className="w-6 h-6 md:w-7 md:h-7" /> : <Unlock className="w-6 h-6 md:w-7 md:h-7" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                       <span className="text-[11px] lg:text-[12px] md:text-[13px]  font-semibold text-[var(--text-primary)] tracking-tight capitalize">Order Trace</span>
                                       <span className={`px-3 py-1 rounded-full text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold tracking-widest border ${statusBg} ${statusColor} ${statusColor.replace('text-', 'border-')}/20 capitalize`}>
                                          {l.status.replace('_', ' ')}
                                       </span>
                                    </div>
                                    <time className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 tracking-widest flex items-center gap-2 capitalize">
                                       <Clock className="w-3 h-3" /> {new Date(l.createdAt).toLocaleDateString()}
                                    </time>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-60 truncate">
                                       <span className="font-mono text-[var(--accent)]  font-bold">#{l.order_id?._id?.slice(-8).toUpperCase() || 'LEGACY'}</span>
                                       <span>•</span>
                                       <span className="truncate max-w-[200px] md:max-w-md">From: {l.buyer_id?.name || 'Customer'} → To: {l.vendor_id?.store_name || 'Vendor'}</span>
                                    </div>
                                 </div>
                              </div>

                              <div className="text-right shrink-0">
                                 <p className="text-xl md:text-2xl  font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{l.amount.toLocaleString()} <span className="text-[10px] lg:text-[12px] md:text-[12px] opacity-30 ml-1">XAF</span></p>
                                 <div className="flex items-center justify-end gap-3 mt-2">
                                    <span className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Protocol Secured</span>
                                    <ShieldCheck className="w-4 h-4 text-emerald-500 opacity-40" />
                                 </div>
                              </div>
                           </div>

                           <AnimatePresence>
                              {isExpanded && (
                                 <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                 >
                                    <div className="px-8 pb-8 flex flex-col lg:flex-row gap-6">
                                       <div className="flex-1 space-y-4">
                                          <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-6 rounded-3xl">
                                             <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-4 opacity-50 capitalize flex items-center gap-2">
                                                <History className="w-3 h-3" /> Vault Trace History
                                             </p>
                                             <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                   <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-1">Customer Confirmed</p>
                                                   <p className={`text-[11px] lg:text-[12px]  font-semibold ${l.customer_confirmed ? 'text-emerald-500' : 'text-rose-500'}`}>{l.customer_confirmed ? 'YES' : 'NO'}</p>
                                                </div>
                                                <div>
                                                   <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-1">Vendor Confirmed</p>
                                                   <p className={`text-[11px] lg:text-[12px]  font-semibold ${l.vendor_confirmed ? 'text-emerald-500' : 'text-rose-500'}`}>{l.vendor_confirmed ? 'YES' : 'NO'}</p>
                                                </div>
                                                {l.release_date && (
                                                  <div className="col-span-2">
                                                     <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-1">Settlement Date</p>
                                                     <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)]">{new Date(l.release_date).toLocaleString()}</p>
                                                  </div>
                                                )}
                                             </div>
                                          </div>
                                       </div>

                                       <div className="flex-1 space-y-4">
                                          {['held', 'pending_release', 'disputed'].includes(l.status) && (
                                            <div className="flex flex-col gap-3">
                                               <button 
                                                 onClick={() => handleRelease(l.order_id?._id)}
                                                 disabled={loadingAction === l.order_id?._id}
                                                 className="w-full h-14 bg-emerald-500 text-white rounded-2xl  font-semibold text-[10px] lg:text-[12px] tracking-[0.2em] capitalize shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                               >
                                                  {loadingAction === l.order_id?._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                                                  Force Release Funds
                                               </button>
                                               <button 
                                                 onClick={() => handleRefund(l.order_id?._id)}
                                                 disabled={loadingAction === l.order_id?._id}
                                                 className="w-full h-14 bg-rose-500 text-white rounded-2xl  font-semibold text-[10px] lg:text-[12px] tracking-[0.2em] capitalize shadow-lg shadow-rose-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                               >
                                                  {loadingAction === l.order_id?._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                  Force Refund Customer
                                               </button>
                                            </div>
                                          )}
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
                    <p className="text-sm  font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No vault logs detected in this node.</p>
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
