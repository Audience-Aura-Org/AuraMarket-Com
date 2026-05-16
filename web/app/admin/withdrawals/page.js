"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, XCircle, Loader2,
  RefreshCw, Search, User, Users, ChevronRight, ShieldCheck,
  Zap, RotateCcw, Copy, Globe, Clock, AlertCircle, CheckCircle2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { fmt, STATUS_CONFIG, getStatusConfig, getMethodIcon } from '@/utils/adminFinance';
import Pagination from '@/components/common/Pagination';

// Map STATUS_CONFIG shape to the local `cls` string format used in this page
const STATUS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [
    k, { cls: `${v.bg} ${v.color} ${v.border}`, icon: v.icon }
  ])
);

function KPI({ title, value, icon: Icon, color, sub }) {
  const c = { fuchsia: 'bg-[var(--accent)]/10 text-[var(--accent)]', blue: 'bg-indigo-500/10 text-indigo-500', emerald: 'bg-emerald-500/10 text-emerald-500', amber: 'bg-amber-500/10 text-amber-500' };
  return (
    <div className="bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-3xl p-6 relative overflow-hidden glass-panel">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-2xl opacity-20 ${c[color]?.split(' ')[0]}`} />
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center mb-4 ${c[color]}`}><Icon className="w-5 h-5" /></div>
      <p className="text-[11px] lg:text-[12px]  font-semibold tracking-[0.15em] text-[var(--text-secondary)] opacity-50">{title}</p>
      <h3 className="text-2xl  font-bold text-[var(--text-primary)] mt-1 tabular-nums">{value}</h3>
      {sub && <p className="text-[10px] lg:text-[12px] text-[var(--text-secondary)] opacity-40 mt-1">{sub}</p>}
    </div>
  );
}

const TABS = ['pending', 'approved', 'completed', 'rejected', 'failed', 'all'];

