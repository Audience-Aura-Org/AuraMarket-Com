'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronsUpDown, Search, Star, X, LayoutGrid } from 'lucide-react';
import { useManagerMode } from '@/hooks/useManagerMode';
import { StatusDot, HEALTH_LABEL } from '@/components/manager/ui';
import { pickerSections, resolveSwitchTarget } from './switching';
import { TYPE_LABEL, workspaceAccountId } from './shell/nav';

const ALL = { id: null, name: 'All accounts' };

/**
 * Account picker — popover on tablet/desktop, full-height sheet on phones.
 *
 * mode="navigate": selecting switches workspace (switching rules in switching.js).
 * mode="filter":   selecting calls onSelect(id | null) — used for page filters.
 * variant: trigger style — 'rail' | 'compact' | 'bar' | 'filter'.
 * hotkey: bind ⌘K / Ctrl+K (only the shell's picker should).
 */
export default function AccountPicker({ mode = 'navigate', value = null, onSelect, variant = 'filter', hotkey = false }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const accounts = useManagerMode((s) => s.accounts);
  const actAsId = useManagerMode((s) => s.actAsId);
  const starred = useManagerMode((s) => s.starred);
  const recent = useManagerMode((s) => s.recent);
  const toggleStar = useManagerMode((s) => s.toggleStar);
  const setSwitching = useManagerMode((s) => s.setSwitching);
  const clearActAs = useManagerMode((s) => s.clearActAs);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  // In navigate mode the URL is the source of truth for which account is open
  // (actAsId can lag a moment behind a switch).
  const currentId = mode === 'navigate' ? (workspaceAccountId(pathname) ?? null) : value;
  const current = accounts.find((a) => a.id === currentId);

  const sections = useMemo(
    () => pickerSections({ accounts, starred, recent, query }),
    [accounts, starred, recent, query]
  );

  // Flattened, keyboard-navigable list. "All accounts" first when not searching.
  const groups = useMemo(() => {
    const g = [];
    if (!query) g.push({ title: null, items: [ALL] });
    if (sections.starred.length) g.push({ title: 'Starred', items: sections.starred });
    if (!query && sections.recent.length) g.push({ title: 'Recent', items: sections.recent });
    g.push({ title: query ? 'Results' : 'All accounts', items: sections.all });
    return g;
  }, [sections, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const choose = useCallback((account) => {
    close();
    const id = account?.id ?? null;
    if (mode === 'filter') {
      onSelect?.(id);
      return;
    }
    if (!id) {
      clearActAs();
      router.push('/manager');
      return;
    }
    const target = resolveSwitchTarget({ pathname, accountId: id, actAsId, accounts });
    if (!target) return;
    setSwitching(true);
    router.push(target);
  }, [close, mode, onSelect, clearActAs, router, pathname, actAsId, accounts, setSwitching]);

  // ⌘K / Ctrl+K
  useEffect(() => {
    if (!hotkey) return undefined;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hotkey]);

  // Outside click closes the popover.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) close(); };
    document.addEventListener('mousedown', onDown);
    setTimeout(() => inputRef.current?.focus(), 30);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, close]);

  useEffect(() => { setActive(0); }, [query]);

  const onListKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && flat[active]) { e.preventDefault(); choose(flat[active]); }
  };

  // Inside an account whose details haven't loaded yet (right after switching):
  // say so, never "All accounts".
  const label = current?.name || (currentId ? 'Loading…' : 'All accounts');

  const trigger = {
    rail: (
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        className="m-card !rounded-[1.25rem] w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:border-[var(--m-border-strong)] transition-colors">
        <span className="min-w-0 flex-1">
          <span className="block m-fs-11 font-medium m-muted">Working in</span>
          <span className="block truncate font-semibold">{label}</span>
        </span>
        <ChevronsUpDown size={16} strokeWidth={1.5} className="m-muted shrink-0" />
      </button>
    ),
    compact: (
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label={`Switch account (current: ${label})`} title={label}
        aria-haspopup="dialog" aria-expanded={open}
        className="m-card !rounded-2xl size-11 flex items-center justify-center font-bold text-[var(--accent)] hover:border-[var(--m-border-strong)]">
        {current ? current.name?.[0]?.toUpperCase() : <LayoutGrid size={16} strokeWidth={1.5} />}
      </button>
    ),
    bar: (
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        className="min-w-0 flex items-center gap-1.5 h-11 px-1 text-left">
        <span className="truncate font-semibold m-fs-15">{label}</span>
        <ChevronsUpDown size={16} strokeWidth={1.5} className="m-muted shrink-0" />
      </button>
    ),
    filter: (
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}
        className="m-input inline-flex items-center gap-2 max-w-[260px]">
        <span className="truncate">{label}</span>
        <ChevronsUpDown size={14} strokeWidth={1.5} className="m-muted shrink-0" />
      </button>
    ),
  }[variant];

  let index = -1;

  return (
    <div ref={rootRef} className="relative">
      {trigger}
      {open && (
        <div
          role="dialog"
          aria-label="Switch account"
          onKeyDown={onListKey}
          className={`fixed inset-0 z-[70] flex flex-col bg-[var(--m-surface-solid)]
            md:absolute md:inset-auto md:top-full md:mt-2 md:w-[360px] md:max-h-[480px] md:rounded-[1.5rem] md:border md:border-[var(--m-border)] md:shadow-[0_24px_60px_rgba(0,0,0,0.22)] md:overflow-hidden
            ${variant === 'compact' ? 'md:left-full md:top-0 md:mt-0 md:ml-2' : 'md:left-0'}`}
        >
          <div className="flex items-center gap-2 px-3 pt-[max(12px,env(safe-area-inset-top))] md:pt-3 pb-2 border-b border-[var(--m-border)]">
            <Search size={16} strokeWidth={1.5} className="m-muted shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search accounts"
              aria-label="Search accounts"
              className="flex-1 h-10 bg-transparent outline-none m-fs-15-13 placeholder:text-[var(--m-text-faint)]"
            />
            <kbd className="hidden md:inline m-fs-11 m-faint border border-[var(--m-border)] rounded px-1.5 py-0.5">Esc</kbd>
            <button type="button" onClick={close} className="m-btn !px-2.5 md:!hidden" aria-label="Close">
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-1.5" role="listbox" aria-label="Accounts">
            {flat.length === 0 && <p className="px-4 py-8 text-center m-muted">No accounts match “{query}”.</p>}
            {groups.map((group) => (
              <div key={group.title || 'all-option'}>
                {group.title && group.items.length > 0 && (
                  <p className="px-4 pt-3 pb-1 m-fs-11 font-semibold m-muted">{group.title}</p>
                )}
                {group.items.map((account) => {
                  index += 1;
                  const i = index;
                  const selected = (account.id ?? null) === (currentId ?? null);
                  const isStarred = account.id && starred.some((s) => s.id === account.id);
                  return (
                    <div
                      key={`${group.title}-${account.id ?? 'all'}`}
                      role="option"
                      aria-selected={selected}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(account)}
                      className={`group mx-1.5 flex items-center gap-3 px-2.5 min-h-[56px] md:min-h-[48px] rounded-2xl cursor-pointer ${
                        active === i ? 'bg-[var(--m-surface-hover)]' : ''
                      }`}
                    >
                      {account.id ? (
                        <span className="m-avatar !size-8 m-fs-12" aria-hidden="true">{(account.name || '?').trim().charAt(0).toUpperCase()}</span>
                      ) : (
                        <span className="m-icon-tile m-tone-indigo !size-8 !rounded-[0.875rem]" aria-hidden="true"><LayoutGrid size={14} strokeWidth={1.75} /></span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate ${selected ? 'font-semibold text-[var(--accent)]' : 'font-medium'}`} title={account.name}>{account.name}</span>
                        {account.id && (
                          <span className="flex items-center gap-1.5 truncate m-fs-12 m-muted">
                            <StatusDot status={account.health || 'neutral'} label={HEALTH_LABEL[account.health] || 'Status unknown'} />
                            {account.owned ? 'Own account' : (TYPE_LABEL[account.role] || account.role)}
                          </span>
                        )}
                      </span>
                      {account.tasks > 0 && <span className="m-pill m-pill-warn !py-0 !px-2 m-num m-fs-11">{account.tasks}</span>}
                      {account.id && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleStar(account.id); }}
                          aria-label={isStarred ? `Unstar ${account.name}` : `Star ${account.name}`}
                          aria-pressed={isStarred}
                          className={`p-1.5 rounded-md ${isStarred ? 'm-warn' : 'm-faint opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100'}`}
                        >
                          <Star size={14} strokeWidth={1.5} fill={isStarred ? 'currentColor' : 'none'} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          {hotkey && (
            <div className="hidden md:flex items-center justify-between px-4 py-2 border-t border-[var(--m-border)] m-fs-11 m-faint">
              <span>↑ ↓ to move · Enter to open</span>
              <span>⌘K</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
