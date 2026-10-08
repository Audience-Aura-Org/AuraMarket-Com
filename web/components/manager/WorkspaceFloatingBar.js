'use client';

import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { useManagerMode } from '@/hooks/useManagerMode';
import Link from 'next/link';

/**
 * Floating bar shown when a manager has actAsId set and is viewing
 * a target user's pages (e.g. /vendor/dashboard, /profile).
 * Provides a quick way to return to manager space.
 */
export default function WorkspaceFloatingBar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const actAsId = useManagerMode((s) => s.actAsId);
  const accounts = useManagerMode((s) => s.accounts);
  const clearActAs = useManagerMode((s) => s.clearActAs);

  // Only show when manager is acting-as on a non-manager route
  if (user?.role !== 'manager' || !actAsId) return null;
  if (pathname?.startsWith('/manager')) return null;

  const account = accounts.find((a) => a.id === actAsId);

  return (
    <div className="fixed top-0 left-0 right-0 z-[999] bg-amber-500/95 backdrop-blur-sm text-black px-4 py-2 flex items-center justify-between gap-3 text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-2 h-2 rounded-full bg-black/30 animate-pulse flex-shrink-0" />
        <span className="truncate">
          Acting as <strong>{account?.name || 'User'}</strong>
          {account?.role && <span className="opacity-70"> ({account.role})</span>}
        </span>
      </div>
      <Link
        href="/manager"
        onClick={() => clearActAs()}
        className="flex-shrink-0 px-3 py-1 rounded-lg bg-black/20 hover:bg-black/30 text-black font-semibold text-xs transition-colors"
      >
        Exit Workspace
      </Link>
    </div>
  );
}
