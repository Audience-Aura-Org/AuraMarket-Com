'use client';

import { useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useManagerMode } from '@/hooks/useManagerMode';
import { getWorkspaceComponent, getWorkspaceNav } from '@/components/manager/workspaceRegistry';

/**
 * Dynamic workspace page — renders the target user's page component
 * inline within the manager layout. The X-Act-As header is active
 * so all API calls work as the target user.
 *
 * No redirect — the manager stays in /manager/as/{userId}/{slug}
 * and sees the vendor/logistics/customer page inside their workspace.
 */
export default function WorkspacePage() {
  const { userId, slug } = useParams();
  const accounts = useManagerMode((s) => s.accounts);
  const loadAccounts = useManagerMode((s) => s.loadAccounts);
  const pageSlug = Array.isArray(slug) ? slug[0] : slug || 'dashboard';

  // Resolve role from accounts list, or fetch it
  const accountFromStore = accounts.find((a) => a.id === userId);
  const [resolvedRole, setResolvedRole] = useState(accountFromStore?.role || null);
  const [resolving, setResolving] = useState(!accountFromStore);
  const [error, setError] = useState(null);

  const resolveRole = useCallback(async () => {
    if (accountFromStore?.role) {
      setResolvedRole(accountFromStore.role);
      setResolving(false);
      return;
    }

    setResolving(true);
    try {
      const result = await loadAccounts({ force: true });
      if (result?.success && result?.accounts) {
        const found = result.accounts.find((a) => a.id === userId);
        if (found?.role) {
          setResolvedRole(found.role);
          setResolving(false);
          return;
        }
      }
      setError('Account not found in your assignments.');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load account info');
    } finally {
      setResolving(false);
    }
  }, [userId, accountFromStore, loadAccounts]);

  useEffect(() => {
    if (!resolvedRole) resolveRole();
  }, [resolvedRole, resolveRole]);

  useEffect(() => {
    if (accountFromStore?.role && !resolvedRole) {
      setResolvedRole(accountFromStore.role);
      setResolving(false);
    }
  }, [accountFromStore, resolvedRole]);

  // Get the page component for this role + slug
  const PageComponent = resolvedRole ? getWorkspaceComponent(resolvedRole, pageSlug) : null;
  const nav = resolvedRole ? getWorkspaceNav(resolvedRole) : [];
  const accountName = accountFromStore?.name || 'Account';

  // Loading state
  if (resolving) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[var(--text-muted)]">Loading workspace...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-16">
        <p className="text-lg text-[var(--text-primary)] mb-2">Cannot open workspace</p>
        <p className="text-sm text-[var(--text-muted)] mb-4">{error}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => { setError(null); setResolving(true); resolveRole(); }}
            className="px-4 py-2 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors"
          >
            Retry
          </button>
          <Link
            href="/manager/accounts"
            className="px-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            View accounts
          </Link>
        </div>
      </div>
    );
  }

  // No matching component for this slug — show nav links
  if (!PageComponent) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-display font-semibold text-[var(--text-primary)] mb-3">
            {accountName} Workspace
          </h2>
          <div className="flex flex-wrap gap-2">
            {nav.map((item) => (
              <Link
                key={item.slug}
                href={`/manager/as/${userId}/${item.slug}`}
                className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--glass-border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-blue-500/30 transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-rounded text-[16px]">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="text-center py-16 text-[var(--text-muted)]">
          <p className="text-lg mb-2">Page not found</p>
          <p className="text-sm">Select a workspace page above, or go to the{' '}
            <Link href={`/manager/as/${userId}/dashboard`} className="text-blue-400 hover:text-blue-300">
              dashboard
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // Render the page component inline within the manager workspace
  return <PageComponent />;
}
