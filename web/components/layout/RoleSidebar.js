"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { useTheme } from "@/context/ThemeContext";
import { useNotifications } from '@/hooks/useNotifications';
import { useChat } from '@/context/ChatContext';
import { useLanguage } from '@/context/LanguageContext';

const VENDOR_NAV = [
  { icon: 'home',                     label: 'Marketplace',      href: '/shop' },
  { icon: 'dashboard',                label: 'Dashboard',        href: '/vendor/dashboard' },
  { icon: 'workspace_premium',        label: 'Subscription',     href: '/subscribe?role=vendor' },
  { icon: 'inventory_2',              label: 'Products',         href: '/vendor/products' },
  { icon: 'auto_awesome',             label: 'Aura Stories',     href: '/vendor/stories' },
  { icon: 'shopping_cart',            label: 'Orders',           href: '/vendor/orders',    badge: 'orders' },
  { icon: 'star_rate',                label: 'Client Ratings',   href: '/vendor/ratings' },
  { icon: 'gavel',                    label: 'Disputes',         href: '/vendor/disputes' },
  { icon: 'chat',                     label: 'Messages',         href: '/chat',             badge: 'messages' },
  { icon: 'account_balance_wallet',   label: 'Wallet',           href: '/vendor/wallet' },
  { icon: 'analytics',                label: 'Analytics',        href: '/vendor/analytics' },
];

const ADMIN_NAV = [
  { icon: 'home',           label: 'Marketplace',      href: '/shop' },
  { icon: 'dashboard',      label: 'Dashboard',        href: '/admin/dashboard' },
  { icon: 'person',         label: 'Users',            href: '/admin/users' },
  { icon: 'store',          label: 'Vendors',          href: '/admin/vendors' },
  { icon: 'inventory',      label: 'Products',         href: '/admin/products' },
  { icon: 'receipt_long',   label: 'Orders',           href: '/admin/orders',      badge: 'orders' },
  { icon: 'chat',           label: 'Messages',         href: '/chat',              badge: 'messages' },
  { icon: 'forum',          label: 'System Comms',     href: '/admin/messages' },
  { icon: 'how_to_reg',     label: 'Vendor KYC',       href: '/admin/approvals' },
  { icon: 'gavel',          label: 'Disputes',         href: '/admin/disputes' },
  { icon: 'security',       label: 'Escrow & Fees',    href: '/admin/escrow' },
  { icon: 'account_balance_wallet',label: 'Withdrawals',    href: '/admin/withdrawals' },
  { icon: 'receipt_long',   label: 'Transactions',    href: '/admin/transactions' },
  { icon: 'workspace_premium', label: 'Subscriptions', href: '/admin/subscriptions' },
  { icon: 'local_shipping', label: 'Shipment Node',    href: '/admin/logistics' },
  { icon: 'payments',       label: 'Earnings',          href: '/admin/logistics/earnings' },
  { icon: 'monitoring',     label: 'Analytics',        href: '/admin/analytics' },
  { icon: 'category',       label: 'Categories',       href: '/admin/categories' },
  { icon: 'star',           label: 'Reviews',          href: '/admin/reviews' },
  { icon: 'mark_email_read', label: 'Email Logs',      href: '/admin/notifications/email-logs' },
  { icon: 'history',         label: 'Audit Ledger',    href: '/admin/audit' },
  { icon: 'web',            label: 'CMS / Hero',       href: '/admin/homepage' },
];

const CUSTOMER_NAV = [
  { icon: 'home',                     label: 'Marketplace',      href: '/shop' },
  { icon: 'shopping_bag',             label: 'Orders',           href: '/profile?tab=orders' },
  { icon: 'favorite',                 label: 'Wishlist',         href: '/wishlist' },
  { icon: 'chat',                     label: 'Messages',         href: '/chat',             badge: 'messages' },
  { icon: 'account_balance_wallet',   label: 'Wallet',           href: '/wallet' },
  { icon: 'workspace_premium',        label: 'Subscription',     href: '/subscribe?role=customer' },
  { icon: 'person',                   label: 'Profile',          href: '/profile?tab=general' },
];

