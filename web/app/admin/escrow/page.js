"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Unlock, History, 
  DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Search, Filter, Database, Loader2, Zap, CreditCard,
  AlertCircle, Clock, XCircle, CheckCircle2
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
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Escrow <span className="text-[var(--accent)]">Vault</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Protocol Active // Master</p>
              </div>
            </div>
          </div>
          <button onClick={fetchEscrow} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
           <div className="relative flex-1 md:w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                type="text"
                placeholder="Order ID, Customer, Store..."
                className="w-full h-11 md:h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px] font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all shadow-inner"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
           </div>
           <button onClick={fetchEscrow} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
         {/* Live Intelligence Stats */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
               { label: 'Custody Total', value: `${heldTotal.toLocaleString()} XAF`, icon: Lock, color: 'var(--accent)', sub: 'LOCKED' },
               { label: 'Settled Capital', value: `${releasedTotal.toLocaleString()} XAF`, icon: Unlock, color: '#10b981', sub: 'RELEASED' },
               { label: 'Contested', value: `${disputedTotal.toLocaleString()} XAF`, icon: AlertCircle, color: '#f43f5e', sub: 'DISPUTE' },
               { label: 'System Health', value: 'High', icon: Zap, color: '#fbbf24', sub: 'TRUST' }
            ].map(s => (
               <div key={s.label} className="group relative p-5 md:p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 backdrop-blur-xl shadow-sm hover:shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                     <div className="size-9 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] border border-[var(--glass-border)] group-hover:text-[var(--text-primary)] transition-colors">
                        <s.icon className="size-4 opacity-40 group-hover:opacity-100" />
                     </div>
                     <span className="text-[9px] font-bold tracking-[0.2em] text-[var(--text-secondary)] opacity-20 group-hover:opacity-40 uppercase font-mono">{s.sub}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase opacity-40 mb-1">{s.label}</p>
                    <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)] truncate">{s.value}</h3>
                  </div>
               </div>
            ))}
         </div>

         {/* Escrow Ledger */}
         <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
               <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                  <Database className="size-4 text-[var(--accent)]" /> Global Escrow Trace Ledger
               </h3>
               <p className="hidden md:block text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">Secure Vault Logs Synchronized</p>
            </div>

            <div className="p-4 md:p-8 space-y-4">
              {loading ? (
                 <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20">
                    <Loader2 className="animate-spin size-10" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Synchronizing Nodes...</p>
                 </div>
              ) : currentLogs.length > 0 ? (
                 <div className="grid grid-cols-1 gap-4">
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
                           className={`group relative rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden backdrop-blur-xl flex flex-col ${isExpanded ? 'ring-1 ring-[var(--accent)]/30 shadow-2xl bg-[var(--bg-primary)]/60' : 'hover:-translate-y-1'}`}
                        >
                           <div 
                              className="p-5 md:p-6 flex flex-col md:flex-row md:items-center gap-6 cursor-pointer"
                              onClick={() => setExpandedId(isExpanded ? null : l._id)}
                           >
                              <div className={`size-12 md:size-14 rounded-2xl ${statusBg} ${statusColor} flex items-center justify-center shrink-0 border ${statusColor.replace('text-', 'border-')}/10 shadow-inner group-hover:scale-105 transition-transform duration-500`}>
                                 {l.status === 'held' ? <Lock className="w-6 h-6 md:w-7 h-7" /> : <Unlock className="w-6 h-6 md:w-7 h-7" />}
                              </div>

                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                       <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-tight uppercase">Order Trace #{l.order_id?._id?.slice(-8).toUpperCase() || 'LEGACY'}</span>
                                       <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-widest border uppercase ${statusBg} ${statusColor} ${statusColor.replace('text-', 'border-')}/20`}>
                                          {l.status.replace('_', ' ')}
                                       </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-widest">
                                       <Clock className="w-3 h-3" /> {new Date(l.createdAt).toLocaleDateString()}
                                    </div>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                       <p className="text-[13px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                                          {l.buyer_id?.name || 'Customer Node'} → {l.vendor_id?.store_name || 'Vendor Hub'}
                                       </p>
                                       <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest mt-0.5">Network Transaction Protocol</p>
                                    </div>
                                 </div>
                              </div>

                              <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-4 pt-5 md:pt-0 border-t md:border-t-0 border-[var(--glass-border)]/50">
                                 <div className="text-left md:text-right">
                                    <p className="text-xl font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{l.amount.toLocaleString()} <span className="text-[10px] opacity-30 ml-1 font-mono">XAF</span></p>
                                    <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-[0.2em] mt-0.5">Asset Custody</p>
                                 </div>
                                 <ShieldCheck className={`hidden md:block size-4 ${l.status === 'released' ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-20'}`} />
                              </div>
                           </div>

                           <AnimatePresence>
                              {isExpanded && (
                                 <motion.div 
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden bg-[var(--bg-secondary)]/20 border-t border-[var(--glass-border)]"
                                 >
                                    <div className="p-6 md:p-8 flex flex-col lg:flex-row gap-8">
                                       <div className="flex-1 space-y-6">
                                          <div className="grid grid-cols-2 gap-4">
                                             <div className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                                <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em] mb-2">Customer Confirmed</p>
                                                <div className="flex items-center gap-2">
                                                   <div className={`size-1.5 rounded-full ${l.customer_confirmed ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                                   <p className={`text-[11px] font-bold ${l.customer_confirmed ? 'text-emerald-500' : 'text-rose-500'}`}>{l.customer_confirmed ? 'VERIFIED' : 'PENDING'}</p>
                                                </div>
                                             </div>
                                             <div className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                                <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em] mb-2">Transaction State</p>
                                                <div className="flex items-center gap-2">
                                                   <div className={`size-1.5 rounded-full ${l.status === 'released' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                                                   <p className={`text-[11px] font-bold ${l.status === 'released' ? 'text-emerald-500' : 'text-amber-500'}`}>{l.status === 'released' ? 'SETTLED' : 'LOCKED'}</p>
                                                </div>
                                             </div>
                                             {l.release_date && (
                                               <div className="col-span-2 p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                                  <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.2em] mb-2">Settlement Timestamp</p>
                                                  <p className="text-[11px] font-bold text-[var(--text-primary)] tracking-tight">{new Date(l.release_date).toLocaleString()}</p>
                                               </div>
                                             )}
                                          </div>
                                       </div>

                                       <div className="flex-1">
                                          {['held', 'pending_release', 'disputed'].includes(l.status) ? (
                                            <div className="flex flex-col gap-3 h-full justify-center">
                                               <button 
                                                 onClick={() => handleRelease(l.order_id?._id)}
                                                 disabled={loadingAction === l.order_id?._id}
                                                 className="w-full h-14 bg-emerald-500 text-white rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                               >
                                                  {loadingAction === l.order_id?._id ? <Loader2 className="size-4 animate-spin" /> : <Unlock className="size-4" />} Force Release
                                               </button>
                                               <button 
                                                 onClick={() => handleRefund(l.order_id?._id)}
                                                 disabled={loadingAction === l.order_id?._id}
                                                 className="w-full h-14 bg-rose-500 text-white rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-rose-500/20 hover:bg-rose-600 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                                               >
                                                  {loadingAction === l.order_id?._id ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Force Refund
                                               </button>
                                            </div>
                                          ) : (
                                             <div className="h-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-[var(--glass-border)] opacity-30">
                                                <CheckCircle2 className="size-8 mb-3 text-emerald-500" />
                                                <p className="text-[10px] font-bold tracking-widest uppercase">Node Fully Settled</p>
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
                 <div className="py-40 flex flex-col items-center justify-center opacity-10 px-10 text-center gap-6">
                    <Database className="w-16 h-16 text-[var(--text-secondary)]" />
                    <p className="text-xs font-bold tracking-[0.4em] uppercase max-w-sm">No Secure Vault Logs Detected</p>
                 </div>
              )}
            </div>

            <div className="p-6 md:p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 flex justify-center">
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
