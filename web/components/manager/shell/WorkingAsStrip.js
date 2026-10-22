'use client';

import Link from 'next/link';
import { TYPE_LABEL } from './nav';

/**
 * Persistent reminder of whose account the manager is acting in.
 * Accent-tinted glass strip, like the vendor dashboard header.
 */
export default function WorkingAsStrip({ account }) {
  return (
    <div className="sticky top-[calc(56px+env(safe-area-inset-top,0px))] md:top-0 z-30 border-b border-[var(--m-border)] bg-[var(--m-surface-solid)]/80 backdrop-blur-2xl">
      <div className="flex items-center gap-3 h-11 px-4 md:px-6">
        <span className="size-2 rounded-full bg-[var(--accent)] animate-pulse shrink-0" aria-hidden="true" />
        <p className="min-w-0 flex-1 truncate">
          <span className="m-muted">Working as </span>
          <span className="font-semibold" title={account?.name}>{account?.name || 'Account'}</span>
          {account?.role && <span className="m-muted"> · {TYPE_LABEL[account.role] || account.role}</span>}
          <span className="hidden md:inline m-faint"> · changes are logged</span>
        </p>
        <Link href="/manager" className="m-btn !min-h-8 shrink-0">Exit</Link>
      </div>
    </div>
  );
}
