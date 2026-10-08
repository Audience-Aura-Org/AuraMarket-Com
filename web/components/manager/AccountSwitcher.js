'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';
import { Search, ChevronDown, Users, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AccountSwitcher — glass-morphic dropdown for switching between
 * assigned accounts in the manager workspace.
 *
 * Shows recent accounts, full account list with search,
 * and a "Manager Space" option to return to the overview.
 */
export default function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);
  const router = useRouter();
  const pathname = usePathname();

  const accounts = useManagerMode((s) => s.accounts);
  const recent = useManagerMode((s) => s.recent);
  const actAsId = useManagerMode((s) => s.actAsId);

  const activeAccount = accounts.find((a) => a.id === actAsId);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query
    ? accounts.filter(
        (a) =>
          a.name?.toLowerCase().includes(query.toLowerCase()) ||
          a.email?.toLowerCase().includes(query.toLowerCase())
      )
    : accounts;

  const switchTo = (accountId) => {
    setOpen(false);
    setQuery('');
    if (!accountId) {
      router.push('/manager');
      return;
    }
    // Preserve current sub-route if possible
    const match = pathname.match(/\/manager\/as\/[^/]+\/(.+)/);
    const subRoute = match ? match[1] : 'dashboard';
    router.push(`/manager/as/${accountId}/${subRoute}`);
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors text-left"
      >
        <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
          {activeAccount ? (activeAccount.name || '?')[0].toUpperCase() : (
            <Users className="w-3.5 h-3.5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {activeAccount?.name || 'All Accounts'}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] truncate">
            {activeAccount ? activeAccount.role : 'Manager Space'}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full min-w-[260px] max-h-[360px] overflow-hidden rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] shadow-xl backdrop-blur-xl flex flex-col"
          >
            {/* Search */}
            <div className="p-2 border-b border-[var(--glass-border)]">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Search accounts..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/30"
                  autoFocus
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-y-auto flex-1">
              {/* Manager Space option */}
              <button
                onClick={() => switchTo(null)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--bg-secondary)] transition-colors ${
                  !actAsId ? 'bg-blue-500/5' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">Manager Space</p>
                  <p className="text-[10px] text-[var(--text-muted)]">All accounts overview</p>
                </div>
              </button>

              {/* Recent accounts */}
              {!query && recent.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                    Recent
                  </div>
                  {recent.map((r) => (
                    <AccountRow
                      key={`recent-${r.id}`}
                      account={r}
                      isActive={r.id === actAsId}
                      onClick={() => switchTo(r.id)}
                    />
                  ))}
                  <div className="h-px bg-[var(--glass-border)] mx-3" />
                </>
              )}

              {/* All accounts */}
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
                {query ? `Results (${filtered.length})` : `All Accounts (${accounts.length})`}
              </div>
              {filtered.map((a) => (
                <AccountRow
                  key={a.id}
                  account={a}
                  isActive={a.id === actAsId}
                  onClick={() => switchTo(a.id)}
                  showTasks
                />
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-[var(--text-muted)] text-center py-4">No accounts found</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AccountRow({ account, isActive, onClick, showTasks }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[var(--bg-secondary)] transition-colors ${
        isActive ? 'bg-blue-500/5' : ''
      }`}
    >
      <div className="w-7 h-7 rounded-full bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
        {(account.name || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] truncate">{account.name || 'Unknown'}</p>
        <p className="text-[10px] text-[var(--text-muted)] truncate">
          {account.role || ''}{account.email ? ` · ${account.email}` : ''}
        </p>
      </div>
      {showTasks && account.tasks > 0 && (
        <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-medium">
          {account.tasks}
        </span>
      )}
    </button>
  );
}
