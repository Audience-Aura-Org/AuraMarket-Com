'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/services/api';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';

const NotificationContext = createContext(null);
const NOTIFICATION_POLL_MS = 30_000;

const getUnreadChatThreadTotal = (chats = []) =>
  chats.reduce((total, chat) => total + (Number(chat?.unread_count || 0) > 0 ? 1 : 0), 0);

export function NotificationProvider({ children }) {
  const user = useAuthStore((state) => state.user);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const latestCount = useRef(0);
  const messageDebounce = useRef(null);
  const currentUserId = useRef(user?._id);
  currentUserId.current = user?._id;

  const refresh = useCallback(async () => {
    if (!user?._id) return;

    const [notificationsResult, chatsResult] = await Promise.allSettled([
      api.get('/notifications', { __noActAs: true, skipClientCache: true }),
      api.get('/chat', { __noActAs: true }),
    ]);
    if (currentUserId.current !== user._id) return;

    if (notificationsResult.status === 'fulfilled' && notificationsResult.value.data?.success) {
      const notifications = notificationsResult.value.data.data?.notifications || [];
      const count = notificationsResult.value.data.data?.unreadCount ?? notifications.filter((notification) => !notification.is_read).length;
      latestCount.current = count;
      setUnreadCount(count);
    }

    if (chatsResult.status === 'fulfilled' && chatsResult.value.data?.success) {
      setUnreadMessages(getUnreadChatThreadTotal(chatsResult.value.data.data?.activeChats || []));
    }
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) {
      latestCount.current = 0;
      setUnreadCount(0);
      setUnreadMessages(0);
      return undefined;
    }

    refresh();
    // Count from the server so replayed socket events cannot inflate badges.
    const handleNotification = () => {
      if (messageDebounce.current) clearTimeout(messageDebounce.current);
      messageDebounce.current = setTimeout(refresh, 300);
    };
    const handleMessage = () => {
      if (messageDebounce.current) clearTimeout(messageDebounce.current);
      messageDebounce.current = setTimeout(refresh, 500);
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const poll = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    socketService.on('notification', handleNotification);
    socketService.on('receive_message', handleMessage);
    socketService.on('messages_read', refresh);
    const interval = setInterval(poll, NOTIFICATION_POLL_MS);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('aura:push-received', refresh);

    return () => {
      socketService.off('notification', handleNotification);
      socketService.off('receive_message', handleMessage);
      socketService.off('messages_read', refresh);
      if (messageDebounce.current) clearTimeout(messageDebounce.current);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('aura:push-received', refresh);
    };
  }, [user?._id, refresh]);

  const markAllRead = useCallback(async () => {
    const userId = currentUserId.current;
    await api.patch('/notifications/read-all', undefined, { __noActAs: true });
    if (currentUserId.current !== userId) return;
    latestCount.current = 0;
    setUnreadCount(0);
  }, []);

  const value = useMemo(() => ({ unreadCount, unreadMessages, markAllRead, refresh }), [unreadCount, unreadMessages, markAllRead, refresh]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider.');
  return context;
}
