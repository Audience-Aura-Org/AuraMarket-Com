/**
 * models/ManagerAssignment.model.js
 * Auradime — Manager ↔ Account Assignments
 *
 * Tracks which managers manage which user accounts,
 * with per-category permissions, invite/accept flow, and full history.
 *
 * Status lifecycle:
 *   Admin direct assign   → active
 *   Manager/user invite   → pending → active | declined
 *   Revoke (admin/user)   → revoked
 *   Expiration             → expired
 */

const mongoose = require('mongoose');

const PERMISSIONS = ['products', 'orders', 'messages', 'money', 'profile'];
const DEFAULT_PERMISSIONS = {
  products: true,
  orders: true,
  messages: true,
  money: false,   // off unless the user/admin explicitly enables it
  profile: true,
};

const ManagerAssignmentSchema = new mongoose.Schema(
  {
    manager_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    permissions: {
      products: { type: Boolean, default: true },
      orders:   { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      money:    { type: Boolean, default: false },
      profile:  { type: Boolean, default: true },
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'revoked', 'declined', 'expired'],
      default: 'pending',
      index: true,
    },
    initiated_by: {
      type: String,
      enum: ['admin', 'manager', 'user'],
      required: true,
    },
    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    expires_at: {
      type: Date,
      default: null,
    },
    revoked_at: {
      type: Date,
      default: null,
    },
    revoked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    note: {
      type: String,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

// One open link per manager/user pair (allows historical revoked/declined records)
ManagerAssignmentSchema.index(
  { manager_id: 1, user_id: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'active'] } } }
);

// Fast lookup: "who manages this user?"
ManagerAssignmentSchema.index({ user_id: 1, status: 1 });

const ManagerAssignment = mongoose.model('ManagerAssignment', ManagerAssignmentSchema);

module.exports = ManagerAssignment;
module.exports.PERMISSIONS = PERMISSIONS;
module.exports.DEFAULT_PERMISSIONS = DEFAULT_PERMISSIONS;
