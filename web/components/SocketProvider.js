"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';
import { useChat } from '@/context/ChatContext';
import { MessageCircle, Bell, Package, Truck, CreditCard, X } from 'lucide-react';
import { consumePendingNativePushIntent } from '@/lib/native-push';

/**
 * Maps notification type → { icon, color, href }
 */
const NOTIF_CONFIG = {
  order_update:  { Icon: Package,       color: '#6366f1', href: '/orders' },
  order_status:  { Icon: Truck,         color: '#6366f1', href: '/orders' },
  payment:       { Icon: CreditCard,    color: '#10b981', href: '/wallet' },
  payment_received: { Icon: CreditCard, color: '#10b981', href: '/wallet' },
  wallet_update: { Icon: CreditCard,    color: '#10b981', href: '/wallet' },
  logistics_update: { Icon: Truck,      color: '#06b6d4', href: '/logistics/manifests' },
  system_alert:  { Icon: Bell,          color: '#f59e0b', href: '/notifications' },
  vendor_update: { Icon: Package,       color: '#06b6d4', href: '/notifications' },
  default:       { Icon: Bell,          color: 'var(--accent)', href: '/notifications' },
};

const hashNotificationId = (value) => {
  const input = String(value || Date.now());
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 2147483647) || Date.now() % 2147483647;
};

