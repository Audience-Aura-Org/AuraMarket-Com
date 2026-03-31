"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';
<<<<<<< HEAD
import { MessageCircle, Bell, Package, Truck, CreditCard, X } from 'lucide-react';

/**
 * Maps notification type → { icon, color, href }
 */
const NOTIF_CONFIG = {
  order_update:  { Icon: Package,       color: '#6366f1', href: '/orders' },
  payment:       { Icon: CreditCard,    color: '#10b981', href: '/wallet' },
  system_alert:  { Icon: Bell,          color: '#f59e0b', href: '/notifications' },
  vendor_update: { Icon: Package,       color: '#06b6d4', href: '/notifications' },
  default:       { Icon: Bell,          color: 'var(--accent)', href: '/notifications' },
};
=======
import { MessageCircle, Bell, X } from 'lucide-react';
>>>>>>> aura-import-main

export default function SocketProvider({ children }) {
  const { user } = useAuthStore();
  const router = useRouter();
<<<<<<< HEAD

  // Chat toast
  const [chatToast, setChatToast] = useState(null);
  const chatToastTimer = useRef(null);

  // Notification toast (orders, logistics, payments, etc.)
  const [notifToast, setNotifToast] = useState(null);
  const notifToastTimer = useRef(null);

=======
  const [toast, setToast] = useState(null);           // chat message toast
  const [notifToast, setNotifToast] = useState(null); // notification toast
  const [cartToast, setCartToast] = useState(null);   // cart item added toast
  const toastTimerRef = useRef(null);
  const notifTimerRef = useRef(null);
  const cartTimerRef = useRef(null);
>>>>>>> aura-import-main
  const connectedUserId = useRef(null);

  useEffect(() => {
    if (!user?._id) return;

<<<<<<< HEAD
    // Connect once per user session
=======
    // Connect once per user session — never disconnect while browsing
>>>>>>> aura-import-main
    if (connectedUserId.current !== user._id) {
      socketService.connect(user._id);
      connectedUserId.current = user._id;
    }

    // ── Handler: new chat message ──────────────────────────────────────────
    const handleNewMessage = (msg) => {
<<<<<<< HEAD
=======
      // 🚀 FOCUS GUARD: If user has multiple tabs open, only the focused one shows the toast
      if (!document.hasFocus()) return;
      
      console.log('[SocketProvider] receive_message fired:', msg);
>>>>>>> aura-import-main
      if (window.location.pathname.startsWith('/chat')) return;
      const senderName = msg.sender_id?.name || 'Aura User';
      const text = msg.text || (msg.product_reference ? '📦 Shared a product' : 'Sent you a message');
<<<<<<< HEAD

      setChatToast({ id: msg._id || Date.now(), sender: senderName, text });

      if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
      chatToastTimer.current = setTimeout(() => setChatToast(null), 6000);
    };

    // ── Handler: in-app notification (order/logistics/payment/system) ──────
    const handleNotification = (notification) => {
      // Don't stack — replace current toast
      const type = notification?.type || 'default';
      const title   = notification?.title   || 'New Notification';
      const message = notification?.message || '';

      setNotifToast({ id: notification?._id || Date.now(), type, title, message });

      if (notifToastTimer.current) clearTimeout(notifToastTimer.current);
      notifToastTimer.current = setTimeout(() => setNotifToast(null), 7000);
=======
      setToast({ id: msg._id || Date.now(), sender: senderName, text });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => setToast(null), 6000);
>>>>>>> aura-import-main
    };

    const handleNotification = (notif) => {
      // 🚀 FOCUS GUARD
      if (!document.hasFocus()) return;

      console.log('[SocketProvider] notification fired:', notif);
      setNotifToast({
        id: notif._id || Date.now(),
        title: notif.title || 'Notification',
        message: notif.message || '',
        link: notif.metadata?.link || '/notifications',
      });
      if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
      notifTimerRef.current = setTimeout(() => setNotifToast(null), 7000);
    };

    socketService.on('receive_message', handleNewMessage);
<<<<<<< HEAD
    socketService.on('notification',    handleNotification);

    return () => {
      socketService.off('receive_message', handleNewMessage);
      socketService.off('notification',    handleNotification);
    };
  }, [user?._id]);

=======
    socketService.on('notification', handleNotification);
    console.log('[SocketProvider] Listening for receive_message & notification');

    return () => {
      socketService.off('receive_message', handleNewMessage);
      socketService.off('notification', handleNotification);
      // Do NOT disconnect here — socket must stay alive while user navigates
    };
  }, [user?._id]);

  useEffect(() => {
    const handleCartItemAdded = (e) => {
      const { name, image } = e.detail || {};
      setCartToast({ 
        id: Date.now(), 
        name: name || 'Item added to stack', 
        image: image || null 
      });
      if (cartTimerRef.current) clearTimeout(cartTimerRef.current);
      cartTimerRef.current = setTimeout(() => setCartToast(null), 4000);
    };

    window.addEventListener('cart-item-added', handleCartItemAdded);
    return () => window.removeEventListener('cart-item-added', handleCartItemAdded);
  }, []);

