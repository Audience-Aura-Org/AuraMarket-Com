'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search, RefreshCw, ChevronRight, Clock, Inbox, ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';

const ROLE_COLORS = {
  vendor:    { text: 'text-pink-400',   bg: 'bg-pink-500/10',   chip: 'bg-pink-500/10 text-pink-400 border-pink-500/15' },
  logistics: { text: 'text-purple-400', bg: 'bg-purple-500/10', chip: 'bg-purple-500/10 text-purple-400 border-purple-500/15' },
  customer:  { text: 'text-teal-400',   bg: 'bg-teal-500/10',   chip: 'bg-teal-500/10 text-teal-400 border-teal-500/15' },
};
const getRoleColor = (role) => ROLE_COLORS[role] || ROLE_COLORS.customer;

const PERM_LABELS = { products: 'Products', orders: 'Orders', messages: 'Messages', money: 'Money', profile: 'Profile' };

function timeAgo(ts) {
  if (!ts) return 'Never';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export default function ManagerAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const hasFetched = useRef(false);

  const fetchAccounts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!hasFetched.current) setLoading(true);
    setError(null);
    try {
      const res = await api.get('/manager/accounts');
      setAccounts(res.data?.data || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
      setRefreshing(false);
      hasFetched.current = true;
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) => (a.name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q) || (a.role || '').toLowerCase().includes(q),
    );
  }, [accounts, search]);

  if (loading && !hasFetched.current) {
    return (
      <div className="p-4 md:p-6 space-y-3 w-full animate-pulse">
        <div className="h-7 w-36 rounded-lg bg-[var(--bg-card)]" />
        <div className="h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)]" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[76px] rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-3 md:space-y-4 w-full max-w-[900px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg md:text-xl font-display font-bold text-[var(--text-primary)] tracking-tight">Accounts</h1>
          <p className="text-[11px] md:text-xs text-[var(--text-muted)] mt-0.5">
            {filtered.length} assigned account{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => fetchAccounts(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] border border-transparent hover:border-[var(--glass-border)] transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Search */}
      {accounts.length > 2 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] text-[12px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/40 transition-colors"
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/8 border border-red-500/15 px-3.5 py-3">
          <p className="text-[12px] font-semibold text-red-400">Failed to load accounts</p>
          <p className="text-[10px] text-red-400/60 mt-0.5">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!error && filtered.length === 0 && (
        <div className="rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)] py-14 text-center">
          <Inbox className="size-9 text-[var(--text-muted)] mx-auto mb-3 opacity-30" />
          <p className="text-[12px] font-semibold text-[var(--text-muted)]">
            {search ? 'No accounts match your search' : 'No accounts assigned yet'}
          </p>
          {!search && (
            <Link href="/manager/invitations" className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors">
              Invite an account <ArrowUpRight className="size-3" />
            </Link>
          )}
        </div>
      )}

      {/* Account Cards */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((account, i) => {
            const role = getRoleColor(account.role);
            const perms = account.permissions || {};
            const activePerms = Object.entries(perms).filter(([, v]) => v).map(([k]) => k);

            return (
              <motion.div
                key={account.id || account._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ delay: i * 0.025 }}
              >
                <Link
                  href={`/manager/as/${account.id || account._id}/dashboard`}
                  className="block rounded-2xl bg-[var(--bg-card)] border border-[var(--glass-border)] hover:border-blue-500/20 transition-all active:scale-[0.995] group"
                >
                  <div className="flex items-center gap-3 p-3 md:p-4">
                    {/* Avatar */}
                    <div className={`size-10 md:size-11 rounded-xl flex items-center justify-center text-[13px] md:text-[14px] font-bold shrink-0 ${role.bg} ${role.text}`}>
                      {(account.name || '?')[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] md:text-[13px] font-semibold text-[var(--text-primary)] truncate leading-tight">
                          {account.name || 'Unknown'}
                        </p>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded-md text-[7px] md:text-[8px] font-bold uppercase tracking-wider border ${role.chip}`}>
                          {account.role}
                        </span>
                      </div>
                      <p className="text-[10px] md:text-[11px] text-[var(--text-muted)] truncate mt-0.5">
                        {account.email || '—'}
                      </p>
                      {activePerms.length > 0 && (
                        <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                          {activePerms.map((p) => (
                            <span key={p} className="px-1.5 py-px rounded text-[8px] font-medium bg-[var(--bg-secondary)] text-[var(--text-muted)] capitalize">
                              {PERM_LABELS[p] || p}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-2 shrink-0">
                      {account.tasks > 0 && (
                        <span className="px-1.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 text-[10px] font-bold tabular-nums">
                          {account.tasks}
                        </span>
                      )}
                      <span className="hidden sm:flex items-center gap-1 text-[9px] text-[var(--text-muted)]">
                        <Clock className="size-2.5" />
                        {timeAgo(account.last_activity)}
                      </span>
                      <ChevronRight className="size-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity hidden md:block" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