const isNativeCapacitorApp = async () => {
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Boolean(Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

const showNativeNotification = async ({ id, title, body, route, type, senderId, senderData }) => {
  if (typeof window === 'undefined') return;
  if (!(await isNativeCapacitorApp())) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let permission = await LocalNotifications.checkPermissions();
    if (permission?.display !== 'granted') {
      permission = await LocalNotifications.requestPermissions();
    }
    if (permission?.display !== 'granted') return;

    await LocalNotifications.schedule({
      notifications: [{
        id: hashNotificationId(id),
        title: title || 'Auradime',
        body: body || '',
        schedule: { at: new Date(Date.now() + 250) },
        smallIcon: 'ic_launcher',
        iconColor: '#f20df2',
        extra: {
          route,
          type,
          senderId,
          senderData,
        },
      }],
    });
  } catch (error) {
    console.warn('[Notifications] Native notification skipped:', error?.message || error);
  }
};

const showBrowserNotification = async ({ id, title, body, route, type, senderId, senderData, icon }) => {
  if (typeof window === 'undefined') return;
  if (await isNativeCapacitorApp()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const payload = {
    title: title || 'Auradime',
    body: body || '',
    icon: icon || '/logo-white.png',
    badge: '/logo-white.png',
    tag: type === 'message' && senderId ? `msg-${senderId}` : `aura-${type || 'alert'}-${id || Date.now()}`,
    renotify: true,
    data: {
      url: route || '/notifications',
      payload: {
        type,
        url: route,
        sender_id: senderId,
        senderId,
        senderData,
        title,
        icon,
      },
    },
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(payload.title, payload);
      return;
    }

    const notification = new Notification(payload.title, payload);
    notification.onclick = () => {
      window.focus();
      if (route) window.location.href = route;
      notification.close();
    };
  } catch (error) {
    console.warn('[Notifications] Browser notification skipped:', error?.message || error);
  }
};

const normalizeAppRoute = (route) => {
  if (!route) return null;
  try {
    const url = new URL(route, window.location.origin);
    if (url.origin !== window.location.origin) return url.href;
    let path = `${url.pathname}${url.search}${url.hash}`;
    if (/^\/vendor\/orders\/[^/?#]+/.test(path)) {
      const orderId = path.split('/')[3]?.split(/[?#]/)[0];
      path = orderId ? `/vendor/orders?orderId=${encodeURIComponent(orderId)}` : '/vendor/orders';
    }
    if (/^\/logistics\/dashboard\?shipmentId=/.test(path)) {
      path = path.replace('/logistics/dashboard', '/logistics/manifests');
    }
    if (/^\/logistics\/(shipments|tracking)\/[^/?#]+/.test(path)) {
      const shipmentId = path.split('/')[3]?.split(/[?#]/)[0];
      path = shipmentId ? `/logistics/manifests?shipmentId=${encodeURIComponent(shipmentId)}` : '/logistics/manifests';
    }
    if (path === '/logistics/dashboard' || path === '/logistics') return '/logistics/manifests';
    return path;
  } catch {
    return route;
  }
};

export default function SocketProvider({ children }) {
  const { user, logout, refreshWalletBalance, setWalletBalance, authChecked, hasHydrated, fetchMe, token } = useAuthStore();
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
  const tokenRef = useRef(token);
  const userRef = useRef(user);
  
  // Keep refs in sync with state for socket auth callback
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);
  useEffect(() => {
    userRef.current = user;
  }, [user]);
  // ✅ Refs to avoid stale closures in socket handlers
  const isOpenRef = useRef(isOpen);
  const activePartnerIdRef = useRef(activePartnerId);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { activePartnerIdRef.current = activePartnerId; }, [activePartnerId]);

  const isProtectedAppRoute = (route = '') => (
    ['/vendor', '/admin', '/logistics', '/messages', '/chat', '/cart', '/checkout', '/orders', '/profile', '/wallet', '/notifications', '/settings']
      .some((prefix) => String(route || '').startsWith(prefix))
  );

  const isAppForeground = () => {
    if (typeof document === 'undefined') return false;
    return document.visibilityState === 'visible' && document.hasFocus?.();
  };

  const ensureSessionForRoute = async (route) => {
    const target = normalizeAppRoute(route);
    if (!target || !isProtectedAppRoute(target)) return true;

    if (!hasHydrated) return false;

    const state = useAuthStore.getState();
    if (!state.user?._id || !state.isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(target)}`);
      return false;
    }

    if (!state.authChecked) {
      const result = await state.fetchMe({ force: true }).catch(() => ({ success: false }));
      const refreshedState = useAuthStore.getState();
      if (!result?.success || !refreshedState.user?._id || !refreshedState.isAuthenticated) {
        router.replace(`/login?redirect=${encodeURIComponent(target)}`);
        return false;
      }
    }

    return true;
  };

  const openMessageRoute = (partnerId, partnerData = null, route = null, notificationTitle = null) => {
    const target = normalizeAppRoute(route || (partnerId ? `/chat?vendorId=${encodeURIComponent(partnerId)}` : '/chat'));
    if (target) router.push(target);
    if (partnerId) {
      openChat(partnerId, null, partnerData, false, notificationTitle);
      window.dispatchEvent(new CustomEvent('aura_chat_focus', {
        detail: { partnerId: partnerId.toString(), partnerData, route: target, notificationTitle },
      }));
    }
  };

  const handleNotificationIntent = async ({ route, payload = {}, senderId = null, senderData = null } = {}) => {
    const nestedPayload = payload?.payload && typeof payload.payload === 'object' ? payload.payload : {};
    const notificationPayload = { ...nestedPayload, ...payload };
    const payloadData = {
      ...(nestedPayload?.data && typeof nestedPayload.data === 'object' ? nestedPayload.data : {}),
      ...(payload?.data && typeof payload.data === 'object' ? payload.data : {}),
    };
    const targetRoute = normalizeAppRoute(route || notificationPayload?.url || payloadData?.url);
    if (!targetRoute) return;

    const allowed = await ensureSessionForRoute(targetRoute);
    if (!allowed) return;

    const resolvedSenderId =
      senderId ||
      notificationPayload.sender_id ||
      notificationPayload.senderId ||
      notificationPayload.userId ||
      payloadData.sender_id ||
      payloadData.senderId;

    let partnerId = resolvedSenderId;
    if (!partnerId && notificationPayload.tag && typeof notificationPayload.tag === 'string' && notificationPayload.tag.startsWith('msg-')) {
      const parts = notificationPayload.tag.split('-');
      if (parts.length > 1) partnerId = parts[1];
    }

    const partnerPayload = senderData || notificationPayload.sender || notificationPayload.senderData || payloadData.senderData || payloadData.sender || {
      _id: partnerId,
      name: notificationPayload.title || notificationPayload.name || 'Auradime User',
      avatar: notificationPayload.icon || null,
      store_name: notificationPayload.store_name || notificationPayload.storeName,
    };

    const notificationTitle =
      notificationPayload.title ||
      payloadData.title ||
      nestedPayload?.title ||
      null;

    const { is_online, ...partnerNoPresence } = partnerPayload || {};

    if (partnerId) {
      // Ensure partner payload includes a readable name
      if (!partnerNoPresence?.name) {
        partnerNoPresence.name = notificationTitle || notificationPayload.name || 'Auradime User';
      }

      // Open chat and dismiss any toasts immediately
      openMessageRoute(
        partnerId,
        partnerNoPresence,
        targetRoute || `/chat?vendorId=${encodeURIComponent(partnerId)}`,
        notificationTitle
      );
      setChatToast(null);
      setNotifToast(null);
      return;
    }

    // Non-chat notification: navigate there and clear in-app toasts
    router.push(targetRoute);
    setNotifToast(null);
  };

  useEffect(() => {
    if (!user?._id) {
      console.log('[SocketProvider] Waiting for user auth...');
      return;
    }

    const getAuthToken = () => {
      if (token) return token;
      if (typeof window === 'undefined') return null;
      try {
        const storedToken = window.localStorage.getItem('aura_token');
        return storedToken || null;
      } catch (e) {
        console.error('[SocketProvider] localStorage read error:', e);
        return null;
      }
    };

    const authToken = getAuthToken();
    if (!authToken) {
      console.warn('[SocketProvider] No auth token yet; delaying socket connect for user:', user._id);
      return;
    }

    // Connect immediately when a user exists to restore instant messaging.
    console.log('[SocketProvider] User authenticated:', user._id);

    // Connect once per user session
    if (connectedUserId.current !== user._id) {
      // Pass token if available; socket will use cookies with withCredentials: true
      console.log('[SocketProvider] Initiating socket connection for user:', user._id, `using token: ${authToken.substring(0, 10)}...`);
      socketService.connect(user._id, authToken);
      connectedUserId.current = user._id;
    }

    // ── Handler: new chat message ──────────────────────────────────────────
    const handleNewMessage = (msg) => {
      console.log(`📨 [SocketProvider] Message received:`, msg._id, `from ${msg.sender_id?.name || msg.sender_id}`);
      const senderId = (msg.sender_id?._id || msg.sender_id)?.toString();
      if (senderId && senderId === user?._id?.toString()) return;

      // Suppress chat toasts whenever this exact thread is the active chat surface.
      // Refs keep this accurate for overlay, full-page chat, and rapid partner switches.
      if ((isOpenRef.current || activePartnerIdRef.current) && activePartnerIdRef.current?.toString() === senderId) {
        return;
      }

      const senderName = msg.sender_id?.name || 'Auradime User';
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

      if (!isAppForeground()) {
        showNativeNotification({
          id: msg._id || `${senderId}-${Date.now()}`,
          title: senderName,
          body: text,
          route: senderId ? `/chat?vendorId=${senderId}` : '/chat',
          type: 'message',
          senderId,
          senderData: {
            _id: senderId,
            name: senderName,
            avatar: senderAvatar,
            store_name: msg.sender_id?.branding?.store_name || msg.sender_id?.store_name,
          },
        });
        showBrowserNotification({
          id: msg._id || `${senderId}-${Date.now()}`,
          title: senderName,
          body: text,
          route: senderId ? `/chat?vendorId=${senderId}` : '/chat',
          type: 'message',
          senderId,
          senderData: {
            _id: senderId,
            name: senderName,
            avatar: senderAvatar,
            store_name: msg.sender_id?.branding?.store_name || msg.sender_id?.store_name,
          },
          icon: senderAvatar || '/logo-white.png',
        });
      } else {
        console.log('[SocketProvider] Foreground app detected; skipping push notifications for active chat.');
      }

      if (chatToastTimer.current) clearTimeout(chatToastTimer.current);
      chatToastTimer.current = setTimeout(() => setChatToast(null), 6000);
    };

    // ── Handler: in-app notification (order/logistics/payment/system) ──────
    const handleNotification = (notif) => {
      console.log('🔔 Real-time notification received:', notif.title || notif.type);

      const type = notif?.type || 'default';
      const title   = notif?.title   || 'New Notification';
      const message = notif?.message || '';
      const link = normalizeAppRoute(notif.metadata?.link || '/notifications');
      const metadataBalance = notif?.metadata?.wallet_balance ?? notif?.metadata?.balance;

      // Detect sender/partner ID for message-related notifications
      const resolvedSenderId =
        notif?.metadata?.sender_id ||
        notif.sender_id ||
        notif.senderId ||
        notif.data?.sender_id ||
        notif.data?.senderId ||
        null;

      // If app is foreground and the chat for this partner is already active, suppress UI notification
      if (isAppForeground() && resolvedSenderId && activePartnerIdRef.current?.toString() === String(resolvedSenderId)) {
        console.log('[SocketProvider] Suppressing notif toast: chat is active for partner', resolvedSenderId);
        return;
      }

      if (['wallet_update', 'payment', 'payment_received', 'order_status'].includes(type)) {
        if (Number.isFinite(Number(metadataBalance))) {
          setWalletBalance(Number(metadataBalance));
        }
        refreshWalletBalance?.();
      }

      setNotifToast({ 
        id: notif?._id || Date.now(), 
        type, 
        title, 
        message,
        link
      });

      if (!isAppForeground()) {
        showNativeNotification({
          id: notif?._id || `${type}-${Date.now()}`,
          title,
          body: message,
          route: link,
          type,
        });
        showBrowserNotification({
          id: notif?._id || `${type}-${Date.now()}`,
          title,
          body: message,
          route: link,
          type,
        });
      } else {
        console.log('[SocketProvider] App is foreground; suppressing push notification for in-app notification.');
      }

      if (notifToastTimer.current) clearTimeout(notifToastTimer.current);
      // Shorter toast lifetime to avoid lingering notifications
      notifToastTimer.current = setTimeout(() => setNotifToast(null), 3000);
    };

    const handleAccountDeleted = async () => {
      await logout();
      router.replace('/login');
    };

    const handleWalletCredited = (data) => {
      if (Number.isFinite(Number(data?.balance))) {
        setWalletBalance(Number(data.balance));
      }
      refreshWalletBalance?.();
    };

    socketService.on('receive_message', handleNewMessage);
    socketService.on('notification', handleNotification);
    socketService.on('account_deleted', handleAccountDeleted);
    socketService.on('wallet:credited', handleWalletCredited);

    return () => {
      socketService.off('receive_message', handleNewMessage);
      socketService.off('notification', handleNotification);
      socketService.off('account_deleted', handleAccountDeleted);
      socketService.off('wallet:credited', handleWalletCredited);
    };
  // Re-register when user changes or store rehydrates. isOpen/activePartnerId are read via refs.
  }, [user?._id, token, hasHydrated, logout, router, refreshWalletBalance, setWalletBalance]);

  // Listen for messages from the Service Worker (e.g., notification click payload)
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const onSWMessage = (e) => {
      const msg = e.data;
      if (!msg) return;

      if (msg.type === 'notification-click') {
        handleNotificationIntent({
          route: msg.url,
          payload: msg.payload || {},
          senderId: msg.senderId || null,
          senderData: msg.senderData || null,
        });
        return;
      }

      if (msg.type === 'push-received') {
        const payload = msg.payload || {};
        const senderId = payload.sender_id || payload.senderId || payload.data?.senderId || payload.data?.sender_id;
        const text = payload.body || payload.message || 'New message received';
        const route = payload.data?.url || payload.url || (senderId ? `/chat?vendorId=${senderId}` : '/chat');

        if (isAppForeground()) {
          // If chat for this sender is active, don't show a toast; otherwise show briefly
          const senderId = payload.sender_id || payload.senderId || payload.data?.senderId || payload.data?.sender_id;
          if (senderId && activePartnerIdRef.current?.toString() === String(senderId)) {
            console.log('[SocketProvider] SW push received for active chat; skipping toast.');
          } else {
            setNotifToast({
              id: Date.now(),
              type: payload.type || 'default',
              title: payload.title || 'Auradime',
              message: text,
              link: route,
            });
            if (notifToastTimer.current) clearTimeout(notifToastTimer.current);
            notifToastTimer.current = setTimeout(() => setNotifToast(null), 3000);
          }
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', onSWMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onSWMessage);
  }, [authChecked, fetchMe, hasHydrated, openChat, router, user?._id]);

  useEffect(() => {
    let listener;
    let cancelled = false;

    const bindNativeNotificationTap = async () => {
      if (!(await isNativeCapacitorApp())) return;

      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        listener = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
          if (cancelled) return;

          const extra = event?.notification?.extra || {};
          handleNotificationIntent({
            route: extra.route,
            payload: extra,
            senderId: extra.senderId,
            senderData: extra.senderData || null,
          });
        });
      } catch (error) {
        console.warn('[Notifications] Native tap listener skipped:', error?.message || error);
      }
    };

    bindNativeNotificationTap();
    return () => {
      cancelled = true;
      listener?.remove?.();
    };
  }, [authChecked, fetchMe, hasHydrated, openChat, router, user?._id]);

  useEffect(() => {
    const onAuraChatFocus = (e) => {
      try {
        const partnerId = e?.detail?.partnerId?.toString?.();
        if (!partnerId) {
          setChatToast(null);
          setNotifToast(null);
          return;
        }
        // If the focused chat matches current toast, dismiss it
        if (chatToast?.senderId && chatToast.senderId.toString() === partnerId) {
          setChatToast(null);
        }
        // Also clear notification toasts
        setNotifToast(null);
      } catch (err) {
        console.error('[SocketProvider] aura_chat_focus handler error:', err);
      }
    };

    window.addEventListener('aura_chat_focus', onAuraChatFocus);
    // cleanup
    return () => window.removeEventListener('aura_chat_focus', onAuraChatFocus);
  }, [chatToast, authChecked, hasHydrated]);
  
  useEffect(() => {
    if (!hasHydrated || !authChecked) return;

    const handlePendingIntent = (intent) => {
      if (!intent) return;
      handleNotificationIntent({
        route: intent.url,
        payload: intent,
        senderId: intent.senderId,
        senderData: intent.senderData || null,
      });
    };

    handlePendingIntent(consumePendingNativePushIntent());

    const onPushIntent = (event) => {
      handlePendingIntent(event.detail);
    };

    window.addEventListener('aura:push-notification-click', onPushIntent);
    return () => window.removeEventListener('aura:push-notification-click', onPushIntent);
  }, [authChecked, hasHydrated, user?._id]);

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
            onClick={() => { 
              if (chatToast.senderId) {
                openChat(chatToast.senderId, null, chatToast.senderData, false, chatToast.sender);
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
            const href = normalizeAppRoute(notifToast.link || resolveConfig(notifToast.type).href);
            return (
              <div
                onClick={() => { router.push(href); setNotifToast(null); }}
                className="bg-emerald-500/95 backdrop-blur-2xl border border-emerald-400/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4 cursor-pointer hover:scale-[1.02] transition-all group text-white"
              >
                <div className="size-12 rounded-xl bg-white/10 shrink-0 border border-white/20 flex items-center justify-center text-white">
                  <Icon className="size-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] lg:text-[12px] font-semibold tracking-tight text-white/70 mb-0.5 leading-none">Aura Dime</p>
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
