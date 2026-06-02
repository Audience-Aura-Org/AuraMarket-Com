"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Unlock, History, 
  DollarSign, ArrowUpRight, ArrowDownLeft, RefreshCw,
  Search, Filter, Database, Loader2, Zap, CreditCard,
  AlertCircle, Clock, XCircle, CheckCircle2,
  Globe, Percent, Save, Settings2
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import Pagination from '@/components/common/Pagination';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const STAT_COLOR_STYLES = {
  amber: 'text-amber-500 bg-amber-500/5',
  blue: 'text-blue-500 bg-blue-500/5',
  emerald: 'text-emerald-500 bg-emerald-500/5',
  indigo: 'text-indigo-500 bg-indigo-500/5',
  rose: 'text-rose-500 bg-rose-500/5'
};

const DEFAULT_SETTINGS = {
  commission_type: 'percentage',
  commission_value: 0,
  escrow_fee_type: 'percentage',
  escrow_fee_value: 0
};

const ESCROW_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'held', label: 'Held' },
  { id: 'pending_release', label: 'Pending' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'released', label: 'Released' },
  { id: 'refunded', label: 'Refunded' }
];

export default function AdminEscrow() {
  const [mounted, setMounted] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const itemsPerPage = 10;

  useEffect(() => {
    setMounted(true);
    fetchEscrow();
  }, []);

  const fetchEscrow = async () => {
    setLoading(true);
    try {
      const [escrowRes, analyticsRes, settingsRes] = await Promise.all([
        api.get('/admin/escrow/logs'),
        api.get('/admin/analytics'),
        api.get('/admin/settings')
      ]);

      if (escrowRes.data?.success) {
        setLogs(escrowRes.data.data.logs || []);
        setStats(escrowRes.data.data.stats || []);
      }
      if (analyticsRes.data?.success) {
        setAnalytics(analyticsRes.data.data.stats || null);
      }
      if (settingsRes.data?.success) {
        const nextSettings = settingsRes.data.data.settings || {};
        setSettings({
          ...DEFAULT_SETTINGS,
          commission_type: nextSettings.commission_type || 'percentage',
          commission_value: nextSettings.commission_value ?? nextSettings.commission_rate ?? 0,
          escrow_fee_type: nextSettings.escrow_fee_type || 'percentage',
          escrow_fee_value: nextSettings.escrow_fee_value ?? 0
        });
      }
    } catch (err) {
      console.error('Failed to sync vault data:', err);
      toast.error('Failed to sync with secure vault');
    } finally {
      setLoading(false);
    }
  };

  const formatFee = (type, value) => {
    const amount = Number(value || 0);
    return type === 'amount' ? `${amount.toLocaleString()} XAF` : `${amount}%`;
  };

  const handleSettingsChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const payload = {
        commission_type: settings.commission_type,
        commission_value: Number(settings.commission_value || 0),
        escrow_fee_type: settings.escrow_fee_type,
        escrow_fee_value: Number(settings.escrow_fee_value || 0)
      };
      const res = await api.patch('/admin/settings', payload);
      if (res.data?.success) {
        toast.success('Commission settings updated');
        const updated = res.data.data.settings || {};
        setSettings({
          ...DEFAULT_SETTINGS,
          commission_type: updated.commission_type || payload.commission_type,
          commission_value: updated.commission_value ?? updated.commission_rate ?? payload.commission_value,
          escrow_fee_type: updated.escrow_fee_type || payload.escrow_fee_type,
          escrow_fee_value: updated.escrow_fee_value ?? payload.escrow_fee_value
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update commission settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const statusCounts = ESCROW_FILTERS.reduce((acc, filter) => {
    acc[filter.id] = filter.id === 'all'
      ? logs.length
      : logs.filter(l => l.status === filter.id).length;
    return acc;
  }, {});

  const filteredLogs = logs.filter(l => {
    const query = searchQuery.toLowerCase();
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter;
    const matchesSearch = !query || (
       l.order_id?._id?.toLowerCase().includes(query) ||
       l.buyer_id?.name?.toLowerCase().includes(query) ||
       l.buyer_id?.email?.toLowerCase().includes(query) ||
       l.vendor_id?.store_name?.toLowerCase().includes(query) ||
       l.vendor_id?.user_id?.name?.toLowerCase().includes(query) ||
       l._id?.toLowerCase().includes(query)
    );

    return matchesStatus && matchesSearch;
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
         <div className="rounded-[1.5rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/25 p-3 md:p-4 backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[var(--text-secondary)] opacity-60">
               <Filter className="size-3.5" />
               Vault Filter
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
               {ESCROW_FILTERS.map(filter => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => { setStatusFilter(filter.id); setCurrentPage(1); }}
                    className={`flex min-w-max items-center gap-2 rounded-2xl border px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] transition-all ${
                      statusFilter === filter.id
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent)]/20'
                        : 'border-[var(--glass-border)] bg-[var(--bg-primary)]/45 text-[var(--text-secondary)] hover:border-[var(--accent)]/30 hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>{filter.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] ${
                      statusFilter === filter.id
                        ? 'bg-white/20 text-white'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                    }`}>
                      {statusCounts[filter.id] || 0}
                    </span>
                  </button>
               ))}
            </div>
         </div>

         {/* Live Intelligence Stats */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {[
               { title: 'LOCKED', desc: 'Custody Total', count: `${heldTotal.toLocaleString()} XAF`, icon: Database, color: 'blue' },
               { title: 'RELEASED', desc: 'Settled Capital', count: `${releasedTotal.toLocaleString()} XAF`, icon: CheckCircle2, color: 'emerald' },
               { title: 'DISPUTE', desc: 'Contested', count: `${disputedTotal.toLocaleString()} XAF`, icon: AlertCircle, color: 'rose' },
               { title: 'REVENUE', desc: 'Gross Platform', count: analytics ? `${analytics.revenue.toLocaleString()} XAF` : '...', icon: Globe, color: 'indigo' },
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

         <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5 md:gap-6">
            <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-5 md:p-6 backdrop-blur-xl">
               <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                     <div className="size-11 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20">
                        <Settings2 className="size-5" />
                     </div>
                     <div>
                        <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Commission Controls</h3>
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.2em]">Admin fee policy</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-2">
                     <span className="px-3 py-1.5 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] text-[10px] font-bold text-[var(--text-secondary)]">
                        Admin {formatFee(settings.commission_type, settings.commission_value)}
                     </span>
                     <span className="px-3 py-1.5 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--glass-border)] text-[10px] font-bold text-[var(--text-secondary)]">
                        Escrow {formatFee(settings.escrow_fee_type, settings.escrow_fee_value)}
                     </span>
                  </div>
               </div>

               <div className="grid md:grid-cols-2 gap-4">
                  {[
                    {
                      title: 'Admin Commission',
                      desc: 'Deducted from vendor payout on every completed sale.',
                      typeField: 'commission_type',
                      valueField: 'commission_value',
                      icon: Percent
                    },
                    {
                      title: 'Escrow Commission',
                      desc: 'Additional fee applied only when escrow protection is used.',
                      typeField: 'escrow_fee_type',
                      valueField: 'escrow_fee_value',
                      icon: Lock
                    }
                  ].map(item => (
                    <div key={item.valueField} className="rounded-2xl bg-[var(--bg-primary)]/45 border border-[var(--glass-border)] p-4 space-y-4">
                       <div className="flex items-start gap-3">
                          <div className="size-9 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center">
                             <item.icon className="size-4" />
                          </div>
                          <div>
                             <p className="text-xs font-bold text-[var(--text-primary)]">{item.title}</p>
                             <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 leading-relaxed">{item.desc}</p>
                          </div>
                       </div>
                       <div className="grid grid-cols-[1fr_120px] gap-3">
                          <select
                            value={settings[item.typeField]}
                            onChange={e => handleSettingsChange(item.typeField, e.target.value)}
                            className="h-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50"
                          >
                             <option value="percentage">Percentage</option>
                             <option value="amount">Fixed XAF</option>
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={settings[item.valueField]}
                            onChange={e => handleSettingsChange(item.valueField, e.target.value)}
                            className="h-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50"
                          />
                       </div>
                    </div>
                  ))}
               </div>

               <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 leading-relaxed max-w-2xl">
                    Fees are calculated against the vendor base amount. When a logistics partner handles delivery, shipping is excluded from the vendor base and paid to logistics after delivery.
                  </p>
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="h-12 px-5 rounded-2xl bg-[var(--accent)] text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 active:scale-95 transition-all"
                  >
                    {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save Fees
                  </button>
               </div>
            </div>

            <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-5 md:p-6 backdrop-blur-xl">
               <div className="flex items-center gap-3 mb-6">
                  <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20">
                     <ShieldCheck className="size-5" />
                  </div>
                  <div>
                     <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">How Escrow Works</h3>
                     <p className="text-[10px] font-bold text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.2em]">Settlement lifecycle</p>
                  </div>
               </div>
               <div className="space-y-3">
                  {[
                    ['1', 'Buyer pays', 'The full order total is collected and the vendor base amount is locked in escrow.'],
                    ['2', 'Vendor fulfills', 'The vendor ships the order, or logistics confirms delivery for logistics-managed orders.'],
                    ['3', 'Buyer confirms', 'The buyer releases escrow after delivery, or an admin can override from this vault.'],
                    ['4', 'Fees settle', 'Admin commission plus escrow commission are deducted, then the vendor payout is credited.'],
                    ['5', 'Disputes pause release', 'A denied release opens a dispute so admins can refund or force release after review.']
                  ].map(([step, title, desc]) => (
                    <div key={step} className="flex gap-3 p-3 rounded-2xl bg-[var(--bg-primary)]/35 border border-[var(--glass-border)]">
                       <div className="size-7 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center text-[10px] font-bold shrink-0">
                         {step}
                       </div>
                       <div>
                         <p className="text-[11px] font-bold text-[var(--text-primary)]">{title}</p>
                         <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 leading-relaxed">{desc}</p>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
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
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Synchronizing Items...</p>
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
                                          {l.buyer_id?.name || 'Customer Node'} {'->'} {l.vendor_id?.store_name || 'Vendor Hub'}
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
