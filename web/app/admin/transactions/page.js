'use client';

import { useState, useEffect } from 'react';
import api from '@/services/api';
import { 
  CreditCard, Clock, User, Filter, 
  Search, RefreshCw, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, XCircle, 
  ArrowUpRight, ShoppingBag, Globe, 
  Database, Loader2, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function fmt(n) { return Number(n || 0).toLocaleString('fr-CM'); }

const STATUS_CONFIG = {
  completed: { label: 'Completed', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  success:   { label: 'Success',   color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CheckCircle2 },
  pending:   { label: 'Pending',   color: 'text-amber-500',   bg: 'bg-amber-500/10',   icon: Clock },
  failed:    { label: 'Failed',    color: 'text-rose-500',    bg: 'bg-rose-500/10',    icon: XCircle },
  rejected:  { label: 'Rejected',  color: 'text-rose-600',    bg: 'bg-rose-600/10',    icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-gray-500',    bg: 'bg-gray-500/10',    icon: XCircle },
};

const TYPE_CONFIG = {
  deposit:        { label: 'Deposit',      icon: Zap,            color: 'text-blue-500' },
  payment:        { label: 'Order Pay',    icon: ShoppingBag,    color: 'text-purple-500' },
  withdrawal:     { label: 'Withdrawal',   icon: ArrowUpRight,   color: 'text-orange-500' },
  refund:         { label: 'Refund',       icon: RefreshCw,      color: 'text-rose-500' },
  escrow_release: { label: 'Escrow Rel',   icon: Globe,          color: 'text-emerald-500' },
  payout:         { label: 'Vendor Payout',icon: CreditCard,     color: 'text-indigo-500' },
};

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [stats, setStats] = useState(null);
  const [gatewaySyncing, setGatewaySyncing] = useState(false);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        status: statusFilter,
        type: typeFilter,
        search
      };
      const res = await api.get('/admin/transactions', { params });
      if (res.data?.success) {
        setTransactions(res.data.data.transactions || []);
        setTotalPages(Math.ceil(res.data.total / 50));
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
        setStats(res.data.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch platform metrics');
    }
  };

  useEffect(() => {
    // Only trigger gateway sync on initial mount to avoid overhead during filtering
    handleGatewaySync();
    fetchStats();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, statusFilter, typeFilter]);

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

  const handleFulfillOrders = async (txId) => {
    setSyncing(txId);
    try {
      const res = await api.post(`/admin/transactions/${txId}/fulfill`);
      if (res.data.success) {
        toast.success('Orders re-synchronized successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(null);
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
            <h2 className="text-xl font-bold text-[var(--text-primary)] tracking-tight ">Global <span className="text-[var(--accent)]">Transaction</span> Ledger</h2>
            <div className="flex items-center gap-2 mt-1">
               <div className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
               <p className="text-[11px] font-bold text-[var(--text-secondary)] tracking-tight opacity-50 uppercase">Live Financial Feed // Node_Aura_Vault</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="relative w-64 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-[var(--text-secondary)] opacity-20 group-focus-within:opacity-100 group-focus-within:text-[var(--accent)] transition-all" />
              <input 
                type="text"
                placeholder="Reference, Gateway ID..."
                className="w-full h-11 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] font-bold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearch}
              />
           </div>
           
           <select 
             className="h-11 px-4 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl text-[11px] font-bold tracking-tight text-[var(--text-secondary)] outline-none cursor-pointer"
             value={typeFilter}
             onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }}
           >
              <option value="all">ALL TYPES</option>
              {Object.keys(TYPE_CONFIG).map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
           </select>

           <div className="flex bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl p-1">
              {['all', 'completed', 'pending', 'failed'].map(s => (
                <button 
                  key={s}
                  onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
                  className={`px-4 py-1.5 rounded-xl text-[10px] font-bold tracking-tight transition-all uppercase ${statusFilter === s ? 'bg-[var(--accent)] text-white shadow-lg' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                >
                  {s}
                </button>
              ))}
           </div>
           
           <button 
             onClick={handleGatewaySync} 
             disabled={gatewaySyncing}
             className="h-11 px-6 bg-[var(--accent)] text-white rounded-2xl text-[10px] font-bold tracking-[0.1em] uppercase shadow-lg shadow-[var(--accent)]/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
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
         <div className="grid grid-cols-4 gap-6">
            {[
               { label: 'Platform Volume', value: stats ? `${fmt(stats.revenue)} XAF` : '...', icon: Database, color: 'var(--accent)', sub: 'VECTOR_ALPHA' },
               { label: 'Failed Attempts', value: stats ? stats.failed_transactions : '...', icon: XCircle, color: '#f43f5e', sub: 'RISK_LOG' },
               { label: 'Escrow Flow', value: stats ? `${fmt(stats.escrow_vault)} XAF` : '...', icon: Globe, color: '#6366f1', sub: 'SECURED_NODES' },
               { label: 'System Uptime', value: '99.98%', icon: Zap, color: '#10b981', sub: 'CORE_STABLE' }
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
                        <div className="flex items-end gap-2">
                           <h3 className="text-2xl font-bold text-[var(--text-primary)] tracking-tighter leading-none">{s.value}</h3>
                           {s.label === 'System Uptime' && <div className="size-2 rounded-full bg-emerald-500 animate-pulse mb-1" />}
                        </div>
                     </div>
                  </div>
               </div>
            ))}
         </div>

         {/* Transaction Ledger */}
         <div className="glass-panel rounded-[3rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 flex items-center justify-between">
               <h3 className="text-[11px] font-bold text-[var(--text-primary)] tracking-[0.1em] flex items-center gap-3 uppercase">
                  <Database className="w-4 h-4 text-[var(--accent)]" /> 
                  Platform Transaction Ledger
               </h3>
               <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">Displaying latest 50 entries per page</p>
            </div>

             <div className="space-y-4">
               {loading ? (
                  <LoadingSpinner text="Synchronizing Ledger" />
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
                                       <span className="text-[11px] md:text-[13px] font-bold text-[var(--text-primary)] tracking-tight uppercase">{tx.type.replace('_', ' ')}</span>
                                       <span className={`px-3 py-1 rounded-full text-[8px] md:text-[9px] font-bold tracking-widest border ${status.bg} ${status.color} ${status.color.replace('text-', 'border-')}/20 uppercase`}>
                                          {status.label}
                                       </span>
                                       <span className="px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[8px] md:text-[9px] font-bold tracking-widest text-[var(--text-secondary)] uppercase">
                                          {tx.gateway || 'Internal'}
                                       </span>
                                    </div>
                                    <time className="text-[9px] md:text-[10px] font-bold text-[var(--text-secondary)] opacity-30 tracking-widest flex items-center gap-2 uppercase">
                                       <Clock className="w-3 h-3" /> {new Date(tx.createdAt).toLocaleDateString()}
                                    </time>
                                 </div>
                                 <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-[10px] md:text-[11px] font-medium text-[var(--text-secondary)] opacity-60 truncate">
                                       <span className="font-mono text-[var(--accent)] font-bold">#{tx.reference.slice(-8).toUpperCase()}</span>
                                       <span>•</span>
                                       <span className="truncate max-w-[200px] md:max-w-md">{tx.description}</span>
                                    </div>
                                 </div>
                              </div>

                              <div className="text-right shrink-0">
                                 <p className="text-xl md:text-2xl font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{fmt(tx.amount)} <span className="text-[10px] md:text-[12px] opacity-30 ml-1">{tx.currency || 'XAF'}</span></p>
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
                                    <span className="text-[9px] md:text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">{tx.user_id?.name?.split(' ')[0] || 'Node'}</span>
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
                                        <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-[0.2em] mb-4 opacity-50 uppercase flex items-center gap-2">
                                           <Database className="w-3 h-3" /> Internal Metadata
                                        </p>
                                        <div className="grid grid-cols-2 gap-4">
                                           <div>
                                              <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest mb-1">Entity Reference</p>
                                              <p className="text-[11px] font-bold font-mono text-[var(--accent)]">{tx.reference}</p>
                                           </div>
                                           <div>
                                              <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest mb-1">Gateway ID</p>
                                              <p className="text-[11px] font-bold font-mono text-[var(--text-primary)]">{tx.gateway_transaction_id || '—'}</p>
                                           </div>
                                           {tx.order_ids?.length > 0 && (
                                              <div className="col-span-2">
                                                 <p className="text-[9px] font-bold opacity-30 uppercase tracking-widest mb-2">Linked Orders</p>
                                                 <div className="flex flex-wrap gap-2">
                                                    {tx.order_ids.map(oid => (
                                                       <span key={oid} className="px-3 py-1 rounded-lg bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[10px] font-bold font-mono text-[var(--accent)]">
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
                                        <p className="text-[10px] font-bold text-[var(--text-secondary)] tracking-[0.2em] mb-4 opacity-50 uppercase">Gateway Payload</p>
                                        <div className="font-mono text-[10px] text-[var(--text-primary)]/80 leading-relaxed max-h-32 overflow-y-auto no-scrollbar scroll-smooth">
                                           <pre>{JSON.stringify(tx.gateway_response || {}, null, 2)}</pre>
                                        </div>
                                        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[var(--bg-secondary)] to-transparent pointer-events-none group-hover/payload:opacity-0 transition-opacity" />
                                     </div>

                                     {tx.status === 'completed' && tx.order_ids?.length > 0 && (
                                        <button 
                                          onClick={() => handleFulfillOrders(tx._id)}
                                          disabled={syncing === tx._id}
                                          className="w-full h-14 bg-emerald-500 text-white rounded-2xl font-bold text-[10px] tracking-[0.2em] uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
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
                     <p className="text-sm font-bold tracking-[0.2em] uppercase leading-relaxed max-w-sm">No financial nodes detected in this vector.</p>
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
