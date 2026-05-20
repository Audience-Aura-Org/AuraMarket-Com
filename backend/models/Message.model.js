/**
 * models/Message.model.js
 * Aura Market — Chat Message Schema
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
  },
  {
    timestamps: true,
  }
);

// Compound index to quickly fetch full bidirectional conversations
MessageSchema.index({ sender_id: 1, receiver_id: 1, createdAt: -1 });

module.exports = mongoose.model('Message', MessageSchema);
