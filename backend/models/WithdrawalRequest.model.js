/**
 * models/WithdrawalRequest.model.js
 * Auradime — Withdrawal Request Schema
 *
 * Tracks all withdrawal requests from users and vendors.
 * Status flow: pending → approved (gateway called) → failed | completed
 *              pending → rejected (no gateway call)
 *
 * Balance is reserved when a request is submitted and restored if rejected/failed.
 */

const mongoose = require('mongoose');

const recipientDetailsSchema = new mongoose.Schema({
  // MoMo
  phone_number: { type: String, default: null },
  // Bank
  bank_code:      { type: String, default: null },
  account_number: { type: String, default: null },
  // Eversend wallet-to-wallet
  eversend_tag:   { type: String, default: null },
  // Saved Beneficiary
  beneficiary_id: { type: String, default: null },
  // Common
  first_name: { type: String, required: true },
  last_name:  { type: String, required: true },
  country:    { type: String, required: true }, // ISO 2-letter e.g. UG, KE, CM
}, { _id: false });

const WithdrawalRequestSchema = new mongoose.Schema(
  {
    // ── Requester ───────────────────────────────
    requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'vendor', 'logistics'],
      required: true,
    },

    // ── Amount ──────────────────────────────────
    amount: {
      type: Number,
      required: true,
      min: [500, 'Minimum withdrawal is 500 XAF'],
    },
    currency: {
      type: String,
      required: true,
      default: 'XAF',
    },

    // ── Method ──────────────────────────────────
    withdrawal_method: {
      type: String,
      enum: ['momo', 'eversend'],
      required: true,
    },
    recipient_details: {
      type: recipientDetailsSchema,
      required: true,
    },

    // ── Status Engine ────────────────────────────
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'failed', 'processing_error', 'completed'],
      default: 'pending',
      index: true,
    },

    // ── Payout Gateway Linkage ───────────────────
    payout_gateway:           { type: String, enum: ['eversend', 'payunit', 'manual'], default: null },
    eversend_transaction_id:  { type: String, default: null },
    eversend_quotation_token: { type: String, default: null, select: false },
    eversend_status:          { type: String, default: null },
    balance_deducted:         { type: Boolean, default: false },

    // ── Admin Review ─────────────────────────────
    rejection_reason: { type: String, default: null },
    failure_reason:   { type: String, default: null },
    reviewed_by:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewed_at:  { type: Date, default: null },

    // ── Optional Note from Requester ─────────────
    note: { type: String, default: null, maxlength: 300 },
  },
  {
    timestamps: true,
  }
);

// Index for quick admin queue lookups
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ requested_by: 1, status: 1 });

module.exports = mongoose.model('WithdrawalRequest', WithdrawalRequestSchema);
