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
import { STATUS_CONFIG } from '@/utils/adminFinance';
import { AmountDateColumn, GatewayBrand, PartyAvatar } from '@/components/admin/FinanceRowDisplay';
import Pagination from '@/components/common/Pagination';
import StatCard from '@/components/layout/StatCard';
import {
  AdminFinancePage,
  AdminFinanceHeader,
  AdminFinanceBody,
  AdminFinanceSplit,
  AdminSidebarCard,
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
  const person = withdrawal?.requested_by || {};
  const branding = person.branding || {};
  const recipient = withdrawal?.recipient_details || {};
  const recipientName = [recipient.first_name, recipient.last_name].filter(Boolean).join(' ');
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
    profile.email || profile.phone || person.email || person.phone || recipient.phone_number || '—';
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
  const { user, hasHydrated } = useAuthStore();
  const router = useRouter();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [processing, setProc] = useState(null);
  const [selected, setSelected] = useState(null);
  const [approveGateway, setApproveGateway] = useState('pawapay');
  const [currentPage, setCurrentPage] = useState(1);
  const [brokenRequesterImages, setBrokenRequesterImages] = useState({});
  const itemsPerPage = 10;

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      router.replace('/login?from=admin-withdrawals');
      return;
    }
    if (user.role !== 'admin') router.replace('/wallet');
  }, [user, router, hasHydrated]);

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
    if (!hasHydrated || user?.role !== 'admin') return;
    load();
  }, [hasHydrated, load, user?.role]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, roleFilter, search]);

  useEffect(() => {
    if (!selected) return;
    setApproveGateway('pawapay');
  }, [selected]);

  const handleApprove = async (id) => {
    setProc('approve');
    try {
      const res = await api.post(`/withdrawals/admin/${id}/approve`, { payout_gateway: approveGateway });
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
      await api.post(`/withdrawals/admin/${id}/reject`, { rejection_reason: reason });
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

  const handleCompleteManual = async (id) => {
    setProc('complete');
    try {
      const res = await api.post(`/withdrawals/admin/${id}/complete`, {
        note: 'PayUnit cashout confirmed from admin dashboard.',
      });
      toast.success(res.data.message || 'Withdrawal marked completed.');
      load();
      setSelected((prev) => (prev ? { ...prev, ...res.data.data?.withdrawal } : null));
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Could not complete withdrawal.');
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
          {(() => {
            const approved   = withdrawals.filter(w => w.status === 'approved').length;
            const total      = withdrawals.length || 1;
            const pendingPct = Math.min(pendingCount * 5, 100);
            const approvedPct = Math.round((approved / total) * 100);
            const issuePct   = Math.min(flaggedCount * 10, 100);
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <StatCard label="Pending" value={pendingCount} icon={CheckCircle2} color="amber" sub="Awaiting review" progress={pendingPct} footer={pendingCount > 0 ? `${pendingCount} need action` : 'Queue clear'} />
                <StatCard label="In view" value={displayed.length} icon={Wallet} color="primary" sub="Currently filtered" progress={Math.min(Math.round((displayed.length / total) * 100), 100)} footer={`${displayed.length} shown`} />
                <StatCard label="Approved" value={approved} icon={CheckCircle2} color="emerald" sub="Processed" progress={approvedPct} footer={`${approvedPct}% approved`} />
                <StatCard label="Issues" value={flaggedCount} icon={AlertCircle} color="rose" sub="Failed / errors" progress={issuePct} footer={flaggedCount > 0 ? `${flaggedCount} flagged` : 'All clear'} />
              </div>
            );
          })()}

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
                  <Pagination
                    compact
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                  />
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
                const requester = getRequesterProfile(w);
                const isPending = w.status === 'pending';
                const payoutGateway = w.payout_gateway || w.withdrawal_method;

                return (
                  <button
                    key={w._id}
                    type="button"
                    onClick={() => setSelected(w)}
                    className={`group flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition active:scale-[0.99] sm:gap-4 sm:rounded-2xl sm:p-3.5 ${
                      isPending
                        ? 'border-emerald-500/25 bg-emerald-500/[0.06] hover:border-emerald-500/40'
                        : 'border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 hover:border-emerald-500/20 hover:bg-[var(--bg-secondary)]/35'
                    }`}
                  >
                    <PartyAvatar
                      src={requester.logo}
                      initial={requester.initial}
                      alt={requester.name}
                      size="lg"
                      badge={
                        <GatewayBrand
                          gateway={payoutGateway}
                          method={w.withdrawal_method}
                          size="sm"
                          className="ring-2 ring-[var(--bg-primary)]"
                        />
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <p className="truncate text-[12px] font-semibold group-hover:text-emerald-600 sm:text-[13px]">
                              {requester.name}
                            </p>
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-semibold uppercase sm:text-[9px] ${S.cls}`}
                            >
                              {w.status}
                            </span>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px] text-[var(--text-secondary)] sm:gap-1.5 sm:text-[10px]">
                            <span className="capitalize">{w.role}</span>
                            <span className="hidden opacity-40 sm:inline">·</span>
                            <span className="hidden capitalize sm:inline">{w.withdrawal_method}</span>
                            <span className="font-mono">#{w._id.slice(-6).toUpperCase()}</span>
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 sm:hidden">
                          <AmountDateColumn
                            compact
                            amount={w.amount}
                            currency={w.currency}
                            createdAt={w.createdAt}
                            amountClassName="text-emerald-700 dark:text-emerald-400"
                          />
                          <ChevronRight className="size-4 text-[var(--text-secondary)]" />
                        </div>
                      </div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-2 sm:flex">
                      <AmountDateColumn
                        amount={w.amount}
                        currency={w.currency}
                        createdAt={w.createdAt}
                        amountClassName="text-emerald-700 dark:text-emerald-400"
                      />
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
              className="relative flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-emerald-500/20 bg-[var(--bg-primary)] shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl"
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-[var(--glass-border)] sm:hidden" />
              <div className="h-1 shrink-0 bg-gradient-to-r from-emerald-500/80 via-emerald-400/50 to-transparent" />
              <div className="flex shrink-0 items-start justify-between border-b border-[var(--glass-border)] p-3 sm:p-4">
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

              <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-3 sm:p-4 sm:space-y-4">
                <div className="flex flex-col gap-3 rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 p-3 sm:flex-row sm:items-center">
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
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold tabular-nums">
                      {Number(selected.amount || 0).toLocaleString('fr-CM')}{' '}
                      <span className="text-[11px] font-medium text-[var(--text-secondary)]">{selected.currency}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[var(--glass-border)] p-3">
                    <p className="text-[10px] text-[var(--text-secondary)]">Method</p>
                    <p className="mt-1 text-[12px] font-semibold capitalize">{selected.withdrawal_method}</p>
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
                      {(selected.recipient_details || {}).first_name}{' '}
                      {(selected.recipient_details || {}).last_name}
                    </span>
                  </div>
                  <div className="flex justify-between text-[12px]">
                    <span className="text-[var(--text-secondary)]">Country</span>
                    <span>{(selected.recipient_details || {}).country || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="text-[var(--text-secondary)]">Endpoint</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[11px] text-[var(--accent)]">
                        {(selected.recipient_details || {}).phone_number ||
                          (selected.recipient_details || {}).account_number ||
                          (selected.recipient_details || {}).eversend_tag ||
                          '—'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const val =
                            (selected.recipient_details || {}).phone_number ||
                            (selected.recipient_details || {}).account_number ||
                            (selected.recipient_details || {}).eversend_tag ||
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

                {(selected.rejection_reason || selected.failure_reason) && (
                  <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                      <AlertCircle className="size-3.5" /> Note
                    </p>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      {selected.rejection_reason || selected.failure_reason}
                    </p>
                  </div>
                )}
              </div>

              <div className="shrink-0 space-y-2 border-t border-[var(--glass-border)] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4">
                {selected.status === 'pending' && (
                  <>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">Payout gateway</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'pawapay',  label: 'PawaPay',  min: '100 XAF min'   },
                        { id: 'payunit',  label: 'PayUnit',  min: '5,000 XAF min' },
                        { id: 'eversend', label: 'Eversend', min: '1,000 XAF min' },
                      ].map((g) => (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setApproveGateway(g.id)}
                          className={`rounded-lg border p-2.5 text-left transition ${
                            approveGateway === g.id
                              ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                              : 'border-[var(--glass-border)]'
                          }`}
                        >
                          <p className="text-[11px] font-semibold">{g.label}</p>
                          <p className="text-[9px] opacity-60 mt-0.5">{g.min}</p>
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
                      Approve
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
                  <div className="space-y-2">
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
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
