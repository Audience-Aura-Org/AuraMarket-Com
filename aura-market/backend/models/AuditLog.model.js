/**
 * models/AuditLog.model.js
 * Aura Market — System Audit Log
 * 
 * Tracks mutations by admins and vendors for accountability.
 */

const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    action: {
      type: String, // e.g., 'price_change', 'stock_update', 'user_ban', 'dispute_resolve'
      required: true,
      index: true
    },
    target_type: {
      type: String, // 'product', 'vendor', 'user', 'order', 'dispute'
      required: true
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    changes: {
      old: mongoose.Schema.Types.Mixed,
      new: mongoose.Schema.Types.Mixed
    },
    metadata: {
      ip: String,
      user_agent: String,
      resource_url: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('AuditLog', AuditLogSchema);
