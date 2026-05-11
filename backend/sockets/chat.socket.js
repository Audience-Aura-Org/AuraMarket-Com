/**
 * sockets/chat.socket.js
 * Aura Market — Real-time WebSockets Manager (Socket.IO)
 */

const socketIo = require('socket.io');
const Message = require('../models/Message.model');

const mapChatSockets = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: [process.env.WEB_CLIENT_URL, 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
      allowEIO3: true,
    },
    transports: ['websocket', 'polling'],
  });

  const userSockets = new Map();

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

    // Track this socket connection and Mark Online
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
      // Mark as online in DB
      require('../models/User.model').findByIdAndUpdate(socket.userId, { is_online: true, last_seen: Date.now() }).catch(e => console.error(e));
      // Broadcast online status to others
      io.emit('user_presence', { userId: socket.userId, isOnline: true });
    }
    userSockets.get(socket.userId).add(socket.id);

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
      if (receiver_id) io.to(receiver_id.toString()).emit('partner_typing', { userId: socket.userId });
    });

    socket.on('typing_stop', ({ receiver_id }) => {
      if (receiver_id) io.to(receiver_id.toString()).emit('partner_stopped_typing', { userId: socket.userId });
    });

    socket.on('disconnect', async () => {
      const userSet = userSockets.get(socket.userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(socket.userId);
          // Mark as offline in DB
          await require('../models/User.model').findByIdAndUpdate(socket.userId, { is_online: false, last_seen: Date.now() }).catch(e => console.error(e));
          // Broadcast offline status
          io.emit('user_presence', { userId: socket.userId, isOnline: false, lastSeen: Date.now() });
        }
      }
      console.log(`🔌 Socket disconnected: ${socket.userId}`);
    });
  });

  return io;
};

module.exports = mapChatSockets;
