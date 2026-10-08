'use client';

import dynamic from 'next/dynamic';

/**
 * Workspace Registry
 *
 * Maps role → slug → existing page component using next/dynamic.
 * When a manager enters /manager/as/{userId}/{slug}, the workspace
 * layout renders the appropriate existing page. The X-Act-As header
 * makes the API treat the manager as that user, so pages work unchanged.
 */

const load = (path) => dynamic(() => import(`@/app/${path}/page`), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  ),
  ssr: false,
});

const REGISTRY = {
  vendor: {
    ''          : load('vendor/dashboard'),
    dashboard   : load('vendor/dashboard'),
    products    : load('vendor/products'),
    orders      : load('vendor/orders'),
    wallet      : load('vendor/wallet'),
    analytics   : load('vendor/analytics'),
    ratings     : load('vendor/ratings'),
    disputes    : load('vendor/disputes'),
    stories     : load('vendor/stories'),
    kitchen     : load('vendor/kitchen'),
    meals       : load('vendor/meals'),
  },

  logistics: {
    ''          : load('logistics/dashboard'),
    dashboard   : load('logistics/dashboard'),
    manifests   : load('logistics/manifests'),
    pricing     : load('logistics/pricing'),
    tracking    : load('logistics/tracking'),
    wallet      : load('logistics/wallet'),
    messages    : load('logistics/messages'),
    analytics   : load('logistics/analytics'),
    deliveries  : load('logistics/manifests'), // alias
  },

  customer: {
    ''          : load('profile'),
    profile     : load('profile'),
    orders      : load('profile'), // profile page has orders tab
  },
};

/**
 * Get the page component for a given role and slug.
 * @param {string} role — vendor, logistics, or customer
 * @param {string} slug — first segment of the catch-all path
 * @returns {React.Component|null}
 */
export function getWorkspacePage(role, slug = '') {
  const roleMap = REGISTRY[role];
  if (!roleMap) return null;
  return roleMap[slug] || null;
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
      { slug: 'profile',    label: 'Profile',    icon: 'person' },
      { slug: 'orders',     label: 'Orders',     icon: 'shopping_bag' },
    ],
  };
  return navs[role] || [];
}
