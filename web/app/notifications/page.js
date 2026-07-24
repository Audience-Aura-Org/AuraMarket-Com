"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  Package, CreditCard, MessageCircle, Trash2, CheckCheck,
  Sparkles, Store, Truck, ShoppingBag, Wallet2, Radio,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationService } from '@/services/notifications';
import Pagination from '@/components/common/Pagination';
import { normalizeAppRoute } from '@/lib/navigation';

// ── Type → visual config ─────────────────────────────────────────────────────
const TYPE_CONFIG = {
  order:            { label: 'SHOPPING HUB',  borderCls: 'border-l-blue-500',    iconBg: 'bg-blue-100 dark:bg-blue-500/15',    iconCls: 'text-blue-600 dark:text-blue-400',    Icon: ShoppingBag },
  order_status:     { label: 'SHOPPING HUB',  borderCls: 'border-l-blue-500',    iconBg: 'bg-blue-100 dark:bg-blue-500/15',    iconCls: 'text-blue-600 dark:text-blue-400',    Icon: Package },
  order_update:     { label: 'SHOPPING HUB',  borderCls: 'border-l-blue-500',    iconBg: 'bg-blue-100 dark:bg-blue-500/15',    iconCls: 'text-blue-600 dark:text-blue-400',    Icon: Package },
  payment:          { label: 'WALLET',         borderCls: 'border-l-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconCls: 'text-emerald-600 dark:text-emerald-400', Icon: CreditCard },
  payment_received: { label: 'WALLET',         borderCls: 'border-l-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconCls: 'text-emerald-600 dark:text-emerald-400', Icon: Wallet2 },
  wallet_update:    { label: 'WALLET',         borderCls: 'border-l-emerald-500', iconBg: 'bg-emerald-100 dark:bg-emerald-500/15', iconCls: 'text-emerald-600 dark:text-emerald-400', Icon: Wallet2 },
  chat:             { label: 'MESSAGES',       borderCls: 'border-l-[var(--accent)]', iconBg: 'bg-[var(--accent)]/10',          iconCls: 'text-[var(--accent)]',                Icon: MessageCircle },
  chat_alert:       { label: 'MESSAGES',       borderCls: 'border-l-[var(--accent)]', iconBg: 'bg-[var(--accent)]/10',          iconCls: 'text-[var(--accent)]',                Icon: MessageCircle },
  system:           { label: 'SYSTEM',         borderCls: 'border-l-amber-500',   iconBg: 'bg-amber-100 dark:bg-amber-500/15',   iconCls: 'text-amber-600 dark:text-amber-400',  Icon: Sparkles },
  system_alert:     { label: 'SYSTEM',         borderCls: 'border-l-amber-500',   iconBg: 'bg-amber-100 dark:bg-amber-500/15',   iconCls: 'text-amber-600 dark:text-amber-400',  Icon: Sparkles },
  vendor_update:    { label: 'STORE UPDATE',   borderCls: 'border-l-sky-500',     iconBg: 'bg-sky-100 dark:bg-sky-500/15',       iconCls: 'text-sky-600 dark:text-sky-400',      Icon: Store },
  logistics:        { label: 'LOGISTICS',      borderCls: 'border-l-violet-500',  iconBg: 'bg-violet-100 dark:bg-violet-500/15', iconCls: 'text-violet-600 dark:text-violet-400', Icon: Truck },
  message:          { label: 'MESSAGES',       borderCls: 'border-l-[var(--accent)]', iconBg: 'bg-[var(--accent)]/10',          iconCls: 'text-[var(--accent)]',                Icon: MessageCircle },
};

const DEFAULT_CONFIG = { label: 'NOTIFICATION', borderCls: 'border-l-[var(--glass-border)]', iconBg: 'bg-[var(--bg-secondary)]', iconCls: 'text-[var(--text-secondary)]', Icon: Sparkles };

const getConfig = (type = '') => {
  const key = Object.keys(TYPE_CONFIG).find(k => type === k || type?.includes(k));
  return key ? TYPE_CONFIG[key] : DEFAULT_CONFIG;
};

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',    label: 'All' },
  { id: 'orders', label: 'Orders',   match: (t) => ['order','order_status','order_update','payment','payment_received','wallet_update','logistics'].some(k => t?.includes(k)) },
  { id: 'offers', label: 'Offers',   match: (t) => ['vendor_update','system','system_alert'].some(k => t?.includes(k)) },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function groupNotifs(items) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart - 86_400_000);
  const buckets = { Today: [], Yesterday: [], Earlier: [] };
  for (const n of items) {
    const t = new Date(n.createdAt);
    if (t >= todayStart)          buckets.Today.push(n);
    else if (t >= yesterdayStart) buckets.Yesterday.push(n);
    else                          buckets.Earlier.push(n);
  }
  return Object.entries(buckets).filter(([, notifs]) => notifs.length > 0);
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { markAllRead: clearBadge } = useNotifications();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) setNotifications(res.data.data.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    clearBadge();
    const unsubscribe = notificationService.onPush((notif) => {
      setNotifications(prev => [notif, ...prev]);
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, [fetchNotifications, clearBadge]);

  const markRead = async (id) => {
    try { await api.patch(`/notifications/${id}/read`); } catch { /* silent */ }
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    try { await api.patch('/notifications/read-all'); clearBadge(); } catch { /* silent */ }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotif = async (id) => {
    try { await api.delete(`/notifications/${id}`); } catch { /* silent */ }
    setNotifications(prev => prev.filter(n => n._id !== id));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filtered = activeFilter === 'all'
    ? notifications
    : notifications.filter(n => {
        const f = FILTERS.find(f => f.id === activeFilter);
        return f?.match?.(n.type) ?? true;
      });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const current   = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const groups    = groupNotifs(current);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] pb-24 lg:pb-12 transition-colors duration-300">

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-[var(--bg-primary)] border-b border-[var(--glass-border)]">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between px-4 pt-4 pb-3 sm:px-5 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Signal icon */}
              <div className="size-9 lg:size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
                <Radio className="size-[18px] lg:size-5 text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-[15px] lg:text-[17px] font-bold tracking-tight text-[var(--text-primary)] leading-none">
                  Notifications
                </h1>
                {unreadCount > 0 && (
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {unreadCount} unread
                  </p>
                )}
              </div>
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="flex items-center gap-1.5 text-[var(--accent)] text-[12px] lg:text-[13px] font-semibold hover:opacity-75 transition-opacity"
              >
                <CheckCheck className="size-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 px-4 pb-3 sm:px-5 lg:px-8">
            {FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => { setActiveFilter(f.id); setCurrentPage(1); }}
                className={`h-8 px-4 rounded-full text-[12px] font-semibold transition-all ${
                  activeFilter === f.id
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border border-[var(--glass-border)] hover:border-[var(--accent)]/30'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <main className="max-w-5xl mx-auto px-3 sm:px-5 lg:px-8 pt-4 lg:pt-6">

        {/* Skeletons */}
        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {[...Array(8)].map((_, i) => (
              <div key={i}
                className="h-[78px] lg:h-[86px] rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] animate-pulse"
                style={{ animationDelay: `${i * 40}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="py-24 flex flex-col items-center text-center gap-4 animate-in fade-in duration-400">
            <div className="size-20 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center">
              <Radio className="size-8 text-[var(--text-secondary)] opacity-20" />
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-[var(--text-primary)]">All caught up</h3>
              <p className="text-[12px] text-[var(--text-secondary)] opacity-50 mt-1 max-w-[180px] mx-auto leading-relaxed">
                No {activeFilter !== 'all' ? activeFilter : ''} notifications yet.
              </p>
            </div>
          </div>
        )}

        {/* Groups */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {groups.map(([label, notifs]) => (
              <section key={label}>
                {/* Date label */}
                <div className="flex items-center gap-2 mb-2.5 px-1">
                  <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--text-secondary)] opacity-40 shrink-0">
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-[var(--glass-border)]" />
                </div>

                {/* 1-col mobile → 2-col desktop */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {notifs.map(n => (
                    <NotifCard
                      key={n._id}
                      n={n}
                      onDelete={() => deleteNotif(n._id)}
                      onNavigate={() => {
                        if (!n.is_read) markRead(n._id);
                        if (n.metadata?.link) router.push(normalizeAppRoute(n.metadata.link));
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              compact
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Notification card ─────────────────────────────────────────────────────────
function NotifCard({ n, onDelete, onNavigate }) {
  const { Icon, iconBg, iconCls, borderCls, label } = getConfig(n.type);

  return (
    <div
      onClick={onNavigate}
      className={`relative group cursor-pointer bg-[var(--bg-primary)] rounded-2xl border-l-[3.5px] border border-[var(--glass-border)] overflow-hidden transition-all duration-200 hover:shadow-md active:scale-[0.99] ${borderCls} ${!n.is_read ? 'shadow-sm' : 'opacity-75'}`}
    >
      <div className="flex items-start gap-3 px-3.5 py-3 lg:px-4 lg:py-3.5">

        {/* Icon with optional unread dot */}
        <div className="relative shrink-0 mt-0.5">
          <div className={`size-10 lg:size-11 rounded-xl flex items-center justify-center ${iconBg}`}>
            <Icon className={`size-[18px] lg:size-5 ${iconCls}`} />
          </div>
          {!n.is_read && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-orange-500 border-2 border-[var(--bg-primary)]" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-7">
          {/* Category + time */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={`text-[9.5px] font-bold tracking-[0.12em] uppercase ${iconCls} opacity-80`}>
              {label}
            </span>
            <span className="text-[10px] text-[var(--text-secondary)] opacity-40 shrink-0">
              {timeAgo(n.createdAt)}
            </span>
          </div>

          {/* Title */}
          <h3 className={`text-[12.5px] lg:text-[13px] font-bold leading-snug line-clamp-1 ${!n.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
            {n.title}
          </h3>

          {/* Message — 1 line mobile, 2 lines desktop */}
          <p className="text-[11.5px] lg:text-[12px] text-[var(--text-secondary)] opacity-70 leading-relaxed line-clamp-1 lg:line-clamp-2 mt-0.5">
            {n.message}
          </p>
        </div>
      </div>

      {/* Delete — always visible on mobile (touch), hover-only on desktop */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 size-7 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
