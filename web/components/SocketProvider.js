"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';
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

export default function SocketProvider({ children }) {
  const { user } = useAuthStore();
  const router = useRouter();

  // Toast states
  const [chatToast, setChatToast] = useState(null);
  const [notifToast, setNotifToast] = useState(null);
  const [cartToast, setCartToast] = useState(null);

  // Timers
  const chatToastTimer = useRef(null);
  const notifToastTimer = useRef(null);
  const cartToastTimer = useRef(null);
  const connectedUserId = useRef(null);

  useEffect(() => {
    if (!user?._id) return;

    // Connect once per user session
    if (connectedUserId.current !== user._id) {
      socketService.connect(user._id);
      connectedUserId.current = user._id;
    }

    // ── Handler: new chat message ──────────────────────────────────────────
    const handleNewMessage = (msg) => {
      // FOCUS GUARD: Only show toast if window is focused or tab is active
      if (!document.hasFocus()) return;
      if (window.location.pathname.startsWith('/chat')) return;

      const senderName = msg.sender_id?.name || 'Aura User';
      const text = msg.text || (msg.product_reference ? '📦 Shared a product' : 'Sent you a message');
      
      // Dispatch global event for unread highlighting
      window.dispatchEvent(new CustomEvent('aura_vendor_reply', { detail: msg }));

      setChatToast({ id: msg._id || Date.now(), sender: senderName, text });

      if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
      chatToastTimer.current = setTimeout(() => setChatToast(null), 6000);
    };

    // ── Handler: in-app notification (order/logistics/payment/system) ──────
    const handleNotification = (notif) => {
      if (!document.hasFocus()) return;

      const type = notif?.type || 'default';
      const title   = notif?.title   || 'New Notification';
      const message = notif?.message || '';
      const link = notif.metadata?.link || '/notifications';

      setNotifToast({ 
        id: notif?._id || Date.now(), 
        type, 
        title, 
        message,
        link
      });

      if (notifToastTimer.current) clearTimeout(notifToastTimer.current);
      notifToastTimer.current = setTimeout(() => setNotifToast(null), 7000);
    };

    socketService.on('receive_message', handleNewMessage);
    socketService.on('notification',    handleNotification);

    return () => {
      socketService.off('receive_message', handleNewMessage);
      socketService.off('notification',    handleNotification);
    };
  }, [user?._id]);

  // Handle local Cart Added event (browser-side)
  useEffect(() => {
    const handleCartItemAdded = (e) => {
      const { name, image } = e.detail || {};
      setCartToast({ 
        id: Date.now(), 
        name: name || 'Item added to stack', 
        image: image || null 
      });
      if (cartToastTimer.current) clearTimeout(cartToastTimer.current);
      cartToastTimer.current = setTimeout(() => setCartToast(null), 4000);
    };

    window.addEventListener('cart-item-added', handleCartItemAdded);
    return () => window.removeEventListener('cart-item-added', handleCartItemAdded);
  }, []);

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

      <style>{`
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ─── Chat Toast ─────────────────────────────────────────────────── */}
      {chatToast && (
        <div
          className="fixed top-6 right-6 z-[9999] max-w-[320px] w-full"
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}
        >
          <div
            onClick={() => { router.push('/chat'); setChatToast(null); }}
            className="bg-[var(--bg-primary)] backdrop-blur-2xl border border-[var(--glass-border)] rounded-2xl p-4 shadow-2xl flex items-start gap-3 cursor-pointer hover:border-[var(--accent)]/50 transition-all group"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)' }}
          >
            <div className="size-10 rounded-full bg-[var(--accent)]/15 flex items-center justify-center shrink-0 border border-[var(--accent)]/25 group-hover:scale-110 transition-transform">
              <MessageCircle className="size-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[9px] font-bold tracking-tight text-[var(--accent)] mb-1 leading-none">New Message</p>
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

      {/* ─── Notification Toast (orders, logistics, payments…) ──────────── */}
      {notifToast && (
        <div
          className={`fixed right-6 z-[9998] max-w-[340px] w-full ${chatToast ? 'top-24' : 'top-6'}`}
          style={{ animation: 'slideInFromTop 0.3s ease-out' }}
        >
          {(() => {
            const { Icon, color } = resolveConfig(notifToast.type);
            const href = notifToast.link || resolveConfig(notifToast.type).href;
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
                  <p className="text-[9px] font-bold tracking-tight mb-1 leading-none" style={{ color }}>
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
        </div>
      )}

      {/* ─── Cart Item Toast ─────────────────────────────────────────────── */}
      {cartToast && (
        <div 
          className={`fixed z-[9997] max-w-[320px] w-full right-6 bottom-24 md:bottom-auto ${chatToast || notifToast ? 'md:top-40' : 'md:top-6'}`}
          style={{ animation: 'slideInFromRight 0.3s ease-out' }}
        >
          <div
            onClick={() => { router.push('/cart'); setCartToast(null); }}
            className="bg-emerald-500/95 backdrop-blur-2xl border border-emerald-400/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-all group text-white"
          >
            <div className="size-12 rounded-xl bg-white/10 shrink-0 border border-white/20 overflow-hidden">
               {cartToast.image ? <img src={cartToast.image} className="size-full object-cover" /> : <div className="size-full flex items-center justify-center font-bold">📦</div>}
            </div>
            <div className="flex-1 min-w-0">
               <p className="text-[10px] font-bold tracking-tight text-white/70 mb-0.5 leading-none">Added to Stack</p>
               <p className="text-sm font-bold truncate leading-tight">{cartToast.name}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
