'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';
import { Search, ChevronDown, Users, X, Check, Star, Lock, Grid3X3, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * AccountSwitcher — Google Ads / Facebook-style account picker.
 * Lives in the sidebar, always visible on /manager pages.
 */

const ROLE_COLORS = {
  vendor:    { bg: 'bg-pink-500/15',    text: 'text-pink-400',    ring: 'ring-pink-500/30',    chip: 'bg-pink-500/10 text-pink-400 border-pink-500/20' },
  logistics: { bg: 'bg-purple-500/15',  text: 'text-purple-400',  ring: 'ring-purple-500/30',  chip: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  customer:  { bg: 'bg-teal-500/15',    text: 'text-teal-400',    ring: 'ring-teal-500/30',    chip: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
};

const getRoleColor = (role) => ROLE_COLORS[role] || ROLE_COLORS.customer;

function HighlightText({ text, query }) {
  if (!query || !text) return text || '';
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-blue-400/20 text-inherit rounded-sm px-px">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

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
  const loading = useManagerMode((s) => s.loading);
  const toggleStar = useManagerMode((s) => s.toggleStar);
  const isStarred = useManagerMode((s) => s.isStarred);
  const refreshBadges = useManagerMode((s) => s.refreshBadges);
  const setSwitching = useManagerMode((s) => s.setSwitching);
  const clearActAs = useManagerMode((s) => s.clearActAs);

  const activeAccount = accounts.find((a) => a.id === actAsId);

  const otherAccountTasks = useMemo(
    () => accounts.filter((a) => a.id !== actAsId).reduce((sum, a) => sum + (a.tasks || 0), 0),
    [accounts, actAsId]
  );

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (open) refreshBadges();
  }, [open, refreshBadges]);

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

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        if (window.location.pathname.startsWith('/manager')) {
          e.preventDefault();
          setOpen((v) => !v);
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
      (a) =>
        a.name?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.role?.toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q)
    );
  }, [accounts, query]);

  const sections = useMemo(() => {
    if (query) return [];
    const shown = new Set();
    const result = [];

    const starredAccounts = starred
      .map((s) => accounts.find((a) => a.id === s.id))
      .filter((a) => a && !shown.has(a.id));
    if (starredAccounts.length > 0) {
      starredAccounts.forEach((a) => shown.add(a.id));
      result.push({ label: 'Starred', items: starredAccounts });
    }

    const recentAccounts = recent
      .map((r) => accounts.find((a) => a.id === r.id))
      .filter((a) => a && !shown.has(a.id));
    if (recentAccounts.length > 0) {
      recentAccounts.forEach((a) => shown.add(a.id));
      result.push({ label: 'Recent', items: recentAccounts });
    }

    const remaining = accounts.filter((a) => !shown.has(a.id));
    if (accounts.length > 20) {
      const groups = {};
      remaining.forEach((a) => {
        const role = a.role || 'other';
        if (!groups[role]) groups[role] = [];
        groups[role].push(a);
      });
      ['vendor', 'logistics', 'customer', 'other'].forEach((role) => {
        if (groups[role]?.length) {
          result.push({ label: role.charAt(0).toUpperCase() + role.slice(1) + 's', items: groups[role].sort((a, b) => (a.name || '').localeCompare(b.name || '')) });
        }
      });
    } else if (remaining.length > 0) {
      result.push({ label: 'All Accounts', items: [...remaining].sort((a, b) => (a.name || '').localeCompare(b.name || '')) });
    }

    return result;
  }, [accounts, starred, recent, query]);

  const flatList = useMemo(() => {
    const items = [{ type: 'manager-space' }];
    if (query) {
      filtered.forEach((a) => items.push({ type: 'account', account: a }));
    } else {
      sections.forEach((s) => s.items.forEach((a) => items.push({ type: 'account', account: a })));
    }
    return items;
  }, [sections, filtered, query]);

  const switchTo = useCallback((accountId) => {
    setOpen(false);
    setQuery('');
    setHighlightIndex(-1);

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
          switchTo(filtered[0].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        if (query) setQuery('');
        else { setOpen(false); triggerRef.current?.focus(); }
        break;
    }
  }, [open, highlightIndex, flatList, filtered, query, switchTo]);

  useEffect(() => {
    if (highlightIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-row]');
    items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex]);

  useEffect(() => {
    if (!activeAccount) return;
    const el = document.getElementById('manager-sr-announce');
    if (el) el.textContent = `Now working as ${activeAccount.name}`;
  }, [activeAccount]);

  // ─── Panel content (shared between desktop dropdown and mobile sheet) ───

  const panelContent = (
    <>
      {/* Search */}
      <div className="p-3 border-b border-[var(--glass-border)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] opacity-40" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search accounts..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlightIndex(-1); }}
            onKeyDown={handleKeyDown}
            className="w-full pl-9 pr-8 py-2.5 text-[12px] font-semibold tracking-tight bg-[var(--bg-secondary)] border border-[var(--glass-border)] rounded-xl text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] placeholder:opacity-40 focus:outline-none focus:border-[var(--accent)]/40 transition-all shadow-inner"
            role="combobox"
            aria-expanded={open}
            aria-controls="account-switcher-list"
            aria-activedescendant={highlightIndex >= 0 ? `row-${highlightIndex}` : undefined}
          />
          {query && (
            <button onClick={() => { setQuery(''); searchRef.current?.focus(); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-[var(--bg-secondary)]">
              <X className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            </button>
          )}
        </div>
      </div>

      <div
        ref={listRef}
        className="overflow-y-auto flex-1 no-scrollbar"
        role="listbox"
        id="account-switcher-list"
        aria-label="Account list"
        onKeyDown={handleKeyDown}
      >
        {/* Manager Space — always first */}
        <button
          data-row
          id="row-0"
          role="option"
          aria-selected={!actAsId}
          onClick={() => switchTo(null)}
          className={`w-full flex items-center gap-3 px-3 py-3 text-left transition-all ${
            !actAsId
              ? 'bg-[var(--accent)]/8 border-l-2 border-[var(--accent)]'
              : 'hover:bg-[var(--bg-secondary)]/60 border-l-2 border-transparent'
          } ${highlightIndex === 0 ? 'bg-[var(--bg-secondary)]/60' : ''}`}
        >
          <div className="size-9 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0 shadow-inner">
            <Grid3X3 className="size-4 text-[var(--accent)]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold tracking-tight text-[var(--text-primary)]">All accounts</p>
            <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50">
              Manager Space · {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </p>
          </div>
          {!actAsId && <Check className="size-4 text-[var(--accent)] shrink-0" />}
        </button>

        {/* Zero accounts */}
        {accounts.length === 0 && !loading && (
          <div className="py-10 text-center">
            <Users className="size-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-20" />
            <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-50">No accounts yet</p>
            <button
              onClick={() => { setOpen(false); router.push('/manager/invitations'); }}
              className="mt-2 text-[11px] font-bold text-[var(--accent)] hover:underline"
            >
              Invite an account
            </button>
          </div>
        )}

        {loading && accounts.length === 0 && (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-[var(--accent)]" />
          </div>
        )}

        {/* Search results */}
        {query && (
          <>
            {filtered.length > 0 && (
              <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.15em] text-[var(--text-secondary)] font-bold opacity-40">
                Results ({filtered.length})
              </div>
            )}
            {filtered.map((a, i) => (
              <AccountRow
                key={a.id}
                account={a}
                allAccounts={accounts}
                isActive={a.id === actAsId}
                isHighlighted={highlightIndex === i + 1}
                index={i + 1}
                query={query}
                starred={isStarred(a.id)}
                onToggleStar={() => toggleStar(a.id)}
                onClick={() => switchTo(a.id)}
              />
            ))}
            {filtered.length === 0 && (
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] opacity-50 text-center py-8">
                No account matches &lsquo;{query}&rsquo;
              </p>
            )}
          </>
        )}

        {/* Sectioned list */}
        {!query && sections.map((section, sIdx) => {
          let offset = 1;
          for (let i = 0; i < sIdx; i++) offset += sections[i].items.length;

          return (
            <div key={section.label}>
              <div className="px-3 py-2 text-[9px] uppercase tracking-[0.15em] text-[var(--text-secondary)] font-bold opacity-40 flex items-center justify-between">
                <span>{section.label}</span>
                {section.label === 'Starred' && <Star className="size-2.5 text-amber-400 fill-amber-400" />}
              </div>
              {section.items.map((a, i) => (
                <AccountRow
                  key={`${section.label}-${a.id}`}
                  account={a}
                  allAccounts={accounts}
                  isActive={a.id === actAsId}
                  isHighlighted={highlightIndex === offset + i}
                  index={offset + i}
                  query=""
                  starred={isStarred(a.id)}
                  onToggleStar={() => toggleStar(a.id)}
                  onClick={() => switchTo(a.id)}
                />
              ))}
              {sIdx < sections.length - 1 && (
                <div className="h-px bg-[var(--glass-border)] mx-3 my-0.5" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {accounts.length > 0 && (
        <div className="border-t border-[var(--glass-border)] px-3 py-2.5 flex items-center gap-3">
          <button
            onClick={() => { setOpen(false); router.push('/manager/accounts'); }}
            className="text-[10px] font-bold tracking-tight text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors opacity-60 hover:opacity-100"
          >
            Manage accounts
          </button>
          <span className="text-[var(--glass-border)]">·</span>
          <button
            onClick={() => { setOpen(false); router.push('/manager/invitations'); }}
            className="text-[10px] font-bold tracking-tight text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors opacity-60 hover:opacity-100"
          >
            Invite an account
          </button>
        </div>
      )}
    </>
  );

  return (
    <div ref={ref} className="relative px-4 py-3 border-b border-[var(--glass-border)]">
      <div id="manager-sr-announce" role="status" aria-live="polite" className="sr-only" />

      {/* Trigger */}
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={activeAccount ? `Working as ${activeAccount.name}` : 'All accounts - Manager Space'}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30 transition-all text-left group shadow-inner"
      >
        {/* Avatar */}
        <div className={`size-9 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0 border shadow-inner ${
          activeAccount
            ? `${getRoleColor(activeAccount.role).bg} ${getRoleColor(activeAccount.role).text} border-transparent`
            : 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20'
        }`}>
          {activeAccount ? (activeAccount.name || '?')[0].toUpperCase() : (
            <Grid3X3 className="size-4" />
          )}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold tracking-tight text-[var(--text-primary)] truncate">
            {activeAccount?.name || 'All accounts'}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {activeAccount ? (
              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border tracking-wider ${getRoleColor(activeAccount.role).chip}`}>
                {activeAccount.role}
              </span>
            ) : (
              <span className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 tracking-tight">Manager Space</span>
            )}
          </div>
        </div>

        {/* Task notification badge */}
        {otherAccountTasks > 0 && (
          <span className="relative flex size-5 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-20" />
            <span className="relative inline-flex items-center justify-center size-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold">
              {otherAccountTasks > 99 ? '99+' : otherAccountTasks}
            </span>
          </span>
        )}

        <ChevronDown className={`size-4 text-[var(--text-secondary)] opacity-40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Desktop dropdown */}
      <AnimatePresence>
        {open && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute z-50 mt-1.5 left-2 right-2 max-h-[440px] overflow-hidden rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] shadow-2xl backdrop-blur-xl flex flex-col"
          >
            {panelContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom sheet */}
      <AnimatePresence>
        {open && isMobile && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
              onClick={() => { setOpen(false); setQuery(''); }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: dragY }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) { setOpen(false); setQuery(''); }
                setDragY(0);
              }}
              className="fixed inset-x-0 bottom-0 z-[301] max-h-[85vh] rounded-t-[2rem] bg-[var(--bg-primary)] border-t border-[var(--glass-border)] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-[var(--text-secondary)] opacity-20" />
              </div>
              <div className="px-4 pb-2 flex items-center justify-between">
                <h3 className="text-sm font-bold tracking-tight text-[var(--text-primary)]">Switch Account</h3>
                <button onClick={() => { setOpen(false); setQuery(''); }} className="p-1.5 rounded-xl hover:bg-[var(--bg-secondary)]">
                  <X className="size-4 text-[var(--text-secondary)]" />
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

// ─── Account Row ────────────────────────────────────────────

function AccountRow({ account, allAccounts, isActive, isHighlighted, index, query, starred, onToggleStar, onClick }) {
  const role = getRoleColor(account.role);
  const expiryDays = daysUntilExpiry(account.expires_at);
  const viewOnly = account.permissions && typeof account.permissions === 'object' && Object.values(account.permissions).every((v) => !v);
  const hasDuplicate = allAccounts.filter((a) => a.name === account.name).length > 1;

  return (
    <div
      data-row
      id={`row-${index}`}
      role="option"
      aria-selected={isActive}
      className={`group relative flex items-center gap-3 px-3 py-2.5 text-left transition-all cursor-pointer ${
        isActive
          ? 'bg-[var(--accent)]/8 border-l-2 border-[var(--accent)]'
          : 'hover:bg-[var(--bg-secondary)]/60 border-l-2 border-transparent'
      } ${isHighlighted ? 'bg-[var(--bg-secondary)]/60' : ''}`}
      style={{ minHeight: 48 }}
      onClick={onClick}
    >
      {/* Avatar */}
      <div className={`size-9 rounded-xl flex items-center justify-center text-[11px] font-extrabold shrink-0 border shadow-inner ${role.bg} ${role.text} border-transparent`}>
        {(account.name || '?')[0].toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-semibold tracking-tight text-[var(--text-primary)] truncate">
            <HighlightText text={account.name || 'Unknown'} query={query} />
          </p>
          <span className={`text-[7px] font-extrabold uppercase px-1 py-0.5 rounded border shrink-0 tracking-wider ${role.chip}`}>
            {account.role}
          </span>
          {viewOnly && (
            <span title="View only">
              <Lock className="size-3 text-[var(--text-secondary)] opacity-40 shrink-0" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {account.email && (
            <p className="text-[10px] font-medium text-[var(--text-secondary)] opacity-50 truncate">
              <HighlightText text={account.email} query={query} />
            </p>
          )}
          {expiryDays !== null && expiryDays <= 7 && (
            <span className="text-[9px] text-amber-400 font-bold whitespace-nowrap">
              Ends in {expiryDays}d
            </span>
          )}
        </div>
      </div>

      {/* Right: badge + star + check */}
      <div className="flex items-center gap-1 shrink-0">
        {account.tasks > 0 && (
          <span className="px-1.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-400 text-[9px] font-extrabold min-w-[20px] text-center border border-amber-500/10">
            {account.tasks > 99 ? '99+' : account.tasks}
          </span>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          className={`p-1 rounded-lg transition-all ${
            starred
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
          aria-label={starred ? 'Unstar' : 'Star'}
          tabIndex={-1}
        >
          <Star className={`size-3 transition-colors ${
            starred ? 'text-amber-400 fill-amber-400' : 'text-[var(--text-secondary)] hover:text-amber-400'
          }`} />
        </button>

        {isActive && <Check className="size-4 text-[var(--accent)]" />}
      </div>
    </div>
  );
}
