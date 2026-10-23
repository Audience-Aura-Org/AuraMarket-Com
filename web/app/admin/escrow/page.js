"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Database, Loader2, AlertCircle, CheckCircle2, Globe, Percent, Save, Settings2, Bot } from 'lucide-react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import { toast } from 'react-hot-toast';

import FinanceEntry, { FinanceTable } from '@/components/admin/FinanceEntry';
import Pagination from '@/components/common/Pagination';
import StatCard from '@/components/layout/StatCard';
import financeStyles from '@/components/admin/AdminFinance.module.css';
import { AdminFinancePage, AdminFinanceHeader, AdminFinanceBody, AdminContentTabs, AdminFilterSearch, AdminFilterPills } from '@/components/admin/AdminFinanceLayout';

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
  const { user, hasHydrated } = useAuthStore();
  const router = useRouter();
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
  const [section, setSection] = useState('activity');
  const itemsPerPage = 20;
  const [totalRecords, setTotalRecords] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const requestVersion = useRef(0);
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(searchQuery), 250); return () => clearTimeout(timer); }, [searchQuery]);

  const fetchEscrow = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!hasHydrated || !['admin', 'manager'].includes(user?.role)) return;
    setLoading(true);
    try {
      const [escrowRes, analyticsRes, settingsRes] = await Promise.all([
        api.get('/admin/escrow/logs', { params: { page: currentPage, limit: itemsPerPage, status: statusFilter, search: debouncedSearch }, skipClientCache: true }),
        api.get('/admin/analytics').catch(() => ({ data: {} })), // secondary: never blank the page
        api.get('/admin/settings', { skipClientCache: true, params: { t: Date.now() } }).catch(() => ({ data: {} })), // secondary: never blank the page
      ]);

      if (version !== requestVersion.current) return;
      if (escrowRes.data?.success) {
        setTotalRecords(escrowRes.data.total || 0);
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
      if (version === requestVersion.current) setLoading(false);
    }
  }, [hasHydrated, user?.role, currentPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/login?from=admin-escrow');
    } else if (!['admin', 'manager'].includes(user.role)) {
      router.replace('/wallet');
    }
  }, [hasHydrated, router, user]);

  useEffect(() => {
    if (!hasHydrated || !['admin', 'manager'].includes(user?.role)) return;
    fetchEscrow();
  }, [hasHydrated, user?.role, fetchEscrow]);

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
    acc[filter.id] = filter.id === 'all' ? stats.reduce((sum, row) => sum + row.count, 0) : stats.find(row => row._id === filter.id)?.count || 0;
    return acc;
  }, {});

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

  const totalPages = Math.max(1, Math.ceil(totalRecords / itemsPerPage));
  const currentLogs = logs;
  useEffect(() => { if (!loading && currentPage > totalPages) setCurrentPage(totalPages); }, [loading, currentPage, totalPages]);

  const heldTotal     = stats.find(s => s._id === 'held')?.totalAmount || 0;
  const releasedTotal = stats.find(s => s._id === 'released')?.totalAmount || 0;
  const disputedTotal = stats.find(s => s._id === 'disputed')?.totalAmount || 0;
  const custodyTotal  = heldTotal + disputedTotal;
  // Platform revenue: sum commission transactions if available, fallback to analytics
  const adminEarn = analytics?.admin_revenue || analytics?.admin_earnings?.total || 0;

  const fmt = (n) => Number(n || 0).toLocaleString('fr-CM');

  // Do not render privileged escrow data until the persisted session is known.
  // This also keeps the server render deterministic for the client-only store.
  if (!hasHydrated || !user || !['admin', 'manager'].includes(user.role)) return null;

  return (
    <AdminFinancePage theme="escrow">
      <AdminFinanceHeader icon={ShieldCheck} title="Escrow & fees" description="Follow protected payments and manage platform fees." onRefresh={fetchEscrow} loading={loading} />
      <AdminFinanceBody>
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
              <StatCard label="Admin Earn" value={loading ? '…' : `${fmt(adminEarn)} XAF`} sub="Platform commissions" icon={Globe} color="indigo" footer="Platform revenue" />
            </div>
          );
        })()}


        <AdminContentTabs value={section} onChange={setSection} items={[{ id: 'activity', label: 'Escrow activity', icon: Database }, { id: 'fees', label: 'Fee settings', icon: Settings2 }]} />
        {section === 'fees' ? (
        <>
        <div className={`${financeStyles.panel} p-5 md:p-6`}>
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
                        aria-label={`${item.title} type`}
                        value={settings[item.typeField]}
                        onChange={e => handleSettingsChange(item.typeField, e.target.value)}
                        disabled={!['admin', 'manager'].includes(user?.role)}
                        className="h-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                         <option value="percentage">Percentage (%)</option>
                         <option value="amount">Fixed (XAF)</option>
                      </select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`${item.title} value`}
                        value={settings[item.valueField]}
                        onChange={e => handleSettingsChange(item.valueField, e.target.value)}
                        disabled={!['admin', 'manager'].includes(user?.role)}
                        className="h-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-3 text-[11px] font-bold text-[var(--text-primary)] outline-none focus:border-[var(--accent)]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                   </div>
                </div>
              ))}
           </div>

           {/* Live Fee Preview */}
           <div className="mt-4 rounded-2xl bg-[var(--bg-primary)]/30 border border-[var(--glass-border)] p-4">
              <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-70 mb-3">Fee preview on a 10,000 XAF order</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
              {['admin', 'manager'].includes(user?.role) ? (
                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                  className="h-12 px-5 rounded-2xl bg-[var(--accent)] text-white text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent)]/20 disabled:opacity-50 active:scale-95 transition-all whitespace-nowrap"
                >
                  {savingSettings ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Save Fees
                </button>
              ) : (
                <span className="text-[10px] font-bold text-[var(--text-secondary)] opacity-60 uppercase tracking-widest">View Only</span>
              )}
           </div>
        </div>


        </>
        ) : <div className="space-y-5">
          <div className={`${financeStyles.panel} ${financeStyles.filterArea} space-y-4`}>
            <AdminFilterSearch value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setCurrentPage(1); }} placeholder="Search order, customer, or store" />
            <AdminFilterPills items={ESCROW_FILTERS.map((filter) => ({ ...filter, badge: statusCounts[filter.id] }))} value={statusFilter} onChange={(value) => { setStatusFilter(value); setCurrentPage(1); }} />
          </div>
        {/* Escrow Ledger */}
        <div className={financeStyles.panel}>
           <div className={financeStyles.panelHeader}>
              <h3 className="text-xs font-bold text-[var(--text-primary)] tracking-[0.2em] flex items-center gap-3 uppercase">
                 <Database className="size-4 text-[var(--accent)]" /> Escrow activity
              </h3>
              <p className="hidden md:block text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">{totalRecords} record{totalRecords !== 1 ? 's' : ''} shown</p>
           </div>

           <div>
             {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4 opacity-30">
                   <Loader2 className="animate-spin size-10" />
                   <p className="text-[11px] font-semibold">Loading escrow records...</p>
                </div>
             ) : currentLogs.length > 0 ? (
                <FinanceTable label="Escrow activity" columns={['Buyer / vendor', 'Order / information', 'Status', 'Amount', 'Date', 'Actions']}>
                  {currentLogs.map(log => {
                    const orderId = log.order_reference || log.order_id?._id;
                    const vendorId = log.vendor_reference || log.vendor_id?._id;
                    const expanded = expandedId === log._id;
                    const active = ['held', 'pending_release'].includes(log.status);
                    const blocked = log.settlement?.blocked || !log.order_id || !log.vendor_id;
                    const reason = log.settlement?.reason || (blocked ? 'Linked order or vendor records are missing. Restore the original records before settlement.' : '');
                    return <FinanceEntry key={log._id} icon={<Lock />}
                      title={log.buyer_id?.name || 'Buyer unavailable'} description={log.vendor_id?.store_name || 'Vendor unavailable'}
                      reference={'Order #' + (orderId ? String(orderId).slice(-8).toUpperCase() : 'Unavailable')}
                      meta={blocked ? <span className="text-amber-600">Needs reconciliation</span> : log.auto_released ? 'Automatically released' : log.customer_confirmed ? 'Buyer confirmed' : 'Buyer confirmation pending'}
                      status={log.status.replaceAll('_', ' ')} tone={blocked ? 'danger' : log.status === 'released' ? 'success' : active ? 'pending' : 'neutral'}
                      amount={fmt(log.amount) + ' XAF'} date={new Date(log.createdAt).toLocaleString()}
                      onOpen={() => setExpandedId(expanded ? null : log._id)} expandable expanded={expanded} controls={'escrow-' + log._id}>
                      {expanded && <div id={'escrow-' + log._id} className="space-y-4 p-4">
                        {reason && <p role="status" className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">{reason}</p>}
                        <dl className="grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
                          <div><dt className="text-[var(--text-secondary)]">Escrow reference</dt><dd className="mt-1 break-all">{log._id}</dd></div>
                          <div><dt className="text-[var(--text-secondary)]">Order reference</dt><dd className="mt-1 break-all">{String(orderId || 'Unavailable')}</dd></div>
                          <div><dt className="text-[var(--text-secondary)]">Vendor reference</dt><dd className="mt-1 break-all">{String(vendorId || 'Unavailable')}</dd></div>
                          <div><dt className="text-[var(--text-secondary)]">Buyer email</dt><dd className="mt-1 break-all">{log.buyer_id?.email || 'Unavailable'}</dd></div>
                          <div><dt className="text-[var(--text-secondary)]">Confirmations</dt><dd className="mt-1">Buyer: {log.customer_confirmed ? 'Confirmed' : 'Pending'} / Vendor: {log.vendor_confirmed ? 'Confirmed' : 'Pending'}</dd></div>
                          <div><dt className="text-[var(--text-secondary)]">Settlement</dt><dd className="mt-1">{log.release_date ? new Date(log.release_date).toLocaleString() : log.delivered_at ? 'Delivery recorded' : 'Delivery not recorded'}</dd></div>
                        </dl>
                        {active && !blocked && <AutoReleaseCountdown autoReleaseAt={log.auto_release_at} />}
                        {active && !blocked && user?.role === 'admin' && <div className="flex flex-wrap gap-2">
                          <button type="button" className={financeStyles.button} onClick={() => handleRelease(orderId)} disabled={Boolean(loadingAction)}>Release funds</button>
                          {log.status === 'held' && <button type="button" className={financeStyles.button} onClick={() => handleRefund(orderId)} disabled={Boolean(loadingAction)}>Refund buyer</button>}
                        </div>}
                        {log.status === 'disputed' && <p className="text-xs text-[var(--text-secondary)]">Use dispute resolution to decide the settlement outcome.</p>}
                      </div>}
                    </FinanceEntry>;
                  })}
                </FinanceTable>
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

        </div>}
      </AdminFinanceBody>
    </AdminFinancePage>
  );
}
