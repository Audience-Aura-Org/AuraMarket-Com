'use client';

import Link from 'next/link';
import { TYPE_LABEL } from './nav';

/**
 * Persistent reminder of whose account the manager is acting in.
 * Accent-tinted glass strip, like the vendor dashboard header.
 */
export default function WorkingAsStrip({ account, mobile = false }) {
  return (
    <div className={mobile
      ? 'h-11 border-t border-[var(--m-border)] bg-[var(--m-surface-solid)]'
      : 'hidden md:sticky md:top-0 md:z-50 md:block border-b border-[var(--m-border)] bg-[var(--m-surface-solid)]/90 md:backdrop-blur-2xl'}>
      <div className="flex items-center gap-3 h-full px-4 md:px-6">
        <span className="size-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate">
          <span className="m-muted">Working as </span>
          {account?.name ? (
            <span className="font-semibold" title={account.name}>{account.name}</span>
          ) : (
            // Name not loaded yet (e.g. right after switching): a placeholder, never the word "Account".
            <span className="inline-block h-3 w-28 align-middle rounded-full bg-[var(--bg-secondary)] animate-pulse" aria-label="Loading account" />
          )}
          {account?.role && <span className="m-muted"> · {TYPE_LABEL[account.role] || account.role}</span>}
          <span className="hidden md:inline m-faint"> · changes are logged</span>
        </p>
        <Link href="/manager" className="m-btn !min-h-8 shrink-0">Exit</Link>
      </div>
    </div>
  );
}
