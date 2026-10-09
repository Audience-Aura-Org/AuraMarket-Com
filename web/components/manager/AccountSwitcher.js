'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';
import { Search, X, Check, Grid3X3, Loader2, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AccountSwitcher — Horizontal scrollable nav bar for managers.
 * Shows account pills with role-colored avatars. Expands to a
 * searchable grid for large account lists.
 */

const ROLE_COLORS = {
  vendor:    { bg: 'bg-pink-500/12',   text: 'text-pink-400',   chip: 'bg-pink-500/10 text-pink-400 border-pink-500/15' },
  logistics: { bg: 'bg-purple-500/12', text: 'text-purple-400', chip: 'bg-purple-500/10 text-purple-400 border-purple-500/15' },
  customer:  { bg: 'bg-teal-500/12',   text: 'text-teal-400',   chip: 'bg-teal-500/10 text-teal-400 border-teal-500/15' },
};
const getRoleColor = (role) => ROLE_COLORS[role] || ROLE_COLORS.customer;

export default function AccountSwitcher() {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const searchRef = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  const accounts = useManagerMode((s) => s.accounts);
  const actAsId = useManagerMode((s) => s.actAsId);
  const loading = useManagerMode((s) => s.loading);
  const setSwitching = useManagerMode((s) => s.setSwitching);
  const clearActAs = useManagerMode((s) => s.clearActAs);
  const refreshBadges = useManagerMode((s) => s.refreshBadges);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setExpanded(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expanded]);

  useEffect(() => {
    if (expanded) {
      refreshBadges();
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [expanded, refreshBadges]);

  // Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        if (window.location.pathname.startsWith('/manager')) {
          e.preventDefault();
          setExpanded((v) => !v);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    if (!query) return accounts;
    const q = query.toLowerCase();
    return accounts.filter(
      (a) => a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.role?.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  const switchTo = useCallback((accountId) => {
    setExpanded(false);
    setQuery('');
    if (!accountId) {
      clearActAs();
      router.push('/manager');
      return;
    }
    setSwitching(true);
    const match = pathname.match(/\/manager\/as\/[^/]+\/(.+)/);
    const subRoute = match ? match[1] : 'dashboard';
    router.push(`/manager/as/${accountId}/${subRoute}`);
  }, [pathname, router, clearActAs, setSwitching]);

  const totalTasks = accounts.reduce((sum, a) => sum + (a.tasks || 0), 0);

  return (
    <div ref={ref} className="relative border-b border-[var(--glass-border)]">
      {/* Scrollable pill row */}
      <div className="flex items-center gap-1 px-2.5 md:px-3 py-1.5 md:py-2 overflow-x-auto no-scrollbar">
        {/* All Accounts */}
        <button
          onClick={() => switchTo(null)}
          className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-bold tracking-tight transition-all ${
            !actAsId
              ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] border border-transparent'
          }`}
        >
          <Grid3X3 className="size-3 md:size-3.5" />
          All
          {totalTasks > 0 && !actAsId && (
            <span className="min-w-[14px] h-[14px] px-0.5 rounded-full bg-amber-500 text-white text-[7px] font-extrabold flex items-center justify-center">
              {totalTasks > 99 ? '99+' : totalTasks}
            </span>
          )}
        </button>

        {/* Account pills */}
        {accounts.map((a) => {
          const role = getRoleColor(a.role);
          const isActive = a.id === actAsId;
          return (
            <button
              key={a.id}
              onClick={() => switchTo(a.id)}
              className={`shrink-0 flex items-center gap-1 md:gap-1.5 px-2 md:px-2.5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-bold tracking-tight transition-all ${
                isActive
                  ? `${role.bg} ${role.text} border border-current/15`
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] border border-transparent'
              }`}
              title={`${a.name} (${a.role})`}
            >
              <span className={`size-4 md:size-5 rounded-md flex items-center justify-center text-[8px] md:text-[9px] font-extrabold shrink-0 ${role.bg} ${role.text}`}>
                {(a.name || '?')[0].toUpperCase()}
              </span>
              <span className="max-w-[56px] md:max-w-[72px] truncate">{a.name || '?'}</span>
              {a.tasks > 0 && (
                <span className="min-w-[12px] h-[12px] md:min-w-[14px] md:h-[14px] px-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[7px] md:text-[8px] font-extrabold flex items-center justify-center">
                  {a.tasks}
                </span>
              )}
              {isActive && <Check className="size-2.5 md:size-3" />}
            </button>
          );
        })}

        {/* Search toggle */}
        {accounts.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`shrink-0 flex items-center gap-1 px-2 md:px-2.5 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-[11px] font-bold tracking-tight transition-all ${
              expanded
                ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--glass-border)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] border border-transparent'
            }`}
          >
            <Search className="size-3" />
            <ChevronDown className={`size-2.5 md:size-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}

        {loading && accounts.length === 0 && (
          <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-2 text-[10px] text-[var(--text-secondary)] opacity-50">
            <Loader2 className="size-3 animate-spin" />
            Loading...
          </div>
        )}
      </div>

      {/* Expanded search panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-[var(--glass-border)]"
          >
            <div className="p-2.5 md:p-3 space-y-2">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-secondary)] opacity-40" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') { setExpanded(false); setQuery(''); }
                    if (e.key === 'Enter' && filtered.length > 0) switchTo(filtered[0].id);
                  }}
                  className="w-full pl-8 pr-7 py-2 text-[11px] md:text-[12px] font-semibold bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg md:rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-40 focus:outline-none focus:border-[var(--accent)]/40 transition-all"
                />
                {query && (
                  <button onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5">
                    <X className="w-3 h-3 text-[var(--text-secondary)]" />
                  </button>
                )}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[220px] md:max-h-[260px] overflow-y-auto no-scrollbar">
                {filtered.map((a) => {
                  const role = getRoleColor(a.role);
                  const isActive = a.id === actAsId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => switchTo(a.id)}
                      className={`flex items-center gap-2.5 px-2.5 md:px-3 py-2 md:py-2.5 rounded-lg md:rounded-xl text-left transition-all active:scale-[0.98] ${
                        isActive
                          ? `${role.bg} border border-current/10`
                          : 'hover:bg-[var(--bg-secondary)]/50 border border-transparent'
                      }`}
                    >
                      <span className={`size-7 md:size-8 rounded-lg flex items-center justify-center text-[10px] md:text-[11px] font-extrabold shrink-0 ${role.bg} ${role.text}`}>
                        {(a.name || '?')[0].toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[10px] md:text-[11px] font-semibold tracking-tight truncate ${isActive ? role.text : 'text-[var(--text-primary)]'}`}>
                          {a.name || 'Unknown'}
                        </p>
                        <p className="text-[8px] md:text-[9px] text-[var(--text-secondary)] opacity-50 truncate">
                          {a.role} · {a.email}
                        </p>
                      </div>
                      {a.tasks > 0 && (
                        <span className="px-1 py-0.5 rounded bg-amber-500/10 text-amber-400 text-[8px] md:text-[9px] font-extrabold">{a.tasks}</span>
                      )}
                      {isActive && <Check className="size-3 text-[var(--accent)] shrink-0" />}
                    </button>
                  );
                })}
                {filtered.length === 0 && query && (
                  <p className="col-span-full text-[10px] text-[var(--text-secondary)] opacity-50 text-center py-5">
                    No accounts match &lsquo;{query}&rsquo;
                  </p>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2.5 pt-1 border-t border-[var(--glass-border)]/50">
                <button
                  onClick={() => { setExpanded(false); router.push('/manager/accounts'); }}
                  className="text-[9px] md:text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors opacity-60 hover:opacity-100"
                >
                  Manage Accounts
                </button>
                <span className="text-[var(--glass-border)]">·</span>
                <button
                  onClick={() => { setExpanded(false); router.push('/manager/invitations'); }}
                  className="text-[9px] md:text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors opacity-60 hover:opacity-100"
                >
                  Invite
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
