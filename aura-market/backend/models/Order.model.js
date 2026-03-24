/**
 * models/Order.model.js
 * Aura Market — Order Schema
 *
 * Tracks the transaction between a Customer and a Vendor.
 * Includes items purchased, pricing breakdown, shipping state, and payment method mapping.
 */

const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }, // price locked at time of purchase
  image: { type: String },
});

const OrderSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Order must belong to a Customer'],
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Order must be mapped to a Vendor'],
    },
    products: [OrderItemSchema], // Arrays of products from the same vendor
    
    // ── Financial Data ───────────
    subtotal: {
      type: Number,
      required: true,
    },
    shipping_fee: {
      type: Number,
      default: 0,
    },
    total_amount: {
      type: Number,
      required: true,
    },
    payment_method: {
      type: String,
      enum: ['wallet', 'escrow', 'direct_card'],
      required: true,
    },
    payment_status: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'pending',
    },

    // ── Shipping Data ────────────
    shipping_method: {
      type: String,
      enum: ['vendor_managed', 'logistics_partner'],
      default: 'vendor_managed',
    },
    shipping_address: {
      street: String,
      city: String,
      region: String,
      quartier: String, // Neighborhood name
      country: { type: String, default: 'Cameroon' },
      phone: String,
      email: String,
    },
    delivery_description: {
      type: String,
    },
    tracking_number: {
      type: String,
      default: null,
    },
    logistics_company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LogisticsCompany',
      default: null,
    },
    escrow_enabled: {

      type: Boolean,
      default: true,
    },

    // ── Order State ──────────────

    order_status: {
      type: String,
      enum: [
        'placed',       // Customer bought it
        'processing',   // Vendor accepted it
        'shipped',      // Vendor/Logistics dispatched it
        'delivered',    // Arrived at customer
        'completed',    // Customer confirmed receipt, Escrow released!
        'cancelled',    // Cancelled before processing
        'refund_pending', // Buyer requested refund
        'refunded',     // Refund approved and processed
      ],
      default: 'placed',
    },
  },
  {
    timestamps: true,
  }
);

// Optional: Indexing primarily used queries
OrderSchema.index({ customer_id: 1, createdAt: -1 });
OrderSchema.index({ vendor_id: 1, order_status: 1 });

module.exports = mongoose.model('Order', OrderSchema);
