'use client';

/**
 * hooks/useNotifications.js
 * Auradime — Global Notification Badge Hook
 *
 * Returns:
 *  - unreadCount : total unread in-app notifications (orders, logistics, system...)
 *  - unreadMessages : count of chat threads that contain unread messages
 *  - markAllRead : function to clear badge
 *  - refresh : manually re-fetch counts
 *
 * Updates in real-time via Socket.IO ('notification' + 'receive_message' events).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';

const NOTIFICATION_POLL_MS = 120_000;

const getUnreadChatThreadTotal = (chats = []) =>
  chats.reduce((total, chat) => total + (Number(chat?.unread_count || 0) > 0 ? 1 : 0), 0);

export function useNotifications() {
  const { user } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const latestCount = useRef(0);
  // Debounce timer: rapid incoming messages only trigger one badge refresh per 500ms burst.
  const msgDebounceRef = useRef(null);

  const fetchCounts = useCallback(async () => {
    if (!user?._id) return;
    try {
      // Notification badges
      const notifRes = await api.get('/notifications');
      if (notifRes.data?.success) {
        const notifications = notifRes.data.data?.notifications || [];
        const count = notifications.filter(n => !n.is_read).length;
        latestCount.current = count;
        setUnreadCount(count);
      }
    } catch { /* silent — badge is non-critical */ }

    try {
      // Chat unread badge
      const chatRes = await api.get('/chat');
      if (chatRes.data?.success) {
        const chats = chatRes.data.data?.activeChats || [];
        setUnreadMessages(getUnreadChatThreadTotal(chats));
      }
    } catch { /* silent */ }
  }, [user?._id]);

  useEffect(() => {
    if (!user?._id) {
      setUnreadCount(0);
      setUnreadMessages(0);
      return;
    }

    fetchCounts();

    // ── Real-time: new in-app notification pushed by backend ──
    const handleNotification = (notification) => {
      // Only count unread ones
      if (!notification?.is_read) {
        latestCount.current += 1;
        setUnreadCount(latestCount.current);
      }
    };

    // ── Real-time: new chat message received ──
    // Debounced so rapid messages don't hammer the API — one refresh per 500ms burst.
    const handleMessage = () => {
      if (msgDebounceRef.current) clearTimeout(msgDebounceRef.current);
      msgDebounceRef.current = setTimeout(() => fetchCounts(), 500);
    };

    // sent_message_echo fires when WE send — our unread count doesn't change, skip.

    // ── Mark messages as read (read receipts — update badge accurately) ──
    const handleMessagesRead = () => {
      fetchCounts();
    };

    socketService.on('notification', handleNotification);
    socketService.on('receive_message', handleMessage);
    socketService.on('messages_read', handleMessagesRead);

    const poll = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchCounts();
      }
    };
    const handleVisible = () => {
      if (document.visibilityState === 'visible') fetchCounts();
    };

    // Refresh counts every 120s as a safety net when sockets miss an event.
    const interval = setInterval(poll, NOTIFICATION_POLL_MS);
    document.addEventListener('visibilitychange', handleVisible);

    return () => {
      socketService.off('notification', handleNotification);
      socketService.off('receive_message', handleMessage);
      socketService.off('messages_read', handleMessagesRead);
      if (msgDebounceRef.current) clearTimeout(msgDebounceRef.current);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisible);
    };
  }, [user?._id, fetchCounts]);

  const markAllRead = useCallback(async () => {
    try {
      await api.patch('/notifications/read-all');
      latestCount.current = 0;
      setUnreadCount(0);
    } catch { /* silent */ }
  }, []);

  return {
    unreadCount,
    unreadMessages,
    markAllRead,
    refresh: fetchCounts,
  };
}
