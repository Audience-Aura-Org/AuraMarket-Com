/**
 * sockets/chat.socket.js
 * Aura Market — Real-time WebSockets Manager (Socket.IO)
 *
 * Facilitates the active transmission of messages globally utilizing user-bound "rooms".
 */

const socketIo = require('socket.io');
const Message = require('../models/Message.model');
const jwt = require('jsonwebtoken'); // Could verify socket origins if deeply secured

const mapChatSockets = (server) => {
  const io = socketIo(server, {
    cors: {
      origin: [process.env.WEB_CLIENT_URL, 'http://localhost:3000'],
      methods: ['GET', 'POST'],
      credentials: true,
      allowEIO3: true, // Support older clients
    },
    // Enable both transports
    transports: ['websocket', 'polling'],
    // Polling config for reliability
    pingInterval: 25000,
    pingTimeout: 20000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6, // 1 MB
  });

  // Track active socket connections
  const userSockets = new Map(); // Map<userId, Set<socketId>>

  // Engine-level connection error logging (helps capture handshake/upgrade failures)
  try {
    io.engine && io.engine.on && io.engine.on('connection_error', (err) => {
      console.error('Socket Engine connection_error:', err);
    });
  } catch (e) {
    // ignore if engine not available
  }

  // Middlewares to map socket security (Optional: Decoding JWT token sent via handshake)
  io.use((socket, next) => {
    try {
      // Log handshake details for debugging transport/upgrade issues
      try {
        console.log('[Socket] Handshake auth:', socket.handshake.auth);
        console.log('[Socket] Handshake headers origin:', socket.handshake.headers?.origin);
      } catch (e) {
        console.warn('[Socket] Error logging handshake:', e);
      }

      // We assume the frontend emits the user's explicit _id through auth tokens when connecting.
      // E.g., const socket = io('url', { auth: { userId: 'xxx' } })
      const userId = socket.handshake.auth?.userId;
      if (!userId) {
        const err = new Error('Authentication Error: Missing userId in socket handshake');
        console.error('[Socket] Auth failed:', err.message);
        return next(err);
      }
      // Bind socket instance uniquely globally to the authenticated User instance ID
      socket.userId = userId;
      console.log(`[Socket] ✅ Auth successful for userId: ${userId}`);
      next();
    } catch (err) {
      console.error('[Socket] Error in socket middleware:', err);
      next(err);
    }
  });

  io.on('connection', (socket) => {
    // Report the transport used (polling / websocket) for this connection
    const transportName = socket.conn && socket.conn.transport && socket.conn.transport.name;
    console.log(`⚡ Socket connected: User ${socket.userId} (${socket.id}) transport=${transportName}`);

    // Track this socket connection
    if (!userSockets.has(socket.userId)) {
      userSockets.set(socket.userId, new Set());
    }
    userSockets.get(socket.userId).add(socket.id);
    console.log(`📊 Active connections for ${socket.userId}: ${userSockets.get(socket.userId).size}`);

    // 1. Join a dynamic private "Room" exactly string-matched to the Mongo User ObjectId
    const userRoom = socket.userId.toString();
    socket.join(userRoom);
    console.log(`🏠 User ${socket.userId} joined room: ${userRoom}`);

    // 2. Transmit 'send_message' (Handles inbound texts & Product Cards)
    socket.on('send_message', async (data) => {
      try {
        const { receiver_id, text, product_reference } = data;
        if (!receiver_id) {
          console.warn(`⚠️ [Socket] Received send_message without receiver_id from ${socket.userId}`);
          return;
        }

        console.log(`[Socket] 📨 Incoming send_message: ${socket.userId} -> ${receiver_id}`);

        // Persist the message mapping in real-time MongoDB securely
        const message = await Message.create({
          sender_id: socket.userId,
          receiver_id,
          text,
          product_reference: product_reference || null,
        });

        const populatedMessage = await Message.findById(message._id)
          .populate('product_reference', 'name price images')
          .populate('sender_id', 'name avatar role')
          .populate('receiver_id', 'name avatar role');

        // Emit to receiver (they're listening in room with their userId)
        const receiverRoom = receiver_id.toString();
        const receiverSocketCount = io.sockets.adapter.rooms.get(receiverRoom)?.size || 0;
        console.log(`[Socket] 📤 Emitting receive_message to room ${receiverRoom} (${receiverSocketCount} recipient(s))`);
        io.to(receiverRoom).emit('receive_message', populatedMessage);
        
        // Emit echo back to sender (for their multiple devices)
        const senderRoom = socket.userId.toString();
        const senderSocketCount = io.sockets.adapter.rooms.get(senderRoom)?.size || 0;
        console.log(`[Socket] 📤 Emitting sent_message_echo to room ${senderRoom} (${senderSocketCount} sender socket(s))`);
        io.to(senderRoom).emit('sent_message_echo', populatedMessage);

        console.log(`✅ [Socket] Message delivered: ${socket.userId} -> ${receiver_id}`);

      } catch (error) {
        console.error('Socket (send_message) Error:', error);
      }
    });

    // 3. Acknowledgements / Receipts handler ('mark_read')
    socket.on('mark_read', async (data) => {
      try {
        const { messageId, senderId } = data;
        if (!messageId || !senderId) return;
        
        console.log(`[Socket] ✍️ mark_read: messageId=${messageId}, senderId=${senderId}`);

        // Ensure atomic sync inside MongoDB
        await Message.findByIdAndUpdate(messageId, { read_status: true });
        
        // Blast read receipt back securely specifically towards whoever sent the message initially
        const senderRoom = senderId.toString();
        io.to(senderRoom).emit('read_receipt', {
          messageId,
          read_status: true,
          readAt: new Date(),
        });

        console.log(`✅ [Socket] Read receipt sent to ${senderRoom}`);

      } catch (error) {
        console.error('Socket (mark_read) Error:', error);
      }
    });

    socket.on('disconnect', () => {
      // Remove from tracking
      const userSet = userSockets.get(socket.userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(socket.userId);
        }
      }
      console.log(`🔌 Socket disconnected: User ${socket.userId} (${socket.id}) | Remaining connections: ${userSet?.size || 0}`);
    });
  });

  return io;
};

module.exports = mapChatSockets;
