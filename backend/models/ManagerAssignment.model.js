/**
 * models/ManagerAssignment.model.js
 * Auradime — Manager ↔ Account Assignments
 *
 * Tracks which managers manage which user accounts,
 * with access levels, invite/accept flow, and full history.
 *
 * Status lifecycle:
 *   Admin direct assign → active
 *   Manager invite      → pending → active | declined
 *   Revoke (admin/user) → revoked
 */

const mongoose = require('mongoose');

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
    access_level: {
      type: String,
      enum: ['read_only', 'standard', 'full'],
      default: 'standard',
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'revoked', 'declined'],
      default: 'active',
      index: true,
    },
    assigned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
  {
    timestamps: true,
  }
);

// A manager can only have one active/pending assignment per user
ManagerAssignmentSchema.index(
  { manager_id: 1, user_id: 1 },
  { unique: true }
);

// Fast lookup: "who manages this user?"
ManagerAssignmentSchema.index({ user_id: 1, status: 1 });

module.exports = mongoose.model('ManagerAssignment', ManagerAssignmentSchema);
