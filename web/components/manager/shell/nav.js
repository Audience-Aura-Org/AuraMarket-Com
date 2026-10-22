import { LayoutGrid, Inbox, LineChart, NotebookPen, Settings } from 'lucide-react';

const under = (base) => (pathname) => pathname === base || pathname.startsWith(`${base}/`);

/** The five manager sections, in rail / bottom-tab order. */
export const MANAGER_SECTIONS = [
  { key: 'accounts', label: 'Accounts', href: '/manager', icon: LayoutGrid, match: (p) => p === '/manager' },
  { key: 'inbox', label: 'Inbox', href: '/manager/inbox', icon: Inbox, match: under('/manager/inbox') },
  { key: 'performance', label: 'Performance', href: '/manager/performance', icon: LineChart, match: under('/manager/performance') },
  { key: 'journal', label: 'Notes & Activity', shortLabel: 'Journal', href: '/manager/journal', icon: NotebookPen, match: under('/manager/journal') },
  { key: 'settings', label: 'Settings', href: '/manager/settings', icon: Settings, match: under('/manager/settings') },
];

export const TYPE_LABEL = { vendor: 'Vendor', logistics: 'Logistics', customer: 'Customer' };

/** "Products, Orders, Messages" — what the manager may do on an account. */
export function describePermissions(permissions = {}) {
  const labels = { products: 'Products', orders: 'Orders', messages: 'Messages', money: 'Money', profile: 'Profile' };
  const granted = Object.keys(labels).filter((k) => permissions?.[k]).map((k) => labels[k]);
  return granted.length ? granted.join(', ') : 'View only';
}

/** Account id when the path is inside an account workspace. */
export function workspaceAccountId(pathname = '') {
  return pathname.match(/^\/manager\/as\/([^/?#]+)/)?.[1] || null;
}
