"use client";

import StatCard from '@/components/layout/StatCard';
import financeStyles from '@/components/admin/AdminFinance.module.css';

import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, Send, Loader2, CheckCircle2,
  Clock, XCircle, Wallet, RefreshCw,
  CreditCard, TrendingDown, AlertTriangle,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import FinanceEntry, { FinanceTable } from '@/components/admin/FinanceEntry';
import Pagination from '@/components/common/Pagination';
import {
  AdminFinancePage,
  AdminFinanceHeader,
  AdminFinanceBody,
  AdminContentTabs,
  AdminFilterToolbar,
  AdminFilterSearch,
  AdminFilterSelect,
} from '@/components/admin/AdminFinanceLayout';

const THEME = 'treasury';

const STATUS_CFG = {
  completed: { icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  pending:   { icon: Clock,        color: 'text-amber-600',   bg: 'bg-amber-500/10 border-amber-500/20' },
  failed:    { icon: XCircle,      color: 'text-rose-600',    bg: 'bg-rose-500/10 border-rose-500/20' },
};

function FieldInput({ label, children }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-[var(--text-secondary)]">
        <span className="mb-2 block">{label}</span>
        {children}
      </label>
    </div>
  );
}

const inputClass =
  `${financeStyles.control} text-[12px]`;

