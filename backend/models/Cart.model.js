/**
 * models/Cart.model.js
 * Auradime — Shopping Cart
 *
 * Phase 3 Step 6 additions:
 * - context_vendor_id: food carts are single-restaurant. Adding a meal from another
 *   restaurant should offer "start a new cart", never silently merge.
 * - context_booking_type: booking types cannot mix in one cart (delivery / pickup /
 *   pre_order). Retail multi-vendor carts leave this null.
 * - scheduled_for: pre-order delivery slot chosen by the buyer.
 * - selected_options: snapshot of meal option selections stored per cart item so the
 *   item can be revalidated and transferred to OrderItem at checkout.
 */

const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema({
  product:  { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, default: 1, min: 1 },
  variant:  { type: mongoose.Schema.Types.Mixed, default: null },

  // Meal option snapshot — copied from Product.meal.option_groups selections.
  // Transferred verbatim to OrderItem.selected_options at placement.
  // Never re-joined from Product at checkout — if the menu changes, the cart
  // value is what the buyer agreed to.
  selected_options: [
    {
      group_name:  String,
      option_label: String,
      price_delta: { type: Number, default: 0 },
    },
  ],
});

const CartSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    items: [CartItemSchema],

    // ── Restaurant context (null for retail carts) ──────────────────────────
    // Food carts are single-restaurant. Set when the first meal item is added.
    // Cleared when the cart is emptied.
    context_vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
    },

    // The booking type chosen for this food cart session.
    // Cannot mix delivery + pickup in one cart.
    // null for retail carts.
    context_booking_type: {
      type: String,
      enum: ['delivery', 'pickup', 'pre_order', 'dine_in', null],
      default: null,
    },

    // Pre-order slot selected by the buyer. Only set when context_booking_type = 'pre_order'.
    scheduled_for: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', CartSchema);
