/**
 * constants/statusEnums.js
 * Auradime — Shared status enum definitions.
 *
 * Single source of truth for all status/enum strings used across models,
 * controllers, and the frontend. Import arrays into schema definitions;
 * import named constants for comparisons.
 *
 * Values are extracted exactly as-is from existing models — no changes to strings.
 */

// ─── Order ────────────────────────────────────────────────────────────────────
const ORDER_STATUS = ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded', 'disputed'];
const PAYMENT_STATUS = ['pending', 'paid', 'refunded', 'failed', 'partial'];
const FOOD_STATUS = [
  'pending_acceptance', 'accepted', 'preparing', 'ready',
  'out_for_delivery', 'delivered', 'timed_out', 'cancelled',
];
const FULFILMENT_TYPE = ['delivery', 'pickup', 'dine_in', 'pre_order'];

// ─── Escrow ───────────────────────────────────────────────────────────────────
const ESCROW_STATUS = ['held', 'pending_release', 'releasing', 'released', 'refunded', 'disputed'];

// ─── Transaction ──────────────────────────────────────────────────────────────
const TRANSACTION_TYPE   = ['deposit', 'withdrawal', 'payment', 'refund', 'commission', 'payout', 'adjustment'];
const TRANSACTION_STATUS = ['pending', 'completed', 'failed', 'cancelled'];
const TRANSACTION_GATEWAY = ['eversend', 'payunit', 'flutterwave', 'wallet', 'manual', 'internal', null];

// ─── Shipment ─────────────────────────────────────────────────────────────────
const SHIPMENT_STATUS = ['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'];

// ─── User / Vendor ────────────────────────────────────────────────────────────
const USER_ROLE = ['user', 'vendor', 'logistics', 'admin'];
const VERIFICATION_STATUS = ['unverified', 'pending', 'held', 'verified', 'rejected', 'suspended'];
const KYC_STATUS = ['not_submitted', 'pending', 'approved', 'rejected'];

// ─── Subscription ─────────────────────────────────────────────────────────────
const SUBSCRIPTION_STATUS = ['active', 'expired', 'cancelled', 'pending'];

// ─── Dispute ──────────────────────────────────────────────────────────────────
const DISPUTE_STATUS = ['pending', 'investigating', 'resolved', 'closed', 'escalated'];

// ─── Withdrawal ───────────────────────────────────────────────────────────────
const WITHDRAWAL_STATUS = ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed'];

module.exports = {
  // Order
  ORDER_STATUS,
  PAYMENT_STATUS,
  FOOD_STATUS,
  FULFILMENT_TYPE,
  // Escrow
  ESCROW_STATUS,
  // Transaction
  TRANSACTION_TYPE,
  TRANSACTION_STATUS,
  TRANSACTION_GATEWAY,
  // Shipment
  SHIPMENT_STATUS,
  // User
  USER_ROLE,
  VERIFICATION_STATUS,
  KYC_STATUS,
  // Subscription
  SUBSCRIPTION_STATUS,
  // Dispute
  DISPUTE_STATUS,
  // Withdrawal
  WITHDRAWAL_STATUS,
};
