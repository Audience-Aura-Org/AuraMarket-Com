const mongoose = require('mongoose');

const AuthOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    otp_hash: {
      type: String,
      required: true,
      select: false,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    expires_at: {
      type: Date,
      required: true,
      index: true,
    },
    cooldown_until: {
      type: Date,
      default: null,
    },
    last_sent_at: {
      type: Date,
      default: null,
    },
    send_window_start: {
      type: Date,
      default: Date.now,
    },
    send_count: {
      type: Number,
      default: 0,
      min: 0,
    },
    verified_at: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

AuthOtpSchema.index({ expires_at: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('AuthOtp', AuthOtpSchema);
