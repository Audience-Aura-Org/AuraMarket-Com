'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Store } from 'lucide-react';
import { useManagerMode } from '@/hooks/useManagerMode';
import { useAuthStore } from '@/hooks/useAuth';
import AccountPicker from '@/components/manager/AccountPicker';
import { getWorkspaceNav } from '@/components/manager/workspaceNav';
import { MANAGER_SECTIONS, TYPE_LABEL, describePermissions, workspaceAccountId } from './nav';
import { useMinWidth } from './useMinWidth';

function RailLink({ href, icon: Icon, label, active, count }) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 h-10 rounded-[10px] px-3 md:justify-center lg:justify-start transition-colors ${
        active ? 'bg-[var(--m-surface-hover)] text-[var(--m-text)] font-medium' : 'm-muted hover:text-[var(--m-text)] hover:bg-[var(--m-surface)]'
      }`}
    >
      {active && <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-full bg-[var(--m-brand)]" />}
      <Icon size={16} strokeWidth={1.5} className="shrink-0" />
      <span className="md:hidden lg:inline truncate flex-1">{label}</span>
      {count > 0 && <span className="md:hidden lg:inline m-num m-fs-12">{count}</span>}
    </Link>
  );
}

/** Desktop rail (232px) / tablet icon strip (64px). Hidden on phones. */
export default function ManagerRail() {
  const pathname = usePathname() || '';
  const wide = useMinWidth(1024);
  const accounts = useManagerMode((s) => s.accounts);
  const user = useAuthStore((s) => s.user);
  const accountId = workspaceAccountId(pathname);
  const account = accounts.find((a) => a.id === accountId);
  const openTasks = accounts.reduce((n, a) => n + (a.tasks || 0), 0);

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-16 lg:w-[232px] flex-col border-r border-[var(--m-border)] bg-[var(--m-bg)]">
      <div className="px-3 pt-5 pb-4 lg:px-4">
        <Link href="/manager" className="flex items-center gap-2 md:justify-center lg:justify-start" aria-label="Manager home">
          <span className="m-headline m-fs-15 md:hidden lg:inline">Auradime</span>
          <span className="m-headline m-fs-15 hidden md:inline lg:hidden">A</span>
          <span className="m-fs-12 m-muted md:hidden lg:inline">Manager</span>
        </Link>
      </div>

      <div className="px-2.5 lg:px-3 pb-3 flex md:justify-center lg:block">
        <AccountPicker mode="navigate" variant={wide ? 'rail' : 'compact'} hotkey />
      </div>

      <nav aria-label="Manager" className="flex-1 overflow-y-auto px-2.5 lg:px-3 space-y-0.5">
        {accountId ? (
          <>
            <RailLink href="/manager" icon={ArrowLeft} label="All accounts" active={false} />
            {account && (
              <div className="hidden lg:block px-3 pt-4 pb-3">
                <p className="truncate font-medium" title={account.name}>{account.name}</p>
                <p className="m-fs-12 m-muted">{TYPE_LABEL[account.role] || account.role}</p>
                <p className="m-fs-12 m-faint mt-1.5 leading-snug">{describePermissions(account.permissions)}</p>
              </div>
            )}
            {getWorkspaceNav(account?.role).map((item) => {
              const href = `/manager/as/${accountId}/${item.slug}`;
              return (
                <RailLink key={item.slug} href={href} icon={item.icon} label={item.label}
                  active={pathname === href || pathname.startsWith(`${href}/`)} />
              );
            })}
          </>
        ) : (
          MANAGER_SECTIONS.map((s) => (
            <RailLink key={s.key} href={s.href} icon={s.icon} label={s.label}
              active={s.match(pathname)} count={s.key === 'inbox' ? openTasks : 0} />
          ))
        )}
      </nav>

      <div className="px-2.5 lg:px-3 py-3 space-y-0.5 border-t border-[var(--m-border)]">
        <RailLink href="/shop" icon={Store} label="Marketplace" active={false} />
        <Link href="/manager/settings" title={user?.name || 'Settings'}
          className="flex items-center gap-3 rounded-[10px] px-3 py-2 md:justify-center lg:justify-start hover:bg-[var(--m-surface)]">
          <span className="size-7 shrink-0 rounded-full border border-[var(--m-border-strong)] flex items-center justify-center m-fs-12 font-medium">
            {(user?.name || 'M')[0].toUpperCase()}
          </span>
          <span className="min-w-0 md:hidden lg:block">
            <span className="block truncate m-fs-13 font-medium">{user?.name || 'Manager'}</span>
            <span className="block m-fs-11 m-muted">Manager</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
