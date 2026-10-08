'use client';

/**
 * Workspace Registry
 *
 * Maps role → slug → actual route path. When a manager enters
 * /manager/as/{userId}/{slug}, the workspace page navigates to
 * the actual route. The X-Act-As header injected by the API
 * interceptor (via useManagerMode.actAsId) makes the API treat
 * the manager as that user, so pages work unchanged.
 */

const ROUTES = {
  vendor: {
    ''          : '/vendor/dashboard',
    dashboard   : '/vendor/dashboard',
    products    : '/vendor/products',
    orders      : '/vendor/orders',
    wallet      : '/vendor/wallet',
    analytics   : '/vendor/analytics',
    ratings     : '/vendor/ratings',
    disputes    : '/vendor/disputes',
    stories     : '/vendor/stories',
    kitchen     : '/vendor/kitchen',
    meals       : '/vendor/meals',
  },

  logistics: {
    ''          : '/logistics/dashboard',
    dashboard   : '/logistics/dashboard',
    manifests   : '/logistics/manifests',
    pricing     : '/logistics/pricing',
    tracking    : '/logistics/tracking',
    wallet      : '/logistics/wallet',
    messages    : '/logistics/messages',
    analytics   : '/logistics/analytics',
    deliveries  : '/logistics/manifests',
  },

  customer: {
    ''          : '/profile',
    profile     : '/profile',
    orders      : '/profile?tab=orders',
  },
};

/**
 * Get the target route for a given role and slug.
 * @param {string} role — vendor, logistics, or customer
 * @param {string} slug — first segment of the catch-all path
 * @returns {string|null}
 */
export function getWorkspaceRoute(role, slug = '') {
  const roleMap = ROUTES[role];
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
