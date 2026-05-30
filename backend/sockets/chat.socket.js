/**
 * sockets/chat.socket.js
 * Auradime — Real-time WebSockets Manager (Socket.IO)
 */

const socketIo = require('socket.io');
const Message = require('../models/Message.model');
const User = require('../models/User.model');
const { createCorsOptions } = require('../middleware/security.middleware');

const mapChatSockets = (server) => {
  const io = socketIo(server, {
    cors: createCorsOptions(),
    allowEIO3: true,
    transports: ['websocket', 'polling'],
  });

  const userSockets = new Map();
  const disconnectTimers = new Map(); // Grace period before marking offline

  io.use((socket, next) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) {
      return next(new Error('Authentication Error: Missing userId'));
    }
    socket.userId = userId;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`⚡ Socket connected: ${socket.userId}`);

    // Cancel any pending offline timer for this user (reconnect scenario)
    if (disconnectTimers.has(socket.userId)) {
      clearTimeout(disconnectTimers.get(socket.userId));
      disconnectTimers.delete(socket.userId);
      console.log(`⚡ Cancelled offline timer for ${socket.userId} (reconnected)`);
    }

    // Track this socket connection and Mark Online
    const isFirstSocket = !userSockets.has(socket.userId) || userSockets.get(socket.userId).size === 0;
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);

    if (isFirstSocket) {
      // Mark as online in DB
      const lastSeen = new Date();
      User.findByIdAndUpdate(socket.userId, { is_online: true, last_seen: lastSeen }).catch(e => console.error(e));
      // Broadcast online status to others
      io.emit('user_presence', { userId: socket.userId, isOnline: true, lastSeen: lastSeen.toISOString() });
    }

    const userRoom = socket.userId.toString();
    socket.join(userRoom);

    socket.on('send_message', async (data) => {
      try {
        const { receiver_id, text, product_reference } = data;
        const message = await Message.create({
          sender_id: socket.userId,
          receiver_id,
          text,
          product_reference: product_reference || null,
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('product_reference', 'name price images')
          .populate('sender_id', 'name avatar role is_online last_seen')
          .populate('receiver_id', 'name avatar role is_online last_seen');

        io.to(receiver_id.toString()).emit('receive_message', populatedMessage);
        io.to(socket.userId.toString()).emit('sent_message_echo', populatedMessage);
      } catch (error) {
        console.error('Socket (send_message) Error:', error);
      }
    });

    socket.on('typing_start', ({ receiver_id }) => {
      if (receiver_id) {
        io.to(receiver_id.toString()).emit('partner_typing', {
          userId: socket.userId,
          receiverId: receiver_id.toString(),
          at: new Date().toISOString(),
        });
      }
    });

    socket.on('typing_stop', ({ receiver_id }) => {
      if (receiver_id) {
        io.to(receiver_id.toString()).emit('partner_stopped_typing', {
          userId: socket.userId,
          receiverId: receiver_id.toString(),
          at: new Date().toISOString(),
        });
      }
    });

    // Allow client to query if a specific user is currently online
    socket.on('check_online_status', async (data, callback) => {
      const targetId = (data?.userId || '').toString();
      if (!targetId) return;
      const isOnline = userSockets.has(targetId) && userSockets.get(targetId).size > 0;
      const user = await User.findById(targetId).select('last_seen is_online').lean().catch(() => null);
      const lastSeen = user?.last_seen || null;
      const response = {
        userId: targetId,
        isOnline,
        lastSeen: lastSeen ? new Date(lastSeen).toISOString() : null,
      };
      // Support both callback and emit patterns
      if (typeof callback === 'function') {
        callback(response);
      } else {
        socket.emit('user_presence', response);
      }
    });

    socket.on('disconnect', () => {
      const userSet = userSockets.get(socket.userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          // Grace period: wait 3 seconds before marking offline
          // This prevents false offline flickers during page refresh / reconnect
          const timer = setTimeout(async () => {
            disconnectTimers.delete(socket.userId);
            // Re-check: user might have reconnected during grace period
            const currentSet = userSockets.get(socket.userId);
            if (currentSet && currentSet.size > 0) return;
            
            userSockets.delete(socket.userId);
            // Mark as offline in DB
            const lastSeen = new Date();
            await User.findByIdAndUpdate(socket.userId, { is_online: false, last_seen: lastSeen }).catch(e => console.error(e));
            // Broadcast offline status
            io.emit('user_presence', { userId: socket.userId, isOnline: false, lastSeen: lastSeen.toISOString() });
            console.log(`🔌 User marked offline: ${socket.userId}`);
          }, 3000);
          disconnectTimers.set(socket.userId, timer);
        }
      }
      console.log(`🔌 Socket disconnected: ${socket.userId}`);
    });
  });

  return io;
};

module.exports = mapChatSockets;
