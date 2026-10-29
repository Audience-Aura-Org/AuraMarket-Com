/**
 * models/Message.model.js
 * Auradime — Chat Message Schema
 *
 * Stores private messages between users (Customers & Vendors/Logistics).
 * Supports standard text and optional Product Card references to enhance the
 * "Chat-to-buy" commerce experience.
 */

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema(
  {
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Speeds up fetching inbox/outbox history
    },
    receiver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    text: {
      type: String,
      trim: true,
      default: '', // Users might just send a product reference without typing text
    },
    product_reference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null, // If present, frontends render a "Product Card" inside the chat
    },
    read_status: {
      type: Boolean,
      default: false, // Updated to true when recipient opens the chat tab natively
    },
    delivered_status: {
      type: Boolean,
      default: false, // Updated when the recipient has an active socket/device session
    },
    delivered_at: {
      type: Date,
      default: null,
    },
    image_url: {
      type: String,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    deleted_for: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      }
    ],
    deleted_everyone: {
      type: Boolean,
      default: false,
    },
    // Client-generated idempotency key — prevents duplicate messages on retry
    client_id: {
      type: String,
      default: null,
    },
    // The message this one answers (WhatsApp-style quote). A snapshot, so the quote
    // still shows if the original is later deleted, and no extra lookup is needed.
    reply_to: {
      type: {
        message_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
        sender_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: { type: String, default: '' },
        has_image: { type: Boolean, default: false },
        has_product: { type: Boolean, default: false },
      },
      default: null,
      _id: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly fetch full bidirectional conversations
MessageSchema.index({ sender_id: 1, receiver_id: 1, createdAt: -1 });
// Inbox: a user's messages newest-first, from both sides (merged without an in-memory sort).
MessageSchema.index({ sender_id: 1, createdAt: -1 });
MessageSchema.index({ receiver_id: 1, createdAt: -1 });
// Unread counts and mark-as-read: indexes only unread messages, so it stays small.
MessageSchema.index({ receiver_id: 1, sender_id: 1 }, { partialFilterExpression: { read_status: false }, name: 'unread_by_pair' });
// Sparse index for idempotent send lookups (client_id is null for legacy messages)
MessageSchema.index({ sender_id: 1, client_id: 1 }, { sparse: true });

module.exports = mongoose.model('Message', MessageSchema);
