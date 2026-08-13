/**
 * models/Order.model.js
 * Auradime — Order Schema
 *
 * Tracks the transaction between a Customer and a Vendor.
 * Includes items purchased, pricing breakdown, shipping state, and payment method mapping.
 */

const mongoose = require('mongoose');

const LEGACY_PAYMENT_METHOD_MAP = {
  mesomb: 'eversend',
  mobile_money: 'eversend',
};

const OrderItemSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  price: { type: Number, required: true }, // price locked at time of purchase (effective price)
  regular_price: { type: Number, required: true }, // product's regular price
  sale_price: { type: Number, default: null }, // product's sale price (if applicable and used)
  compare_at_price: { type: Number, default: null }, // product's compare at price (if applicable and used)
  image: { type: String },
  variant: { type: mongoose.Schema.Types.Mixed, default: null },

  // Meal option snapshot — copied verbatim from Cart.items.selected_options at placement.
  // Never re-joined from Product at read time; if the menu changes, the order retains the
  // price and label the buyer agreed to.
  selected_options: [
    {
      group_name:   String,
      option_label: String,
      price_delta:  { type: Number, default: 0 },
    },
  ],
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
    collection_fee: {
      type: Number,
      default: 0,
    },
    // Phase 4: intercity transit fee (paid to the agency at dispatch).
    // Credited to vendor wallet at capture so they can pay the agency.
    transit_fee: {
      type: Number,
      default: 0,
    },
    total_amount: {
      type: Number,
      required: true,
    },
    payment_method: {
      type: String,
      enum: ['wallet', 'escrow', 'direct_card', 'pay_on_delivery', 'eversend', 'payunit'],
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
      enum: ['vendor_managed', 'logistics_partner', 'intercity_agency'],
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

    // ── Phase 3 Step 7 — Restaurant pipeline fields ────────────────────────

    // Delivery vs. pickup — set at cart build time for food orders.
    fulfilment_type: {
      type: String,
      enum: ['delivery', 'pickup', 'dine_in', 'pre_order'],
      default: null, // null for non-food (retail) orders
    },

    // Kitchen-specific status track. Runs parallel to order_status.
    // Not added to order_status enum to avoid contaminating retail GMV/payout queries.
    // pending_acceptance → preparing → ready → rider_arrived → picked_up → delivered
    // Terminal failure states: timed_out (system auto-cancel), rejected (vendor decline)
    food_status: {
      type: String,
      enum: ['pending_acceptance', 'preparing', 'ready', 'rider_arrived', 'picked_up', 'delivered', 'timed_out', 'rejected'],
      default: null, // null for retail orders
    },

    // Acceptance deadline for food orders — auto-cancel + full refund if missed.
    // Value set by order controller when food_status = 'pending_acceptance'.
    acceptance_deadline: {
      type: Date,
      default: null,
    },

    // Phase 3 Step 5c — Dispute window for food orders.
    // Buyer can only open a dispute before this timestamp.
    // Worker in disputeWindowEnforcement.service.js marks the order non-disputable after expiry.
    dispute_window_closes_at: {
      type: Date,
      default: null,
    },
    dispute_window_closed: {
      type: Boolean,
      default: false,
    },
    dispute_window_warning_sent: {
      type: Boolean,
      default: false,
    },

    // Phase 3 Step 5b — New-restaurant hold.
    // If true at order placement, vendor payout is deferred until food_status = 'delivered'.
    // Auto-set when vendor's lifetime completed order count is below the platform threshold.
    new_restaurant_hold: {
      type: Boolean,
      default: false,
    },

    // Step 12 — tracks when a rider arrived at the restaurant (before pickup).
    // Separate from picked_up so kitchen wait time can be measured.
    rider_arrived_at: {
      type: Date,
      default: null,
    },

    // Stamped when food_status transitions to 'picked_up' and 'delivered'.
    // Used by avgDeliveryMinutes.service.js to compute accurate per-firm travel times
    // (delivered_at - picked_up_at) instead of the imprecise updatedAt - createdAt proxy.
    picked_up_at: {
      type: Date,
      default: null,
    },
    delivered_at: {
      type: Date,
      default: null,
    },

    // Step 12 — delayed rider dispatch.
    // Set when restaurant accepts but prep_time > avg_delivery_minutes.
    // delayedRiderDispatch.service.js polls for orders where
    //   food_status='preparing' AND rider_dispatch_at <= now AND no Shipment exists.
    // null = dispatch was immediate (Shipment already created at acceptance).
    rider_dispatch_at: {
      type: Date,
      default: null,
    },

    // Immutable status log — same shape as Shipment.shipment_logs[].
    // Records every state transition with actor, timestamp, and optional note.
    status_logs: [
      {
        status:    { type: String, required: true },
        actor_id:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        timestamp: { type: Date, default: Date.now },
        note:      { type: String, default: null },
      },
    ],

    // ── Phase 4 — Intercity shipping fields ───────────────────────────────

    // The IntercityRate document used to price this shipment.
    transit_rate_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IntercityRate',
      default: null,
    },
    // true when transit_fee was waived (buyer hit free-shipping threshold).
    transit_fee_waived: {
      type: Boolean,
      default: false,
    },
    // Actual transit fee paid by vendor to agency (recorded at dispatch).
    // May differ from transit_fee if the agency charged a different amount.
    transit_fee_actual: {
      type: Number,
      default: null,
    },
    // Agency name — denormalized from IntercityRate so receipts are readable
    // even if the rate document is later deleted.
    transit_carrier: {
      type: String,
      default: null,
    },
    // Waybill / parcel-tracking reference issued by the intercity agency.
    transit_waybill_ref: {
      type: String,
      default: null,
    },
    // URL of the receipt/waybill image uploaded by the vendor at dispatch.
    transit_receipt_url: {
      type: String,
      default: null,
    },
    // Pickup point at the destination city where buyer collects the parcel.
    pickup_point_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PickupPoint',
      default: null,
    },
    // When the vendor handed the parcel to the intercity agency.
    dispatched_at: {
      type: Date,
      default: null,
    },
    // Estimated arrival date computed from IntercityRate.transit_hours_max.
    expected_arrival_at: {
      type: Date,
      default: null,
    },
    // When the parcel arrived at the destination pickup point.
    arrived_at: {
      type: Date,
      default: null,
    },
    // Transit lifecycle — runs parallel to order_status.
    // null for non-intercity orders.
    // awaiting_dispatch → dispatched → arrived → collected
    transit_status: {
      type: String,
      enum: ['awaiting_dispatch', 'dispatched', 'arrived', 'collected'],
      default: null,
    },
    // Timestamp of the last expected_arrival_at lapse notification sent.
    // Used to enforce the 24-hour cooldown in intercityArrivalLapse.service.js.
    transit_lapse_pinged_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

OrderSchema.virtual('shipment', {
  ref: 'Shipment',
  localField: '_id',
  foreignField: 'order_id',
  justOne: true
});

OrderSchema.pre('validate', function normalizeLegacyPaymentMethod() {
  if (this.payment_method && LEGACY_PAYMENT_METHOD_MAP[this.payment_method]) {
    this.payment_method = LEGACY_PAYMENT_METHOD_MAP[this.payment_method];
  }
});

// Optional: Indexing primarily used queries
OrderSchema.index({ customer_id: 1, createdAt: -1 });
OrderSchema.index({ vendor_id: 1, order_status: 1 });
OrderSchema.index({ vendor_id: 1, createdAt: -1 });
OrderSchema.index({ vendor_id: 1, payment_status: 1, createdAt: -1 });
OrderSchema.index({ customer_id: 1, payment_status: 1, createdAt: -1 });
OrderSchema.index({ order_status: 1, payment_status: 1, createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);
