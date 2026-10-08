'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users, Search, RefreshCw, ChevronRight, Clock,
  Shield, ShoppingCart, MessageSquare, Eye, Settings,
  UserCheck, Inbox,
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/services/api';

const ROLE_STYLES = {
  vendor:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Vendor' },
  buyer:   { color: 'text-blue-400',    bg: 'bg-blue-500/10',    label: 'Buyer' },
  seller:  { color: 'text-purple-400',  bg: 'bg-purple-500/10',  label: 'Seller' },
  admin:   { color: 'text-rose-400',    bg: 'bg-rose-500/10',    label: 'Admin' },
  manager: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Manager' },
};

const PERM_ICONS = {
  orders:    ShoppingCart,
  messages:  MessageSquare,
  view:      Eye,
  settings:  Settings,
  kyc:       UserCheck,
};

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
  const [search, setSearch] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/manager/accounts');
      setAccounts(res.data?.data || []);
    } catch (err) {
      console.error('[Manager] Failed to load accounts:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q),
    );
  }, [accounts, search]);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-[var(--text-primary)]">
            Assigned Accounts
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {loading ? 'Loading...' : `${filtered.length} account${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={fetchAccounts}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </div>

      {/* Accounts Grid */}
      {!loading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-xl p-12 backdrop-blur-sm text-center"
        >
          <Inbox className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm">
            {search ? 'No accounts match your search' : 'No accounts assigned yet'}
          </p>
        </motion.div>
      )}

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((account, i) => {
            const role = ROLE_STYLES[account.role] || ROLE_STYLES.buyer;
            const perms = account.permissions || [];

            return (
              <motion.div
                key={account.id || account._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.03 }}
              >
                <Link
                  href={`/manager/as/${account.id || account._id}`}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] backdrop-blur-sm hover:border-blue-500/30 transition-all group"
                >
                  {/* Left: Avatar + Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-blue-500/10 flex items-center justify-center text-sm font-bold text-blue-400 shrink-0">
                      {(account.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {account.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {account.email || '—'}
                      </p>
                    </div>
                  </div>

                  {/* Right: Role + Tasks + Activity + Permissions + Arrow */}
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {/* Role badge */}
                    <span className={`hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-medium ${role.bg} ${role.color}`}>
                      {role.label}
                    </span>

                    {/* Task count pill */}
                    {(account.tasks != null && account.tasks > 0) && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-medium">
                        {account.tasks} task{account.tasks !== 1 ? 's' : ''}
                      </span>
                    )}

                    {/* Last activity */}
                    <span className="hidden md:flex items-center gap-1 text-xs text-[var(--text-muted)]">
                      <Clock className="w-3 h-3" />
                      {timeAgo(account.last_activity)}
                    </span>

                    {/* Permission icons */}
                    {perms.length > 0 && (
                      <div className="hidden lg:flex items-center gap-1">
                        {perms.map((p) => {
                          const Icon = PERM_ICONS[p] || Shield;
                          return (
                            <span
                              key={p}
                              title={p}
                              className="w-6 h-6 rounded-md bg-[var(--bg-secondary)] flex items-center justify-center"
                            >
                              <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-16 rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] animate-pulse"
            />
          ))}
        </div>
      )}
    </div>
  );
}