const ACCOUNT_NAV = [
  { icon: 'shield',        label: 'Security',      href: '/profile?tab=security' },
  { icon: 'group',         label: 'Network',       href: '/profile?tab=network' },
  { icon: 'verified_user', label: 'Verification',  href: '/profile?tab=kyc' },
  { icon: 'notifications', label: 'Alerts',        href: '/profile?tab=notifications' },
];

const LOGISTICS_NAV = [
  { icon: 'home',                label: 'Marketplace',  href: '/shop' },
  { icon: 'dashboard_customize', label: 'Dashboard',    href: '/logistics/dashboard' },
  { icon: 'workspace_premium',   label: 'Subscription', href: '/subscribe?role=logistics' },
  { icon: 'list_alt',            label: 'Manifests',    href: '/logistics/manifests', badge: 'orders' },
  { icon: 'payments',            label: 'Route Pricing',href: '/logistics/pricing' },
  { icon: 'location_on',         label: 'Live Tracking',href: '/logistics/tracking' },
  { icon: 'auto_awesome',        label: 'Aura Stories', href: '/discovery?tab=status' },
  { icon: 'chat',                label: 'Messages',     href: '/logistics/messages', badge: 'messages' },
  { icon: 'hub',                 label: 'Relay Nodes',  href: '/logistics/nodes' },
  { icon: 'account_balance_wallet',   label: 'Wallet',           href: '/logistics/wallet' },
];

const ROLE_CONFIG = {
  customer: {
    nav: CUSTOMER_NAV,
    label: 'Aura Member',
    accent: '#2dd4bf',
    plan: 'Standard Tier',
    icon: 'star',
  },
  vendor: {
    nav: VENDOR_NAV,
    label: 'Vendor Premium',
    accent: '#f20df2',
    plan: 'Pro Vendor',
    icon: 'auto_awesome',
  },
  admin: {
    nav: ADMIN_NAV,
    label: 'Governance Mode',
    accent: '#bf34bf',
    plan: 'Admin Access',
    icon: 'shield_with_heart',
  },
  logistics: {
    nav: LOGISTICS_NAV,
    label: 'Fulfillment Node',
    accent: '#a855f7',
    plan: 'Logistics Ops',
    icon: 'local_shipping',
  },
};

