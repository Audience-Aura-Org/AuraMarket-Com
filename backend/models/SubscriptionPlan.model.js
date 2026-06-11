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
    roles: [{
      type: String,
      enum: ['customer', 'vendor', 'logistics', 'admin'],
    }],
    features: [{
      type: String,
      trim: true,
      maxlength: 160,
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
