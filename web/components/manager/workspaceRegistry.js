'use client';

import dynamic from 'next/dynamic';

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
    dashboard:       dynamic(() => import('@/app/vendor/dashboard/page'), { ssr: false }),
    products:        dynamic(() => import('@/app/vendor/products/page'), { ssr: false }),
    'products/add':  dynamic(() => import('@/app/vendor/products/add/page'), { ssr: false }),
    'products/edit': dynamic(() => import('@/app/vendor/products/edit/page'), { ssr: false }),
    meals:           dynamic(() => import('@/app/vendor/meals/page'), { ssr: false }),
    'meals/add':     dynamic(() => import('@/app/vendor/meals/add/page'), { ssr: false }),
    kitchen:         dynamic(() => import('@/app/vendor/kitchen/page'), { ssr: false }),
    stories:         dynamic(() => import('@/app/vendor/stories/page'), { ssr: false }),
    orders:          dynamic(() => import('@/app/vendor/orders/page'), { ssr: false }),
    wallet:          dynamic(() => import('@/app/vendor/wallet/page'), { ssr: false }),
    analytics:       dynamic(() => import('@/app/vendor/analytics/page'), { ssr: false }),
    ratings:         dynamic(() => import('@/app/vendor/ratings/page'), { ssr: false }),
    disputes:        dynamic(() => import('@/app/vendor/disputes/page'), { ssr: false }),
  },
  logistics: {
    dashboard: dynamic(() => import('@/app/logistics/dashboard/page'), { ssr: false }),
    manifests: dynamic(() => import('@/app/logistics/manifests/page'), { ssr: false }),
    pricing:   dynamic(() => import('@/app/logistics/pricing/page'), { ssr: false }),
    tracking:  dynamic(() => import('@/app/logistics/tracking/page'), { ssr: false }),
    wallet:    dynamic(() => import('@/app/logistics/wallet/page'), { ssr: false }),
    messages:  dynamic(() => import('@/app/logistics/messages/page'), { ssr: false }),
    analytics: dynamic(() => import('@/app/logistics/analytics/page'), { ssr: false }),
    nodes:     dynamic(() => import('@/app/logistics/nodes/page'), { ssr: false }),
  },
  customer: {
    dashboard: dynamic(() => import('@/app/profile/page'), { ssr: false }),
    profile:   dynamic(() => import('@/app/profile/page'), { ssr: false }),
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
