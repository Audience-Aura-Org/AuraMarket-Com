"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useTheme } from "@/context/ThemeContext";

const VENDOR_NAV = [
  { icon: 'dashboard', label: 'Dashboard', href: '/vendor/dashboard' },
  { icon: 'inventory_2', label: 'Products', href: '/vendor/products' },
  { icon: 'shopping_cart', label: 'Orders', href: '/vendor/orders' },
  { icon: 'star_rate', label: 'Client Ratings', href: '/vendor/ratings' },
  { icon: 'gavel', label: 'Disputes', href: '/vendor/disputes' },
  { icon: 'chat', label: 'Messages', href: '/messages' },
  { icon: 'account_balance_wallet', label: 'Wallet', href: '/wallet' },
  { icon: 'analytics', label: 'Analytics', href: '/vendor/analytics' },
];

const ADMIN_NAV = [
  { icon: 'dashboard', label: 'Dashboard', href: '/admin/dashboard' },
  { icon: 'person', label: 'Users', href: '/admin/users' },
  { icon: 'store', label: 'Vendors', href: '/admin/vendors' },
  { icon: 'inventory', label: 'Products', href: '/admin/products' },
  { icon: 'receipt_long', label: 'Orders', href: '/admin/orders' },
  { icon: 'chat', label: 'Messages', href: '/messages' },
  { icon: 'forum', label: 'System Comms', href: '/admin/messages' },
  { icon: 'how_to_reg', label: 'Vendor KYC', href: '/admin/approvals' },
  { icon: 'gavel', label: 'Disputes', href: '/admin/disputes' },
  { icon: 'account_balance', label: 'Escrow', href: '/admin/escrow' },
  { icon: 'local_shipping', label: 'Shipment Node', href: '/admin/logistics' },
  { icon: 'payments', label: 'Logistics Earnings', href: '/admin/logistics/earnings' },
  { icon: 'monitoring', label: 'Analytics', href: '/admin/analytics' },
  { icon: 'category', label: 'Categories', href: '/admin/categories' },
  { icon: 'star', label: 'Reviews', href: '/admin/reviews' },
  { icon: 'mark_email_read', label: 'Email Logs', href: '/admin/notifications/email-logs' },
  { icon: 'web', label: 'CMS / Hero', href: '/admin/homepage' },
];

const LOGISTICS_NAV = [
  { icon: 'dashboard_customize', label: 'Dashboard', href: '/logistics/dashboard' },
  { icon: 'list_alt', label: 'Manifests', href: '/logistics/manifests' },
  { icon: 'payments', label: 'Route Pricing', href: '/logistics/pricing' },
  { icon: 'location_on', label: 'Live Tracking', href: '/logistics/tracking' },

  { icon: 'chat', label: 'Messages', href: '/messages' },
  { icon: 'hub', label: 'Relay Nodes', href: '/logistics/nodes' },
];

const ROLE_CONFIG = {
  vendor: {
    nav: VENDOR_NAV,
    label: 'Vendor Premium',
    accent: '#f20df2',
    plan: 'Pro Vendor',
    icon: 'auto_awesome',
    statusLabel: 'Platform Status',
    statusValue: 'Active',
  },
  admin: {
    nav: ADMIN_NAV,
    label: 'Governance Mode',
    accent: '#bf34bf',
    plan: 'Admin Access',
    icon: 'shield_with_heart',
    statusLabel: 'Platform Status',
    statusValue: 'Critical Secure',
  },
  logistics: {
    nav: LOGISTICS_NAV,
    label: 'Fulfillment Node',
    accent: '#a855f7',
    plan: 'Logistics Ops',
    icon: 'local_shipping',
    statusLabel: 'Network Health',
    statusValue: 'Optimal Flow',
  },
};

export default function RoleSidebar({ role, isOpen, onClose }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { theme } = useTheme();
  const router = useRouter();
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.vendor;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <>
      {/* Backdrop for Mobile */}
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[180] lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Aside */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-[88vw] max-w-72 lg:w-72 bg-[var(--bg-primary)] border-r border-[var(--glass-border)] flex flex-col h-full z-[200] transition-transform duration-500 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo Area */}
        <div className="p-5 flex items-center justify-between border-b border-[var(--glass-border)] opacity-90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-6 w-auto flex items-center justify-center shrink-0">
               <img 
                 src={theme === 'dark' ? '/logo-white.png' : '/logo-black.png'} 
                 alt="Aura Market" 
                 className="h-4 w-auto object-contain"
               />
            </div>
            <div className="flex flex-col min-w-0">
               <h1 className="text-[10px] font-black tracking-tight text-[var(--text-primary)] leading-none uppercase whitespace-nowrap overflow-hidden text-ellipsis">Aura <span className="text-[var(--accent)]">Market</span></h1>
               <p className="text-[7px] font-black tracking-[0.08em] uppercase opacity-50 mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: config.accent }}>{config.label}</p>
            </div>
          </div>
          {/* Mobile Close Button */}
          <button onClick={onClose} className="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors shrink-0">
            <span className="material-symbols-outlined">close_fullscreen</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {config.nav.map(item => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => { if(window.innerWidth < 1024) onClose(); }}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-all group ${
                  isActive
                    ? 'border-l-[3px]'
                    : 'hover:bg-[var(--accent)]/5 border-l-[3px] border-transparent'
                }`}
                style={
                  isActive
                    ? {
                        background: `linear-gradient(90deg, ${config.accent}22 0%, transparent 100%)`,
                        borderLeftColor: config.accent,
                      }
                    : {}
                }
              >
                <span
                  className="material-symbols-outlined text-xl transition-colors"
                  style={{ color: isActive ? config.accent : 'var(--text-secondary)' }}
                >
                  {item.icon}
                </span>
                <span className={`font-medium text-sm transition-colors truncate ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
          {/* ... existing Nav footer items ... */}
          <div className="pt-8 pb-2 px-4">
            <p className="text-[10px] tracking-widest text-[var(--text-secondary)] font-bold">Preferences</p>
          </div>

          <Link href="/settings" className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-[var(--accent)]/5 transition-all group border-l-[3px] border-transparent">
            <span className="material-symbols-outlined text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">settings</span>
            <span className="font-medium text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]">Settings</span>
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-4 px-4 py-3 rounded-lg hover:bg-red-500/10 transition-all group w-full border-l-[3px] border-transparent"
          >
            <span className="material-symbols-outlined text-[var(--text-secondary)] group-hover:text-red-500">logout</span>
            <span className="font-medium text-[var(--text-secondary)] group-hover:text-red-500">Sign Out</span>
          </button>
        </nav>

        {/* Footer Status */}
        <div className="p-6">
          <div
            className="glass-panel p-4 rounded-xl border border-[var(--glass-border)]"
            style={{ background: `${config.accent}08` }}
          >
            <p className="text-xs text-[var(--text-secondary)] mb-2">{config.statusLabel}</p>
            <p className="text-sm font-bold text-[var(--text-primary)] flex items-center justify-between">
              {config.plan}
              <span
                className="text-[10px] text-white px-2 py-0.5 rounded-full"
                style={{ background: config.accent }}
              >
                Active
              </span>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
