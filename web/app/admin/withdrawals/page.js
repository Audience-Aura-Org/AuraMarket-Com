"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, XCircle, Loader2, RefreshCw, ChevronRight,
  RotateCcw, Copy, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import api from '@/services/api';
import { fmt, STATUS_CONFIG, getMethodIcon } from '@/utils/adminFinance';
import Pagination from '@/components/common/Pagination';
import {
  AdminFinancePage,
  AdminFinanceHeader,
  AdminFinanceBody,
  AdminFinanceSplit,
  AdminSidebarCard,
  AdminMetricStrip,
  AdminAlertBanner,
  AdminFilterToolbar,
  AdminFilterSearch,
  AdminFilterSelect,
  AdminFilterPills,
  AdminListPanel,
} from '@/components/admin/AdminFinanceLayout';

const STATUS = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([k, v]) => [
    k,
    { cls: `${v.bg} ${v.color} ${v.border}`, icon: v.icon },
  ])
);

const STATUS_TABS = ['all', 'pending', 'approved', 'completed', 'rejected', 'failed'];

function getRequesterProfile(withdrawal) {
  const profile = withdrawal?.requesterProfile || {};
  const person = withdrawal?.requestedBy || {};
  const branding = person.branding || {};
  const recipient = withdrawal?.recipientDetails || {};
  const recipientName = [recipient.firstName, recipient.lastName].filter(Boolean).join(' ');
  const name =
    profile.name ||
    profile.storeName ||
    branding.store_name ||
    branding.storeName ||
    person.store_name ||
    person.storeName ||
    person.name ||
    recipientName ||
    person.email ||
    `${withdrawal?.role || 'User'} account`;
  const logo =
    profile.logo ||
    profile.avatar ||
    profile.image ||
    branding.logo ||
    branding.logo_url ||
    branding.logoUrl ||
    branding.avatar ||
    branding.avatar_url ||
    branding.avatarUrl ||
    person.avatar ||
    null;
  const contact =
    profile.email || profile.phone || person.email || person.phone || recipient.phoneNumber || '—';
  const initial = String(name || 'A').trim().charAt(0).toUpperCase();

  return {
    name,
    logo,
    contact,
    initial,
    accountName: profile.accountName || person.name || recipientName || name,
    storeName: profile.storeName || null,
    role: profile.role || person.role || withdrawal?.role,
  };
}

