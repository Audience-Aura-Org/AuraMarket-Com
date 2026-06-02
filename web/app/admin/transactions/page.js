'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import {
  CreditCard, Clock, User, RotateCcw, ChevronDown,
  Mail, Phone, Database, Loader2, Zap, Globe,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Pagination from '@/components/common/Pagination';
import { fmt, STATUS_CONFIG, TYPE_CONFIG } from '@/utils/adminFinance';
import {
  AmountDateColumn,
  GatewayBrand,
  PartyAvatar,
  getTransactionParty,
} from '@/components/admin/FinanceRowDisplay';
import {
  AdminFinancePage,
  AdminFinanceHeader,
  AdminFinanceBody,
  AdminMetricGrid,
  AdminFilterToolbar,
  AdminFilterSearch,
  AdminFilterSelect,
  AdminFilterPills,
  AdminFilterButton,
  AdminFilterRow,
  AdminListPanel,
  AdminLedgerTableHeader,
} from '@/components/admin/AdminFinanceLayout';

const GATEWAYS = ['eversend', 'mesomb', 'wallet', 'manual', 'paystack'];
const STATUS_FILTERS = ['all', 'completed', 'pending', 'failed'];

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [gatewayFilter, setGatewayFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [stats, setStats] = useState(null);
  const [gatewaySyncing, setGatewaySyncing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [recoveringId, setRecoveringId] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        status: statusFilter,
        type: typeFilter,
        search,
        ...(gatewayFilter !== 'all' && { gateway: gatewayFilter }),
      };
      const res = await api.get('/admin/transactions', { params });
      if (res.data?.success) {
        setTransactions(res.data.data.transactions || []);
        setTotalPages(Math.max(1, Math.ceil((res.data.total || 0) / 50)));
      }
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, typeFilter, gatewayFilter, search]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/admin/analytics');
      if (res.data.success) {
        const d = res.data.data;
        setStats(d?.stats || d?.payout_intel || d || null);
      }
    } catch {
      console.error('Failed to fetch platform metrics');
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSearchSubmit = () => {
    setCurrentPage(1);
    fetchTransactions();
  };

  const handleGatewaySync = async () => {
    setGatewaySyncing(true);
    try {
      const res = await api.post('/admin/transactions/sync-gateways');
      if (res.data.success) {
        const { eversendImported = 0, mesombUpdated = 0, eversendUpdated = 0 } = res.data;
        toast.success(
          res.data.message ||
            `Sync done — Eversend: ${eversendImported} imported, ${eversendUpdated} updated; MeSomb: ${mesombUpdated} updated.`
        );
        fetchTransactions();
        fetchStats();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gateway sync failed');
    } finally {
      setGatewaySyncing(false);
    }
  };

  const handleUpdateStatus = async (txId, newStatus) => {
    const admin_note = window.prompt(
      `Mark as ${newStatus}? Enter reason (wallet/order effects may apply):`,
      'Administrative correction'
    );
    if (admin_note === null) return;

    setUpdatingStatus(txId);
    try {
      const res = await api.patch(`/admin/transactions/manual-fix/${txId}`, {
        status: newStatus,
        admin_note,
      });
      if (res.data.success) {
        toast.success(`Updated to ${newStatus}`);
        fetchTransactions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleFulfillOrders = async (txId) => {
    setSyncing(txId);
    try {
      const res = await api.post(`/admin/transactions/${txId}/fulfill`);
      if (res.data.success) {
        toast.success(res.data.message || 'Orders fulfilled');
        fetchTransactions();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fulfillment failed');
    } finally {
      setSyncing(null);
    }
  };

  const handleRecoverPayment = async (tx) => {
    const confirmed = window.confirm(
      `Recover payment for ${tx.reference}?\n\nThis re-checks the gateway and credits ${fmt(tx.amount)} XAF if confirmed.`
    );
    if (!confirmed) return;

    setRecoveringId(tx._id);
    try {
      const res = await api.post(`/payments/eversend/recover/${tx.reference}`);
      if (res.data.success) {
        toast.success(res.data.message);
        fetchTransactions();
      } else {
        const forceIt = window.confirm(
          `${res.data.message}\n\nForce recover anyway? Only if you confirmed receipt in Eversend.`
        );
        if (forceIt) {
          const forceRes = await api.post(`/payments/eversend/recover/${tx.reference}`, { force: true });
          if (forceRes.data.success) {
            toast.success(forceRes.data.message);
            fetchTransactions();
          } else {
            toast.error(forceRes.data.message || 'Force recovery failed');
          }
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Recovery failed';
      if (err.response?.status === 400) {
        const forceIt = window.confirm(`${msg}\n\nForce recover anyway?`);
        if (forceIt) {
          try {
            const forceRes = await api.post(`/payments/eversend/recover/${tx.reference}`, { force: true });
            if (forceRes.data.success) {
              toast.success(forceRes.data.message);
              fetchTransactions();
            } else {
              toast.error(forceRes.data.message || 'Force recovery failed');
            }
          } catch (forceErr) {
            toast.error(forceErr.response?.data?.message || 'Force recovery failed');
          }
        }
      } else {
        toast.error(msg);
      }
    } finally {
      setRecoveringId(null);
    }
  };

  return (
    <AdminFinancePage theme="transactions">
      <AdminFinanceHeader
        theme="transactions"
        icon={CreditCard}
        title="Payment ledger"
        description="Escrow, deposits, and platform revenue"
        badge={
          <>
            <span className="sm:hidden">{transactions.length}</span>
            <span className="hidden sm:inline">{transactions.length} on page</span>
          </>
        }
        onRefresh={fetchTransactions}
        loading={loading}
      />

      <AdminFinanceBody>
        <AdminMetricGrid
          theme="transactions"
          metrics={[
            { label: 'Escrow held', value: stats ? `${fmt(stats.escrow_held)}` : '…', hint: 'XAF' },
            { label: 'Released', value: stats ? `${fmt(stats.escrow_released)}` : '…', hint: 'XAF' },
            { label: 'Disputed', value: stats ? `${fmt(stats.escrow_disputed)}` : '…', hint: 'XAF' },
            { label: 'Revenue', value: stats ? `${fmt(stats.revenue)}` : '…', hint: 'XAF' },
            { label: 'This page', value: String(transactions.length), hint: 'transactions' },
          ]}
        />

        <AdminListPanel
          theme="transactions"
          variant="ledger"
          title="Ledger entries"
          countLabel={
            <>
              <span className="sm:hidden">Pg {currentPage}</span>
              <span className="hidden sm:inline">Page {currentPage} · 50 per page</span>
            </>
          }
          loading={loading}
          loadingMessage="Loading ledger…"
          isEmpty={!loading && transactions.length === 0}
          emptyIcon={CreditCard}
          emptyMessage="No transactions match your filters."
          listHeader={
            <AdminLedgerTableHeader columns={['Transaction', 'Amount & date', 'Gateway', '']} />
          }
          footer={
            !loading && transactions.length > 0 ? (
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
                  theme="transactions"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onSubmit={handleSearchSubmit}
                  placeholder="Reference or gateway ID"
                />
                <AdminFilterRow>
                  <AdminFilterSelect
                    theme="transactions"
                    value={typeFilter}
                    onChange={(e) => {
                      setTypeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All types</option>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </AdminFilterSelect>
                  <AdminFilterSelect
                    theme="transactions"
                    value={gatewayFilter}
                    onChange={(e) => {
                      setGatewayFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All gateways</option>
                    {GATEWAYS.map((g) => (
                      <option key={g} value={g}>
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </option>
                    ))}
                  </AdminFilterSelect>
                </AdminFilterRow>
                <AdminFilterButton
                  theme="transactions"
                  onClick={handleGatewaySync}
                  disabled={gatewaySyncing}
                  variant="primary"
                >
                  {gatewaySyncing ? <Loader2 className="size-3.5 animate-spin" /> : <Globe className="size-3.5" />}
                  Sync gateways
                </AdminFilterButton>
              </AdminFilterToolbar>
              <AdminFilterPills
                theme="transactions"
                items={STATUS_FILTERS}
                value={statusFilter}
                onChange={(s) => {
                  setStatusFilter(s);
                  setCurrentPage(1);
                }}
              />
            </>
          }
        >
          {transactions.map((tx, idx) => {
            const status = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
            const type = TYPE_CONFIG[tx.type] || TYPE_CONFIG.payment;
            const isExpanded = expandedId === tx._id;
            const TypeIcon = type.icon;
            const party = getTransactionParty(tx);

            return (
              <div
                key={tx._id}
                className={`transition ${
                  isExpanded ? 'bg-indigo-500/[0.06]' : idx % 2 === 1 ? 'bg-[var(--bg-secondary)]/15' : ''
                }`}
              >
                <button
                  type="button"
                  className="w-full text-left active:bg-[var(--bg-secondary)]/30"
                  onClick={() => setExpandedId(isExpanded ? null : tx._id)}
                >
                  {/* Mobile: compact single-row card */}
                  <div className="flex items-center gap-2.5 px-2.5 py-2.5 sm:hidden">
                    <PartyAvatar
                      src={party.logo}
                      initial={party.initial}
                      alt={party.name}
                      badge={
                        <GatewayBrand
                          gateway={tx.gateway}
                          className="ring-2 ring-[var(--bg-primary)]"
                        />
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold capitalize">
                          {tx.type?.replace(/_/g, ' ')}
                        </span>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-semibold uppercase ${status.bg} ${status.color}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[9px] text-indigo-600 dark:text-indigo-400">
                        #{tx.reference?.slice(-8).toUpperCase()}
                      </p>
                      <p className="mt-0.5 truncate text-[9px] text-[var(--text-secondary)]">{party.name}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <AmountDateColumn
                        compact
                        amount={tx.amount}
                        currency={tx.currency || 'XAF'}
                        createdAt={tx.createdAt}
                        amountClassName="text-indigo-900 dark:text-indigo-200"
                      />
                      <ChevronDown
                        className={`size-4 text-[var(--text-secondary)] transition ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`}
                      />
                    </div>
                  </div>

                  {/* Desktop: ledger grid */}
                  <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_120px_110px_36px] sm:items-center sm:gap-3 sm:px-4 sm:py-2.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <PartyAvatar
                        src={party.logo}
                        initial={party.initial}
                        alt={party.name}
                        badge={
                          <GatewayBrand
                            gateway={tx.gateway}
                            className="ring-2 ring-[var(--bg-primary)]"
                          />
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[12px] font-semibold capitalize">
                            {tx.type?.replace(/_/g, ' ')}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-semibold uppercase ${status.bg} ${status.color}`}
                          >
                            <TypeIcon className="size-3" />
                            {status.label}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-indigo-600 dark:text-indigo-400">
                          #{tx.reference?.slice(-10).toUpperCase()}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--text-secondary)]">
                          {party.name} · {tx.description || '—'}
                        </p>
                      </div>
                    </div>

                    <AmountDateColumn
                      amount={tx.amount}
                      currency={tx.currency || 'XAF'}
                      createdAt={tx.createdAt}
                      amountClassName="text-indigo-900 dark:text-indigo-200"
                    />

                    <div className="flex items-center justify-center">
                      <GatewayBrand gateway={tx.gateway} size="md" />
                    </div>

                    <div className="flex items-center justify-center">
                      <ChevronDown
                        className={`size-4 text-[var(--text-secondary)] transition ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`}
                      />
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-indigo-500/15 bg-[var(--bg-primary)]/50"
                    >
                      <div className="grid gap-2.5 p-2.5 sm:grid-cols-2 sm:gap-3 sm:p-4">
                        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-3 space-y-2">
                          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                            <Database className="size-3.5" /> Transaction data
                          </p>
                          <div className="text-[11px]">
                            <span className="text-[var(--text-secondary)]">Reference </span>
                            <span className="font-mono">{tx.reference}</span>
                          </div>
                          <div className="text-[11px]">
                            <span className="text-[var(--text-secondary)]">Gateway ID </span>
                            <span className="font-mono">{tx.gateway_transaction_id || '—'}</span>
                          </div>
                          <p className="inline-flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
                            <Clock className="size-3" />
                            {new Date(tx.createdAt).toLocaleString()}
                          </p>
                          {tx.order_ids?.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {tx.order_ids.map((oid) => (
                                <span
                                  key={oid}
                                  className="rounded-md bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] text-indigo-700 dark:text-indigo-300"
                                >
                                  #{String(oid).slice(-8).toUpperCase()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-2.5 rounded-xl border border-[var(--glass-border)] p-3">
                            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--glass-border)] bg-[var(--bg-secondary)]">
                              {tx.user_id?.avatar ? (
                                <img src={tx.user_id.avatar} alt="" className="size-full object-cover" />
                              ) : (
                                <User className="size-4 text-[var(--text-secondary)]" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-semibold">{tx.user_id?.name || 'User'}</p>
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                                <Mail className="size-3 shrink-0" />
                                <span className="truncate">{tx.user_id?.email || '—'}</span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)]">
                                <Phone className="size-3 shrink-0" />
                                <span>{tx.user_id?.phone || '—'}</span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-[var(--glass-border)] p-3">
                            <p className="mb-2 text-[11px] font-semibold text-[var(--text-secondary)]">
                              Update status
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {['completed', 'pending', 'failed'].map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => handleUpdateStatus(tx._id, s)}
                                  disabled={updatingStatus === tx._id || tx.status === s}
                                  className="rounded-lg border border-[var(--glass-border)] px-2.5 py-1.5 text-[10px] font-medium capitalize hover:border-indigo-500/30 disabled:opacity-40"
                                >
                                  {updatingStatus === tx._id ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    s
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>

                          {tx.gateway === 'eversend' &&
                            ['failed', 'pending'].includes(tx.status) &&
                            tx.type === 'deposit' && (
                              <button
                                type="button"
                                onClick={() => handleRecoverPayment(tx)}
                                disabled={recoveringId === tx._id}
                                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-[11px] font-semibold text-white disabled:opacity-50"
                              >
                                {recoveringId === tx._id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="size-3.5" />
                                )}
                                Recover {fmt(tx.amount)} XAF
                              </button>
                            )}

                          {tx.status === 'completed' && tx.order_ids?.length > 0 && (
                            <button
                              type="button"
                              onClick={() => handleFulfillOrders(tx._id)}
                              disabled={syncing === tx._id}
                              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-[11px] font-semibold text-white disabled:opacity-50"
                            >
                              {syncing === tx._id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Zap className="size-3.5" />
                              )}
                              Fulfill linked orders
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
        </AdminListPanel>
      </AdminFinanceBody>
    </AdminFinancePage>
  );
}
