/**
 * models/User.model.js
 * Aura Market — User Schema
 *
 * Supports all platform roles:
 *   - customer    → buys products
 *   - vendor      → sells products
 *   - logistics   → handles shipments
 *   - admin       → manages the platform
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    // ── Basic Info ──────────────────────────────
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Never return password in queries by default
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, 'Please enter a valid phone number'],
    },

    // ── Platform Role ────────────────────────────
    role: {
      type: String,
      enum: {
        values: ['customer', 'vendor', 'logistics', 'admin'],
        message: 'Role must be: customer, vendor, logistics, or admin',
      },
      default: 'customer',
    },

    // ── Wallet ───────────────────────────────────
    wallet_balance: {
      type: Number,
      default: 0,
      min: [0, 'Wallet balance cannot be negative'],
    },

    // ── Verification ─────────────────────────────
    verification_status: {
      type: String,
      enum: ['unverified', 'pending', 'verified', 'rejected', 'held'],
      default: 'unverified',
    },
    is_active: {
      type: Boolean,
      default: true,
    },

    // ── Profile ──────────────────────────────────
    avatar: {
      type: String,
      default: null,
    },
    branding: {
      logo: { type: String, default: null },
      banner: { type: String, default: null },
    },
    addresses: [
      {
        label: String, // 'Home', 'Office', etc.
        street: String,
        city: String,
        region: String,
        isDefault: { type: Boolean, default: false }
      }
    ],
    preferred_currency: {
      type: String,
      default: 'XAF',
      enum: ['XAF', 'USD', 'EUR', 'NGN', 'GHS']
    },
    preferred_language: {
      type: String,
      default: 'en',
      enum: ['en', 'fr', 'sw', 'ha']
    },

    // ── Security (2FA) ───────────────────────────
    two_factor_enabled: {
      type: Boolean,
      default: false
    },
    two_factor_secret: {
      type: String,
      select: false // Hide by default
    },

    // ── Onboarding & Personalization ──────────────
    onboarded: {
      type: Boolean,
      default: false,
    },
    liked_categories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
    }],
    onboarding_location: {
      city: String,
      quartier: String,
      address_description: String,
    },

    // ── Referral System ──────────────────────────
    referral_code: {
      type: String,
      unique: true,
      sparse: true, // allows multiple nulls
    },
    referred_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ── Loyalty Points ───────────────────────────
    loyalty_points: {
      type: Number,
      default: 0,
    },

    // ── Presence Tracking ────────────────────────
    is_online: {
      type: Boolean,
      default: false,
    },
    last_seen: {
      type: Date,
      default: Date.now,
    },

    // ── Password Reset ───────────────────────────
    reset_password_token: String,
    reset_password_expires: Date,
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ─────────────────────────────────────────────
// Pre-save Hook: Hash password before saving
// (Mongoose 8+ / bcryptjs 3 compatible — promise-based, no next())
// ─────────────────────────────────────────────
UserSchema.pre('save', async function () {
  // Only hash if password field was modified
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// ─────────────────────────────────────────────
// Instance Method: Compare entered password with hashed
// ─────────────────────────────────────────────
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// ─────────────────────────────────────────────
// Instance Method: Generate a unique referral code
// ─────────────────────────────────────────────
UserSchema.methods.generateReferralCode = function () {
  return `AURA-${this._id.toString().slice(-6).toUpperCase()}`;
};

module.exports = mongoose.model('User', UserSchema);
