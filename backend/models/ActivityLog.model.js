/**
 * models/ActivityLog.model.js
 * Auradime — Manager Activity Audit Trail
 *
 * Written automatically for every successful write operation a manager
 * makes while acting on behalf of a user in workspace mode (X-Act-As).
 * Only field NAMES are logged (never values) to avoid storing secrets.
 */

const mongoose = require('mongoose');

module.exports = mongoose.model(
  'ActivityLog',
  new mongoose.Schema(
    {
      manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      category:   String,    // products | orders | messages | money | profile
      method:     String,    // HTTP method
      path:       String,    // request URL
      status:     Number,    // HTTP status code
      fields:     [String],  // names of body keys changed (never values)
      ip:         String,
    },
    { timestamps: { createdAt: true, updatedAt: false } }
  )
);
