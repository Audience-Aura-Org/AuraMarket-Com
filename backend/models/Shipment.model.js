/**
 * models/Shipment.model.js
 * Auradime — Shipment Tracking Schema
 *
 * Bridges a Vendor's `Order` with a `LogisticsCompany` (marketplace shipments),
 * or represents a standalone P2P pickup & delivery booking.
 */

const mongoose = require('mongoose');

const ShipmentSchema = new mongoose.Schema(
  {
    // ── Shipment type ──────────────────────────────────────────────────
    type: {
      type: String,
      enum: ['marketplace', 'p2p'],
      default: 'marketplace',
    },

    // ── Marketplace fields (optional for P2P) ──────────────────────────
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },

    logistics_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticsCompany',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'pending',           // Initial state
        'assigned',          // Assigned to carrier
        'picked_up',         // Logistics has the goods
        'in_transit',        // Moving to hub/destination
        'out_for_delivery',  // Final mile
        'delivered',         // Success
        'failed',            // Issue reported
        'cancelled',         // Aborted by vendor/admin/booker
      ],
      default: 'pending',
    },
    tracking_code: {
      type: String,
      unique: true,
      required: true, // Format: AURA-xxxxxx
    },
    pickup_address: {
      street: String,
      city: String,
      region: String,
      quartier: String,
      phone: String,
      zone_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticZone', default: null },
    },
    delivery_address: {
      street: String,
      city: String,
      region: String,
      quartier: String,
      phone: String,
      zone_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticZone', default: null },
    },
    delivery_description: {
      type: String,
    },
    price: {
      type: Number,
      required: true,
    },
    proof_of_delivery: {
      image_url: String,
      note: String,
      receiver_name: String,
      timestamp: Date,
    },
    failure_reason: {
      type: String,
      enum: ['unreachable', 'wrong address', 'other', null],
      default: null,
    },
    shipment_logs: [
      {
        status: String,
        updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
    estimated_delivery: {
      type: Date,
      default: null,
    },

    // ── P2P-specific fields ────────────────────────────────────────────
    direction: {
      type: String,
      enum: ['send', 'request_pickup'],
      default: null, // null for marketplace shipments
    },
    booked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    guest_booker: {
      name: String,
      phone: String,
      email: String,
      guest_session_id: String,
    },
    other_party: {
      user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      name: String,
      phone: String,
      email: String,
      address: {
        street: String,
        city: String,
        region: String,
        quartier: String,
        zone_id: { type: mongoose.Schema.Types.ObjectId, ref: 'LogisticZone', default: null },
        landmark_description: String,
      },
    },
    package_details: {
      category: {
        type: String,
        enum: ['document', 'fragile', 'food', 'electronics', 'clothing', 'household', 'other'],
      },
      weight_tier: {
        type: String,
        enum: ['light', 'medium', 'heavy', 'extra_heavy'],
      },
      declared_value: { type: Number, default: 0 },
      description: String,
      prohibited_items_confirmed: { type: Boolean, default: false },
    },
    scheduled_pickup: { type: Date, default: null },
    paid_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    payment_status: {
      type: String,
      enum: ['unpaid', 'pending', 'paid', 'refunded'],
      default: 'unpaid',
    },
    payment_reference: String,
    cancellation_fee: { type: Number, default: 0 },
    pod_otp_hash: String,
    pod_otp_expires: Date,
    pod_otp_attempts: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ──────────────────────────────────────────────────────────
ShipmentSchema.index({ vendor_id: 1, status: 1, createdAt: -1 });
ShipmentSchema.index({ logistics_id: 1, status: 1, createdAt: -1 });
ShipmentSchema.index({ order_id: 1, status: 1 }, { sparse: true });
// P2P indexes
ShipmentSchema.index({ type: 1, booked_by: 1, createdAt: -1 });
ShipmentSchema.index({ type: 1, 'other_party.user_id': 1, createdAt: -1 });
ShipmentSchema.index({ type: 1, 'guest_booker.guest_session_id': 1 }, { sparse: true });

module.exports = mongoose.model('Shipment', ShipmentSchema);
