'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Store } from 'lucide-react';
import { useManagerMode } from '@/hooks/useManagerMode';
import { useAuthStore } from '@/hooks/useAuth';
import AccountPicker from '@/components/manager/AccountPicker';
import { getWorkspaceNavGroups } from '@/components/manager/workspaceNav';
import { MANAGER_SECTIONS, TYPE_LABEL, describePermissions, workspaceAccountId } from './nav';
import { useMinWidth } from './useMinWidth';

function RailLink({ href, icon: Icon, label, active, count }) {
  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 h-11 rounded-2xl px-3 md:justify-center lg:justify-start transition-all font-medium ${
        active
          ? 'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--m-text)] font-semibold'
          : 'm-muted hover:text-[var(--accent)] hover:bg-[var(--m-surface-hover)]'
      }`}
    >
      {active && <span aria-hidden="true" className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-[var(--accent)]" />}
      <Icon size={18} strokeWidth={1.75} className={`shrink-0 ${active ? 'text-[var(--accent)]' : ''}`} />
      <span className="md:hidden lg:inline truncate flex-1">{label}</span>
      {count > 0 && (
        <span className="md:hidden lg:inline-flex m-num m-fs-11 font-bold min-w-[22px] h-[22px] px-1.5 items-center justify-center rounded-full bg-[var(--accent)] text-white">{count}</span>
      )}
    </Link>
  );
}

/** Desktop rail (272px) / tablet icon strip (64px). Hidden on phones. */
export default function ManagerRail() {
  const pathname = usePathname() || '';
  const wide = useMinWidth(1024);
  const accounts = useManagerMode((s) => s.accounts);
  const user = useAuthStore((s) => s.user);
  const accountId = workspaceAccountId(pathname);
  const account = accounts.find((a) => a.id === accountId);
  const openTasks = accounts.reduce((n, a) => n + (a.tasks || 0), 0);

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-16 lg:w-[272px] flex-col border-r border-[var(--m-border)] bg-[var(--m-surface-solid)]/80 backdrop-blur-2xl">
      <div className="px-3 pt-5 pb-4 lg:px-4">
        <Link href="/manager" className="flex items-center gap-2.5 md:justify-center lg:justify-start" aria-label="Manager home">
          <span className="size-9 shrink-0 rounded-xl bg-gradient-to-br from-[color-mix(in_srgb,var(--accent)_20%,transparent)] to-indigo-600/10 border border-[color-mix(in_srgb,var(--accent)_20%,transparent)] flex items-center justify-center">
            <img src="/icon-192.png" alt="" className="size-5 object-contain" />
          </span>
          <span className="md:hidden lg:block leading-tight">
            <span className="block m-headline m-fs-15">Auradime</span>
            <span className="block m-fs-11 font-semibold text-[var(--accent)]">Manager</span>
          </span>
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
              <div className="hidden lg:block mx-1 my-3 p-3 rounded-[1.25rem] border border-[var(--m-border)] bg-[var(--m-surface)]">
                <p className="truncate font-semibold" title={account.name}>{account.name}</p>
                <p className="m-fs-12 m-muted">{TYPE_LABEL[account.role] || account.role}</p>
                <p className="m-fs-12 m-faint mt-1.5 leading-snug">{describePermissions(account.permissions)}</p>
              </div>
            )}
            {getWorkspaceNavGroups(account?.role).map(group => <div key={group.label} className="pt-3 first:pt-0" role="group" aria-label={group.label}>
              <p className="hidden lg:block px-3 pb-2 m-fs-11 m-faint font-medium">{group.label}</p>
              <div className="space-y-0.5">{group.items.map(item => {
                const href = '/manager/as/' + accountId + '/' + item.slug;
                return <RailLink key={item.slug} href={href} icon={item.icon} label={item.label} active={pathname === href || pathname.startsWith(href + '/')} />;
              })}</div>
            </div>)}

          </>
        ) : (
          [['Workspace', ['accounts', 'inbox']], ['Review & records', ['performance', 'journal']], ['Preferences', ['settings']]].map(([label, keys]) => (
            <div key={label} role="group" aria-label={label} className="pt-3 first:pt-0">
              <p className="hidden lg:block px-3 pb-2 m-fs-11 m-faint font-medium">{label}</p>
              <div className="space-y-0.5">{MANAGER_SECTIONS.filter(section => keys.includes(section.key)).map(section => (
                <RailLink key={section.key} href={section.href} icon={section.icon} label={section.label} active={section.match(pathname)} count={section.key === 'inbox' ? openTasks : 0} />
              ))}</div>
            </div>
          ))
        )}
      </nav>

      <div className="px-2.5 lg:px-3 py-3 space-y-0.5 border-t border-[var(--m-border)]">
        <RailLink href="/shop" icon={Store} label="Marketplace" active={false} />
        <Link href="/manager/settings" title={user?.name || 'Settings'}
          className="flex items-center gap-3 rounded-2xl px-2.5 py-2 md:justify-center lg:justify-start hover:bg-[var(--m-surface-hover)]">
          <span className="m-avatar !size-8 m-fs-12">
            {(user?.name || 'M')[0].toUpperCase()}
          </span>
          <span className="min-w-0 md:hidden lg:block">
            <span className="block truncate m-fs-13 font-semibold">{user?.name || 'Manager'}</span>
            <span className="block m-fs-11 m-muted">Manager</span>
          </span>
        </Link>
      </div>
    </aside>
  );
}
