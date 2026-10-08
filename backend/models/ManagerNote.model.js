/**
 * models/ManagerNote.model.js
 * Auradime — Manager Notes & Reminders
 *
 * Managers can create notes for themselves, optionally tied to a specific
 * assigned account. Supports optional reminders and done/undone toggling.
 */

const mongoose = require('mongoose');

module.exports = mongoose.model(
  'ManagerNote',
  new mongoose.Schema(
    {
      manager_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
      user_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true }, // null = general note
      body:       { type: String, required: true, maxlength: 2000 },
      remind_at:  { type: Date, default: null },
      done:       { type: Boolean, default: false },
    },
    { timestamps: true }
  )
);
