'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/services/api';
import { useManagerMode } from '@/hooks/useManagerMode';
import { getWorkspaceRoute, getWorkspaceNav } from '@/components/manager/workspaceRegistry';

/**
 * Dynamic workspace page — resolves the target user's role then
 * navigates to their actual page (vendor dashboard, logistics dashboard, etc.)
 * while the X-Act-As header is active.
 *
 * The role is resolved from:
 *   1. The manager's loaded accounts list (fast, no network call)
 *   2. A lightweight API call to GET /manager/accounts (fallback)
 */
export default function WorkspacePage() {
  const { userId, slug } = useParams();
  const router = useRouter();
  const accounts = useManagerMode((s) => s.accounts);
  const loadAccounts = useManagerMode((s) => s.loadAccounts);
  const pageSlug = Array.isArray(slug) ? slug[0] : slug || '';

  // Resolve role from accounts list, or fetch it
  const accountFromStore = accounts.find((a) => a.id === userId);
  const [resolvedRole, setResolvedRole] = useState(accountFromStore?.role || null);
  const [resolving, setResolving] = useState(!accountFromStore);
  const [error, setError] = useState(null);

  // If not in store, fetch accounts to resolve the role
  const resolveRole = useCallback(async () => {
    if (accountFromStore?.role) {
      setResolvedRole(accountFromStore.role);
      setResolving(false);
      return;
    }

    setResolving(true);
    try {
      // Try loading accounts (may already be cached)
      const result = await loadAccounts({ force: true });
      if (result?.success && result?.accounts) {
        const found = result.accounts.find((a) => a.id === userId);
        if (found?.role) {
          setResolvedRole(found.role);
          setResolving(false);
          return;
        }
      }

      // Fallback: direct API call for this specific user
      const res = await api.get(`/manager/accounts`);
      const accts = res.data?.data || [];
      const match = accts.find((a) => a.id === userId);
      if (match?.role) {
        setResolvedRole(match.role);
      } else {
        setError('Account not found in your assignments.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load account info');
    } finally {
      setResolving(false);
    }
  }, [userId, accountFromStore, loadAccounts]);

  useEffect(() => {
    if (!resolvedRole) resolveRole();
  }, [resolvedRole, resolveRole]);

  // Update if store changes (e.g. accounts finish loading later)
  useEffect(() => {
    if (accountFromStore?.role && !resolvedRole) {
      setResolvedRole(accountFromStore.role);
      setResolving(false);
    }
  }, [accountFromStore, resolvedRole]);

  const targetRoute = resolvedRole ? getWorkspaceRoute(resolvedRole, pageSlug) : null;
  const nav = resolvedRole ? getWorkspaceNav(resolvedRole) : [];
  const accountName = accountFromStore?.name || 'Account';

  // Navigate to the actual page — actAsId is already set by the layout
  useEffect(() => {
    if (targetRoute) {
      router.replace(targetRoute);
    }
  }, [targetRoute, router]);

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

  // No matching route for this slug
  if (!targetRoute) {
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

  // Show loading spinner while redirecting
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-[var(--text-muted)]">Opening {resolvedRole} dashboard...</p>
    </div>
  );
}