export default function AdminWithdrawalsPage() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter]     = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch]     = useState('');
  const [processing, setProc]   = useState(null);
  const [selected, setSelected] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    if (!user) { router.replace('/login?from=admin-withdrawals'); return; }
    if (user.role !== 'admin') { router.replace('/wallet'); }
  }, [user, router]);


  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter !== 'all') params.status = filter;
      if (roleFilter !== 'all') params.role = roleFilter;
      const res = await api.get('/withdrawals/admin', { params });
      
      const payload = res.data?.data || res.data;
      if (res.data?.success || res.status === 200) {
        setWithdrawals(payload?.withdrawals || []);
        setPendingCount(payload?.pendingCount || 0);
      }
    } catch (err) { 
      console.error('[Withdrawals] Load failed:', err);
      toast.error('Failed to load withdrawals'); 
    } finally { 
      setLoading(false); 
    }
  }, [filter, roleFilter]);

  useEffect(() => { load(); }, [load, filter, roleFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, roleFilter, search]);

  const handleApprove = async (id) => {
    setProc('approve');
    try {
      const res = await api.post(`/withdrawals/admin/${id}/approve`);
      toast.success(res.data.message || 'Approved. Payout sent to Eversend.');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Approval failed.');
    } finally { setProc(null); }
  };

  const handleReject = async (id, reason) => {
    if (!reason || reason.trim().length < 5) { toast.error('Rejection reason too short.'); return; }
    setProc('reject');
    try {
      await api.post(`/withdrawals/admin/${id}/reject`, { rejectionReason: reason });
      toast.success('Request rejected. User notified.');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Rejection failed.');
    } finally { setProc(null); }
  };

  const handleRecheck = async (id) => {
    setProc('recheck');
    try {
      const res = await api.post(`/withdrawals/admin/${id}/recheck`);
      toast.success(res.data.message || 'Status synced from Eversend.');
      load();
      // Refresh selected drawer
      setSelected(prev => prev ? { ...prev, ...res.data.data?.withdrawal } : null);
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Recheck failed.');
    } finally { setProc(null); }
  };

  const displayed = withdrawals.filter(w => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (w.requestedBy?.name || '').toLowerCase().includes(q) ||
           (w.requestedBy?.email || '').toLowerCase().includes(q) ||
           (w._id || '').toLowerCase().includes(q);
  });


  if (!user || user.role !== 'admin') return null;

  return (
    <>
      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelected(null)} />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] rounded-[2.5rem] p-6 md:p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col backdrop-blur-3xl"
            >
              <div className="flex items-start justify-between mb-8 shrink-0">
                <div className="flex items-center gap-4">
                   <div className="size-12 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20 shadow-inner"><Wallet className="w-6 h-6" /></div>
                   <div>
                      <h2 className="text-xl font-bold tracking-tight">Review Payout</h2>
                      <p className="text-[10px] font-bold text-[var(--accent)] tracking-[0.3em] uppercase opacity-60 mt-1">Transaction Node // {selected._id.slice(-8).toUpperCase()}</p>
                   </div>
                </div>
                <button onClick={() => setSelected(null)} className="p-2 rounded-xl hover:bg-[var(--bg-secondary)] transition-all text-[var(--text-secondary)]"><XCircle className="w-6 h-6" /></button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
                 <div className="space-y-6">
                    {/* Requester Profile */}
                    <div className="flex items-center gap-4 p-5 rounded-[2rem] bg-[var(--bg-secondary)]/40 border border-[var(--glass-border)] backdrop-blur-xl">
                       <div className="size-12 rounded-full bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                          {selected.requestedBy?.avatar ? <img src={selected.requestedBy.avatar} className="size-full object-cover" /> : <User className="size-6 opacity-20" />}
                       </div>
                       <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-bold text-[var(--text-primary)] truncate">{selected.requestedBy?.name || 'Unknown Node'}</p>
                          <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-tighter truncate">{selected.requestedBy?.email}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                             <span className="text-[9px] font-bold tracking-[0.1em] px-2 py-0.5 rounded-full bg-[var(--accent)] text-white uppercase">{selected.role}</span>
                             {selected.isInternal && <span className="text-[9px] font-bold tracking-[0.1em] px-2 py-0.5 rounded-full bg-indigo-500 text-white uppercase">Internal</span>}
                          </div>
                       </div>
                       <div className="text-right shrink-0 pl-4 border-l border-[var(--glass-border)]">
                          <p className="text-xl font-bold tabular-nums tracking-tighter text-[var(--text-primary)]">{fmt(selected.amount)}</p>
                          <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.1em]">{selected.currency}</p>
                       </div>
                    </div>

                    {/* Transaction Topology */}
                    <div className="grid grid-cols-2 gap-3">
                       <div className="p-4 rounded-2xl bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
                          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40 mb-2">Protocol</p>
                          <div className="flex items-center gap-2">
                             {(() => {
                                const MIcon = getMethodIcon(selected.withdrawalMethod);
                                return (
                                   <div className="p-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--accent)]">
                                      <MIcon className="size-3" />
                                   </div>
                                );
                             })()}
                             <p className="text-xs font-bold capitalize">{selected.withdrawalMethod}</p>
                          </div>
                       </div>
                       <div className="p-4 rounded-2xl bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)]">
                          <p className="text-[9px] font-bold text-[var(--text-secondary)] uppercase tracking-[0.2em] opacity-40 mb-2">Status</p>
                          <div className={`flex items-center gap-1.5 text-[11px] font-bold ${(STATUS[selected.status] || STATUS.pending).cls.split(' ').slice(1).join(' ')}`}>
                             <div className="size-1.5 rounded-full bg-current animate-pulse" />
                             <span className="capitalize">{selected.status}</span>
                          </div>
                       </div>
                    </div>

                    {/* Destination Logic */}
                    <div className="p-5 rounded-[2rem] bg-[var(--bg-secondary)]/20 border border-[var(--glass-border)] space-y-4">
                       <h3 className="text-[10px] font-bold text-[var(--text-secondary)] tracking-[0.3em] uppercase opacity-40 flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5" /> Destination Registry
                       </h3>
                       <div className="grid grid-cols-1 gap-4">
                          <div className="flex items-center justify-between">
                             <p className="text-[11px] font-bold text-[var(--text-primary)]">Recipient</p>
                             <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">{(selected.recipientDetails || {}).firstName} {(selected.recipientDetails || {}).lastName}</p>
                          </div>
                          <div className="flex items-center justify-between">
                             <p className="text-[11px] font-bold text-[var(--text-primary)]">Region</p>
                             <div className="flex items-center gap-1.5">
                                <Globe className="size-3 text-[var(--accent)]" />
                                <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">{(selected.recipientDetails || {}).country}</p>
                             </div>
                          </div>
                          <div className="flex items-center justify-between">
                             <p className="text-[11px] font-bold text-[var(--text-primary)]">Endpoint</p>
                             <div className="flex items-center gap-2">
                                <p className="text-[11px] font-bold font-mono text-[var(--accent)]">{(selected.recipientDetails || {}).phoneNumber || (selected.recipientDetails || {}).accountNumber || (selected.recipientDetails || {}).eversendTag || '—'}</p>
                                <button onClick={() => navigator.clipboard.writeText((selected.recipientDetails || {}).phoneNumber || (selected.recipientDetails || {}).accountNumber || (selected.recipientDetails || {}).eversendTag || '')} className="size-6 rounded-lg bg-[var(--bg-secondary)] flex items-center justify-center border border-[var(--glass-border)] hover:text-[var(--accent)] transition-colors"><Copy className="size-3" /></button>
                             </div>
                          </div>
                          {(selected.recipientDetails || {}).bankCode && (
                             <div className="flex items-center justify-between">
                                <p className="text-[11px] font-bold text-[var(--text-primary)]">Network Node</p>
                                <p className="text-[11px] font-medium text-[var(--text-secondary)] opacity-60">{(selected.recipientDetails || {}).bankCode}</p>
                             </div>
                          )}
                       </div>
                    </div>

                    {/* Eversend Integration */}
                    {selected.eversendTransactionId && (
                       <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-3">
                          <Zap className="size-4 text-indigo-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                             <p className="text-[9px] font-bold text-indigo-500/60 uppercase tracking-widest">External Uplink ID</p>
                             <p className="text-xs font-mono font-bold truncate tracking-tighter">{selected.eversendTransactionId}</p>
                          </div>
                       </div>
                    )}

                    {/* Failure/Reject Intelligence */}
                    {(selected.rejectionReason || selected.failureReason) && (
                       <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                          <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                             <AlertCircle className="size-3" /> System Warning
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">"{selected.rejectionReason || selected.failureReason}"</p>
                       </div>
                    )}
                 </div>
              </div>

              {/* Execution Layer */}
              <div className="pt-6 border-t border-[var(--glass-border)] mt-6 shrink-0">
                 {selected.status === 'pending' && (
                    <div className="flex flex-col gap-3">
                       <button onClick={() => handleApprove(selected._id)} disabled={!!processing}
                         className="w-full h-14 bg-emerald-500 text-white rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                       >
                         {processing === 'approve' ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Authorize Payout
                       </button>
                       <button onClick={() => handleReject(selected._id, prompt('Rejection Reason (required):') || '')} disabled={!!processing}
                         className="w-full h-12 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-rose-500/20 transition-all"
                       >
                         Void Transaction
                       </button>
                    </div>
                 )}
                 
                 {(selected.status === 'approved' || selected.status === 'processing_error') && (
                    <button onClick={() => handleRecheck(selected._id)} disabled={!!processing}
                      className="w-full h-14 bg-indigo-500 text-white rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      {processing === 'recheck' ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />} Synchronize Uplink
                    </button>
                 )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 shadow-inner border border-purple-500/20 shrink-0">
               <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Payout <span className="text-[var(--accent)]">Protocol</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] lg:text-[12px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Network Treasury Alpha</p>
              </div>
            </div>
          </div>
          <button onClick={load} className="md:hidden size-10 rounded-xl border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center active:scale-95">
             <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto no-scrollbar py-1">
           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1 shrink-0">
              {TABS.map(f => (
                <button 
                  key={f}
                  onClick={() => { setFilter(f); }} 
                  className={`px-3 md:px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px] font-semibold tracking-tight transition-all uppercase ${filter === f ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] opacity-40'}`}
                >
                  {f}
                </button>
              ))}
           </div>
           <button onClick={load} className="hidden md:flex size-11 md:size-12 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-4 md:p-10 space-y-8 pb-32">
         {/* Treasury Intelligence */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
               { title: 'Pending', value: pendingCount, icon: Clock, color: 'var(--accent)', sub: 'AWAITING' },
               { title: 'Active Filter', value: displayed.length, icon: Wallet, color: '#6366f1', sub: 'FILTERED' },
               { title: 'Sent Out', value: withdrawals.filter(w => w.status === 'approved').length, icon: Zap, color: '#10b981', sub: 'EXECUTED' },
               { title: 'Flagged', value: withdrawals.filter(w => ['failed','processing_error'].includes(w.status)).length, icon: AlertCircle, color: '#fbbf24', sub: 'ALERTS' }
            ].map(s => (
               <div key={s.title} className="group relative p-5 md:p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:bg-[var(--bg-primary)]/60 transition-all duration-500 backdrop-blur-xl shadow-sm hover:shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                     <div className="size-9 rounded-xl bg-[var(--bg-secondary)] flex items-center justify-center text-[var(--text-secondary)] border border-[var(--glass-border)] group-hover:text-[var(--text-primary)] transition-colors">
                        <s.icon className="size-4 opacity-40 group-hover:opacity-100" />
                     </div>
                     <span className="text-[9px] font-bold tracking-[0.2em] text-[var(--text-secondary)] opacity-20 group-hover:opacity-40 uppercase font-mono">{s.sub}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase opacity-40 mb-1">{s.title}</p>
                    <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)] tabular-nums">{s.value}</h3>
                  </div>
               </div>
            ))}
         </div>

         {/* Search & Role Matrix */}
         <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="relative flex-1 group">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-30 group-focus-within:text-[var(--accent)] group-focus-within:opacity-100 transition-all" />
               <input 
                  value={search} 
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search identity or transaction hash..."
                  className="w-full h-14 pl-12 pr-6 bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] rounded-[1.25rem] text-sm font-bold placeholder:text-[var(--text-secondary)] placeholder:opacity-30 outline-none focus:border-[var(--accent)] focus:bg-[var(--bg-secondary)]/50 transition-all" 
               />
            </div>
            <div className="flex items-center gap-3 bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] rounded-[1.25rem] px-5 h-14 group hover:border-[var(--accent)]/30 transition-all">
               <Users className="size-4 text-[var(--text-secondary)] opacity-30" />
               <select 
                  value={roleFilter} 
                  onChange={e => setRoleFilter(e.target.value)}
                  className="bg-transparent text-[11px] font-bold tracking-[0.1em] text-[var(--text-secondary)] uppercase outline-none flex-1 min-w-[120px]"
               >
                  <option value="all">Role Matrix: ALL</option>
                  <option value="vendor">Node: VENDOR</option>
                  <option value="logistics">Node: LOGISTICS</option>
                  <option value="user">Node: CUSTOMER</option>
               </select>
            </div>
         </div>

         {/* Transaction Ledger */}
         <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
            <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
               <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                  <Wallet className="size-4 text-[var(--accent)]" /> Treasury Liquidity Flow
               </h3>
               <p className="hidden md:block text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">Ledger Verified // SSL_ENCRYPTED</p>
            </div>

            <div className="p-4 md:p-8 space-y-4">
              {loading ? (
                 <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-20">
                    <Loader2 className="animate-spin size-10" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Synchronizing Ledger...</p>
                 </div>
              ) : displayed.length === 0 ? (
                 <div className="py-40 text-center border border-dashed border-[var(--glass-border)] rounded-[2.5rem] flex flex-col items-center gap-6">
                    <Wallet className="size-16 opacity-10" />
                    <p className="text-xs font-bold tracking-[0.4em] uppercase opacity-10">No Transaction Data Found</p>
                    {filter !== 'all' && (
                       <button 
                         onClick={() => setFilter('all')}
                         className="px-6 py-3 bg-[var(--accent)] text-white rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-[var(--accent)]/20 hover:scale-105 active:scale-95 transition-all"
                       >
                         View All History
                       </button>
                    )}
                 </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                   {displayed.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map(w => {
                      const S = STATUS[w.status] || STATUS.pending;
                      const SIcon = S.icon;
                      const MIcon = getMethodIcon(w.withdrawalMethod) || Wallet;
                      return (
                         <div 
                           key={w._id} 
                           onClick={() => setSelected(w)}
                           className="group relative rounded-[2rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col md:flex-row md:items-center p-5 md:p-6 gap-6 cursor-pointer"
                         >
                            <div className={`size-12 md:size-14 rounded-2xl ${S.cls} flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500`}>
                               <SIcon className="w-6 h-6 md:w-7 h-7" />
                            </div>

                            <div className="flex-1 min-w-0">
                               <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-3">
                                     <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-tight uppercase">TX Node #{w._id.slice(-6).toUpperCase()}</span>
                                     <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-widest border uppercase ${S.cls}`}>
                                        {w.status}
                                     </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[9px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-widest">
                                     <Clock className="w-3 h-3" /> {new Date(w.createdAt).toLocaleDateString()}
                                  </div>
                               </div>
                               <div className="flex items-center gap-4">
                                  <div className="size-8 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] overflow-hidden shrink-0">
                                     {w.requestedBy?.avatar ? <img src={w.requestedBy.avatar} className="size-full object-cover" /> : <User className="size-full p-1 opacity-20" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <p className="text-[13px] font-bold text-[var(--text-primary)] truncate group-hover:text-[var(--accent)] transition-colors">{w.requestedBy?.name || 'Unknown'}</p>
                                     <div className="flex items-center gap-3 mt-1">
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-[var(--text-secondary)] opacity-40 uppercase">
                                           <MIcon className="size-3" />
                                           {w.withdrawalMethod}
                                        </div>
                                        <span className="text-[10px] opacity-10">•</span>
                                        <span className="text-[9px] font-bold text-[var(--accent)] uppercase tracking-tighter bg-[var(--accent)]/5 px-1.5 py-0.5 rounded-md">{w.role}</span>
                                     </div>
                                  </div>
                               </div>
                            </div>

                            <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-4 pt-5 md:pt-0 border-t md:border-t-0 border-[var(--glass-border)]/50">
                               <div className="text-left md:text-right">
                                  <p className="text-xl font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{fmt(w.amount)}</p>
                                  <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-20 uppercase tracking-[0.2em] mt-0.5">{w.currency}</p>
                               </div>
                               <ChevronRight className="hidden md:block size-4 opacity-20 group-hover:opacity-60 group-hover:translate-x-1 transition-all" />
                            </div>
                         </div>
                      );
                   })}
                </div>
              )}
            </div>

             <div className="p-6 md:p-8 border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/10 flex flex-col items-center gap-4">
                <Pagination 
                   currentPage={currentPage}
                   totalPages={Math.ceil(displayed.length / itemsPerPage)}
                   onPageChange={setCurrentPage}
                />
                <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-30 uppercase tracking-[0.3em]">End of Active Ledger Node</p>
             </div>
         </div>
      </div>
    </>
  );
}
