'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';
import { ArrowLeft, Shield } from 'lucide-react';

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

const ROLE_BANNER = {
  vendor:    { border: 'border-pink-500/30', bg: 'bg-pink-500/8',   text: 'text-pink-300',   accent: 'text-pink-200' },
  logistics: { border: 'border-purple-500/30', bg: 'bg-purple-500/8', text: 'text-purple-300', accent: 'text-purple-200' },
  customer:  { border: 'border-teal-500/30', bg: 'bg-teal-500/8',   text: 'text-teal-300',   accent: 'text-teal-200' },
};

export default function WorkspaceLayout({ children }) {
  const { userId } = useParams();
  const router = useRouter();
  const setActAs = useManagerMode((s) => s.setActAs);
  const setSwitching = useManagerMode((s) => s.setSwitching);
  const accounts = useManagerMode((s) => s.accounts);
  const account = accounts.find((a) => a.id === userId);

  useIsomorphicLayoutEffect(() => {
    if (userId) {
      setActAs(userId);
      // Clear switching state once workspace layout mounts
      setSwitching(false);
    }
    // Intentionally no cleanup — see note above
  }, [userId, setActAs, setSwitching]);

  const colors = ROLE_BANNER[account?.role] || ROLE_BANNER.customer;

  return (
    <div>
      {/* Workspace identity banner — distinct color per role so the manager
          never forgets which account they are operating in */}
      <div className={`mx-4 lg:mx-6 mt-4 px-4 py-2.5 rounded-lg ${colors.bg} border ${colors.border} flex items-center gap-3 text-sm`}>
        <Shield className={`w-4 h-4 ${colors.text} shrink-0`} />
        <span className={`flex-1 ${colors.text}`}>
          Working as{' '}
          <strong className={colors.accent}>{account?.name || 'User'}</strong>
          {account?.role && (
            <span className="ml-1 opacity-70">({account.role})</span>
          )}
          <span className="ml-2 opacity-50">— Changes are recorded and visible to them.</span>
        </span>
        <button
          onClick={() => router.push('/manager')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${colors.text} hover:bg-white/5 transition-colors shrink-0`}
        >
          <ArrowLeft className="w-3 h-3" />
          <span className="hidden sm:inline">Back to all accounts</span>
          <span className="sm:hidden">Back</span>
        </button>
      </div>
      {children}
    </div>
  );
}
