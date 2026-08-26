"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck, Lock, Unlock, History,
  ArrowUpRight, ArrowDownLeft, RefreshCw,
  Search, Filter, Database, Loader2, Zap, CreditCard,
  AlertCircle, Clock, XCircle, CheckCircle2,
  Globe, Percent, Save, Settings2, Bot, User2, Shield
} from 'lucide-react';
import api from '@/services/api';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import Pagination from '@/components/common/Pagination';
import StatCard from '@/components/layout/StatCard';

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

const STATUS_ICON = {
  held: Lock,
  pending_release: Clock,
  disputed: AlertCircle,
  released: Unlock,
  refunded: XCircle,
};

const STATUS_COLOR = {
  held: 'text-amber-500',
  pending_release: 'text-blue-500',
  disputed: 'text-rose-600',
  released: 'text-emerald-500',
  refunded: 'text-rose-500',
};

function AutoReleaseCountdown({ autoReleaseAt }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!autoReleaseAt) return;
    const tick = () => {
      const diff = new Date(autoReleaseAt) - Date.now();
      if (diff <= 0) { setRemaining('Releasing soon…'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [autoReleaseAt]);

  if (!autoReleaseAt) return null;
  return (
    <div className="col-span-2 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15">
      <p className="text-[10px] font-bold text-amber-500 opacity-80 mb-1">Auto-Release In</p>
      <div className="flex items-center gap-2">
        <Bot className="size-3.5 text-amber-500" />
        <p className="text-[12px] font-bold text-amber-500 tabular-nums">{remaining}</p>
      </div>
      <p className="text-[9px] text-[var(--text-secondary)] opacity-40 mt-1">
        {new Date(autoReleaseAt).toLocaleString()}
      </p>
    </div>
  );
}

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
        api.get('/admin/settings', { skipClientCache: true, params: { t: Date.now() } })
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

  // Live fee preview for a 10,000 XAF base amount
  const feePreview = useMemo(() => {
    const base = 10000;
    const commissionVal = Number(settings.commission_value || 0);
    const escrowVal = Number(settings.escrow_fee_value || 0);
    const commFee = settings.commission_type === 'amount' ? Math.min(commissionVal, base) : (base * commissionVal) / 100;
    const esFee = settings.escrow_fee_type === 'amount' ? Math.min(escrowVal, base) : (base * escrowVal) / 100;
    const total = Math.min(commFee + esFee, base);
    return { base, commFee, esFee, total, payout: base - total };
  }, [settings]);

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
       l._id?.toLowerCase().includes(query)
    );
    return matchesStatus && matchesSearch;
  });

  const handleRelease = async (orderId) => {
    if (!orderId) { toast.error('Invalid order reference'); return; }
    if (!window.confirm('Are you sure you want to FORCE RELEASE funds to the vendor? This action is irreversible.')) return;
    setLoadingAction(orderId);
    try {
      const res = await api.post(`/escrow/release/${orderId}`);
      if (res.data?.success) { toast.success('Funds released successfully'); fetchEscrow(); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to release funds');
    } finally { setLoadingAction(null); }
  };

  const handleRefund = async (orderId) => {
    if (!orderId) { toast.error('Invalid order reference'); return; }
    if (!window.confirm('Are you sure you want to FORCE REFUND funds to the customer? This action is irreversible.')) return;
    setLoadingAction(orderId);
    try {
      const res = await api.post(`/escrow/refund/${orderId}`, { reason: 'Admin override' });
      if (res.data?.success) { toast.success('Funds refunded successfully'); fetchEscrow(); }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refund funds');
    } finally { setLoadingAction(null); }
  };

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const currentLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const heldTotal     = stats.find(s => s._id === 'held')?.totalAmount || 0;
  const releasedTotal = stats.find(s => s._id === 'released')?.totalAmount || 0;
  const disputedTotal = stats.find(s => s._id === 'disputed')?.totalAmount || 0;
  const custodyTotal  = heldTotal + disputedTotal;
  // Platform revenue: sum commission transactions if available, fallback to analytics
  const adminEarn = analytics?.admin_revenue || analytics?.admin_earnings?.total || 0;

  const fmt = (n) => Number(n || 0).toLocaleString('fr-CM');

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="min-h-20 py-4 flex flex-col md:flex-row md:h-24 items-center justify-between px-4 md:px-10 border-b border-[var(--glass-border)] bg-[var(--bg-primary)]/80 backdrop-blur-xl sticky top-0 md:top-16 lg:top-0 z-40 gap-4 md:gap-0">
        <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-4">
            <div className="size-10 md:size-12 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner border border-[var(--accent)]/20 shrink-0">
               <ShieldCheck className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-[var(--text-primary)] tracking-tight">Escrow <span className="text-[var(--accent)]">Vault</span></h2>
              <div className="flex items-center gap-2 mt-0.5">
                 <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                 <p className="text-[10px] md:text-[11px] font-semibold text-[var(--text-secondary)] tracking-tight opacity-60">Live · Admin View</p>
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
                className="w-full h-11 md:h-12 bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-2xl pl-11 pr-4 text-[11px] font-semibold tracking-tight text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 transition-all shadow-inner"
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
        {/* Filter Row */}
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
                     statusFilter === filter.id ? 'bg-white/20 text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'
                   }`}>
                     {statusCounts[filter.id] || 0}
                   </span>
                 </button>
              ))}
           </div>
        </div>

        {/* Stats */}
        {(() => {
          const total   = (custodyTotal + releasedTotal) || 1;
          const lockPct = Math.min(Math.round((custodyTotal  / total) * 100), 100);
          const relPct  = Math.min(Math.round((releasedTotal / total) * 100), 100);
          const disPct  = Math.min(Math.round((disputedTotal / total) * 100), 100);
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
              <StatCard label="Locked" value={`${fmt(custodyTotal)} XAF`} sub="Active Custody" icon={Database} color="blue" progress={lockPct} footer={`${lockPct}% of vault`} />
              <StatCard label="Released" value={`${fmt(releasedTotal)} XAF`} sub="Settled Capital" icon={CheckCircle2} color="emerald" progress={relPct} footer={`${relPct}% settled`} />
              <StatCard label="Disputed" value={`${fmt(disputedTotal)} XAF`} sub="Contested Funds" icon={AlertCircle} color="rose" progress={disPct} footer={`${disPct}% contested`} />
              <StatCard label="Admin Earn" value={loading ? '…' : `${fmt(adminEarn)} XAF`} sub="Platform commissions" icon={Globe} color="indigo" progress={100} footer="Platform revenue" />
            </div>
          );
        })()}

        {/* Commission Controls */}
        <div className="rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-5 md:p-6 backdrop-blur-xl">
           <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                 <div className="size-11 rounded-2xl bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center border border-[var(--accent)]/20">
                    <Settings2 className="size-5" />
                 </div>
                 <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">Commission Controls</h3>
                    <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">Platform fee policy</p>
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
                         <option value="percentage">Percentage (%)</option>
                         <option value="amount">Fixed (XAF)</option>
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

           {/* Live Fee Preview */}
           <div className="mt-4 rounded-2xl bg-[var(--bg-primary)]/30 border border-[var(--glass-border)] p-4">
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-70 mb-3">Fee preview on a 10,000 XAF order</p>
              <div className="grid grid-cols-4 gap-3">
                 {[
                   { label: 'Base',       value: `${fmt(feePreview.base)} XAF`,     color: 'text-[var(--text-primary)]' },
                   { label: 'Commission', value: `-${fmt(feePreview.commFee)} XAF`, color: 'text-rose-500' },
                   { label: 'Escrow Fee', value: `-${fmt(feePreview.esFee)} XAF`,   color: 'text-rose-500' },
                   { label: 'Vendor Gets', value: `${fmt(feePreview.payout)} XAF`,  color: 'text-emerald-500' },
                 ].map(p => (
                   <div key={p.label} className="text-center">
                      <p className={`text-[12px] font-bold tabular-nums ${p.color}`}>{p.value}</p>
                      <p className="text-[9px] font-semibold text-[var(--text-secondary)] opacity-40 uppercase tracking-[0.1em] mt-0.5">{p.label}</p>
                   </div>
                 ))}
              </div>
           </div>

           <div className="mt-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 leading-relaxed max-w-2xl">
                Fees are calculated against the vendor base amount. Logistics shipping fees are paid directly to the carrier after delivery and are excluded from the commission base.
              </p>
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="h-12 px-5 rounded-2xl bg-[var(--accent)] text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 active:scale-95 transition-all whitespace-nowrap"
              >
                {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save Fees
              </button>
           </div>
        </div>

        {/* Escrow Ledger */}
        <div className="rounded-[2.5rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 overflow-hidden shadow-2xl backdrop-blur-xl">
           <div className="p-6 md:p-8 border-b border-[var(--glass-border)] flex items-center justify-between bg-[var(--bg-secondary)]/20">
              <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                 <Database className="size-4 text-[var(--accent)]" /> Global Escrow Trace Ledger
              </h3>
              <p className="hidden md:block text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">{filteredLogs.length} record{filteredLogs.length !== 1 ? 's' : ''} shown</p>
           </div>

           <div className="p-4 md:p-8 space-y-4">
             {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-30">
                   <Loader2 className="animate-spin size-10" />
                   <p className="text-[11px] font-semibold">Loading escrow records...</p>
                </div>
             ) : currentLogs.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {currentLogs.map(l => {
                    const isExpanded = expandedId === l._id;
                    const statusColor = STATUS_COLOR[l.status] || 'text-[var(--text-secondary)]';
                    const statusBg = statusColor.replace('text-', 'bg-').concat('/10');
                    const StatusIcon = STATUS_ICON[l.status] || Lock;
                    const isReleased = l.status === 'released';
                    const isHeld = l.status === 'held' || l.status === 'pending_release';

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
                                <StatusIcon className="w-6 h-6 md:w-7 md:h-7" />
                             </div>

                             <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-3">
                                   <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-[11px] font-bold text-[var(--text-primary)] tracking-tight uppercase">Order #{l.order_id?._id?.slice(-8).toUpperCase() || 'N/A'}</span>
                                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-widest border uppercase ${statusBg} ${statusColor} ${statusColor.replace('text-', 'border-')}/20`}>
                                         {l.status.replace('_', ' ')}
                                      </span>
                                      {/* Auto-released badge */}
                                      {l.auto_released && (
                                        <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold border bg-amber-500/10 text-amber-500 border-amber-500/20 flex items-center gap-1">
                                          <Bot className="size-2.5" /> Auto-released
                                        </span>
                                      )}
                                   </div>
                                   <div className="flex items-center gap-2 text-[10px] font-semibold text-[var(--text-secondary)] opacity-60">
                                      <Clock className="w-3 h-3" /> {new Date(l.createdAt).toLocaleDateString()}
                                   </div>
                                </div>
                                <div className="flex items-center gap-4">
                                   <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors truncate">
                                         {l.buyer_id?.name || 'Unknown Buyer'} → {l.vendor_id?.store_name || 'Unknown Vendor'}
                                      </p>
                                      <p className="text-[10px] text-[var(--text-secondary)] opacity-60 truncate mt-0.5">{l.buyer_id?.email || ''}</p>
                                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                                        {/* Customer confirmed inline indicator */}
                                        <span className={`text-[9px] font-bold flex items-center gap-1 ${l.customer_confirmed ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-40'}`}>
                                          <User2 className="size-2.5" />
                                          {l.customer_confirmed ? 'Buyer ✓' : 'Buyer pending'}
                                        </span>
                                        <span className={`text-[9px] font-bold flex items-center gap-1 ${l.vendor_confirmed ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-40'}`}>
                                          <Shield className="size-2.5" />
                                          {l.vendor_confirmed ? 'Vendor ✓' : 'Vendor pending'}
                                        </span>
                                      </div>
                                   </div>
                                </div>
                             </div>

                             <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-4 pt-5 md:pt-0 border-t md:border-t-0 border-[var(--glass-border)]/50">
                                <div className="text-left md:text-right">
                                   <p className="text-xl font-bold tabular-nums text-[var(--text-primary)] tracking-tighter">{l.amount.toLocaleString()} <span className="text-[10px] opacity-30 ml-1 font-mono">XAF</span></p>
                                   <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 mt-0.5">Escrow Amount</p>
                                </div>
                                <ShieldCheck className={`hidden md:block size-4 ${isReleased ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-20'}`} />
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
                                      <div className="flex-1 space-y-4">
                                         {/* Confirmation grid */}
                                         <div className="grid grid-cols-2 gap-3">
                                            {/* Customer Confirmed */}
                                            <div className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                               <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-[0.12em] mb-2">Customer Confirmed</p>
                                               <div className="flex items-center gap-2">
                                                  {l.auto_released ? (
                                                    <>
                                                      <Bot className="size-3 text-amber-500" />
                                                      <p className="text-[11px] font-bold text-amber-500">AUTO-RELEASED</p>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <div className={`size-1.5 rounded-full ${l.customer_confirmed ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                                                      <p className={`text-[11px] font-bold ${l.customer_confirmed ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {l.customer_confirmed ? 'VERIFIED' : 'PENDING'}
                                                      </p>
                                                    </>
                                                  )}
                                               </div>
                                            </div>
                                            {/* Vendor Confirmed */}
                                            <div className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                               <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-[0.12em] mb-2">Vendor Confirmed</p>
                                               <div className="flex items-center gap-2">
                                                  <div className={`size-1.5 rounded-full ${l.vendor_confirmed ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--text-secondary)] opacity-30'}`} />
                                                  <p className={`text-[11px] font-bold ${l.vendor_confirmed ? 'text-emerald-500' : 'text-[var(--text-secondary)] opacity-50'}`}>
                                                    {l.vendor_confirmed ? 'VERIFIED' : 'PENDING'}
                                                  </p>
                                               </div>
                                            </div>
                                            {/* Transaction State */}
                                            <div className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                               <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-[0.12em] mb-2">Transaction State</p>
                                               <div className="flex items-center gap-2">
                                                  <div className={`size-1.5 rounded-full ${isReleased ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                                                  <p className={`text-[11px] font-bold ${isReleased ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                    {isReleased ? 'SETTLED' : l.status.toUpperCase().replace('_',' ')}
                                                  </p>
                                               </div>
                                            </div>
                                            {/* Released By */}
                                            <div className="p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                               <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-[0.12em] mb-2">Released By</p>
                                               <div className="flex items-center gap-2">
                                                  {(() => {
                                                    // Use explicit released_by field; fall back to legacy flags for old records
                                                    const by = l.released_by
                                                      || (l.auto_released ? 'auto' : null)
                                                      || ((l.customer_confirmed && isReleased) ? 'customer' : null);
                                                    if (!by) return <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40">—</p>;
                                                    if (by === 'auto') return <><Bot className="size-3.5 text-amber-500" /><p className="text-[11px] font-bold text-amber-500">System (Auto)</p></>;
                                                    if (by === 'customer') return <><User2 className="size-3.5 text-emerald-500" /><p className="text-[11px] font-bold text-emerald-500">Customer</p></>;
                                                    if (by === 'admin') return <><Shield className="size-3.5 text-indigo-500" /><p className="text-[11px] font-bold text-indigo-500">Admin Override</p></>;
                                                    return <p className="text-[11px] font-bold text-[var(--text-secondary)] opacity-40">—</p>;
                                                  })()}
                                               </div>
                                            </div>
                                            {/* Auto-release countdown for held escrows */}
                                            {isHeld && <AutoReleaseCountdown autoReleaseAt={l.auto_release_at} />}
                                            {/* Settlement Timestamp */}
                                            {l.release_date && (
                                              <div className="col-span-2 p-4 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)]">
                                                 <p className="text-[9px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-[0.12em] mb-2">Settlement Timestamp</p>
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
                                            <div className="h-full flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-[var(--glass-border)] opacity-60">
                                               <CheckCircle2 className="size-8 mb-3 text-emerald-500" />
                                               <p className="text-[11px] font-bold">Transaction Complete</p>
                                               {l.auto_released && <p className="text-[10px] mt-1 opacity-70">Released automatically by system</p>}
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
                <div className="py-40 flex flex-col items-center justify-center opacity-30 px-10 text-center gap-4">
                   <Database className="w-12 h-12 text-[var(--text-secondary)]" />
                   <p className="text-sm font-semibold text-[var(--text-secondary)]">No escrow records found</p>
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
