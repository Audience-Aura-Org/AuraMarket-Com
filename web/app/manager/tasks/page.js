'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, RefreshCw, ChevronRight, Filter,
  Package, Truck, MessageSquare, ShieldCheck, Scale,
  Inbox, Clock, ExternalLink, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';

/* ── type config ─────────────────────────────────────────────── */

const TYPE_STYLES = {
  order:    { color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20',    label: 'Order',    icon: Package },
  shipment: { color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/20',  label: 'Shipment', icon: Truck },
  message:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Message',  icon: MessageSquare },
  kyc:      { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   label: 'KYC',      icon: ShieldCheck },
  dispute:  { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20',    label: 'Dispute',  icon: Scale },
};

const FILTER_TYPES = [
  { key: null,        label: 'All' },
  { key: 'order',     label: 'Orders' },
  { key: 'shipment',  label: 'Shipments' },
  { key: 'message',   label: 'Messages' },
  { key: 'kyc',       label: 'KYC' },
  { key: 'dispute',   label: 'Disputes' },
];

/* ── helpers ─────────────────────────────────────────────────── */

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24)  return `${hours}h ago`;
  const days  = Math.floor(hours / 24);
  if (days < 30)   return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ── component ───────────────────────────────────────────────── */

export default function ManagerTasks() {
  const [tasks, setTasks]           = useState([]);
  const [accounts, setAccounts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [typeFilter, setTypeFilter] = useState(null);
  const [accountFilter, setAccountFilter] = useState(null);
  const [dropdownOpen, setDropdownOpen]   = useState(false);

  /* ── fetch ──────────────────────────────────────────────── */

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (typeFilter)    params.type    = typeFilter;
      if (accountFilter) params.account = accountFilter;

      const res = await api.get('/manager/tasks', { params });
      setTasks(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load tasks:', err.message);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, accountFilter]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get('/manager/accounts');
      setAccounts(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load accounts:', err.message);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchTasks(); },    [fetchTasks]);

  /* ── derived ────────────────────────────────────────────── */

  const selectedAccount = accounts.find(a => a.id === accountFilter || a._id === accountFilter);

  /* ── render ─────────────────────────────────────────────── */

  return (
    <div className="p-4 lg:p-6 xl:p-8 space-y-6 w-full">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-400" />
            Task Inbox
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Unified task queue across all accounts
          </p>
        </div>
        <button
          onClick={fetchTasks}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">

        {/* Type filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-[var(--text-muted)]" />
          {FILTER_TYPES.map((f) => {
            const active = typeFilter === f.key;
            return (
              <button
                key={f.label}
                onClick={() => setTypeFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                  active
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-[var(--bg-card)] border-[var(--glass-border)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Account dropdown */}
        <div className="relative ml-auto">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors min-w-[160px]"
          >
            <span className="truncate">
              {selectedAccount ? (selectedAccount.name || selectedAccount.email) : 'All Accounts'}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 ml-auto transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-1 w-56 max-h-64 overflow-y-auto rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] shadow-xl z-20 backdrop-blur-md"
              >
                <button
                  onClick={() => { setAccountFilter(null); setDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                    !accountFilter
                      ? 'text-blue-400 bg-blue-500/10'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                  }`}
                >
                  All Accounts
                </button>
                {accounts.map((a) => {
                  const id = a.id || a._id;
                  return (
                    <button
                      key={id}
                      onClick={() => { setAccountFilter(id); setDropdownOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        accountFilter === id
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
                      }`}
                    >
                      {a.name || a.email || id}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Task List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl backdrop-blur-sm overflow-hidden"
      >
        {/* Loading skeleton */}
        {loading && (
          <div className="divide-y divide-[var(--glass-border)]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
                <div className="w-16 h-5 rounded bg-[var(--bg-secondary)]" />
                <div className="flex-1 space-y-1.5">
                  <div className="w-2/3 h-4 rounded bg-[var(--bg-secondary)]" />
                  <div className="w-1/3 h-3 rounded bg-[var(--bg-secondary)]" />
                </div>
                <div className="w-12 h-3 rounded bg-[var(--bg-secondary)]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <Inbox className="w-7 h-7 text-emerald-400" />
            </div>
            <p className="text-[var(--text-primary)] font-medium">All clear &mdash; no tasks waiting</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {typeFilter || accountFilter ? 'Try adjusting your filters' : 'Tasks will appear here when action is needed'}
            </p>
          </div>
        )}

        {/* Task rows */}
        {!loading && tasks.length > 0 && (
          <div className="divide-y divide-[var(--glass-border)]">
            {tasks.map((task, i) => {
              const style = TYPE_STYLES[task.type] || TYPE_STYLES.order;
              const Icon  = style.icon;

              return (
                <motion.div
                  key={task.id || task._id || i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={task.href || `/manager/as/${task.accountId || task.account}`}
                    className="flex items-center gap-4 px-4 py-3.5 hover:bg-[var(--bg-secondary)] transition-colors group"
                  >
                    {/* Type pill */}
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap ${style.bg} ${style.color} border ${style.border}`}>
                      <Icon className="w-3 h-3" />
                      {style.label}
                    </span>

                    {/* Title + account */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                        {task.accountName || task.account || 'Unknown account'}
                      </p>
                    </div>

                    {/* Age */}
                    <span className="hidden sm:flex items-center gap-1 text-xs text-[var(--text-muted)] whitespace-nowrap">
                      <Clock className="w-3 h-3" />
                      {timeAgo(task.createdAt || task.at)}
                    </span>

                    {/* Link arrow */}
                    <ExternalLink className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors flex-shrink-0" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Footer count */}
        {!loading && tasks.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--glass-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)]">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''}
              {typeFilter  ? ` in ${TYPE_STYLES[typeFilter]?.label || typeFilter}` : ''}
              {selectedAccount ? ` for ${selectedAccount.name || selectedAccount.email}` : ''}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
