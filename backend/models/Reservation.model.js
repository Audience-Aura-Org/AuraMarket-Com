/**
 * models/Reservation.model.js
 * Auradime — Dine-In Reservation
 *
 * Phase 3 Step 14: Intentionally separated from the Order collection to avoid
 * contaminating GMV, payout, and commission queries with dine-in reservations
 * that often involve no money movement.
 *
 * Status flow:
 *   requested → confirmed → seated → completed
 *                        ↘ no_show
 *            ↘ cancelled
 *
 * Capacity guard: MongoDB transaction on check + insert.
 * A unique index on (vendor_id, slot_start, table_ref) prevents double-booking
 * at the DB level even if application logic races.
 */

const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema(
  {
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Requested items / dishes (optional — buyer may not know the menu yet)
    product_ids: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],

    // Time slot
    slot_start: {
      type: Date,
      required: true,
    },
    slot_end: {
      type: Date,
      required: true,
    },

    // Table reference (free-text label: "Table 4", "Terrace A", etc.)
    // Nullable until the restaurant assigns a table on confirmation.
    table_ref: {
      type: String,
      default: null,
    },

    party_size: {
      type: Number,
      required: true,
      min: 1,
    },

    status: {
      type: String,
      enum: ['requested', 'confirmed', 'seated', 'completed', 'no_show', 'cancelled'],
      default: 'requested',
    },

    contact_phone: {
      type: String,
      required: true,
      trim: true,
    },

    notes: {
      type: String,
      default: null,
    },

    // Linked order — only set if a deposit or pre-payment is attached.
    // Null for standard reservations (no money touches wallets/escrow).
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },

    // Cancellation metadata
    cancelled_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    cancellation_reason: {
      type: String,
      default: null,
    },
    cancelled_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index to prevent double-booking of the same table at the same time.
// table_ref is sparse because it is null until the restaurant assigns it.
// The application-layer capacity check (party_size vs table capacity) runs BEFORE insert.
ReservationSchema.index(
  { vendor_id: 1, slot_start: 1, table_ref: 1 },
  {
    unique: true,
    partialFilterExpression: {
      table_ref: { $type: 'string' },
      status: { $in: ['requested', 'confirmed', 'seated'] },
    },
  }
);

// Index for vendor queue view and customer history
ReservationSchema.index({ vendor_id: 1, slot_start: 1, status: 1 });
ReservationSchema.index({ customer_id: 1, slot_start: -1 });

module.exports = mongoose.model('Reservation', ReservationSchema);
