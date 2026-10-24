const mongoose = require('mongoose');

const SubscriptionPlanSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 500,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (price) { return Number.isFinite(price) && (this.currency !== 'XAF' || Number.isInteger(price)); },
        message: 'Price must be finite; XAF prices must be whole numbers.',
      },
    },
    currency: {
      type: String,
      default: 'XAF',
      uppercase: true,
      trim: true,
    },
    billing_cycle: {
      type: String,
      enum: ['one_time', 'monthly', 'yearly'],
      default: 'one_time',
    },
    duration_days: {
      type: Number,
      default: null,
      min: 0,
      validate: { validator: value => value == null || Number.isFinite(value), message: 'Duration must be finite.' },
    },
    contact_required: {
      type: Boolean,
      default: false,
    },
    roles: [{
      type: String,
      enum: ['customer', 'vendor', 'logistics', 'admin'],
    }],
    features: [{
      type: mongoose.Schema.Types.Mixed,
    }],
    is_active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

SubscriptionPlanSchema.index({ is_active: 1, roles: 1, price: 1 });

module.exports = mongoose.model('SubscriptionPlan', SubscriptionPlanSchema);
