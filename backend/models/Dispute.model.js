const mongoose = require('mongoose');

/**
 * models/Dispute.model.js
 * Auradime — Dispute Resolution System
 * 
 * Formal flow for buyers or vendors to contest an order held in escrow.
 */
const DisputeSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
    initiator_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      enum: [
        // ── Retail reasons ────────────────────────────────────────────────────
        'item_not_received',
        'item_not_as_described',
        'faulty_item',
        'unauthorized_transaction',
        // ── Food-specific reasons (Phase 3 Step 5c) ───────────────────────────
        // Short dispute window (consumed product); resolution types are narrower.
        'never_arrived',       // Delivery never showed up
        'wrong_items',         // Restaurant sent the wrong meal
        'arrived_cold',        // Meal arrived cold / unacceptable temperature
        'quality',             // Food quality was unacceptable
        // ── Intercity-specific reasons (Phase 4) ──────────────────────────────
        'lost_in_transit',  // Parcel never arrived at pickup point after dispatch
        // ── Catch-all ─────────────────────────────────────────────────────────
        'other'
      ]
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    evidence_urls: [String],
    status: {
      type: String,
      enum: ['pending', 'investigating', 'resolved', 'cancelled'],
      default: 'pending'
    },
    resolution_type: {
      type: String,
      enum: [
        // Retail
        'full_refund',
        'release_payment',
        'partial_refund',
        'return_and_refund',
        // Food (Phase 3 Step 5c) — no return possible for consumed meals
        'food_full_refund',    // Full refund; restaurant wallet debited
        'food_partial_refund', // Partial refund (e.g., arrived cold but was eaten)
        'food_no_refund',      // Dispute rejected after review
      ],
      default: null
    },
    admin_notes: String,
    resolved_at: Date,
    resolved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    // For food orders: the window closes quickly (meal is perishable / consumed).
    // Null for retail orders (retail uses the existing 6-hour escrow window).
    dispute_window_closes_at: {
      type: Date,
      default: null,
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Dispute', DisputeSchema);