export default function AdminTreasuryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();

  const [view, setView] = useState('history');
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // History
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [stats, setStats] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterGateway, setFilterGateway] = useState('all');
  const [search, setSearch] = useState('');

  // Gateway balances
  const [wallets, setWallets] = useState([]);

  // Form
  const [form, setForm] = useState({
    gateway: 'eversend',
    phone: '',
    firstName: '',
    lastName: '',
    country: 'CM',
    amount: '',
    currency: 'XAF',
    note: '',
  });

  // Recheck
  const [rechecking, setRechecking] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !authLoading && !['admin', 'manager'].includes(user?.role)) router.replace('/');
  }, [mounted, authLoading, user, router]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: historyPage, limit: 20 };
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterGateway !== 'all') params.gateway = filterGateway;
      if (search) params.search = search;

      const res = await api.get('/admin/treasury/history', { params });
      if (res.data?.success) {
        setHistory(res.data.data.transactions || []);
        setHistoryTotal(res.data.data.total || 0);
        setHistoryPages(res.data.pages || 1);
        if (res.data.data.stats) setStats(res.data.data.stats);
      }
    } catch {
      toast.error('Failed to load payout history');
    } finally {
      setLoading(false);
    }
  }, [historyPage, filterStatus, filterGateway, search]);

  const fetchBalances = useCallback(async () => {
    try {
      const res = await api.get('/admin/treasury/gateway-balances');
      if (res.data?.success) setWallets(res.data.data.wallets || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (mounted && ['admin', 'manager'].includes(user?.role)) {
      fetchHistory();
      fetchBalances();
    }
  }, [mounted, user, fetchHistory, fetchBalances]);

  const handleSubmit = async () => {
    if (!form.phone || !form.firstName || !form.lastName || !form.amount) {
      return toast.error('Please fill in all required fields.');
    }
    if (Number(form.amount) <= 0) {
      return toast.error('Amount must be greater than 0.');
    }
    const confirmed = window.confirm(
      `Execute ${Number(form.amount).toLocaleString()} ${form.currency} payout via ${form.gateway.toUpperCase()} to ${form.phone}?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await api.post('/admin/treasury/payout', { ...form, amount: Number(form.amount) });
      if (res.data?.success) {
        toast.success(res.data.message || 'Payout initiated');
        setForm(f => ({ ...f, phone: '', firstName: '', lastName: '', amount: '', note: '' }));
        fetchHistory();
        fetchBalances();
        setView('history');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payout failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      const res = await api.post('/admin/treasury/recheck');
      if (res.data?.success) {
        toast.success(res.data.message || 'Recheck complete');
        fetchHistory();
      }
    } catch { toast.error('Recheck failed'); }
    finally { setRechecking(false); }
  };

  const handleRefresh = () => { fetchHistory(); fetchBalances(); };

  const xafWallet = wallets.find?.(w => (w.currency || '').toUpperCase() === 'XAF');
  const xafBalance = xafWallet?.amount ?? xafWallet?.balance ?? null;

  if (!mounted || authLoading) return null;
  if (!['admin', 'manager'].includes(user?.role)) return null;

  const kpis = [
    { icon: CreditCard, label: 'Gateway balance', value: xafBalance != null ? Number(xafBalance).toLocaleString() + ' XAF' : '---', color: 'emerald', sub: 'Available for payouts', footer: 'XAF gateway wallet' },
    { icon: Send, label: 'Total payouts', value: stats?.total_count ?? 0, color: 'indigo', sub: 'All payout requests', footer: 'Across payout gateways' },
    { icon: CheckCircle2, label: 'Disbursed', value: Number(stats?.completed_amount || 0).toLocaleString() + ' XAF', color: 'amber', sub: 'Completed transfers', footer: 'Successfully paid out' },
    { icon: AlertTriangle, label: 'Failed', value: stats?.failed ?? 0, color: 'primary', sub: 'Unsuccessful transfers', footer: 'Review payout history' },
  ];

  return (
    <AdminFinancePage theme={THEME}>
      <AdminFinanceHeader
        theme={THEME}
        icon={Landmark}
        title="Treasury"
        description="Send direct payouts and follow their progress across gateways."
        actions={<button type="button" aria-label="New payout" className={`${financeStyles.primaryButton} text-[11px]`} onClick={() => setView('payout')}><Send className="size-4" /><span className="hidden sm:inline">New payout</span></button>}
        onRefresh={handleRefresh}
        loading={loading}
      />

      <AdminFinanceBody>
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {kpis.map(({ icon, label, value, color, sub, footer }) => (
            <StatCard key={label} icon={icon} label={label} value={value} color={color} sub={sub} footer={footer} loading={loading} />
          ))}
        </div>

        <AdminContentTabs value={view} onChange={setView} items={[{ id: 'history', label: 'Payout history', icon: Wallet }, { id: 'payout', label: 'New payout', icon: Send }]} />
        <div className="space-y-5">

          {/* ── Left: Payout Form (sticky on desktop) ── */}
          <section hidden={view !== 'payout'} className={`${financeStyles.panel} mx-auto max-w-3xl`}>
            <div className={financeStyles.panelHeader}>
              <p className="text-[12px] font-semibold flex items-center gap-2">
                <Send className="size-4 text-amber-600" /> New Payout
              </p>
            </div>
            <div className={`${financeStyles.panelBody} space-y-5`}>
              {/* Gateway */}
              <div className="flex gap-2">
                {['eversend', 'pawapay'].map(gw => (
                  <button
                    key={gw}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, gateway: gw }))}
                    className={`flex-1 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all ${
                      form.gateway === gw
                        ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                        : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--glass-border)] hover:border-amber-500/30'
                    }`}
                  >
                    {gw === 'eversend' ? 'Eversend' : 'PawaPay'}
                    <span className="block text-[9px] font-normal opacity-70 mt-0.5">
                      Min: {gw === 'eversend' ? '1,000' : '100'} XAF
                    </span>
                  </button>
                ))}
              </div>

              {/* Fields */}
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="Phone *">
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="6XXXXXXXX" className={inputClass} />
                </FieldInput>
                <FieldInput label={`Amount (${form.currency}) *`}>
                  <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="5000" min="1" className={inputClass} />
                </FieldInput>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="First Name *">
                  <input type="text" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="John" className={inputClass} />
                </FieldInput>
                <FieldInput label="Last Name *">
                  <input type="text" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Doe" className={inputClass} />
                </FieldInput>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FieldInput label="Country">
                  <select value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} className={inputClass}>
                    <option value="CM">Cameroon</option>
                    <option value="CI">Ivory Coast</option>
                    <option value="SN">Senegal</option>
                    <option value="GA">Gabon</option>
                    <option value="CD">DR Congo</option>
                  </select>
                </FieldInput>
                <FieldInput label="Currency">
                  <select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className={inputClass}>
                    <option value="XAF">XAF</option>
                    <option value="XOF">XOF</option>
                  </select>
                </FieldInput>
              </div>
              <FieldInput label="Note (optional)">
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Purpose of payout..." rows={2} className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[12px] outline-none focus:border-amber-500/45 resize-none transition-colors" />
              </FieldInput>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-amber-600 text-white text-[12px] font-bold uppercase tracking-wider hover:bg-amber-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                {submitting ? 'Processing...' : 'Execute Payout'}
              </button>
            </div>
          </section>

          {/* ── Right: Payout History ── */}
          <section hidden={view !== 'history'} className={financeStyles.panel}>
            {/* Title bar */}
            <div className={financeStyles.panelHeader}>
              <h2 className="text-sm font-semibold">Payout History</h2>
              <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {historyTotal} total
              </span>
            </div>

            {/* Filters */}
            <div className={`${financeStyles.filterArea} space-y-3`}>
              <AdminFilterToolbar>
                <AdminFilterSearch
                  theme={THEME}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setHistoryPage(1); }}
                  placeholder="Search reference..."
                />
                <AdminFilterSelect label="Payout status" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setHistoryPage(1); }}>
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </AdminFilterSelect>
                <AdminFilterSelect label="Payout gateway" value={filterGateway} onChange={e => { setFilterGateway(e.target.value); setHistoryPage(1); }}>
                  <option value="all">All Gateways</option>
                  <option value="eversend">Eversend</option>
                  <option value="pawapay">PawaPay</option>
                </AdminFilterSelect>
                <button
                  type="button"
                  onClick={handleRecheck}
                  disabled={rechecking}
                  className="h-10 px-3 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-600 text-[11px] font-bold hover:bg-amber-500/20 disabled:opacity-50 transition-all flex items-center gap-2 shrink-0"
                >
                  <RefreshCw className={`size-3.5 ${rechecking ? 'animate-spin' : ''}`} />
                  {rechecking ? 'Syncing...' : 'Sync Status'}
                </button>
              </AdminFilterToolbar>
            </div>

            {/* List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20">
                <Loader2 className="size-8 animate-spin text-amber-600" />
                <p className="text-[11px] text-[var(--text-secondary)]">Loading payouts...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <Wallet className="mx-auto mb-3 size-9 text-[var(--text-secondary)]/35" />
                <p className="text-sm font-medium text-[var(--text-secondary)]">No direct payouts yet.</p>
              </div>
            ) : (
              <FinanceTable>
                {history.map(tx => {
                  const cfg = STATUS_CFG[tx.status] || STATUS_CFG.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <FinanceEntry key={tx._id}
                      icon={<StatusIcon />} title={[tx.metadata?.recipient?.firstName, tx.metadata?.recipient?.lastName].filter(Boolean).join(' ') || 'Payout recipient'}
                      description={tx.metadata?.recipient?.phone || 'No phone recorded'} reference={tx.reference}
                      amount={(tx.amount || 0).toLocaleString() + ' ' + (tx.currency || 'XAF')}
                      date={new Date(tx.createdAt).toLocaleString()} status={tx.status}
                      tone={tx.status === 'completed' ? 'success' : tx.status === 'failed' ? 'danger' : 'pending'}
                      meta={<><span className="capitalize">{tx.gateway || 'Manual payout'}</span>{tx.metadata?.note && <span>{tx.metadata.note}</span>}</>}
                    />
                  );
                })}
              </FinanceTable>
            )}

            {/* Pagination */}
            {historyPages > 1 && !loading && (
              <div className="border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/15 px-2 py-2 sm:px-4 sm:py-3">
                <Pagination currentPage={historyPage} totalPages={historyPages} onPageChange={setHistoryPage} />
              </div>
            )}
          </section>
        </div>
      </AdminFinanceBody>
    </AdminFinancePage>
  );
}