>>>>>>> aura-import-main
  // Disconnect only on logout
  useEffect(() => {
    if (!user) {
      socketService.disconnect();
      connectedUserId.current = null;
    }
  }, [user]);

  // ── Resolve notification display config ──────────────────────────────────
  const resolveConfig = (type) => {
    const key = Object.keys(NOTIF_CONFIG).find(k => type?.includes(k)) || 'default';
    return NOTIF_CONFIG[key] || NOTIF_CONFIG.default;
  };

  return (
    <>
      {children}

<<<<<<< HEAD
      {/* ─── Chat Toast ─────────────────────────────────────────────────── */}
      {chatToast && (
        <div
          className="fixed top-6 right-6 z-[9999] max-w-[320px] w-full"
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}
        >
=======
      {/* Global Chat Message Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-[9999] max-w-[320px] w-full"
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}>
>>>>>>> aura-import-main
          <style>{`
            @keyframes slideInFromTop {
              from { opacity: 0; transform: translateY(-12px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div
            onClick={() => { router.push('/chat'); setChatToast(null); }}
            className="bg-[var(--bg-primary)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer hover:border-[var(--accent)]/50 transition-all group"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)' }}
          >
            <div className="size-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0 border border-[var(--accent)]/25 group-hover:scale-110 transition-transform">
              <MessageCircle className="size-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-[var(--accent)] mb-1 leading-none">New Message</p>
              <p className="text-sm font-bold text-[var(--text-primary)] truncate leading-tight">{chatToast.sender}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5 leading-snug">{chatToast.text}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setChatToast(null); }}
              className="p-1 rounded-full hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-colors opacity-60 hover:opacity-100 shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}

<<<<<<< HEAD
      {/* ─── Notification Toast (orders, logistics, payments…) ──────────── */}
      {notifToast && (
        <div
          className="fixed top-6 right-6 z-[9998] max-w-[340px] w-full"
          style={{ animation: 'slideInFromTop 0.3s ease-out', marginTop: chatToast ? '80px' : '0' }}
        >
          {(() => {
            const { Icon, color, href } = resolveConfig(notifToast.type);
            return (
              <div
                onClick={() => { router.push(href); setNotifToast(null); }}
                className="bg-[var(--bg-primary)] backdrop-blur-2xl border rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer transition-all group"
                style={{
                  borderColor: `${color}40`,
                  boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px ${color}15`,
                }}
              >
                <div
                  className="size-10 rounded-full flex items-center justify-center shrink-0 border group-hover:scale-110 transition-transform"
                  style={{ background: `${color}18`, borderColor: `${color}35` }}
                >
                  <Icon className="size-5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-[9px] font-black uppercase tracking-widest mb-1 leading-none" style={{ color }}>
                    Aura Market
                  </p>
                  <p className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">{notifToast.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug line-clamp-2">{notifToast.message}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setNotifToast(null); }}
                  className="p-1 rounded-full hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-colors opacity-60 hover:opacity-100 shrink-0"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            );
          })()}
=======
      {/* Global Notification Toast — stacks below message toast if both visible */}
      {notifToast && (
        <div className={`fixed z-[9998] max-w-[320px] w-full right-6 ${toast ? 'top-24' : 'top-6'}`}
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}>
          <div
            onClick={() => { router.push(notifToast.link); setNotifToast(null); }}
            className="bg-[var(--bg-primary)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer hover:border-amber-500/50 transition-all group"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)' }}
          >
            <div className="size-10 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 border border-amber-500/25 group-hover:scale-110 transition-transform">
              <Bell className="size-5 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1 leading-none">Notification</p>
              <p className="text-sm font-bold text-[var(--text-primary)] truncate leading-tight">{notifToast.title}</p>
              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5 leading-snug">{notifToast.message}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setNotifToast(null); }}
              className="p-1 rounded-full hover:bg-[var(--glass-border)] text-[var(--text-secondary)] transition-colors opacity-60 hover:opacity-100 shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
      {/* Global Cart Item Toast */}
      {cartToast && (
        <div className={`fixed z-[9997] max-w-[320px] w-full right-6 bottom-24 md:bottom-auto ${toast || notifToast ? 'md:top-40' : 'md:top-6'}`}
          style={{ animation: 'slideInFromRight 0.3s ease-out' }}>
          <style>{`
            @keyframes slideInFromRight {
              from { opacity: 0; transform: translateX(20px); }
              to   { opacity: 1; transform: translateX(0); }
            }
          `}</style>
          <div
            onClick={() => { router.push('/cart'); setCartToast(null); }}
            className="bg-emerald-500/95 backdrop-blur-2xl border border-emerald-400/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-all group text-white"
          >
            <div className="size-12 rounded-xl bg-white/10 shrink-0 border border-white/20 overflow-hidden">
               {cartToast.image ? <img src={cartToast.image} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center font-black">📦</div>}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-[10px] font-black uppercase tracking-widest text-white/70 mb-0.5 leading-none">Added to Stack</p>
               <p className="text-sm font-bold truncate leading-tight">{cartToast.name}</p>
            </div>
          </div>
>>>>>>> aura-import-main
        </div>
      )}
    </>
  );
}
