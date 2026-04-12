'use client';

/**
 * hooks/useNotifications.js
 * Aura Market — Global Notification Badge Hook
 *
 * Returns:
 *  - unreadCount : total unread in-app notifications (orders, logistics, system...)
 *  - unreadMessages : unread chat messages count
 *  - markAllRead : function to clear badge
 *  - refresh : manually re-fetch counts
 *
 * Updates in real-time via Socket.IO ('notification' + 'receive_message' events).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/services/api';
import socketService from '@/services/socket';
import { useAuthStore } from '@/hooks/useAuth';

export function useNotifications() {
  const { user } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const latestCount = useRef(0);

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
        setUnreadMessages(chats.filter(c => c.read_status === false).length);
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

    // ── Real-time: new chat message ──
    const handleMessage = () => {
      if (!window.location.pathname.startsWith('/chat')) {
        setUnreadMessages(prev => prev + 1);
      }
    };

    // ── Mark messages as read when visiting chat ──
    const handleMessagesRead = () => {
      setUnreadMessages(0);
    };

    socketService.on('notification', handleNotification);
    socketService.on('receive_message', handleMessage);
    socketService.on('messages_read', handleMessagesRead);

    // Refresh counts every 60s as a safety net
    const interval = setInterval(fetchCounts, 60_000);

    return () => {
      socketService.off('notification', handleNotification);
      socketService.off('receive_message', handleMessage);
      socketService.off('messages_read', handleMessagesRead);
      clearInterval(interval);
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
