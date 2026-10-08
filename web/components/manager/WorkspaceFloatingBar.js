'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { useManagerMode } from '@/hooks/useManagerMode';
import Link from 'next/link';

/**
 * Floating bar shown when a manager has actAsId set.
 * Shows on all routes (including /manager/as/... workspace routes and
 * redirected target routes like /vendor/dashboard, /profile).
 * Provides account info, role badge, and quick exit.
 */
export default function WorkspaceFloatingBar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const actAsId = useManagerMode((s) => s.actAsId);
  const accounts = useManagerMode((s) => s.accounts);
  const clearActAs = useManagerMode((s) => s.clearActAs);

  // Only show when manager is acting-as someone
  if (user?.role !== 'manager' || !actAsId) return null;
  // Don't show on core manager-space pages (they have their own workspace header in sidebar)
  if (pathname?.startsWith('/manager') && !pathname?.startsWith('/manager/as/')) return null;

  const account = accounts.find((a) => a.id === actAsId);

  const roleIcon = account?.role === 'vendor'
    ? 'store'
    : account?.role === 'logistics'
    ? 'local_shipping'
    : 'person';

  const roleColor = account?.role === 'vendor'
    ? 'bg-pink-500'
    : account?.role === 'logistics'
    ? 'bg-purple-500'
    : 'bg-blue-500';

  return (
    <>
    {/* Spacer to prevent content from being hidden under the fixed bar */}
    <div className="h-[44px]" />
    <div className="fixed top-0 left-0 right-0 z-[999] bg-[var(--bg-primary)]/95 backdrop-blur-xl border-b border-amber-500/30 px-4 py-2 flex items-center justify-between gap-3 text-sm shadow-lg">
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
        <span className={`material-symbols-outlined text-base text-white ${roleColor} rounded-md p-0.5`}>
          {roleIcon}
        </span>
        <div className="min-w-0">
          <span className="text-[var(--text-primary)] font-semibold truncate block text-[13px]">
            {account?.name || 'User'}
          </span>
          {account?.role && (
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
              {account.role} workspace
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/manager/as/${actAsId}/dashboard`}
          className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <span className="material-symbols-outlined text-sm">grid_view</span>
          Pages
        </Link>
        <Link
          href="/manager"
          onClick={() => clearActAs()}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-bold hover:bg-amber-500/25 transition-colors"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Exit
        </Link>
      </div>
    </div>
    </>
  );
}
