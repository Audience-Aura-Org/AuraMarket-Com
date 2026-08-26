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

import { useNotificationContext } from '@/context/NotificationContext';

export function useNotifications() {
  return useNotificationContext();
}
