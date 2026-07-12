"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Package, CreditCard, MessageCircle,
  Trash2, ArrowLeft, CheckCheck,
  Sparkles, Store, Truck,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationService } from '@/services/notifications';
import Pagination from '@/components/common/Pagination';
import { normalizeAppRoute } from '@/lib/navigation';

// ── Icon map (matches backend enum) ─────────────────────────────────────────
const ICON_MAP = {
  order:            { Icon: Package,       color: 'text-indigo-500',        bg: 'bg-indigo-500/10'        },
  order_status:     { Icon: Package,       color: 'text-indigo-500',        bg: 'bg-indigo-500/10'        },
  order_update:     { Icon: Package,       color: 'text-indigo-500',        bg: 'bg-indigo-500/10'        },
  payment:          { Icon: CreditCard,    color: 'text-emerald-500',       bg: 'bg-emerald-500/10'       },
  payment_received: { Icon: CreditCard,    color: 'text-emerald-500',       bg: 'bg-emerald-500/10'       },
  wallet_update:    { Icon: CreditCard,    color: 'text-emerald-500',       bg: 'bg-emerald-500/10'       },
  chat:             { Icon: MessageCircle, color: 'text-[var(--accent)]',   bg: 'bg-[var(--accent)]/10'   },
  chat_alert:       { Icon: MessageCircle, color: 'text-[var(--accent)]',   bg: 'bg-[var(--accent)]/10'   },
  system:           { Icon: Sparkles,      color: 'text-amber-500',         bg: 'bg-amber-500/10'         },
  system_alert:     { Icon: Sparkles,      color: 'text-amber-500',         bg: 'bg-amber-500/10'         },
  vendor_update:    { Icon: Store,         color: 'text-sky-500',           bg: 'bg-sky-500/10'           },
  logistics:        { Icon: Truck,         color: 'text-purple-500',        bg: 'bg-purple-500/10'        },
};

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
    if (t >= todayStart)     buckets.Today.push(n);
    else if (t >= yesterdayStart) buckets.Yesterday.push(n);
    else                     buckets.Earlier.push(n);
  }

  return Object.entries(buckets).filter(([, notifs]) => notifs.length > 0);
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { markAllRead: clearBadge } = useNotifications();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) setNotifications(res.data.data.notifications || []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
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
  const totalPages  = Math.ceil(notifications.length / itemsPerPage);
  const current     = notifications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const groups      = groupNotifs(current);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] pb-32 transition-colors duration-500">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 border-b border-[var(--glass-border)] bg-[var(--bg-secondary)]/80 backdrop-blur-3xl">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">

          {/* Back */}
          <button
            type="button"
            onClick={() => router.back()}
            className="size-9 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent)]/40 transition-all shadow-sm shrink-0"
          >
            <ArrowLeft className="size-4" />
          </button>

          {/* Title */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center shrink-0">
              <Bell className="size-4 text-[var(--accent)]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">Signals</h1>
                {unreadCount > 0 && (
                  <span className="h-4 px-1.5 rounded-full bg-[var(--accent)] text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-semibold tracking-[0.15em] text-[var(--text-secondary)] opacity-40 uppercase">
                Notification Center
              </p>
            </div>
          </div>

          {/* Mark all read */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 h-8 rounded-xl bg-[var(--accent)]/10 text-[var(--accent)] text-[11px] font-semibold hover:bg-[var(--accent)] hover:text-white transition-all border border-[var(--accent)]/20 shrink-0"
            >
              <CheckCheck className="size-3.5" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-2.5">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-[74px] rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && notifications.length === 0 && (
          <div className="py-24 flex flex-col items-center text-center gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="size-20 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center shadow-sm">
              <Bell className="size-8 text-[var(--text-secondary)] opacity-20" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">You&apos;re all caught up</h3>
              <p className="text-[12px] text-[var(--text-secondary)] opacity-40 max-w-[200px] mx-auto leading-relaxed">
                No notifications yet. We&apos;ll let you know when something happens.
              </p>
            </div>
          </div>
        )}

        {/* Notification groups */}
        {!loading && notifications.length > 0 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {groups.map(([label, notifs]) => (
              <section key={label}>
                {/* Group label */}
                <div className="flex items-center gap-3 mb-3 px-1">
                  <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-[var(--text-secondary)] opacity-40 shrink-0">
                    {label}
                  </span>
                  <div className="flex-1 h-px bg-[var(--glass-border)]" />
                </div>

                {/* Cards */}
                <div className="space-y-2">
                  {notifs.map((n) => {
                    const typeKey = Object.keys(ICON_MAP).find(k => n.type?.includes(k)) ?? 'system_alert';
                    const { Icon, color, bg } = ICON_MAP[typeKey];
                    return (
                      <NotifCard
                        key={n._id}
                        n={n}
                        Icon={Icon}
                        iconColor={color}
                        iconBg={bg}
                        onDelete={() => deleteNotif(n._id)}
                        onNavigate={() => {
                          if (!n.is_read) markRead(n._id);
                          if (n.metadata?.link) router.push(normalizeAppRoute(n.metadata.link));
                        }}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(p) => {
              setCurrentPage(p);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            compact
          />
        )}
      </main>
    </div>
  );
}

// ── Notification card ────────────────────────────────────────────────────────
function NotifCard({ n, Icon, iconColor, iconBg, onDelete, onNavigate }) {
  return (
    <div
      onClick={onNavigate}
      className={`relative overflow-hidden rounded-2xl border transition-all duration-200 group cursor-pointer ${
        !n.is_read
          ? 'bg-[var(--bg-primary)] border-[var(--accent)]/20 shadow-sm'
          : 'bg-[var(--bg-primary)]/40 border-[var(--glass-border)] hover:bg-[var(--bg-primary)]/70'
      }`}
    >
      {/* Unread left accent bar */}
      {!n.is_read && (
        <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-[var(--accent)] rounded-r-full" />
      )}

      <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
        {/* Type icon */}
        <div className={`size-9 rounded-xl flex-shrink-0 flex items-center justify-center ${iconBg} mt-0.5`}>
          <Icon className={`size-[18px] ${iconColor}`} />
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className={`text-[12px] font-bold leading-snug ${!n.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-60'}`}>
              {n.title}
            </h3>
            <span className="text-[10px] font-medium text-[var(--text-secondary)] opacity-35 shrink-0 mt-px">
              {timeAgo(n.createdAt)}
            </span>
          </div>
          <p className={`text-[11px] leading-relaxed line-clamp-2 ${!n.is_read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
            {n.message}
          </p>
        </div>

        {/* Unread dot */}
        {!n.is_read && (
          <div className="size-1.5 rounded-full bg-[var(--accent)] shrink-0 mt-1.5 animate-pulse" />
        )}
      </div>

      {/* Delete — reveals on hover */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="absolute right-2.5 bottom-2.5 opacity-0 group-hover:opacity-100 size-7 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/15 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
