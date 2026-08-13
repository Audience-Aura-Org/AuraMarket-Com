/**
 * models/Shipment.model.js
 * Auradime — Shipment Tracking Schema
 *
 * Uniquely bridges a Vendor's `Order` with a `LogisticsCompany`.
 */

const mongoose = require('mongoose');

const ShipmentSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true, // 1 Order = 1 primary Shipment ticket max
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    logistics_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticsCompany',
      required: true, // The assigned delivery firm
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
        'cancelled',         // Aborted by vendor/admin
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
      quartier: String, // The "delivery quartier" selected
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
  },
  {
    timestamps: true,
  }
);

ShipmentSchema.index({ vendor_id: 1, status: 1, createdAt: -1 });
ShipmentSchema.index({ logistics_id: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('Shipment', ShipmentSchema);
