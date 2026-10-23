import {
  LayoutDashboard, Package, ShoppingCart, Wallet, BarChart3, Star, Scale,
  ClipboardList, Tags, MapPin, MessagesSquare, User,
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

export function getWorkspaceNav(role) {
  return NAVS[role] || [];
}

export function getWorkspaceNavGroups(role) {
  const nav = getWorkspaceNav(role);
  const sections = [
    ['Overview', ['dashboard']],
    ['Operations', ['products', 'orders', 'manifests', 'tracking']],
    ['Finance', ['wallet', 'pricing']],
    ['Communication & support', ['messages', 'disputes']],
    ['Insights', ['analytics', 'ratings']],
  ];
  return sections.map(([label, slugs]) => ({ label, items: nav.filter(item => slugs.includes(item.slug)) })).filter(section => section.items.length);
}