export default function RoleSidebar({ role, isOpen, onClose }) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.customer;

  const { unreadCount, unreadMessages } = useNotifications();
  const { openChat, isOpen: chatOverlayOpen } = useChat();

  const getBadge = (item) => {
    if (item.badge === 'messages') return unreadMessages;
    if (item.badge === 'orders')   return unreadCount;
    return 0;
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-[180] lg:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      <aside className={`fixed inset-y-0 left-0 w-[88vw] max-w-[270px] lg:w-[240px] bg-[var(--bg-primary)]/80 backdrop-blur-xl border-r border-[var(--glass-border)]/50 flex flex-col h-full z-[220] transition-transform duration-500 ease-in-out transform font-poppins ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Logo Area */}
        <div className="p-5 flex items-center justify-between border-b border-[var(--glass-border)] opacity-90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-6 w-auto flex items-center justify-center shrink-0">
               <img 
                 src="/icon-512.png" 
                 alt="Aura Dime" 
                 className="h-4 w-auto object-contain"
               />
            </div>
            <div className="flex flex-col min-w-0">
               <h1 className="text-[12px]  font-semibold tracking-tighter text-[var(--text-primary)] leading-none">Aura<span className="text-[var(--accent)]">Dime</span></h1>
               <p className="text-[10px] lg:text-[12px] font-medium tracking-tight opacity-80 mt-1" style={{ color: config.accent }}>{t(`roleSidebar.${role}.label`, config.label)}</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors shrink-0">
            <span className="material-symbols-outlined">close_fullscreen</span>
          </button>
        </div>

        {/* Global Notifications */}
        <div className="px-4 py-3 border-b border-[var(--glass-border)] flex items-center gap-3">
          <Link
            href="/notifications"
            onClick={() => { if (window.innerWidth < 1024) onClose(); }}
            className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--accent)]/5 transition-all group"
          >
            <span className="material-symbols-outlined text-xl text-[var(--text-secondary)] group-hover:text-[var(--accent)] transition-colors">notifications</span>
            <span className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">{t('nav.signals', 'Signals')}</span>
            {unreadCount > 0 && (
              <span
                className="ml-auto min-w-[20px] h-5 px-1.5 text-white text-[11px] lg:text-[12px]  font-semibold rounded-full flex items-center justify-center animate-pulse"
                style={{ background: config.accent }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto no-scrollbar">
          {/* Main Navigation */}
          {[...config.nav, ...ACCOUNT_NAV].map(item => {
            const itemPath = item.href.split('?')[0];
            
            // Re-evaluating isActive more simply for the profile tabs
            const currentTab = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') : null;
            const itemTab = item.href.includes('tab=') ? item.href.split('tab=')[1] : null;
            const isTabActive = item.href.startsWith('/profile') && pathname === '/profile' && currentTab === itemTab;
            const isRegularActive =
              !item.href.startsWith('/profile') &&
              (pathname === itemPath ||
                pathname?.startsWith(itemPath + '/') ||
                (item.href === '/chat' && pathname === '/messages'));
            
            const isMessages = item.label === 'Messages';
            const isSystemComms = item.label === 'System Comms';
            const logisticsMessagesLink = role === 'logistics' && isMessages;
            const messagesActive =
              !logisticsMessagesLink && isMessages && chatOverlayOpen;
            const messagesHubActive =
              logisticsMessagesLink && pathname === '/logistics/messages';
            const active = item.href.includes('tab=')
              ? isTabActive
              : messagesActive || messagesHubActive || isRegularActive;

            const badge = getBadge(item);
            const isChatTrigger =
              isSystemComms || (isMessages && role !== 'logistics');
            const Comp = isChatTrigger ? 'button' : Link;

            return (
              <div key={item.href + item.label}>
                {item.label === 'Security' && (
                  <div className="pt-6 pb-2 px-4">
                    <p className="text-[11px] lg:text-[12px]  font-semibold tracking-tight text-[var(--text-secondary)] opacity-40">{t('nav.accountConfiguration', 'Account Configuration')}</p>
                  </div>
                )}
                <Comp
                  type={isChatTrigger ? 'button' : undefined}
                  href={isChatTrigger ? undefined : item.href}
                  onClick={(e) => { 
                    if (isMessages && role !== 'logistics') {
                      e.preventDefault();
                      openChat(null, null, null, false);
                    }
                    if (isSystemComms) {
                      e.preventDefault();
                      openChat(null, null, null, true);
                    }
                    if (window.innerWidth < 1024) onClose(); 
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all group text-left ${
                    active
                      ? 'border-l-[3px]'
                      : 'hover:bg-[var(--accent)]/5 border-l-[3px] border-transparent'
                  }`}
                  style={
                    active
                      ? {
                          background: `linear-gradient(90deg, ${config.accent}22 0%, transparent 100%)`,
                          borderLeftColor: config.accent,
                        }
                      : {}
                  }
                >
                  <span
                    className="material-symbols-outlined text-xl transition-colors"
                    style={{ color: active ? config.accent : 'var(--text-secondary)' }}
                  >
                    {item.icon}
                  </span>
                  <span className={`text-[11px] lg:text-[12px]  font-semibold tracking-tight transition-colors truncate flex-1 ${active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'}`}>
                    {t(`nav.${item.label.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '.')}`, item.label)}
                  </span>
                  {badge > 0 && (
                    <span
                      className="min-w-[20px] h-5 px-1.5 text-white text-[11px] lg:text-[12px]  font-semibold rounded-full flex items-center justify-center shadow-sm flex-shrink-0"
                      style={{ background: item.badge === 'messages' ? '#ef4444' : config.accent }}
                    >
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </Comp>
              </div>
            );
          })}

        </nav>

        <div className="p-6">
          <div
            className="glass-panel p-4 rounded-xl border border-[var(--glass-border)]"
            style={{ background: `${config.accent}08` }}
          >
            <p className="text-sm  font-bold text-[var(--text-primary)] flex items-center justify-between">
              {t(`roleSidebar.${role}.plan`, config.plan)}
              <span
                className="text-[10px] lg:text-[12px] text-white px-2 py-0.5 rounded-full"
                style={{ background: config.accent }}
              >
                {t('common.active', 'Active')}
              </span>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
