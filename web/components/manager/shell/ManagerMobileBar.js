'use client';

import Link from 'next/link';
import { Store } from 'lucide-react';
import AccountPicker from '@/components/manager/AccountPicker';
import WorkingAsStrip from './WorkingAsStrip';

/** Phone header: account picker + marketplace shortcut. */
export default function ManagerMobileBar({ account, inWorkspace }) {
  return (
    <header className={`md:hidden fixed inset-x-0 top-0 z-[60] bg-[var(--m-surface-solid)] pt-[env(safe-area-inset-top,0px)] ${inWorkspace ? '' : 'border-b border-[var(--m-border)]'}`}>
      <div className="h-14 flex items-center justify-between gap-2 px-3">
        <div className="min-w-0 flex-1">
          <AccountPicker mode="navigate" variant="bar" />
        </div>
        <Link href="/shop" aria-label="Marketplace" className="size-10 shrink-0 rounded-xl border border-[var(--m-border)] bg-[var(--m-surface)] flex items-center justify-center m-muted hover:text-[var(--accent)]">
          <Store size={18} strokeWidth={1.5} />
        </Link>
      </div>
      {inWorkspace && <WorkingAsStrip account={account} mobile />}
    </header>
  );
}
