/**
 * routes/chat.routes.js
 * Auradime — Chat HTTP Routes
 */

const express = require('express');
const router = express.Router();

const { getConversation, getUserInbox, sendMessage, markAsRead, getAllMessagesAdmin, getSystemWideInbox, deleteMessage } = require('../controllers/chat.controller');

const { protect, restrictTo } = require('../middleware/auth.middleware');

// All chat routes require authentication (Any user role can chat)
router.use(protect);

// ── Admin-only Routes ──────────────────────────
router.get('/admin/all', restrictTo('admin'), getAllMessagesAdmin);
router.get('/admin/inbox', restrictTo('admin'), getSystemWideInbox);

// ── Operations ──────────────────────────────
router.get('/', getUserInbox);                 // List of all active distinct conversations
router.post('/', sendMessage);                // Send a new message
router.get('/:userId', getConversation);       // Historical loop between current user and the dynamically requested User ID
router.patch('/read/:userId', markAsRead);     // Mark all incoming messages from this user as read
router.delete('/message/:messageId', deleteMessage); // Delete single message for me or for everyone

module.exports = router;
