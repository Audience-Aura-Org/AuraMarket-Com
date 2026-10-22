'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { useManagerMode } from '@/hooks/useManagerMode';
import { SidePanel } from '@/components/manager/ui';
import { getWorkspaceNav } from '@/components/manager/workspaceNav';
import { MANAGER_SECTIONS, workspaceAccountId } from './nav';

/** One tab, styled exactly like the customer bottom nav (components/layout/BottomNav). */
function Tab({ href, icon: Icon, label, active, count, onClick }) {
  const body = (
    <>
      <div
        className={`relative rounded-xl p-1.5 transition-colors duration-200 ${
          active
            ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--accent)_22%,transparent)]'
            : 'bg-transparent'
        }`}
      >
        <Icon className="size-5 shrink-0 stroke-2 transition-colors" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-[var(--accent)] text-white text-[10px] leading-4 text-center font-bold tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </div>
      <span
        className={`max-w-full truncate px-0.5 text-[12px] font-medium leading-none tracking-tight transition-colors min-[380px]:text-[13px] font-[Poppins] ${
          active ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] opacity-90'
        }`}
      >
        {label}
      </span>
      {active && <span className="absolute bottom-1 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-80" aria-hidden="true" />}
    </>
  );
  const cls = `relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1 transition-colors duration-200 active:scale-[0.98] ${
    active ? 'text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
  }`;
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>{body}</button>
  ) : (
    <Link href={href} aria-current={active ? 'page' : undefined} className={cls}>{body}</Link>
  );
}

/** Phone bottom tabs: the five sections, or the open account's pages. */
export default function ManagerBottomTabs() {
  const pathname = usePathname() || '';
  const accounts = useManagerMode((s) => s.accounts);
  const [moreOpen, setMoreOpen] = useState(false);
  const accountId = workspaceAccountId(pathname);
  const account = accounts.find((a) => a.id === accountId);
  const openTasks = accounts.reduce((n, a) => n + (a.tasks || 0), 0);

  let tabs;
  let more = [];
  if (accountId && !account) {
    // Account details still loading (right after switching): placeholders
    // shaped like the tabs, not a lone "More".
    tabs = [0, 1, 2, 3].map((i) => (
      <div key={i} className="flex flex-1 flex-col items-center justify-center gap-1.5" aria-hidden="true">
        <span className="size-8 rounded-xl bg-[var(--bg-secondary)] animate-pulse" />
        <span className="h-2 w-10 rounded-full bg-[var(--bg-secondary)] animate-pulse" />
      </div>
    ));
  } else if (accountId) {
    const pages = getWorkspaceNav(account?.role).map((p) => ({ ...p, href: `/manager/as/${accountId}/${p.slug}` }));
    const isActive = (href) => pathname === href || pathname.startsWith(`${href}/`);
    tabs = pages.slice(0, 4).map((p) => <Tab key={p.slug} href={p.href} icon={p.icon} label={p.label} active={isActive(p.href)} />);
    more = pages.slice(4);
  } else {
    tabs = MANAGER_SECTIONS.map((s) => (
      <Tab key={s.key} href={s.href} icon={s.icon} label={s.shortLabel || s.label}
        active={s.match(pathname)} count={s.key === 'inbox' ? openTasks : 0} />
    ));
  }

  return (
    <>
      <nav aria-label="Manager" className="md:hidden fixed inset-x-0 bottom-0 z-40 w-full overflow-hidden rounded-t-[24px] border-t border-[var(--glass-border)] bg-[var(--bg-primary)] shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--text-primary)_8%,transparent),0_-8px_32px_-8px_rgba(0,0,0,0.14)] dark:shadow-[inset_0_1px_0_0_color-mix(in_srgb,var(--text-primary)_10%,transparent),0_-10px_36px_-8px_rgba(0,0,0,0.35)] pb-[env(safe-area-inset-bottom,0px)]">
        <div className="relative flex h-[68px] w-full items-center justify-around px-1 pt-0.5">
          {tabs}
          {accountId && account && <Tab icon={MoreHorizontal} label="More" onClick={() => setMoreOpen(true)} />}
        </div>
      </nav>
      {accountId && (
        <SidePanel open={moreOpen} onClose={() => setMoreOpen(false)} title={account?.name || 'Account'}>
          <div className="m-divide">
            {more.map((p) => (
              <Link key={p.slug} href={p.href} onClick={() => setMoreOpen(false)} className="flex items-center gap-3 h-14 font-medium">
                <span className="m-icon-tile m-tone-accent !size-9 !rounded-xl"><p.icon size={16} strokeWidth={1.75} /></span>
                {p.label}
              </Link>
            ))}
            <Link href="/manager" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 h-14 font-medium">
              <span className="m-icon-tile m-tone-indigo !size-9 !rounded-xl"><ArrowLeft size={16} strokeWidth={1.75} /></span>
              All accounts
            </Link>
          </div>
        </SidePanel>
      )}
    </>
  );
}
