'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useManagerMode } from '@/hooks/useManagerMode';
import { getWorkspacePage, getWorkspaceNav } from '@/components/manager/workspaceRegistry';
import { ChevronRight } from 'lucide-react';

/**
 * Dynamic workspace page — renders the existing vendor/logistics/customer
 * page inside the manager workspace using the registry.
 */
export default function WorkspacePage() {
  const { userId, slug } = useParams();
  const accounts = useManagerMode((s) => s.accounts);
  const account = accounts.find((a) => a.id === userId);
  const role = account?.role || 'customer';
  const pageSlug = Array.isArray(slug) ? slug[0] : slug || '';

  const PageComponent = getWorkspacePage(role, pageSlug);
  const nav = getWorkspaceNav(role);

  if (!PageComponent) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        {/* Workspace navigation */}
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

  return (
    <div>
      {/* Workspace sub-navigation */}
      <div className="px-4 lg:px-6 mt-3 mb-1">
        <div className="flex flex-wrap gap-1.5">
          {nav.map((item) => (
            <Link
              key={item.slug}
              href={`/manager/as/${userId}/${item.slug}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                item.slug === pageSlug
                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/25'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <PageComponent />
    </div>
  );
}
