'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import api from '@/services/api';
import { ActingAccountContext } from '@/hooks/useAuth';
import { useManagerMode } from '@/hooks/useManagerMode';
import { getWorkspaceComponent } from '@/components/manager/workspaceRegistry';
import { useActingAccount } from '@/components/manager/actingAccount';
import { EmptyState, Skeleton } from '@/components/manager/ui';

/**
 * Dynamic workspace page — renders the managed account's own page component
 * inline within the manager layout (like switching into a client account in
 * a Google Ads manager account).
 *
 *  - API calls carry X-Act-As, so the backend runs them as the account.
 *  - ActingAccountContext makes useAuthStore() return the account's profile
 *    for everything rendered below, so role/onboarding checks in the
 *    embedded pages pass and they never touch the manager's own session.
 */
export default function WorkspacePageClient() {
  const { userId, slug } = useParams();
  const actAsId = useManagerMode((s) => s.actAsId);
  const pageSlug = Array.isArray(slug) && slug.length ? slug.join('/') : slug || 'dashboard';

  const [loadedAccount, setLoadedAccount] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // The account currently in the URL; late responses for another are dropped.
  const currentUserId = useRef(userId);
  currentUserId.current = userId;

  const loadSession = useCallback(async () => {
    try {
      const res = await api.get(`/manager/accounts/${userId}/session`, {
        skipClientCache: true,
        __skipRetry: true,
      });
      if (currentUserId.current !== userId) return { success: false, stale: true };
      const user = res.data?.data?.user;
      if (!user) throw new Error('Account not found in your assignments.');
      setLoadedAccount(user);
      setError(null);
      return { success: true, user };
    } catch (err) {
      if (currentUserId.current !== userId) return { success: false, stale: true };
      setError(err.response?.data?.message || err.message || 'Failed to load account');
      return { success: false };
    } finally {
      if (currentUserId.current === userId) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    setLoadedAccount(null);
    setLoading(true);
    setError(null);
    loadSession();
  }, [loadSession]);

  // Stable helpers: embedded pages depend on them (see useActingAccount).
  const acting = useActingAccount({ account: loadedAccount, loadSession });
  const account = acting?.user || null;

  const PageComponent = account ? getWorkspaceComponent(account.role, pageSlug) : null;

  // Render nothing account-specific until the header (actAsId) and the loaded
  // profile both belong to the account in the URL — avoids a frame where a
  // previous account's identity is shown while switching.
  const ready = account && String(account._id) === String(userId) && actAsId === userId;
  if (loading || (!error && !ready)) {
    return (
      <div className="mx-auto w-full max-w-[1240px] px-4 md:px-8 py-6 space-y-4" aria-busy="true">
        <Skeleton className="h-7 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[2rem]" />)}
        </div>
        <Skeleton className="h-64 rounded-[2rem]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 md:px-8 py-10">
        <EmptyState
          title="Can't open this account"
          description={error}
          action={
            <div className="flex items-center justify-center gap-2">
              <button type="button" className="m-btn" onClick={() => { setLoading(true); loadSession(); }}>Retry</button>
              <Link href="/manager" className="m-btn m-btn-primary">All accounts</Link>
            </div>
          }
        />
      </div>
    );
  }

  if (!PageComponent) {
    return (
      <div className="mx-auto w-full max-w-[720px] px-4 md:px-8 py-10">
        <EmptyState title="Nothing to manage here yet" description="This account type has no workspace pages." />
      </div>
    );
  }

  // Re-mount on account switch so no state leaks between accounts.
  // .m-embedded restores the app's own surface and type for the page.
  return (
    <div className="m-embedded">
      <ActingAccountContext.Provider value={acting}>
        <PageComponent key={userId} />
      </ActingAccountContext.Provider>
    </div>
  );
}
