'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/manager/ui';

/** Shown while an embedded page's code downloads (slow networks, first visit). */
function PageLoading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 md:px-8 py-6 space-y-4" aria-busy="true" aria-label="Loading page">
      <Skeleton className="h-7 w-56" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[2rem]" />)}
      </div>
      <Skeleton className="h-64 rounded-[2rem]" />
    </div>
  );
}
const PAGE_OPTIONS = { ssr: false, loading: PageLoading };

/**
 * Workspace Registry
 *
 * Maps role -> slug -> dynamically imported page component.
 * Pages are rendered INSIDE the manager layout with X-Act-As active,
 * so the manager never leaves their workspace. The API interceptor
 * adds the X-Act-As header making the backend treat the manager as
 * the target user.
 */

// Keys are the path below /vendor or /logistics (e.g. 'products/edit'), so a
// link inside an embedded page maps 1:1 onto /manager/as/{id}/{key}.
const COMPONENTS = {
  vendor: {
    dashboard:       dynamic(() => import('@/app/vendor/dashboard/page'), PAGE_OPTIONS),
    products:        dynamic(() => import('@/app/vendor/products/page'), PAGE_OPTIONS),
    'products/add':  dynamic(() => import('@/app/vendor/products/add/page'), PAGE_OPTIONS),
    'products/edit': dynamic(() => import('@/app/vendor/products/edit/page'), PAGE_OPTIONS),
    meals:           dynamic(() => import('@/app/vendor/meals/page'), PAGE_OPTIONS),
    'meals/add':     dynamic(() => import('@/app/vendor/meals/add/page'), PAGE_OPTIONS),
    kitchen:         dynamic(() => import('@/app/vendor/kitchen/page'), PAGE_OPTIONS),
    stories:         dynamic(() => import('@/app/vendor/stories/page'), PAGE_OPTIONS),
    orders:          dynamic(() => import('@/app/vendor/orders/page'), PAGE_OPTIONS),
    wallet:          dynamic(() => import('@/app/vendor/wallet/page'), PAGE_OPTIONS),
    analytics:       dynamic(() => import('@/app/vendor/analytics/page'), PAGE_OPTIONS),
    ratings:         dynamic(() => import('@/app/vendor/ratings/page'), PAGE_OPTIONS),
    disputes:        dynamic(() => import('@/app/vendor/disputes/page'), PAGE_OPTIONS),
  },
  logistics: {
    dashboard: dynamic(() => import('@/app/logistics/dashboard/page'), PAGE_OPTIONS),
    manifests: dynamic(() => import('@/app/logistics/manifests/page'), PAGE_OPTIONS),
    pricing:   dynamic(() => import('@/app/logistics/pricing/page'), PAGE_OPTIONS),
    tracking:  dynamic(() => import('@/app/logistics/tracking/page'), PAGE_OPTIONS),
    wallet:    dynamic(() => import('@/app/logistics/wallet/page'), PAGE_OPTIONS),
    messages:  dynamic(() => import('@/app/logistics/messages/page'), PAGE_OPTIONS),
    analytics: dynamic(() => import('@/app/logistics/analytics/page'), PAGE_OPTIONS),
    nodes:     dynamic(() => import('@/app/logistics/nodes/page'), PAGE_OPTIONS),
  },
  customer: {
    dashboard: dynamic(() => import('@/app/profile/page'), PAGE_OPTIONS),
    profile:   dynamic(() => import('@/app/profile/page'), PAGE_OPTIONS),
  },
};

/**
 * Get the page component for a given role and slug.
 * Returns null if no match found.
 */
export function getWorkspaceComponent(role, slug = 'dashboard') {
  const roleMap = COMPONENTS[role];
  if (!roleMap) return null;
  const section = String(slug).split('/')[0];
  return roleMap[slug] || roleMap[section] || roleMap.dashboard || null;
}

/** Workspace page navigation lives in workspaceNav.js (pure, testable). */
export { getWorkspaceNav } from './workspaceNav';
