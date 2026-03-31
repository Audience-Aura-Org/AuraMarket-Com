"use client";

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

export const dynamic = 'force-dynamic';

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

  return (
    <div className="min-h-screen bg-[var(--bg-secondary)] pb-32 transition-colors duration-500">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-[var(--bg-secondary)]/80 backdrop-blur-3xl px-8 py-8 flex items-center justify-between border-b border-[var(--glass-border)] transition-all">
        <button onClick={() => router.back()} className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--text-primary)] hover:border-[var(--accent)]/50 transition-all shadow-sm">
          <ArrowLeft className="size-6" />
        </button>
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-black text-[var(--text-primary)] tracking-tight uppercase">Signals</h1>
          {unreadCount > 0 && (
            <span className="h-6 px-3 bg-[var(--accent)] text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-[var(--accent)]/20 animate-pulse border border-white/20">
              {unreadCount}
            </span>
          )}
        </div>
        <button className="size-12 rounded-2xl bg-[var(--bg-primary)] border border-[var(--glass-border)] text-[var(--text-secondary)] flex items-center justify-center transition-all shadow-sm">
          <MoreHorizontal className="size-6" />
        </button>
      </div>

      <main className="max-w-3xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-12 px-2">
          <p className="text-[11px] font-black text-[var(--text-secondary)] tracking-[0.4em] uppercase opacity-40">Frequency Feed</p>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="flex items-center gap-3 text-[10px] font-black text-[var(--accent)] tracking-widest uppercase hover:underline group">
              <CheckCheck className="size-4 group-hover:scale-110 transition-transform" /> Synchronize All
            </button>
          )}
        </div>

        {loading ? (
          <div className="space-y-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 rounded-[40px] bg-[var(--bg-primary)]/40 border border-[var(--glass-border)] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            {notifications.map((n) => {
              const typeKey = Object.keys(ICON_MAP).find(k => n.type?.includes(k)) || 'system_alert';
              const { Icon, color, bg } = ICON_MAP[typeKey];
              return (
                <div
                  key={n._id}
                  onClick={() => {
                    if (!n.is_read) markRead(n._id);
                    if (n.metadata?.link) router.push(n.metadata.link);
                  }}
                  className={`p-8 rounded-[40px] border transition-all duration-500 flex gap-8 relative group cursor-pointer glass-panel ${
                    !n.is_read 
                    ? 'bg-[var(--bg-primary)] shadow-2xl shadow-[var(--accent)]/5 border-[var(--accent)]/20' 
                    : 'bg-[var(--bg-primary)]/40 border-[var(--glass-border)] hover:bg-[var(--bg-primary)]/60'
                  }`}
                >
                  {!n.is_read && (
                    <div className="absolute top-8 right-8 size-3 rounded-full bg-[var(--accent)] shadow-lg shadow-[var(--accent)]/40 ring-4 ring-[var(--accent)]/10" />
                  )}

                  <div className={`size-20 rounded-[28px] flex-shrink-0 flex items-center justify-center shadow-inner ${bg} ${color} group-hover:scale-110 transition-transform`}>
                    <Icon className="size-10" />
                  </div>

                  <div className="flex-1 pr-12">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className={`text-xl font-black tracking-tight uppercase ${!n.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] opacity-60'}`}>
                        {n.title}
                      </h3>
                    </div>
                    <p className={`text-base leading-relaxed mb-6 ${!n.is_read ? 'text-[var(--text-secondary)] font-medium' : 'text-[var(--text-secondary)] opacity-40'}`}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-6">
                      <span className="text-[10px] font-black tracking-widest text-[var(--text-secondary)] uppercase opacity-30">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                    <button 
                      onClick={e => { e.stopPropagation(); deleteNotif(n._id); }}
                      className="size-12 rounded-2xl bg-rose-500/5 text-rose-500 border border-rose-500/10 hover:bg-rose-500 hover:text-white transition-all shadow-sm flex items-center justify-center"
                    >
                      <Trash2 className="size-5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="py-32 flex flex-col items-center text-center space-y-8 animate-in fade-in slide-in-from-bottom-5">
            <div className="size-32 rounded-[48px] bg-[var(--bg-primary)] border border-[var(--glass-border)] flex items-center justify-center shadow-2xl group">
              <Bell className="size-14 text-[var(--text-secondary)] opacity-20 group-hover:rotate-12 transition-transform" />
            </div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Silence Reclaimed</h3>
              <p className="text-[var(--text-secondary)] font-medium text-lg max-w-sm mx-auto opacity-60">No pending signals detected in the frequency. Your sanctuary remains undisturbed.</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
