"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { 
  Bell, Package, CreditCard, MessageCircle, 
  Trash2, ArrowLeft, MoreHorizontal, CheckCheck,
  Sparkles, Store, Truck
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useNotifications } from '@/hooks/useNotifications';
import { notificationService } from '@/services/notifications';
import Pagination from '@/components/common/Pagination';
import { normalizeAppRoute } from '@/lib/navigation';

// Mapped to the backend enum
const ICON_MAP = {
  order:             { Icon: Package,       color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  order_status:      { Icon: Package,       color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  order_update:      { Icon: Package,       color: 'text-indigo-500',  bg: 'bg-indigo-500/10' },
  payment:           { Icon: CreditCard,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  payment_received:  { Icon: CreditCard,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  wallet_update:     { Icon: CreditCard,    color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  chat:              { Icon: MessageCircle, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
  chat_alert:        { Icon: MessageCircle, color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10' },
  system:            { Icon: Sparkles,      color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  system_alert:      { Icon: Sparkles,      color: 'text-amber-500',   bg: 'bg-amber-500/10' },
  vendor_update:     { Icon: Store,         color: 'text-sky-500',     bg: 'bg-sky-500/10' },
  logistics:         { Icon: Truck,         color: 'text-purple-500',  bg: 'bg-purple-500/10' },
};

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  return `${Math.floor(diff/86400)}d ago`;
}

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
      if (res.data.success) {
        setNotifications(res.data.data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    clearBadge(); // Clear global badge count

    // Subscribe to real-time pushes
    const unsubscribe = notificationService.onPush((notif) => {
      setNotifications(prev => [notif, ...prev]);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [fetchNotifications, clearBadge]);

  const markRead = async (id) => {
    try { await api.patch(`/notifications/${id}/read`); } catch { /* silent */ }
    setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    try { 
      await api.patch('/notifications/read-all'); 
      clearBadge();
    } catch { /* silent */ }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const deleteNotif = async (id) => {
    try { await api.delete(`/notifications/${id}`); } catch { /* silent */ }
    setNotifications(prev => prev.filter(n => n._id !== id));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const totalPages = Math.ceil(notifications.length / itemsPerPage);
  const currentNotifications = notifications.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] pb-32 transition-colors duration-500">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[var(--bg-secondary)]/80 backdrop-blur-3xl px-6 py-4 flex items-center justify-between border-b border-[var(--glass-border)] transition-all">
        <button onClick={() => router.back()} className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-all shadow-sm">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-lg  font-bold text-[var(--text-primary)] tracking-tight ">Signals</h1>
          {unreadCount > 0 && (
            <span className="h-5 px-2 bg-[var(--accent)] text-white text-[11px] lg:text-[12px]  font-semibold rounded-full flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </div>
        <button className="size-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm">
          < MoreHorizontal className="size-5" />
        </button>
      </div>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8 px-1">
          <p className="text-[11px] lg:text-[12px]  font-semibold text-[var(--text-secondary)] tracking-[0.3em]  opacity-40">Frequency Feed</p>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-2 text-[11px] lg:text-[12px]  font-semibold text-[var(--accent)] tracking-tight  hover:underline group">
              <CheckCheck className="size-3 group-hover:scale-110 transition-transform" /> Sync All
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {currentNotifications.map((n) => {
              const typeKey = Object.keys(ICON_MAP).find(k => n.type?.includes(k)) || 'system_alert';
              const { Icon, color, bg } = ICON_MAP[typeKey];
              return (
                <div
                  key={n._id}
                  onClick={() => {
                    if (!n.is_read) markRead(n._id);
                    if (n.metadata?.link) router.push(normalizeAppRoute(n.metadata.link));
                  }}
                  className={`p-4 rounded-2xl border transition-all duration-300 flex items-center gap-4 relative group cursor-pointer glass-panel ${
                    !n.is_read 
                    ? 'bg-[var(--bg-primary)] border-[var(--accent)]/30 shadow-lg' 
                    : 'bg-[var(--bg-primary)]/40 border-[var(--glass-border)] hover:bg-[var(--bg-primary)]/60'
                  }`}
                >
                  <div className={`size-10 rounded-xl flex-shrink-0 flex items-center justify-center ${bg} ${color} transition-transform`}>
                    <Icon className="size-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <h3 className={`text-xs  font-bold truncate ${!n.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-60'}`}>
                        {n.title}
                      </h3>
                      <span className="text-[10px] lg:text-[12px] font-medium text-[var(--text-secondary)] opacity-40 shrink-0">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className={`text-[11px] lg:text-[12px] leading-snug truncate ${!n.is_read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)] opacity-40'}`}>
                      {n.message}
                    </p>
                  </div>

                  {!n.is_read && (
                    <div className="size-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                  )}

                  <div className="opacity-0 group-hover:opacity-100 transition-opacity pl-2">
                    <button 
                      onClick={e => { e.stopPropagation(); deleteNotif(n._id); }}
                      className="size-8 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="mt-8">
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="py-20 flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-5">
            <div className="size-20 rounded-3xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center shadow-lg group">
              <Bell className="size-8 text-[var(--text-secondary)] opacity-20 group-hover:rotate-12 transition-transform" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl  font-bold text-[var(--text-primary)] tracking-tight ">Silence</h3>
              <p className="text-[var(--text-secondary)] font-medium text-xs max-w-[240px] mx-auto opacity-40">Your signal frequency is currently undisturbed.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
