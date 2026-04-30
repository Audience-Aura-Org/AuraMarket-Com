const mongoose = require('mongoose');

/**
 * models/Coupon.model.js
 * Aura Market — Promo & Discount Codes
 */
const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    discount_type: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    discount_value: {
      type: Number,
      required: true
    },
    min_order_amount: {
      type: Number,
      default: 0
    },
    max_discount_amount: {
      type: Number, // Applicable for percentage discount
      default: null
    },
    expiry_date: {
      type: Date,
      required: true
    },
    is_active: {
      type: Boolean,
      default: true
    },
    max_uses: {
      type: Number,
      default: null // null means unlimited
    },
    used_count: {
      type: Number,
      default: 0
    },
    vendor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null // null means platform-wide coupon
    }
  },
  {
    timestamps: true
  }
);

// Method to check if coupon is valid
CouponSchema.methods.isValid = function (orderAmount) {
  const now = new Date();
  if (!this.is_active) return false;
  if (this.expiry_date < now) return false;
  if (this.max_uses && this.used_count >= this.max_uses) return false;
  if (orderAmount < this.min_order_amount) return false;
  return true;
};

module.exports = mongoose.model('Coupon', CouponSchema);
