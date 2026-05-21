'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  CreditCard, Clock, User,
  Search, RefreshCw, RotateCcw,
  XCircle, Globe, Mail, Phone,
  Database, Loader2, Zap,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { fmt, STATUS_CONFIG, TYPE_CONFIG } from '@/utils/adminFinance';

const STAT_COLOR_STYLES = {
  amber: 'text-amber-500 bg-amber-500/5',
  blue: 'text-blue-500 bg-blue-500/5',
  emerald: 'text-emerald-500 bg-emerald-500/5',
  indigo: 'text-indigo-500 bg-indigo-500/5',
  rose: 'text-rose-500 bg-rose-500/5'
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [stats, setStats] = useState(null);
  const [gatewaySyncing, setGatewaySyncing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [recoveringId, setRecoveringId] = useState(null);

  const GATEWAYS = ['eversend', 'mesomb', 'wallet', 'manual', 'paystack'];

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        status: statusFilter,
        type: typeFilter,
        search,
        ...(gatewayFilter !== 'all' && { gateway: gatewayFilter })
      };
      const res = await api.get('/admin/transactions', { params });
      if (res.data?.success) {
        setTransactions(res.data.data.transactions || []);
        setTotalPages(Math.ceil((res.data.total || 0) / 50));
      }
    } catch (err) {
      toast.error('Failed to sync financial matrix');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/analytics');
      if (res.data.success) {
        // Support both response shapes
        const d = res.data.data;
        setStats(d?.stats || d?.payout_intel || d || null);
      }
    } catch (err) {
      console.error('Failed to fetch platform metrics');
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, statusFilter, typeFilter, gatewayFilter]);

  const handleSearch = (e) => {
    if (e.key === 'Enter') {
      setCurrentPage(1);
      fetchTransactions();
    }
  };

  const handleGatewaySync = async () => {
    setGatewaySyncing(true);
    try {
      const res = await api.post('/admin/transactions/sync-eversend');
      if (res.data.success) {
        toast.success(res.data.message);
        fetchTransactions();
      }
    } catch (err) {
      toast.error('Gateway reconciliation failed');
    } finally {
      setGatewaySyncing(false);
    }
  };

  const handleUpdateStatus = async (txId, newStatus) => {
    const admin_note = window.prompt(`Are you sure you want to shift this transaction to ${newStatus.toUpperCase()}? This will trigger cascading effects (wallet credit or order settlement) if marking as completed. Enter reason:`, 'Administrative Correction');
    if (admin_note === null) return;

    setUpdatingStatus(txId);
    try {
      const res = await api.patch(`/admin/transactions/manual-fix/${txId}`, { status: newStatus, admin_note });
      if (res.data.success) {
        toast.success(`Transaction shifted to ${newStatus}`);
        fetchTransactions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Recover a failed/stuck Eversend deposit that the gateway actually processed
  const handleRecoverPayment = async (tx) => {
    const confirmed = window.confirm(
      `Recover payment for ${tx.reference}?\n\nThis will:\n• Re-check with Eversend gateway\n• Credit ${tx.amount?.toLocaleString()} XAF to the user's wallet if confirmed\n• Notify the user\n\nOnly proceed if you have confirmed the gateway received funds.`
    );
    if (!confirmed) return;

    setRecoveringId(tx._id);
    try {
      const res = await api.post(`/payments/eversend/recover/${tx.reference}`);
      if (res.data.success) {
        toast.success(`✅ ${res.data.message}`);
        fetchTransactions();
      } else {
        // Gateway check didn't confirm — offer force option
        const forceIt = window.confirm(
          `Gateway check returned: "${res.data.message}"\n\nDo you want to FORCE recover this payment?\n\nOnly do this if you have a confirmed receipt from the Eversend dashboard showing funds were received.`
        );
        if (forceIt) {
          const forceRes = await api.post(`/payments/eversend/recover/${tx.reference}`, { force: true });
          if (forceRes.data.success) {
            toast.success(`✅ Force recovered: ${forceRes.data.message}`);
            fetchTransactions();
          } else {
            toast.error(forceRes.data.message || 'Force recovery failed.');
          }
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Recovery request failed.';
      // 400 means gateway check ran but returned non-success — offer force
      if (err.response?.status === 400) {
        const forceIt = window.confirm(
          `${msg}\n\nForce recover anyway?\n(Only if you have confirmed gateway receipt)`
        );
        if (forceIt) {
          try {
            const forceRes = await api.post(`/payments/eversend/recover/${tx.reference}`, { force: true });
            if (forceRes.data.success) {
              toast.success(`✅ Force recovered: ${forceRes.data.message}`);
              fetchTransactions();
            } else {
              toast.error(forceRes.data.message || 'Force recovery failed.');
            }
          } catch (forceErr) {
            toast.error(forceErr.response?.data?.message || 'Force recovery failed.');
          }
        }
      } else {
        toast.error(msg);
      }
    } finally {
      setRecoveringId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Surgical Header */}
      <header className="h-24 flex items-center justify-between px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-16 z-40">
        <div className="flex items-center gap-6">
          <div className="size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20">
             <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl  font-bold text-[var(--text-primary)] tracking-tight ">Global <span className="text-[var(--accent)]">Transaction</span> Ledger</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-tight opacity-50 capitalize">Live Financial Feed // Node_Aura_Vault</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                type="text"
                placeholder="Reference, Gateway ID..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearch}
              />
           </div>
           
           <select 
             className="h-11 px-4 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] outline-none cursor-pointer"
             value={typeFilter}
             onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
           >
              <option value="all">ALL TYPES</option>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
           </select>

           <select 
             className="h-11 px-4 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] outline-none cursor-pointer"
             value={gatewayFilter}
             onChange={e => { setGatewayFilter(e.target.value); setCurrentPage(1); }}
           >
              <option value="all">ALL GATEWAYS</option>
              {GATEWAYS.map(g => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
           </select>

           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1">
              {['all', 'completed', 'pending', 'failed'].map(s => (
                <button 
                  key={s}
                  onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                  className={`px-4 py-1.5 rounded-xl text-[10px] lg:text-[12px]  font-semibold tracking-tight transition-all capitalize ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {s}
                </button>
              ))}
           </div>
           
           <button 
             onClick={handleGatewaySync} 
             disabled={gatewaySyncing}
             className="h-11 px-6 bg-[var(--accent)] text-white rounded-2xl text-[10px] lg:text-[12px]  font-semibold tracking-[0.1em] capitalize shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
           >
              {gatewaySyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              Sync Gateway
           </button>

           <button onClick={fetchTransactions} className="size-11 rounded-2xl border border-[var(--glass-border)] hover:bg-[var(--accent)]/10 text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm active:scale-95">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </header>

      <div className="p-10 space-y-8 pb-40">
         {/* Live Stats */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
            {[
               { title: 'LOCKED', desc: 'Custody Total', count: stats ? `${fmt(stats.escrow_held)} XAF` : '...', icon: Database, color: 'blue' },
               { title: 'RELEASED', desc: 'Settled Capital', count: stats ? `${fmt(stats.escrow_released)} XAF` : '...', icon: CheckCircle2, color: 'emerald' },
               { title: 'DISPUTE', desc: 'Contested', count: stats ? `${fmt(stats.escrow_disputed)} XAF` : '...', icon: AlertCircle, color: 'rose' },
               { title: 'TRUST', desc: 'System Health', count: 'High', icon: Zap, color: 'amber' },
               { title: 'REVENUE', desc: 'Gross Platform', count: stats ? `${fmt(stats.revenue)} XAF` : '...', icon: Globe, color: 'indigo' },
            ].map((item, i) => (
               <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all group backdrop-blur-xl">
                  <div className={`size-10 rounded-xl flex items-center justify-center border border-transparent group-hover:border-current transition-all ${STAT_COLOR_STYLES[item.color] || STAT_COLOR_STYLES.blue}`}>
                     <item.icon className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-[11px] lg:text-[12px] font-semibold truncate uppercase tracking-tight">{item.title}</p>
                     <p className="text-[10px] lg:text-[11px] font-semibold text-[var(--text-secondary)] opacity-40">{item.desc}</p>
                  </div>
                  <div className="text-right">
                     <p className="text-xs font-bold font-mono whitespace-nowrap">{item.count}</p>
                  </div>
               </div>
            ))}
         </div>

         {/* Transaction Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 capitalize">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Platform Transaction Ledger
               </h3>
               <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">Displaying latest 50 entries per page</p>
            </div>

             <div className="space-y-4">
               {loading ? (
                  <LoadingSpinner />
               ) : transactions.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 p-6 lg:p-10">
                    {transactions.map(tx => {
                      const status = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
                      const type = TYPE_CONFIG[tx.type] || TYPE_CONFIG.payment;
                      const isExpanded = expandedId === tx._id;

                      // Extract unique vendor logos
                      const vendorLogos = new Set();
                      if (tx.order_id?.vendor_id?.branding?.logo) vendorLogos.add(tx.order_id.vendor_id.branding.logo);
                      tx.order_ids?.forEach(o => {
                        if (o.vendor_id?.branding?.logo) vendorLogos.add(o.vendor_id.branding.logo);
                      });
                      const logos = Array.from(vendorLogos);

                      return (
                        <div 
                          key={tx._id} 
                          className={`group relative rounded-[2.5rem] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] shadow-sm hover:shadow-2xl transition-all duration-500 overflow-hidden hover:-translate-y-1 backdrop-blur-xl flex flex-col ${isExpanded ? 'ring-2 ring-[var(--accent)]/20 shadow-2xl' : ''}`}
                        >
                          <div 
                            className="p-6 lg:p-8 flex items-center gap-6 md:gap-8 cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : tx._id)}
                          >
                              <div className={`size-12 md:size-14 rounded-[1.5rem] ${status.bg} ${status.color} flex items-center justify-center shrink-0 border ${status.color.replace('text-', 'border-')}/10 shadow-inner`}>
                                 <type.icon className="w-6 h-6 md:w-7 md:h-7" />
                              </div>

                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                       <span className="text-[11px] lg:text-[12px] md:text-[13px]  font-semibold text-[var(--text-primary)] tracking-tight capitalize">{tx.type.replace('_', ' ')}</span>
                                       <span className={`px-3 py-1 rounded-full text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold tracking-widest border ${status.bg} ${status.color} ${status.color.replace('text-', 'border-')}/20 capitalize`}>
                                          {status.label}
                                       </span>
                                       <span className="px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold tracking-widest text-[var(--text-secondary)] capitalize">
                                          {tx.gateway || 'Internal'}
                                       </span>
                                    </div>
                                    <time className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-30 tracking-widest flex items-center gap-2 capitalize">
                                       <Clock className="w-3 h-3" /> {new Date(tx.createdAt).toLocaleDateString()}
                                    </time>
                                 </div>
                                 <div className="flex items-center gap-4">
                                     <div className="flex items-center gap-2 text-[10px] lg:text-[12px] md:text-[11px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-60 truncate">
                                        <span className="font-mono text-[var(--accent)]  font-bold">#{tx.reference.slice(-8).toUpperCase()}</span>
                                        <span>•</span>
                                        <span className="text-[var(--text-primary)] font-bold">{tx.user_id?.phone || 'No Phone'}</span>
                                        <span>•</span>
                                        <span className="truncate max-w-[150px] md:max-w-sm">{tx.description}</span>
                                     </div>
                                 </div>
                              </div>

                              <div className="text-right shrink-0">
                                 <p className="text-xl md:text-2xl  font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{fmt(tx.amount)} <span className="text-[10px] lg:text-[12px] md:text-[12px] opacity-30 ml-1">{tx.currency || 'XAF'}</span></p>
                                 <div className="flex items-center justify-end gap-3 mt-2">
                                    {logos.length > 0 && (
                                       <div className="flex -space-x-2 mr-2">
                                          {logos.map((logo, idx) => (
                                             <div key={idx} className="size-6 rounded-lg overflow-hidden bg-white border border-[var(--glass-border)] shadow-sm">
                                                <img src={logo} className="size-full object-contain" />
                                             </div>
                                          ))}
                                       </div>
                                    )}
                                    <span className="text-[10px] lg:text-[12px] md:text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] opacity-40 capitalize tracking-widest">{tx.user_id?.name?.split(' ')[0] || 'Node'}</span>
                                    <div className="size-6 rounded-lg overflow-hidden bg-[var(--bg-secondary)] border border-[var(--glass-border)] shadow-sm">
                                       {tx.user_id?.avatar ? <img src={tx.user_id.avatar} className="size-full object-cover" /> : <User className="size-full p-1 opacity-20" />}
                                    </div>
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
                                           <Database className="w-3 h-3" /> Internal Metadata
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                           <div>
                                              <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-1">Entity Reference</p>
                                              <p className="text-[11px] lg:text-[12px]  font-semibold font-mono text-[var(--accent)]">{tx.reference}</p>
                                           </div>
                                           <div>
                                              <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-1">Gateway ID</p>
                                              <p className="text-[11px] lg:text-[12px]  font-semibold font-mono text-[var(--text-primary)]">{tx.gateway_transaction_id || '—'}</p>
                                           </div>
                                           {tx.order_ids?.length > 0 && (
                                              <div className="col-span-2">
                                                 <p className="text-[10px] lg:text-[12px]  font-semibold opacity-30 capitalize tracking-widest mb-2">Linked Orders</p>
                                                 <div className="flex flex-wrap gap-2">
                                                    {tx.order_ids.map(oid => (
                                                       <span key={oid} className="px-3 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] lg:text-[12px]  font-semibold font-mono text-[var(--accent)]">
                                                          #{oid.slice(-8).toUpperCase()}
                                                       </span>
                                                    ))}
                                                 </div>
                                              </div>
                                           )}
                                        </div>
                                     </div>
                                  </div>

                                  <div className="flex-1 space-y-4">
                                     <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-6 rounded-3xl relative overflow-hidden group/payload">
                                        <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-4 opacity-50 capitalize">User Identity</p>
                                        <div className="space-y-3">
                                           <div className="flex items-center gap-3">
                                              <div className="size-8 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)]">
                                                 <Mail className="size-3.5" />
                                              </div>
                                              <div>
                                                 <p className="text-[10px] lg:text-[11px] font-semibold opacity-30 capitalize tracking-widest">Email Address</p>
                                                 <p className="text-[11px] lg:text-[12px] font-semibold text-[var(--text-primary)]">{tx.user_id?.email || 'No email attached'}</p>
                                              </div>
                                           </div>
                                           <div className="flex items-center gap-3">
                                              <div className="size-8 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-secondary)]">
                                                 <Phone className="size-3.5" />
                                              </div>
                                              <div>
                                                 <p className="text-[10px] lg:text-[11px] font-semibold opacity-30 capitalize tracking-widest">Phone Number</p>
                                                 <p className="text-[11px] lg:text-[12px] font-semibold text-[var(--text-primary)]">{tx.user_id?.phone || 'No phone recorded'}</p>
                                              </div>
                                           </div>
                                        </div>
                                     </div>

                                     <div className="bg-[var(--bg-secondary)]/30 border border-[var(--glass-border)] p-6 rounded-3xl">
                                        <p className="text-[10px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.2em] mb-4 opacity-50 capitalize">Manual Status Correction</p>
                                        <div className="flex flex-wrap gap-2">
                                           {['completed', 'pending', 'failed'].map(s => (
                                              <button 
                                                key={s}
                                                onClick={() => handleUpdateStatus(tx._id, s)}
                                                disabled={updatingStatus === tx._id || tx.status === s}
                                                className={`flex-1 h-10 px-4 rounded-xl text-[10px] lg:text-[12px]  font-semibold tracking-tight transition-all capitalize border ${tx.status === s ? 'bg-[var(--bg-secondary)] border-[var(--glass-border)] opacity-30 text-[var(--text-secondary)] cursor-not-allowed' : 'bg-[var(--bg-primary)] border-[var(--glass-border)] hover:border-[var(--accent)] text-[var(--text-primary)] active:scale-95'}`}
                                              >
                                                 {updatingStatus === tx._id ? <Loader2 className="w-3 h-3 animate-spin" /> : `Mark ${s}`}
                                              </button>
                                           ))}
                                        </div>
                                        <p className="text-[9px] lg:text-[10px]  font-semibold text-[var(--text-secondary)] mt-3 opacity-30 leading-relaxed italic">* Marking as COMPLETED will automatically credit user wallets or settle linked orders.</p>
                                     </div>

                                      {/* ── Gateway Payment Recovery (Eversend only) ──────── */}
                                      {tx.gateway === 'eversend' && ['failed', 'pending'].includes(tx.status) && tx.type === 'deposit' && (
                                        <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-3xl">
                                          <div className="flex items-start gap-3 mb-4">
                                            <div className="size-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                                              <RotateCcw className="size-4" />
                                            </div>
                                            <div>
                                              <p className="text-[11px] lg:text-[12px] font-semibold text-amber-400 tracking-tight">Gateway Payment Recovery</p>
                                              <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-60 mt-0.5 leading-relaxed">
                                                Use when Eversend confirmed receipt but our system marked this as <span className="text-amber-400 capitalize">{tx.status}</span>. Re-verifies live and credits wallet on success.
                                              </p>
                                            </div>
                                          </div>
                                          <div className="bg-[var(--bg-secondary)]/60 border border-[var(--glass-border)] rounded-xl p-2.5 mb-4 font-mono text-[9px] text-[var(--text-secondary)] opacity-50 break-all">
                                            {tx.reference}
                                          </div>
                                          <button
                                            onClick={() => handleRecoverPayment(tx)}
                                            disabled={recoveringId === tx._id}
                                            className="w-full h-12 bg-amber-500 text-white rounded-2xl font-semibold text-[11px] lg:text-[12px] tracking-tight flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all disabled:opacity-50"
                                          >
                                            {recoveringId === tx._id
                                              ? <><Loader2 className="size-4 animate-spin" /> Verifying with gateway...</>
                                              : <><RotateCcw className="size-4" /> Recover {tx.amount?.toLocaleString()} XAF</>
                                            }
                                          </button>
                                        </div>
                                      )}

                                     {tx.status === 'completed' && tx.order_ids?.length > 0 && (
                                        <button 
                                          onClick={() => handleFulfillOrders(tx._id)}
                                          disabled={syncing === tx._id}
                                          className="w-full h-14 bg-emerald-500 text-white rounded-2xl  font-semibold text-[10px] lg:text-[12px] tracking-[0.2em] capitalize shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                           {syncing === tx._id ? (
                                              <Loader2 className="w-4 h-4 animate-spin" />
                                           ) : (
                                              <Zap className="w-4 h-4" />
                                           )}
                                           Synchronize & Fulfill Associated Orders
                                        </button>
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
                     <CreditCard className="w-16 h-16 mb-8 text-[var(--text-secondary)]" />
                     <p className="text-sm  font-bold tracking-[0.2em] capitalize leading-relaxed max-w-sm">No financial nodes detected in this vector.</p>
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
