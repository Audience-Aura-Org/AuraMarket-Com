'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { useManagerMode } from '@/hooks/useManagerMode';
import { SidePanel } from '@/components/manager/ui';
import { getWorkspaceNav } from '@/components/manager/workspaceNav';
import { MANAGER_SECTIONS, workspaceAccountId } from './nav';

function Tab({ href, icon: Icon, label, active, count, onClick }) {
  const body = (
    <>
      <span className="relative">
        <span className={`flex items-center justify-center h-8 w-12 rounded-full transition-colors ${active ? 'bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]' : ''}`}>
          <Icon size={20} strokeWidth={active ? 2 : 1.5} />
        </span>
        {count > 0 && (
          <span className="absolute -top-1 left-7 min-w-4 h-4 px-1 rounded-full bg-[var(--accent)] text-white m-fs-10 leading-4 text-center m-num font-bold">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="m-fs-11 truncate max-w-full">{label}</span>
    </>
  );
  const cls = `flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 h-16 ${active ? 'text-[var(--m-text)] font-semibold' : 'm-muted font-medium'}`;
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
  if (accountId) {
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
      <nav aria-label="Manager" className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[var(--m-border)] bg-[var(--m-surface-solid)]/85 backdrop-blur-2xl pb-[env(safe-area-inset-bottom,0px)]">
        <div className="flex">
          {tabs}
          {accountId && <Tab icon={MoreHorizontal} label="More" onClick={() => setMoreOpen(true)} />}
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
