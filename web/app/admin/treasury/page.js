"use client";

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
import Pagination from '@/components/common/Pagination';
import {
  AdminFinancePage,
  AdminFinanceHeader,
  AdminFinanceBody,
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
      <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] outline-none focus:border-amber-500/45 transition-colors';

export default function AdminTreasuryPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();

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
    { icon: CreditCard,    label: 'Gateway Balance',  value: xafBalance != null ? `${Number(xafBalance).toLocaleString()} XAF` : '---' },
    { icon: Send,          label: 'Total Payouts',    value: stats?.total_count ?? 0 },
    { icon: CheckCircle2,  label: 'Disbursed',        value: `${((stats?.completed_amount || 0) / 1000).toFixed(0)}k XAF` },
    { icon: AlertTriangle, label: 'Failed',           value: stats?.failed ?? 0 },
  ];

  return (
    <AdminFinancePage theme={THEME}>
      <AdminFinanceHeader
        theme={THEME}
        icon={Landmark}
        title="Treasury"
        description="Direct gateway payouts"
        onRefresh={handleRefresh}
        loading={loading}
      />

      <AdminFinanceBody>
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {kpis.map(({ icon: KIcon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-amber-500/15 bg-[var(--bg-primary)]/95 px-3 py-2.5"
            >
              <div className="size-8 shrink-0 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <KIcon className="size-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-medium text-[var(--text-secondary)]">{label}</p>
                <p className="text-[12px] font-bold tabular-nums truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 2-Column Layout: Form (left) + History (right) on desktop */}
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">

          {/* ── Left: Payout Form (sticky on desktop) ── */}
          <section className="rounded-2xl border border-amber-500/10 bg-[var(--bg-primary)]/95 shadow-sm overflow-hidden lg:sticky lg:top-[85px]">
            <div className="px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/20">
              <p className="text-[12px] font-semibold flex items-center gap-2">
                <Send className="size-4 text-amber-600" /> New Payout
              </p>
            </div>
            <div className="p-4 space-y-3">
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
          <section className="rounded-2xl border border-amber-500/10 bg-[var(--bg-primary)]/95 shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="space-y-2.5 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-2.5 sm:space-y-3 sm:p-4">
              <AdminFilterToolbar>
                <AdminFilterSearch
                  theme={THEME}
                  value={search}
                  onChange={e => { setSearch(e.target.value); setHistoryPage(1); }}
                  placeholder="Search reference..."
                />
                <AdminFilterSelect value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setHistoryPage(1); }}>
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                </AdminFilterSelect>
                <AdminFilterSelect value={filterGateway} onChange={e => { setFilterGateway(e.target.value); setHistoryPage(1); }}>
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

            {/* Title bar */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-2.5">
              <p className="text-[12px] font-semibold">Payout History</p>
              <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                {historyTotal} total
              </span>
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
              <div className="divide-y divide-[var(--glass-border)]/50">
                {history.map(tx => {
                  const cfg = STATUS_CFG[tx.status] || STATUS_CFG.pending;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={tx._id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)]/20 transition-colors">
                      <div className={`size-8 shrink-0 rounded-lg flex items-center justify-center ${cfg.bg} border`}>
                        <StatusIcon className={`size-3.5 ${cfg.color}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                            {tx.metadata?.recipient?.phone || 'N/A'} — {tx.metadata?.recipient?.firstName} {tx.metadata?.recipient?.lastName}
                          </p>
                          <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] shrink-0">
                            {tx.gateway}
                          </span>
                        </div>
                        <p className="text-[9px] text-[var(--text-secondary)] opacity-50 truncate">
                          {tx.reference} {tx.metadata?.note ? `| ${tx.metadata.note}` : ''} | {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-[12px] font-bold tabular-nums text-[var(--text-primary)] shrink-0">
                        {(tx.amount || 0).toLocaleString()} {tx.currency || 'XAF'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {historyPages > 1 && !loading && (
              <div className="border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/15 px-2 py-2 sm:px-4 sm:py-3">
                <Pagination page={historyPage} pages={historyPages} onPageChange={setHistoryPage} />
              </div>
            )}
          </section>
        </div>
      </AdminFinanceBody>
    </AdminFinancePage>
  );
}
