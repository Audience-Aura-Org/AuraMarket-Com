"use client";

import { useState, useEffect, useCallback } from 'react';
import {
  Landmark, Send, Loader2, AlertCircle, CheckCircle2,
  Clock, XCircle, Wallet, TrendingUp, RefreshCw,
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
  AdminMetricGrid,
  AdminFilterToolbar,
  AdminFilterSearch,
  AdminFilterSelect,
  AdminListPanel,
} from '@/components/admin/AdminFinanceLayout';

const THEME = 'treasury';

const STATUS_STYLE = {
  completed: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20',
  pending: 'text-amber-600 bg-amber-500/10 border-amber-500/20',
  failed: 'text-rose-600 bg-rose-500/10 border-rose-500/20',
};

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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !authLoading && !['admin', 'manager'].includes(user?.role)) {
      router.replace('/');
    }
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
      if (res.data?.success) {
        setWallets(res.data.data.wallets || []);
      }
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
      const res = await api.post('/admin/treasury/payout', {
        ...form,
        amount: Number(form.amount),
      });
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

  const [rechecking, setRechecking] = useState(false);

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      const res = await api.post('/admin/treasury/recheck');
      if (res.data?.success) {
        toast.success(res.data.message || 'Recheck complete');
        fetchHistory();
      }
    } catch {
      toast.error('Recheck failed');
    } finally {
      setRechecking(false);
    }
  };

  const handleRefresh = () => {
    fetchHistory();
    fetchBalances();
  };

  const xafWallet = wallets.find?.(w => (w.currency || '').toUpperCase() === 'XAF');
  const xafBalance = xafWallet?.amount ?? xafWallet?.balance ?? null;

  if (!mounted || authLoading) return null;
  if (!['admin', 'manager'].includes(user?.role)) return null;

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
        {/* Metrics */}
        <AdminMetricGrid
          theme={THEME}
          metrics={[
            { label: 'Eversend XAF', value: xafBalance != null ? `${Number(xafBalance).toLocaleString()}` : '---' },
            { label: 'Total Payouts', value: stats?.total_count ?? 0 },
            { label: 'Disbursed', value: `${((stats?.completed_amount || 0) / 1000).toFixed(0)}k XAF` },
            { label: 'Failed', value: stats?.failed ?? 0 },
          ]}
        />

        {/* Payout Form */}
        <section className="rounded-2xl border border-amber-500/10 bg-[var(--bg-primary)]/95 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/20">
            <p className="text-[12px] font-semibold flex items-center gap-2">
              <Send className="size-4 text-amber-600" /> New Payout
            </p>
          </div>
          <div className="p-4 space-y-4">
            {/* Gateway Selection */}
            <div className="flex gap-3">
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

            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Phone *</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="6XXXXXXXX"
                  className="w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] outline-none focus:border-amber-500/45"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Amount ({form.currency}) *</label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="5000"
                  min="1"
                  className="w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] outline-none focus:border-amber-500/45"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">First Name *</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                  placeholder="John"
                  className="w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] outline-none focus:border-amber-500/45"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Last Name *</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Doe"
                  className="w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] outline-none focus:border-amber-500/45"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Country</label>
                <select
                  value={form.country}
                  onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] outline-none focus:border-amber-500/45"
                >
                  <option value="CM">Cameroon</option>
                  <option value="CI">Ivory Coast</option>
                  <option value="SN">Senegal</option>
                  <option value="GA">Gabon</option>
                  <option value="CD">DR Congo</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Currency</label>
                <select
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] outline-none focus:border-amber-500/45"
                >
                  <option value="XAF">XAF</option>
                  <option value="XOF">XOF</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Note (optional)</label>
              <textarea
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Purpose of payout..."
                rows={2}
                className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[12px] outline-none focus:border-amber-500/45 resize-none"
              />
            </div>

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

        {/* History */}
        <AdminListPanel
          theme={THEME}
          title="Payout History"
          countLabel={`${historyTotal} total`}
          loading={loading}
          loadingMessage="Loading payouts..."
          isEmpty={history.length === 0}
          emptyIcon={Wallet}
          emptyMessage="No direct payouts yet."
          filterSlot={
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
          }
          footer={
            historyPages > 1 && (
              <Pagination
                page={historyPage}
                pages={historyPages}
                onPageChange={setHistoryPage}
              />
            )
          }
        >
          <div className="divide-y divide-[var(--glass-border)]/50">
            {history.map(tx => (
              <div key={tx._id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)]/20 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase border ${STATUS_STYLE[tx.status] || STATUS_STYLE.pending}`}>
                      {tx.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)]">
                      {tx.gateway}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                    {tx.metadata?.recipient?.phone || 'N/A'} — {tx.metadata?.recipient?.firstName} {tx.metadata?.recipient?.lastName}
                  </p>
                  <p className="text-[9px] text-[var(--text-secondary)] opacity-50 mt-0.5">
                    {tx.reference} {tx.metadata?.note ? `| ${tx.metadata.note}` : ''} | {new Date(tx.createdAt).toLocaleString()}
                  </p>
                </div>
                <p className="text-[12px] font-bold tabular-nums text-[var(--text-primary)] shrink-0">
                  {(tx.amount || 0).toLocaleString()} {tx.currency || 'XAF'}
                </p>
              </div>
            ))}
          </div>
        </AdminListPanel>
      </AdminFinanceBody>
    </AdminFinancePage>
  );
}
