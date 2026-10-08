'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useParams } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';

// Use useLayoutEffect on client, useEffect on server (SSR safety)
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Workspace layout — sets the actAsId when entering a user's workspace.
 * All API calls made by child pages will include X-Act-As header.
 *
 * NOTE: We do NOT clear actAsId on unmount. When the workspace redirects
 * to the target user's actual route (e.g. /vendor/dashboard, /profile),
 * this layout unmounts but actAsId must remain set so the API interceptor
 * continues sending X-Act-As. Clearing happens in the manager layout
 * when navigating back to manager-space routes.
 *
 * Uses useLayoutEffect so actAsId is set BEFORE child useEffect hooks
 * fire (the workspace page's redirect useEffect needs actAsId set).
 */
export default function WorkspaceLayout({ children }) {
  const { userId } = useParams();
  const setActAs = useManagerMode((s) => s.setActAs);
  const accounts = useManagerMode((s) => s.accounts);
  const account = accounts.find((a) => a.id === userId);

  useIsomorphicLayoutEffect(() => {
    if (userId) setActAs(userId);
    // Intentionally no cleanup — see note above
  }, [userId, setActAs]);

  return (
    <div>
      {/* Workspace status bar */}
      <div className="mx-4 lg:mx-6 mt-4 px-4 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center gap-3 text-sm">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-amber-300">
          Acting as{' '}
          <strong className="text-amber-200">{account?.name || 'User'}</strong>
          {account?.role && (
            <span className="ml-1 text-amber-400/70">({account.role})</span>
          )}
          <span className="ml-2 text-amber-500/70">— changes are logged</span>
        </span>
      </div>
      {children}
    </div>
  );
}
