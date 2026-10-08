'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';
import { Search, ChevronDown, Users, X, Check, Star, Lock, Grid3X3, ArrowLeft, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AccountSwitcher — Google Ads / Facebook-style account picker for manager workspace.
 *
 * Features:
 *   - Trigger shows current identity (avatar, name, role chip, task badge)
 *   - Panel: search, starred section, recent section, all accounts (grouped by role if 20+)
 *   - Star toggle (max 10), keyboard navigation, Ctrl+K shortcut
 *   - Mobile: renders as full-width bottom sheet with drag handle
 *   - Accessibility: role="listbox", aria-selected, focus trap, screen reader announcements
 */

const ROLE_COLORS = {
  vendor:    { bg: 'bg-pink-500/15',    text: 'text-pink-400',    chip: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  logistics: { bg: 'bg-purple-500/15',  text: 'text-purple-400',  chip: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  customer:  { bg: 'bg-teal-500/15',    text: 'text-teal-400',    chip: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
};

const getRoleColor = (role) => ROLE_COLORS[role] || ROLE_COLORS.customer;

/** Highlight matching text in a string. */
function HighlightText({ text, query }) {
  if (!query || !text) return text || '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-500/30 text-[var(--text-primary)] rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

/** Days until expiration, or null if no expiry. */
function daysUntilExpiry(expiresAt) {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt) - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}

export default function AccountSwitcher() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [isMobile, setIsMobile] = useState(false);
  const [dragY, setDragY] = useState(0);

  const ref = useRef(null);
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const triggerRef = useRef(null);

  const router = useRouter();
  const pathname = usePathname();

  const accounts = useManagerMode((s) => s.accounts);
  const recent = useManagerMode((s) => s.recent);
  const starred = useManagerMode((s) => s.starred);
  const actAsId = useManagerMode((s) => s.actAsId);
  const switching = useManagerMode((s) => s.switching);
  const loading = useManagerMode((s) => s.loading);
  const toggleStar = useManagerMode((s) => s.toggleStar);
  const isStarred = useManagerMode((s) => s.isStarred);
  const refreshBadges = useManagerMode((s) => s.refreshBadges);
  const setSwitching = useManagerMode((s) => s.setSwitching);
  const setActAs = useManagerMode((s) => s.setActAs);
  const clearActAs = useManagerMode((s) => s.clearActAs);

  const activeAccount = accounts.find((a) => a.id === actAsId);

  // Total tasks across non-active accounts (for trigger badge)
  const otherAccountTasks = useMemo(
    () => accounts.filter((a) => a.id !== actAsId).reduce((sum, a) => sum + (a.tasks || 0), 0),
    [accounts, actAsId]
  );

  // Check mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Refresh badges on panel open
  useEffect(() => {
    if (open) refreshBadges();
  }, [open, refreshBadges]);

  // Close on outside click (desktop only)
  useEffect(() => {
    if (!open || isMobile) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, isMobile]);

  // Auto-focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  // Ctrl/Cmd + K shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        const isManagerPage = window.location.pathname.startsWith('/manager');
        if (isManagerPage) {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Filter accounts
  const filtered = useMemo(() => {
    if (!query) return accounts;
    const q = query.toLowerCase();
    return accounts.filter(
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.role?.toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  // Build display sections (deduplicated)
  const sections = useMemo(() => {
    if (query) return []; // When searching, show flat filtered list

    const shown = new Set();
    const result = [];

    // Starred
    const starredAccounts = starred
      .map((s) => accounts.find((a) => a.id === s.id))
      .filter((a) => a && !shown.has(a.id));
    if (starredAccounts.length > 0) {
      starredAccounts.forEach((a) => shown.add(a.id));
      result.push({ label: 'Starred', items: starredAccounts });
    }

    // Recent (exclude items already in starred)
    const recentAccounts = recent
      .map((r) => accounts.find((a) => a.id === r.id))
      .filter((a) => a && !shown.has(a.id));
    if (recentAccounts.length > 0) {
      recentAccounts.forEach((a) => shown.add(a.id));
      result.push({ label: 'Recent', items: recentAccounts });
    }

    // All accounts — group by role if 20+
    const remaining = accounts.filter((a) => !shown.has(a.id));
    if (accounts.length > 20) {
      const groups = {};
      remaining.forEach((a) => {
        const role = a.role || 'other';
        if (!groups[role]) groups[role] = [];
        groups[role].push(a);
      });
      const roleOrder = ['vendor', 'logistics', 'customer', 'other'];
      roleOrder.forEach((role) => {
        if (groups[role]?.length) {
          const label = role.charAt(0).toUpperCase() + role.slice(1) + 's';
          result.push({ label, items: groups[role].sort((a, b) => (a.name || '').localeCompare(b.name || '')) });
        }
      });
    } else {
      const sorted = [...remaining].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      if (sorted.length > 0) {
        result.push({ label: 'All Accounts', items: sorted });
      }
    }

    return result;
  }, [accounts, starred, recent, query]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const items = [{ type: 'manager-space' }]; // "All accounts" row is always first
    if (query) {
      filtered.forEach((a) => items.push({ type: 'account', account: a }));
    } else {
      sections.forEach((section) => {
        section.items.forEach((a) => items.push({ type: 'account', account: a }));
      });
    }
    return items;
  }, [sections, filtered, query]);

  // Switch to an account
  const switchTo = useCallback((accountId) => {
    setOpen(false);
    setQuery('');
    setHighlightIndex(-1);

    if (!accountId) {
      // Back to manager space
      clearActAs();
      router.push('/manager');
      return;
    }

    setSwitching(true);

    // Preserve current sub-route if possible
    const match = pathname.match(/\/manager\/as\/[^/]+\/(.+)/);
    const subRoute = match ? match[1] : 'dashboard';

    // Navigate — setActAs is done by the workspace layout
    router.push(`/manager/as/${accountId}/${subRoute}`);
  }, [pathname, router, clearActAs, setSwitching]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!open) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, flatList.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Home':
        e.preventDefault();
        setHighlightIndex(0);
        break;
      case 'End':
        e.preventDefault();
        setHighlightIndex(flatList.length - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < flatList.length) {
          const item = flatList[highlightIndex];
          switchTo(item.type === 'manager-space' ? null : item.account.id);
        } else if (filtered.length > 0 && query) {
          // Enter opens first result when searching
          switchTo(filtered[0].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (query) {
          setQuery('');
        } else {
          setOpen(false);
          triggerRef.current?.focus();
        }
        break;
    }
  }, [open, highlightIndex, flatList, filtered, query, switchTo]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-row]');
    items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  // Screen reader announcement
  useEffect(() => {
    if (!activeAccount) return;
    const el = document.getElementById('manager-sr-announce');
    if (el) el.textContent = `Now working as ${activeAccount.name}`;
  }, [activeAccount]);

  // ─── Render ──────────────────────────────────────────────

  const panelContent = (
    <>
      {/* Search */}
      <div className="p-2.5 border-b border-[var(--glass-border)]">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name, email, role..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlightIndex(-1); }}
            onKeyDown={handleKeyDown}
            className="w-full pl-8 pr-8 py-2 text-sm bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/30"
            role="combobox"
            aria-expanded={open}
            aria-controls="account-switcher-list"
            aria-activedescendant={highlightIndex >= 0 ? `row-${highlightIndex}` : undefined}
          />
          {query && (
            <button onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-[var(--bg-secondary)]">
              <X className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="overflow-y-auto flex-1"
        role="listbox"
        id="account-switcher-list"
        aria-label="Account list"
        onKeyDown={handleKeyDown}
      >
        {/* Manager Space (All Accounts) — always pinned first */}
        <button
          data-row
          id="row-0"
          role="option"
          aria-selected={!actAsId}
          onClick={() => switchTo(null)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
            !actAsId ? 'bg-blue-500/8 border-l-2 border-blue-500' : 'hover:bg-[var(--bg-secondary)] border-l-2 border-transparent'
          } ${highlightIndex === 0 ? 'bg-[var(--bg-secondary)]' : ''}`}
        >
          <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
            <Grid3X3 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">All accounts</p>
            <p className="text-[10px] text-[var(--text-muted)]">Manager Space · {accounts.length} accounts</p>
          </div>
          {!actAsId && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
        </button>

        {/* Zero accounts */}
        {accounts.length === 0 && !loading && (
          <div className="py-8 text-center">
            <Users className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-30" />
            <p className="text-sm text-[var(--text-muted)]">No accounts yet</p>
            <button
              onClick={() => { setOpen(false); router.push('/manager/invitations'); }}
              className="mt-2 text-xs text-blue-400 hover:underline"
            >
              Invite an account
            </button>
          </div>
        )}

        {/* Search results (flat) */}
        {query && (
          <>
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium">
              {filtered.length > 0 ? `Results (${filtered.length})` : null}
            </div>
            {filtered.map((a, i) => (
              <AccountRow
                key={a.id}
                account={a}
                isActive={a.id === actAsId}
                isHighlighted={highlightIndex === i + 1}
                index={i + 1}
                query={query}
                isStarred={isStarred(a.id)}
                onToggleStar={() => toggleStar(a.id)}
                onClick={() => switchTo(a.id)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-[var(--text-muted)] text-center py-6">
                No account matches &lsquo;{query}&rsquo;
              </p>
            )}
          </>
        )}

        {/* Sectioned list (no query) */}
        {!query && sections.map((section, sIdx) => {
          // Calculate the index offset for this section
          let offset = 1; // 1 for the "All accounts" row
          for (let i = 0; i < sIdx; i++) offset += sections[i].items.length;

          return (
            <div key={section.label}>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-medium flex items-center justify-between">
                <span>{section.label}</span>
                {section.label === 'Starred' && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />}
              </div>
              {section.items.map((a, i) => (
                <AccountRow
                  key={`${section.label}-${a.id}`}
                  account={a}
                  isActive={a.id === actAsId}
                  isHighlighted={highlightIndex === offset + i}
                  index={offset + i}
                  query=""
                  isStarred={isStarred(a.id)}
                  onToggleStar={() => toggleStar(a.id)}
                  onClick={() => switchTo(a.id)}
                />
              ))}
              {sIdx < sections.length - 1 && (
                <div className="h-px bg-[var(--glass-border)] mx-3 my-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {accounts.length > 0 && (
        <div className="border-t border-[var(--glass-border)] px-3 py-2 flex items-center gap-3">
          <button
            onClick={() => { setOpen(false); router.push('/manager/accounts'); }}
            className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Manage accounts
          </button>
          <span className="text-[var(--glass-border)]">·</span>
          <button
            onClick={() => { setOpen(false); router.push('/manager/invitations'); }}
            className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            Invite an account
          </button>
        </div>
      )}
    </>
  );

  return (
    <div ref={ref} className="relative px-4 py-3 border-b border-[var(--glass-border)]">
      {/* Screen reader live region */}
      <div id="manager-sr-announce" role="status" aria-live="polite" className="sr-only" />

      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={activeAccount ? `Working as ${activeAccount.name}` : 'All accounts - Manager Space'}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors text-left group"
      >
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          activeAccount ? getRoleColor(activeAccount.role).bg + ' ' + getRoleColor(activeAccount.role).text : 'bg-blue-500/15 text-blue-400'
        }`}>
          {activeAccount ? (activeAccount.name || '?')[0].toUpperCase() : (
            <Grid3X3 className="w-4 h-4" />
          )}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-primary)] truncate">
            {activeAccount?.name || 'All accounts'}
          </p>
          <div className="flex items-center gap-1.5">
            {activeAccount ? (
              <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full border ${getRoleColor(activeAccount.role).chip}`}>
                {activeAccount.role}
              </span>
            ) : (
              <span className="text-[10px] text-[var(--text-muted)]">Manager Space</span>
            )}
          </div>
        </div>

        {/* Task badge on trigger */}
        {otherAccountTasks > 0 && (
          <span className="relative flex h-5 min-w-[20px] items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-20" />
            <span className="relative inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
              {otherAccountTasks > 99 ? '99+' : otherAccountTasks}
            </span>
          </span>
        )}

        <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Desktop dropdown panel */}
      <AnimatePresence>
        {open && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 mt-1 left-2 right-2 max-h-[420px] overflow-hidden rounded-xl bg-[var(--bg-card)] border border-[var(--glass-border)] shadow-2xl backdrop-blur-xl flex flex-col"
          >
            {panelContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {open && isMobile && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
              onClick={() => { setOpen(false); setQuery(''); }}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: dragY }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) {
                  setOpen(false);
                  setQuery('');
                }
                setDragY(0);
              }}
              className="fixed inset-x-0 bottom-0 z-[301] max-h-[85vh] rounded-t-2xl bg-[var(--bg-card)] border-t border-[var(--glass-border)] shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Drag handle */}
              <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-[var(--text-muted)] opacity-30" />
              </div>

              {/* Sheet title */}
              <div className="px-4 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Switch Account</h3>
                <button onClick={() => { setOpen(false); setQuery(''); }} className="p-1 rounded-lg hover:bg-[var(--bg-secondary)]">
                  <X className="w-4 h-4 text-[var(--text-muted)]" />
                </button>
              </div>

              {panelContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AccountRow ──────────────────────────────────────────

function AccountRow({ account, isActive, isHighlighted, index, query, isStarred, onToggleStar, onClick }) {
  const [hovered, setHovered] = useState(false);
  const role = getRoleColor(account.role);
  const expiryDays = daysUntilExpiry(account.expires_at);
  const viewOnly = account.permissions && Object.values(account.permissions).every((v) => !v);

  // Disambiguate: show email if another account has the same name
  const accounts = useManagerMode((s) => s.accounts);
  const hasDuplicate = accounts.filter((a) => a.name === account.name).length > 1;

  return (
    <div
      data-row
      id={`row-${index}`}
      role="option"
      aria-selected={isActive}
      className={`group relative flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${
        isActive ? 'bg-blue-500/8 border-l-2 border-blue-500' : 'hover:bg-[var(--bg-secondary)] border-l-2 border-transparent'
      } ${isHighlighted ? 'bg-[var(--bg-secondary)]' : ''}`}
      style={{ minHeight: 44 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${role.bg} ${role.text}`}>
        {(account.name || '?')[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm text-[var(--text-primary)] truncate">
            <HighlightText text={account.name || 'Unknown'} query={query} />
          </p>
          <span className={`text-[8px] font-semibold uppercase px-1 py-0.5 rounded border shrink-0 ${role.chip}`}>
            {account.role}
          </span>
          {viewOnly && (
            <span title="View only">
              <Lock className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] text-[var(--text-muted)] truncate">
            {hasDuplicate && account.email ? (
              <HighlightText text={account.email} query={query} />
            ) : account.email ? (
              <HighlightText text={account.email} query={query} />
            ) : null}
          </p>
          {expiryDays !== null && expiryDays <= 7 && (
            <span className="text-[9px] text-amber-400 font-medium whitespace-nowrap">
              Ends in {expiryDays}d
            </span>
          )}
        </div>
      </div>

      {/* Right side: task badge + star + check */}
      <div className="flex items-center gap-1.5 shrink-0">
        {account.tasks > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[10px] font-bold min-w-[20px] text-center">
            {account.tasks > 99 ? '99+' : account.tasks}
          </span>
        )}

        {/* Star toggle — visible on hover/focus on desktop, always on mobile */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          className={`p-0.5 rounded transition-all ${
            isStarred
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus:opacity-100 touch-device:opacity-100'
          }`}
          aria-label={isStarred ? 'Unstar account' : 'Star account'}
          tabIndex={-1}
        >
          <Star className={`w-3.5 h-3.5 transition-colors ${
            isStarred ? 'text-amber-400 fill-amber-400' : 'text-[var(--text-muted)] hover:text-amber-400'
          }`} />
        </button>

        {isActive && <Check className="w-4 h-4 text-blue-400" />}
      </div>
    </div>
  );
}
