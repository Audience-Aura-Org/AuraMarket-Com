import api from './api';
import socketService from './socket';

/**
 * notificationService
 * Functional logic for polling alerts and handling real-time pushes.
 */
export const notificationService = {
  // Get latest notifications
  getAll: async () => {
    const res = await api.get('/notifications');
    return res.data;
  },

  // Mark a specific notification as read
  markAsRead: async (id) => {
    const res = await api.patch(`/notifications/${id}/read`);
    return res.data;
  },

  // Mark all as read
  markAllAsRead: async () => {
    const res = await api.patch('/notifications/read-all');
    return res.data;
  },

  // Real-time listener for incoming pushes — uses the proper SocketService.on() queue
  onPush: (callback) => {
    socketService.on('notification', callback);
    return () => socketService.off('notification', callback);
  }
};
