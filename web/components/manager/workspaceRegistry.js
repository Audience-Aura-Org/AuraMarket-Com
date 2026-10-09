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

const COMPONENTS = {
  vendor: {
    dashboard: dynamic(() => import('@/app/vendor/dashboard/page'), { ssr: false }),
    products:  dynamic(() => import('@/app/vendor/products/page'), { ssr: false }),
    orders:    dynamic(() => import('@/app/vendor/orders/page'), { ssr: false }),
    wallet:    dynamic(() => import('@/app/vendor/wallet/page'), { ssr: false }),
    analytics: dynamic(() => import('@/app/vendor/analytics/page'), { ssr: false }),
    ratings:   dynamic(() => import('@/app/vendor/ratings/page'), { ssr: false }),
    disputes:  dynamic(() => import('@/app/vendor/disputes/page'), { ssr: false }),
  },
  logistics: {
    dashboard: dynamic(() => import('@/app/logistics/dashboard/page'), { ssr: false }),
    manifests: dynamic(() => import('@/app/logistics/manifests/page'), { ssr: false }),
    pricing:   dynamic(() => import('@/app/logistics/pricing/page'), { ssr: false }),
    tracking:  dynamic(() => import('@/app/logistics/tracking/page'), { ssr: false }),
    wallet:    dynamic(() => import('@/app/logistics/wallet/page'), { ssr: false }),
    messages:  dynamic(() => import('@/app/logistics/messages/page'), { ssr: false }),
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
  return roleMap[slug] || roleMap.dashboard || null;
}

/**
 * Get the list of available workspace pages for a role.
 * Used to render the workspace navigation.
 */
export function getWorkspaceNav(role) {
  const navs = {
    vendor: [
      { slug: 'dashboard',  label: 'Dashboard',  icon: 'dashboard' },
      { slug: 'products',   label: 'Products',   icon: 'inventory_2' },
      { slug: 'orders',     label: 'Orders',     icon: 'shopping_cart' },
      { slug: 'wallet',     label: 'Wallet',     icon: 'account_balance_wallet' },
      { slug: 'analytics',  label: 'Analytics',  icon: 'analytics' },
      { slug: 'ratings',    label: 'Ratings',    icon: 'star_rate' },
      { slug: 'disputes',   label: 'Disputes',   icon: 'gavel' },
    ],
    logistics: [
      { slug: 'dashboard',  label: 'Dashboard',  icon: 'dashboard_customize' },
      { slug: 'manifests',  label: 'Manifests',  icon: 'list_alt' },
      { slug: 'pricing',    label: 'Pricing',    icon: 'payments' },
      { slug: 'tracking',   label: 'Tracking',   icon: 'location_on' },
      { slug: 'wallet',     label: 'Wallet',     icon: 'account_balance_wallet' },
      { slug: 'messages',   label: 'Messages',   icon: 'chat' },
    ],
    customer: [
      { slug: 'dashboard',  label: 'Dashboard',  icon: 'account_circle' },
    ],
  };
  return navs[role] || [];
}
