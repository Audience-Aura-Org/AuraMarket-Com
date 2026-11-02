import {
  LayoutDashboard, Package, ShoppingCart, Wallet, BarChart3, Star, Scale,
  ClipboardList, Tags, MapPin, MessagesSquare, User, ChefHat, UtensilsCrossed, PlusCircle,
} from 'lucide-react';

/**
 * Pages a manager can open inside each account type's workspace.
 * `slug` maps 1:1 onto /manager/as/{id}/{slug} and workspaceRegistry keys.
 */
const NAVS = {
  vendor: [
    { slug: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { slug: 'products',  label: 'Products',  icon: Package },
    { slug: 'orders',    label: 'Orders',    icon: ShoppingCart },
    { slug: 'messages',  label: 'Messages',  icon: MessagesSquare },
    { slug: 'wallet',    label: 'Wallet',    icon: Wallet },
    { slug: 'analytics', label: 'Analytics', icon: BarChart3 },
    { slug: 'ratings',   label: 'Ratings',   icon: Star },
    { slug: 'disputes',  label: 'Disputes',  icon: Scale },
  ],
  logistics: [
    { slug: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { slug: 'manifests', label: 'Manifests', icon: ClipboardList },
    { slug: 'pricing',   label: 'Pricing',   icon: Tags },
    { slug: 'tracking',  label: 'Tracking',  icon: MapPin },
    { slug: 'wallet',    label: 'Wallet',    icon: Wallet },
    { slug: 'messages',  label: 'Messages',  icon: MessagesSquare },
    { slug: 'analytics', label: 'Analytics', icon: BarChart3 },
  ],
  customer: [
    { slug: 'dashboard', label: 'Account', icon: User },
    { slug: 'messages', label: 'Messages', icon: MessagesSquare },
  ],
};

// A restaurant's own menu: kitchen and meals instead of products (as in its sidebar).
const RESTAURANT = [
  { slug: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { slug: 'kitchen',   label: 'Kitchen',   icon: ChefHat },
  { slug: 'meals',     label: 'Meals',     icon: UtensilsCrossed },
  { slug: 'meals/add', label: 'Add meal',  icon: PlusCircle },
  ...NAVS.vendor.filter((n) => !['dashboard', 'products'].includes(n.slug)),
];

/** Pages for an account; pass the account so restaurants get their kitchen pages. */
export function getWorkspaceNav(role, account = null) {
  if (role === 'vendor' && account?.vendor_type === 'restaurant') return RESTAURANT;
  return NAVS[role] || [];
}

export function getWorkspaceNavGroups(role, account = null) {
  const nav = getWorkspaceNav(role, account);
  const sections = [
    ['Overview', ['dashboard']],
    ['Kitchen', ['kitchen', 'meals', 'meals/add']],
    ['Operations', ['products', 'orders', 'manifests', 'tracking']],
    ['Finance', ['wallet', 'pricing']],
    ['Communication & support', ['messages', 'disputes']],
    ['Insights', ['analytics', 'ratings']],
  ];
  return sections.map(([label, slugs]) => ({ label, items: nav.filter(item => slugs.includes(item.slug)) })).filter(section => section.items.length);
}
