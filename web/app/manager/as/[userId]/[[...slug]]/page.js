'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { useManagerMode } from '@/hooks/useManagerMode';
import { getWorkspaceRoute, getWorkspaceNav } from '@/components/manager/workspaceRegistry';

/**
 * Dynamic workspace page — navigates the manager to the actual
 * vendor/logistics/customer page while the X-Act-As header is active.
 */
export default function WorkspacePage() {
  const { userId, slug } = useParams();
  const router = useRouter();
  const accounts = useManagerMode((s) => s.accounts);
  const loaded = useManagerMode((s) => s.loaded);
  const account = accounts.find((a) => a.id === userId);
  const role = account?.role;
  const pageSlug = Array.isArray(slug) ? slug[0] : slug || '';

  const targetRoute = role ? getWorkspaceRoute(role, pageSlug) : null;
  const nav = role ? getWorkspaceNav(role) : [];

  // Navigate to the actual page — actAsId is already set by the layout
  useEffect(() => {
    if (targetRoute) {
      router.replace(targetRoute);
    }
  }, [targetRoute, router]);

  // Wait for accounts to load before showing "not found"
  if (!loaded || (!account && !loaded)) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Account not found in assignments
  if (!account) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-16">
        <p className="text-lg text-[var(--text-primary)] mb-2">Account not found</p>
        <p className="text-sm text-[var(--text-muted)]">
          This account may not be assigned to you.{' '}
          <Link href="/manager/accounts" className="text-blue-400 hover:text-blue-300">
            View your accounts
          </Link>
        </p>
      </div>
    );
  }

  // Show navigation if no matching route
  if (!targetRoute) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-display font-semibold text-[var(--text-primary)] mb-3">
            {account?.name || 'Account'} Workspace
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
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
