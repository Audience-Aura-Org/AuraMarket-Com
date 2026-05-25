/**
 * models/WithdrawalRequest.model.js
 * Auradime — Withdrawal Request Schema
 *
 * Tracks all withdrawal requests from users and vendors.
 * Status flow: pending → approved (Eversend called) → failed | completed
 *              pending → rejected (no Eversend call)
 *
 * Balance is NEVER deducted until Eversend confirms success.
 */

const mongoose = require('mongoose');

const recipientDetailsSchema = new mongoose.Schema({
  // MoMo
  phoneNumber: { type: String, default: null },
  // Bank
  bankCode:      { type: String, default: null },
  accountNumber: { type: String, default: null },
  // Eversend wallet-to-wallet
  eversendTag:   { type: String, default: null },
  // Saved Beneficiary
  beneficiaryId: { type: String, default: null },
  // Common
  firstName:  { type: String, required: true },
  lastName:   { type: String, required: true },
  country:    { type: String, required: true }, // ISO 2-letter e.g. UG, KE, CM
}, { _id: false });

const WithdrawalRequestSchema = new mongoose.Schema(
  {
    // ── Requester ───────────────────────────────
    requestedBy: {
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
      min: [1000, 'Minimum withdrawal is 1,000 XAF'],
    },
    currency: {
      type: String,
      required: true,
      default: 'XAF',
    },

    // ── Method ──────────────────────────────────
    withdrawalMethod: {
      type: String,
      enum: ['momo', 'bank', 'eversend'],
      required: true,
    },
    recipientDetails: {
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

    // ── Eversend Linkage ─────────────────────────
    eversendTransactionId: { type: String, default: null },
    eversendQuotationToken: { type: String, default: null, select: false },
    eversendStatus: { type: String, default: null },
    balanceDeducted: { type: Boolean, default: false },

    // ── Admin Review ─────────────────────────────
    rejectionReason: { type: String, default: null },
    failureReason:   { type: String, default: null },
    reviewedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:  { type: Date, default: null },

    // ── Optional Note from Requester ─────────────
    note: { type: String, default: null, maxlength: 300 },
  },
  {
    timestamps: true,
  }
);

// Index for quick admin queue lookups
WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });
WithdrawalRequestSchema.index({ requestedBy: 1, status: 1 });

module.exports = mongoose.model('WithdrawalRequest', WithdrawalRequestSchema);