export default function AdminWithdrawalsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [processing, setProc] = useState(null);
  const [selected, setSelected] = useState(null);
  const [approveGateway, setApproveGateway] = useState('mesomb');
  const [currentPage, setCurrentPage] = useState(1);
  const [brokenRequesterImages, setBrokenRequesterImages] = useState({});
  const itemsPerPage = 10;

  useEffect(() => {
    if (!user) {
      router.replace('/login?from=admin-withdrawals');
      return;
    }
    if (user.role !== 'admin') router.replace('/wallet');
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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, roleFilter, search]);

  useEffect(() => {
    if (!selected) return;
    setApproveGateway(
      selected.payoutGateway || (selected.withdrawalMethod === 'mesomb' ? 'mesomb' : 'eversend')
    );
  }, [selected]);

  const handleApprove = async (id) => {
    setProc('approve');
    try {
      const res = await api.post(`/withdrawals/admin/${id}/approve`, { payoutGateway: approveGateway });
      toast.success(res.data.message || `Approved via ${approveGateway}.`);
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Approval failed.');
    } finally {
      setProc(null);
    }
  };

  const handleReject = async (id, reason) => {
    if (!reason || reason.trim().length < 5) {
      toast.error('Rejection reason must be at least 5 characters.');
      return;
    }
    setProc('reject');
    try {
      await api.post(`/withdrawals/admin/${id}/reject`, { rejectionReason: reason });
      toast.success('Withdrawal rejected.');
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Rejection failed.');
    } finally {
      setProc(null);
    }
  };

  const handleRecheck = async (id) => {
    setProc('recheck');
    try {
      const res = await api.post(`/withdrawals/admin/${id}/recheck`);
      toast.success(res.data.message || 'Status synced.');
      load();
      setSelected((prev) => (prev ? { ...prev, ...res.data.data?.withdrawal } : null));
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Recheck failed.');
    } finally {
      setProc(null);
    }
  };

  const displayed = withdrawals.filter((w) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const requester = getRequesterProfile(w);
    return (
      requester.name.toLowerCase().includes(q) ||
      requester.contact.toLowerCase().includes(q) ||
      (w._id || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(displayed.length / itemsPerPage));
  const pageItems = displayed.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const selectedRequester = selected ? getRequesterProfile(selected) : null;
  const flaggedCount = withdrawals.filter((w) =>
    ['failed', 'processing_error'].includes(w.status)
  ).length;

  if (!user || user.role !== 'admin') return null;

  return (
    <>
      <AdminFinancePage theme="withdrawals">
        <AdminFinanceHeader
          theme="withdrawals"
          icon={Wallet}
          title="Payout queue"
          description="Approve vendor, logistics, and customer withdrawals"
          badge={pendingCount > 0 ? `${pendingCount} pending` : null}
          onRefresh={load}
          loading={loading}
        />

        <AdminFinanceBody>
          <AdminMetricStrip
            theme="withdrawals"
            metrics={[
              { label: 'Pending', value: pendingCount },
              { label: 'In view', value: displayed.length },
              { label: 'Approved', value: withdrawals.filter((w) => w.status === 'approved').length },
              { label: 'Issues', value: flaggedCount },
            ]}
          />

          {pendingCount > 0 && filter !== 'pending' && (
            <AdminAlertBanner
              theme="withdrawals"
              onAction={() => setFilter('pending')}
              actionLabel="Show pending"
            >
              {pendingCount} withdrawal{pendingCount === 1 ? '' : 's'} waiting for review
            </AdminAlertBanner>
          )}

          <AdminFinanceSplit
            sidebar={
              <AdminSidebarCard title="Status" theme="withdrawals">
                <AdminFilterPills
                  theme="withdrawals"
                  layout="vertical"
                  items={STATUS_TABS.map((tab) => ({
                    id: tab,
                    label: tab,
                    badge: tab === 'pending' ? pendingCount : undefined,
                  }))}
                  value={filter}
                  onChange={setFilter}
                />
              </AdminSidebarCard>
            }
          >
            <AdminListPanel
              theme="withdrawals"
              variant="queue"
              title="Requests"
              countLabel={`${displayed.length} shown`}
              loading={loading}
              loadingMessage="Loading payout queue…"
              isEmpty={!loading && pageItems.length === 0}
              emptyIcon={Wallet}
              emptyMessage="No withdrawals match your filters."
              emptyAction={
                filter !== 'all' ? (
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="mt-3 text-[11px] font-semibold text-emerald-600"
                  >
                    Clear filters
                  </button>
                ) : null
              }
              footer={
                !loading && displayed.length > 0 ? (
                  <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
                ) : null
              }
              filterSlot={
                <>
                  <AdminFilterToolbar>
                    <AdminFilterSearch
                      theme="withdrawals"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search name, contact, or ID"
                    />
                    <AdminFilterSelect
                      theme="withdrawals"
                      value={roleFilter}
                      onChange={(e) => setRoleFilter(e.target.value)}
                      className="sm:min-w-[140px]"
                    >
                      <option value="all">All roles</option>
                      <option value="vendor">Vendor</option>
                      <option value="logistics">Logistics</option>
                      <option value="user">Customer</option>
                    </AdminFilterSelect>
                  </AdminFilterToolbar>
                  <div className="lg:hidden">
                    <AdminFilterPills
                      theme="withdrawals"
                      items={STATUS_TABS.map((tab) => ({
                        id: tab,
                        label: tab,
                        badge: tab === 'pending' ? pendingCount : undefined,
                      }))}
                      value={filter}
                      onChange={setFilter}
                    />
                  </div>
                </>
              }
            >
              {pageItems.map((w) => {
                const S = STATUS[w.status] || STATUS.pending;
                const MIcon = getMethodIcon(w.withdrawalMethod) || Wallet;
                const requester = getRequesterProfile(w);
                const isPending = w.status === 'pending';

                return (
                  <button
                    key={w._id}
                    type="button"
                    onClick={() => setSelected(w)}
                    className={`group flex w-full flex-col gap-2 rounded-2xl border p-3 text-left transition sm:flex-row sm:items-center sm:gap-4 sm:p-3.5 ${
                      isPending
                        ? 'border-emerald-500/25 bg-emerald-500/[0.06] hover:border-emerald-500/40'
                        : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 hover:border-emerald-500/20 hover:bg-[var(--bg-secondary)]/35'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="relative shrink-0">
                        <div className="size-11 overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-primary)]">
                          {requester.logo ? (
                            <img src={requester.logo} alt="" className="size-full object-cover" />
                          ) : (
                            <span className="flex size-full items-center justify-center bg-emerald-500/10 text-sm font-semibold text-emerald-600">
                              {requester.initial}
                            </span>
                          )}
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-[var(--bg-primary)] ${
                            isPending ? 'bg-amber-400' : 'bg-[var(--text-secondary)]/40'
                          }`}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-[13px] font-semibold group-hover:text-emerald-600">
                            {requester.name}
                          </p>
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${S.cls}`}
                          >
                            {w.status}
                          </span>
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-[var(--text-secondary)]">
                          <span className="capitalize">{w.role}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5 capitalize">
                            <MIcon className="size-3" />
                            {w.withdrawalMethod}
                          </span>
                          <span>·</span>
                          <span className="font-mono">#{w._id.slice(-6).toUpperCase()}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:shrink-0 sm:flex-col sm:items-end sm:justify-center">
                      <div className="rounded-xl bg-[var(--bg-primary)] px-3 py-1.5 text-right shadow-sm">
                        <p className="text-[14px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                          {fmt(w.amount)}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          {w.currency} ·{' '}
                          {new Date(w.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      </div>
                      <ChevronRight className="size-4 text-[var(--text-secondary)] group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                    </div>
                  </button>
                );
              })}
            </AdminListPanel>
          </AdminFinanceSplit>
        </AdminFinanceBody>
      </AdminFinancePage>

      <AnimatePresence>
        {selected && (
          <div className="fixed inset-0 z-[1000] flex items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-emerald-500/20 bg-[var(--bg-primary)] shadow-2xl sm:rounded-2xl"
            >
              <div className="h-1 shrink-0 bg-gradient-to-r from-emerald-500/80 via-emerald-400/50 to-transparent" />
              <div className="flex shrink-0 items-start justify-between border-b border-[var(--glass-border)] p-4">
                <div>
                  <h2 className="text-base font-semibold">Review payout</h2>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    #{selected._id.slice(-8).toUpperCase()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
                >
                  <XCircle className="size-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="flex items-center gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-3">
                  <div className="size-11 shrink-0 overflow-hidden rounded-full border border-[var(--glass-border)] bg-[var(--bg-primary)]">
                    {selectedRequester?.logo && !brokenRequesterImages[selected._id] ? (
                      <img
                        src={selectedRequester.logo}
                        alt=""
                        className="size-full object-cover"
                        onError={() =>
                          setBrokenRequesterImages((prev) => ({ ...prev, [selected._id]: true }))
                        }
                      />
                    ) : (
                      <span className="flex size-full items-center justify-center text-sm font-semibold text-[var(--accent)]">
                        {selectedRequester?.initial}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold">{selectedRequester?.name}</p>
                    <p className="truncate text-[11px] text-[var(--text-secondary)]">
                      {selectedRequester?.contact}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)] capitalize">
                      {selectedRequester?.role || selected.role}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{fmt(selected.amount)}</p>
                    <p className="text-[10px] text-[var(--text-secondary)]">{selected.currency}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[var(--glass-border)] p-3">
                    <p className="text-[10px] text-[var(--text-secondary)]">Method</p>
                    <p className="mt-1 text-[12px] font-semibold capitalize">{selected.withdrawalMethod}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--glass-border)] p-3">
                    <p className="text-[10px] text-[var(--text-secondary)]">Status</p>
                    <p className="mt-1 text-[12px] font-semibold capitalize">{selected.status}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--glass-border)] p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)]">Recipient</p>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--text-secondary)]">Name</span>
                    <span>
                      {(selected.recipientDetails || {}).firstName}{' '}
                      {(selected.recipientDetails || {}).lastName}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--text-secondary)]">Country</span>
                    <span>{(selected.recipientDetails || {}).country || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-[var(--text-secondary)]">Endpoint</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[11px] text-[var(--accent)]">
                        {(selected.recipientDetails || {}).phoneNumber ||
                          (selected.recipientDetails || {}).accountNumber ||
                          (selected.recipientDetails || {}).eversendTag ||
                          '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const val =
                            (selected.recipientDetails || {}).phoneNumber ||
                            (selected.recipientDetails || {}).accountNumber ||
                            (selected.recipientDetails || {}).eversendTag ||
                            '';
                          if (val) navigator.clipboard.writeText(val);
                        }}
                        className="rounded p-1 hover:bg-[var(--bg-secondary)]"
                      >
                        <Copy className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {(selected.rejectionReason || selected.failureReason) && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                      <AlertCircle className="size-3.5" /> Note
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {selected.rejectionReason || selected.failureReason}
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-[var(--glass-border)] p-4 space-y-2">
                {selected.status === 'pending' && (
                  <>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">Payout gateway</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'mesomb', label: 'MeSomb' },
                        { id: 'eversend', label: 'Eversend' },
                      ].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setApproveGateway(g.id)}
                          className={`rounded-lg border p-2.5 text-[11px] font-semibold transition ${
                            approveGateway === g.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                              : 'border-[var(--glass-border)]'
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApprove(selected._id)}
                      disabled={!!processing}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-[12px] font-semibold text-white disabled:opacity-50"
                    >
                      {processing === 'approve' ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-4" />
                      )}
                      Approve via {approveGateway}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleReject(selected._id, prompt('Rejection reason (required):') || '')
                      }
                      disabled={!!processing}
                      className="h-10 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 text-[12px] font-semibold text-rose-600"
                    >
                      Reject
                    </button>
                  </>
                )}
                {(selected.status === 'approved' || selected.status === 'processing_error') && (
                  <button
                    type="button"
                    onClick={() => handleRecheck(selected._id)}
                    disabled={!!processing}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-[12px] font-semibold text-white disabled:opacity-50"
                  >
                    {processing === 'recheck' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="size-4" />
                    )}
                    Sync status
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
