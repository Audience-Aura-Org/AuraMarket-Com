"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Scale, Search, Loader2, ArrowUpCircle, ArrowDownCircle,
  Wallet, UserSearch, History, ChevronRight, X,
  TrendingUp, TrendingDown, BarChart3,
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
} from '@/components/admin/AdminFinanceLayout';

const THEME = 'transactions';

const TYPE_LABEL = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  payment: 'Payment',
  refund: 'Refund',
  escrow_release: 'Escrow Release',
  payout: 'Payout',
  subscription: 'Subscription',
};

export default function AdminVendorBalancePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthStore();
  const searchTimer = useRef(null);

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Vendor search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Adjust form
  const [operation, setOperation] = useState('credit');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Adjustment history
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPages, setHistoryPages] = useState(1);
  const [stats, setStats] = useState(null);

  // Selected vendor's transaction history
  const [vendorTxns, setVendorTxns] = useState([]);
  const [vendorTxnTotal, setVendorTxnTotal] = useState(0);
  const [vendorTxnPage, setVendorTxnPage] = useState(1);
  const [vendorTxnPages, setVendorTxnPages] = useState(1);
  const [vendorTxnLoading, setVendorTxnLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (mounted && !authLoading && !['admin', 'manager'].includes(user?.role)) router.replace('/');
  }, [mounted, authLoading, user, router]);

  // Debounced vendor search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get('/admin/vendor-balance/search', { params: { search: searchQuery } });
        if (res.data?.success) setSearchResults(res.data.data.vendors || []);
      } catch { /* silent */ }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  // Fetch adjustment history
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/vendor-balance/history', { params: { page: historyPage, limit: 20 } });
      if (res.data?.success) {
        setHistory(res.data.data.transactions || []);
        setHistoryTotal(res.data.data.total || 0);
        setHistoryPages(res.data.pages || 1);
        if (res.data.data.stats) setStats(res.data.data.stats);
      }
    } catch { toast.error('Failed to load adjustment history'); }
    finally { setLoading(false); }
  }, [historyPage]);

  useEffect(() => {
    if (mounted && ['admin', 'manager'].includes(user?.role)) fetchHistory();
  }, [mounted, user, fetchHistory]);

  // Fetch selected vendor's transactions
  const fetchVendorTxns = useCallback(async (userId, page = 1) => {
    setVendorTxnLoading(true);
    try {
      const res = await api.get(`/admin/vendor-balance/transactions/${userId}`, { params: { page, limit: 15 } });
      if (res.data?.success) {
        setVendorTxns(res.data.data.transactions || []);
        setVendorTxnTotal(res.data.data.total || 0);
        setVendorTxnPages(res.data.pages || 1);
        setVendorTxnPage(page);
      }
    } catch { /* silent */ }
    finally { setVendorTxnLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedVendor?.user_id) fetchVendorTxns(selectedVendor.user_id, 1);
  }, [selectedVendor, fetchVendorTxns]);

  const handleSelectVendor = (vendor) => {
    setSelectedVendor(vendor);
    setSearchQuery('');
    setSearchResults([]);
    setAmount('');
    setReason('');
    setVendorTxnPage(1);
  };

  const handleAdjust = async () => {
    if (!selectedVendor) return;
    if (!amount || Number(amount) <= 0) return toast.error('Enter a valid amount.');
    if (!reason || reason.length < 5) return toast.error('Reason must be at least 5 characters.');

    const confirmed = window.confirm(
      `${operation === 'credit' ? 'Credit' : 'Debit'} ${Number(amount).toLocaleString()} XAF ${operation === 'credit' ? 'to' : 'from'} ${selectedVendor.store_name || selectedVendor.user_name}?`
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const res = await api.post('/admin/vendor-balance/adjust', {
        userId: selectedVendor.user_id,
        amount: Number(amount),
        operation,
        reason,
      });
      if (res.data?.success) {
        toast.success(res.data.message);
        setSelectedVendor(v => ({
          ...v,
          wallet_balance: res.data.data.user.wallet_balance,
        }));
        setAmount('');
        setReason('');
        fetchHistory();
        fetchVendorTxns(selectedVendor.user_id, 1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Adjustment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted || authLoading) return null;
  if (!['admin', 'manager'].includes(user?.role)) return null;

  const kpis = [
    { icon: BarChart3,     label: 'Adjustments',   value: stats?.total_count ?? 0 },
    { icon: TrendingUp,    label: 'Credited',       value: `${((stats?.total_credited || 0) / 1000).toFixed(0)}k XAF` },
    { icon: TrendingDown,  label: 'Debited',        value: `${((stats?.total_debited || 0) / 1000).toFixed(0)}k XAF` },
    { icon: Scale,         label: 'Net',             value: `${((stats?.net || 0) / 1000).toFixed(0)}k XAF` },
  ];

  const inputClass =
    'w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 text-[12px] outline-none focus:border-indigo-500/45 transition-colors';

  return (
    <AdminFinancePage theme={THEME}>
      <AdminFinanceHeader
        theme={THEME}
        icon={Scale}
        title="Vendor Balances"
        description="Manual balance adjustments"
        onRefresh={fetchHistory}
        loading={loading}
      />

      <AdminFinanceBody>
        {/* KPI Strip */}
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {kpis.map(({ icon: KIcon, label, value }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-indigo-500/15 bg-[var(--bg-primary)]/95 px-3 py-2.5"
            >
              <div className="size-8 shrink-0 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <KIcon className="size-4 text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-medium text-[var(--text-secondary)]">{label}</p>
                <p className="text-[12px] font-bold tabular-nums truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 2-Column Layout: Search/Adjust (left) + History (right) on desktop */}
        <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">

          {/* ── Left: Vendor Search & Adjust (sticky on desktop) ── */}
          <section className="rounded-2xl border border-indigo-500/10 bg-[var(--bg-primary)]/95 shadow-sm overflow-hidden lg:sticky lg:top-[85px]">
            <div className="px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/20">
              <p className="text-[12px] font-semibold flex items-center gap-2">
                <UserSearch className="size-4 text-indigo-600" /> Find Vendor
              </p>
            </div>
            <div className="p-4 space-y-3">
              {/* Search Input */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--text-secondary)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Store name, email, phone..."
                  className="w-full h-10 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] pl-9 pr-3 text-[12px] outline-none focus:border-indigo-500/45 transition-colors"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-indigo-500" />}
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--glass-border)] divide-y divide-[var(--glass-border)]/50">
                  {searchResults.map(v => (
                    <button
                      key={v.vendor_id}
                      type="button"
                      onClick={() => handleSelectVendor(v)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-500/5 transition-colors text-left"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">{v.store_name}</p>
                        <p className="text-[9px] text-[var(--text-secondary)] opacity-60">{v.user_name} &middot; {v.phone || v.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] font-bold tabular-nums">{(v.wallet_balance || 0).toLocaleString()} XAF</span>
                        <ChevronRight className="size-3 text-[var(--text-secondary)] opacity-30" />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Vendor Card */}
              {selectedVendor && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] p-3.5 space-y-3">
                  {/* Vendor Info */}
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[var(--text-primary)] truncate">{selectedVendor.store_name}</p>
                      <p className="text-[9px] text-[var(--text-secondary)] opacity-60">{selectedVendor.user_name} &middot; {selectedVendor.phone || selectedVendor.email}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedVendor(null)} className="size-7 rounded-lg flex items-center justify-center hover:bg-[var(--bg-secondary)] transition-colors shrink-0">
                      <X className="size-3.5 text-[var(--text-secondary)]" />
                    </button>
                  </div>

                  {/* Balance */}
                  <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)]">
                    <Wallet className="size-5 text-indigo-500 shrink-0" />
                    <div>
                      <p className="text-[9px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Balance</p>
                      <p className="text-[15px] font-bold tabular-nums">{(selectedVendor.wallet_balance || 0).toLocaleString()} XAF</p>
                    </div>
                  </div>

                  {/* Operation Toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOperation('credit')}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                        operation === 'credit'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--glass-border)]'
                      }`}
                    >
                      <ArrowUpCircle className="size-3.5" /> Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperation('debit')}
                      className={`flex-1 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider border transition-all flex items-center justify-center gap-1.5 ${
                        operation === 'debit'
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--glass-border)]'
                      }`}
                    >
                      <ArrowDownCircle className="size-3.5" /> Debit
                    </button>
                  </div>

                  {/* Amount & Reason */}
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Amount (XAF) *</label>
                    <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="5000" min="1" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1 block">Reason *</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason (min 5 chars)..." rows={2} className="w-full rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)] px-3 py-2 text-[12px] outline-none focus:border-indigo-500/45 resize-none transition-colors" />
                  </div>

                  <button
                    type="button"
                    onClick={handleAdjust}
                    disabled={submitting}
                    className={`w-full h-10 rounded-xl text-white text-[12px] font-bold uppercase tracking-wider disabled:opacity-50 transition-all flex items-center justify-center gap-2 ${
                      operation === 'credit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    {submitting ? <Loader2 className="size-4 animate-spin" /> : operation === 'credit' ? <ArrowUpCircle className="size-4" /> : <ArrowDownCircle className="size-4" />}
                    {submitting ? 'Processing...' : `Apply ${operation === 'credit' ? 'Credit' : 'Debit'}`}
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* ── Right: History Panels ── */}
          <div className="space-y-4">
            {/* Vendor Transaction History (when vendor selected) */}
            {selectedVendor && (
              <section className="rounded-2xl border border-indigo-500/10 bg-[var(--bg-primary)]/95 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-2.5">
                  <p className="text-[12px] font-semibold truncate">{selectedVendor.store_name} — Transactions</p>
                  <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
                    {vendorTxnTotal} total
                  </span>
                </div>

                {vendorTxnLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-16">
                    <Loader2 className="size-7 animate-spin text-indigo-600" />
                    <p className="text-[11px] text-[var(--text-secondary)]">Loading transactions...</p>
                  </div>
                ) : vendorTxns.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <History className="mx-auto mb-3 size-8 text-[var(--text-secondary)]/35" />
                    <p className="text-sm font-medium text-[var(--text-secondary)]">No transactions for this vendor.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--glass-border)]">
                    {vendorTxns.map(tx => (
                      <div key={tx._id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)]/20 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase border ${
                              tx.type === 'deposit' || tx.type === 'escrow_release' || tx.type === 'refund'
                                ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                                : tx.type === 'withdrawal' || tx.type === 'payment'
                                ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
                                : 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20'
                            }`}>
                              {TYPE_LABEL[tx.type] || tx.type}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase border ${
                              tx.status === 'completed' ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                              : tx.status === 'failed' ? 'text-rose-600 bg-rose-500/10 border-rose-500/20'
                              : 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                            }`}>
                              {tx.status}
                            </span>
                            {tx.gateway && (
                              <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold uppercase bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)]">
                                {tx.gateway}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-[var(--text-secondary)] opacity-60 truncate">
                            {tx.description || tx.reference} &middot; {new Date(tx.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <p className={`text-[12px] font-bold tabular-nums shrink-0 ${
                          tx.type === 'deposit' || tx.type === 'escrow_release' || tx.type === 'refund'
                            ? 'text-emerald-600' : 'text-[var(--text-primary)]'
                        }`}>
                          {tx.type === 'withdrawal' || tx.type === 'payment' ? '-' : '+'}{(tx.amount || 0).toLocaleString()} XAF
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {vendorTxnPages > 1 && !vendorTxnLoading && (
                  <div className="border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/15 px-2 py-2 sm:px-4 sm:py-3">
                    <Pagination page={vendorTxnPage} pages={vendorTxnPages} onPageChange={p => { setVendorTxnPage(p); fetchVendorTxns(selectedVendor.user_id, p); }} />
                  </div>
                )}
              </section>
            )}

            {/* Admin Adjustment History */}
            <section className="rounded-2xl border border-indigo-500/10 bg-[var(--bg-primary)]/95 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-[var(--glass-border)] px-4 py-2.5">
                <p className="text-[12px] font-semibold">Adjustment History</p>
                <span className="rounded-full bg-[var(--bg-secondary)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                  {historyTotal} adjustments
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-20">
                  <Loader2 className="size-8 animate-spin text-indigo-600" />
                  <p className="text-[11px] text-[var(--text-secondary)]">Loading adjustments...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="px-6 py-20 text-center">
                  <Scale className="mx-auto mb-3 size-9 text-[var(--text-secondary)]/35" />
                  <p className="text-sm font-medium text-[var(--text-secondary)]">No balance adjustments yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--glass-border)]">
                  {history.map(tx => (
                    <div key={tx._id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-secondary)]/20 transition-colors">
                      <div className={`size-8 shrink-0 rounded-lg flex items-center justify-center border ${
                        tx.metadata?.operation === 'credit'
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : 'bg-rose-500/10 border-rose-500/20'
                      }`}>
                        {tx.metadata?.operation === 'credit'
                          ? <ArrowUpCircle className="size-3.5 text-emerald-500" />
                          : <ArrowDownCircle className="size-3.5 text-rose-500" />
                        }
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-semibold text-[var(--text-primary)] truncate">
                          {tx.user_id?.name || 'Unknown User'}
                        </p>
                        <p className="text-[9px] text-[var(--text-secondary)] opacity-60 truncate">
                          {tx.metadata?.reason || tx.description} &middot; by {tx.metadata?.admin_name || 'Admin'} &middot; {new Date(tx.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <p className={`text-[12px] font-bold tabular-nums shrink-0 ${
                        tx.metadata?.operation === 'credit' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {tx.metadata?.operation === 'credit' ? '+' : '-'}{(tx.amount || 0).toLocaleString()} XAF
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {historyPages > 1 && !loading && (
                <div className="border-t border-[var(--glass-border)] bg-[var(--bg-secondary)]/15 px-2 py-2 sm:px-4 sm:py-3">
                  <Pagination page={historyPage} pages={historyPages} onPageChange={setHistoryPage} />
                </div>
              )}
            </section>
          </div>
        </div>
      </AdminFinanceBody>
    </AdminFinancePage>
  );
}
