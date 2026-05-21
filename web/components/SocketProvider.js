"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
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
  const { isOpen, activePartnerId, openChat } = useChat();

  // Toast states
  const [chatToast, setChatToast] = useState(null);
  const [notifToast, setNotifToast] = useState(null);
  const [cartToast, setCartToast] = useState(null);

  // Timers
  const chatToastTimer = useRef(null);
  const notifToastTimer = useRef(null);
  const cartToastTimer = useRef(null);
  const connectedUserId = useRef(null);
  // ✅ Refs to avoid stale closures in socket handlers
  const isOpenRef = useRef(isOpen);
  const activePartnerIdRef = useRef(activePartnerId);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { activePartnerIdRef.current = activePartnerId; }, [activePartnerId]);

  useEffect(() => {
    if (!user?._id) return;

    // Connect once per user session
    if (connectedUserId.current !== user._id) {
      socketService.connect(user._id);
      connectedUserId.current = user._id;
    }

    // ── Handler: new chat message ──────────────────────────────────────────
    const handleNewMessage = (msg) => {
      const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();

      // ✅ FIRST: Check if MessagingHub modal is open with this exact sender (highest priority)
      //    This works on ANY page (home, products, etc.), not just /chat or /messages
      if (isOpenRef.current && activePartnerIdRef.current && activePartnerIdRef.current.toString() === senderId) {
        return;
      }

      // ✅ SECOND: If on a dedicated chat/messages page, also suppress
      //    (fallback check for full-page chat views)
      const path = window.location.pathname;
      if (path.startsWith('/chat') || path.startsWith('/messages')) return;

      const senderName = msg.sender_id?.name || 'Aura User';
      const senderAvatar = msg.sender_id?.avatar || msg.sender_id?.branding?.logo || null;
      const text = msg.text || (msg.product_reference ? '📦 Shared a product' : 'Sent you a message');
      
      // Dispatch global event for unread highlighting
      window.dispatchEvent(new CustomEvent('aura_vendor_reply', { detail: msg }));

      setChatToast({ 
        id: msg._id || Date.now(), 
        sender: senderName, 
        senderId,
        senderData: {
          _id: senderId,
          name: senderName,
          avatar: senderAvatar,
          store_name: msg.sender_id?.branding?.store_name || msg.sender_id?.store_name,
          // ✅ Don't include is_online — message payloads never have live presence.
          //    The chat will fetch the real status from the API on open.
        },
        text 
      });

      if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
      chatToastTimer.current = setTimeout(() => setChatToast(null), 6000);
    };

    // Emit identification to server after a short delay to ensure server-side room join
    const attemptRegisterRoom = () => {
      try {
        if (socketService && socketService.isConnected && socketService.isConnected()) {
          console.log('[SocketProvider] Registering socket with server rooms for user', user._id);
          // Common server-side handlers may accept these events; harmless if ignored
          socketService.emit('identify', { userId: user._id });
          socketService.emit('join_user_room', { userId: user._id });
        } else {
          console.warn('[SocketProvider] Socket not connected yet — will retry register in 1s');
          setTimeout(attemptRegisterRoom, 1000);
        }
      } catch (e) {
        console.error('[SocketProvider] Error during register attempt:', e);
      }
    };

    // Kick off a single attempt shortly after connecting
    setTimeout(attemptRegisterRoom, 800);

    // ── Handler: in-app notification (order/logistics/payment/system) ──────
    const handleNotification = (notif) => {
      console.log('🔔 Real-time notification received:', notif.title || notif.type);

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
  // Only re-register when the USER changes. isOpen/activePartnerId are read via refs.
  }, [user?._id]);

  // Listen for messages from the Service Worker (e.g., notification click payload)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const onSWMessage = (e) => {
      const msg = e.data;
      if (!msg || msg.type !== 'notification-click') return;
      const payload = msg.payload || {};

      // Attempt to extract a partner/sender id from common fields
      const senderId = payload.sender_id || payload.senderId || payload.userId || payload.data?.sender_id || payload.data?.senderId;
      let partnerId = senderId;
      if (!partnerId && payload.tag && typeof payload.tag === 'string' && payload.tag.startsWith('msg-')) {
        const parts = payload.tag.split('-');
        if (parts.length > 1) partnerId = parts[1];
      }

      const partnerData = payload.sender || payload.senderData || payload.data?.senderData || payload.data?.sender || {
        _id: partnerId,
        name: payload.title || payload.name || 'Aura User',
        avatar: payload.icon || null,
        store_name: payload.store_name || payload.storeName
      };

      // Strip any presence flag from the push payload — we prefer real-time status
      const { is_online, ...partnerNoPresence } = partnerData || {};

      if (partnerId) {
        openChat(partnerId, null, partnerNoPresence);
      } else if (payload.url) {
        router.push(payload.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', onSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSWMessage);
  }, [openChat, router]);

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
    // Log current socket status for debugging
    try {
      console.log('[SocketProvider] Socket status:', { connected: socketService.isConnected(), transport: socketService.getTransport(), lastError: socketService.getLastError() });
    } catch (e) { /* ignore */ }
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
            onClick={() => { 
              if (chatToast.senderId) {
                openChat(chatToast.senderId, null, chatToast.senderData);
              }
              setChatToast(null); 
            }}
            className="bg-emerald-500/95 backdrop-blur-2xl border border-emerald-400/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-all group text-white"
          >
            <div className="size-12 rounded-xl bg-white/10 shrink-0 border border-white/20 flex items-center justify-center text-white">
              <MessageCircle className="size-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-white/70 mb-0.5 leading-none">New Message</p>
              <p className="text-sm font-bold truncate leading-tight">{chatToast.sender}</p>
              <p className="text-xs text-white/80 truncate mt-0.5 leading-snug">{chatToast.text}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setChatToast(null); }}
              className="p-1 rounded-full hover:bg-white/15 text-white/60 hover:text-white transition-colors shrink-0"
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
            const { Icon } = resolveConfig(notifToast.type);
            const href = notifToast.link || resolveConfig(notifToast.type).href;
            return (
              <div
                onClick={() => { router.push(href); setNotifToast(null); }}
                className="bg-emerald-500/95 backdrop-blur-2xl border border-emerald-400/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-all group text-white"
              >
                <div className="size-12 rounded-xl bg-white/10 shrink-0 border border-white/20 flex items-center justify-center text-white">
                  <Icon className="size-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-white/70 mb-0.5 leading-none">Aura Market</p>
                  <p className="text-sm font-bold truncate leading-tight">{notifToast.title}</p>
                  <p className="text-xs text-white/80 line-clamp-2 mt-0.5 leading-snug">{notifToast.message}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setNotifToast(null); }}
                  className="p-1 rounded-full hover:bg-white/15 text-white/60 hover:text-white transition-colors shrink-0"
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
               <p className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-white/70 mb-0.5 leading-none">Added to Stack</p>
               <p className="text-sm font-bold truncate leading-tight">{cartToast.name}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setCartToast(null); }}
              className="p-1 rounded-full hover:bg-white/15 text-white/60 hover:text-white transition-colors shrink-0"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
