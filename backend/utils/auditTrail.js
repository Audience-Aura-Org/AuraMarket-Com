/**
 * utils/auditTrail.js
 * Auradime — Centralised audit log writer.
 *
 * Call this on every mutation that:
 *   - changes a wallet balance or financial status
 *   - changes a user's role or verification_status
 *   - changes an order's payment or escrow state
 *
 * Never throws — audit failure must not abort the primary operation.
 */

const logger = require('./logger');

let AuditLog; // lazy-loaded to avoid circular-require issues

const getModel = () => {
  if (!AuditLog) AuditLog = require('../models/AuditLog.model');
  return AuditLog;
};

/**
 * @param {object} params
 * @param {string|import('mongoose').Types.ObjectId} params.actorId   - User performing the action
 * @param {string}  params.action      - Verb: 'wallet_credit', 'wallet_debit', 'role_change', 'escrow_release', etc.
 * @param {string}  params.targetType  - 'User', 'Order', 'Escrow', 'Transaction', etc.
 * @param {string|import('mongoose').Types.ObjectId} params.targetId
 * @param {*}       [params.before]    - Snapshot of state before the change
 * @param {*}       [params.after]     - Snapshot of state after the change
 * @param {import('mongoose').ClientSession} [params.session]
 * @param {object}  [params.meta]      - Any extra key-value pairs
 * @returns {Promise<void>}
 */
const recordAudit = async ({ actorId, action, targetType, targetId, before, after, session, meta = {} }) => {
  try {
    const Model = getModel();
    const entry = {
      actor_id:    actorId,
      action,
      target_type: targetType,
      target_id:   targetId,
      before:      before !== undefined ? JSON.parse(JSON.stringify(before)) : undefined,
      after:       after  !== undefined ? JSON.parse(JSON.stringify(after))  : undefined,
      meta,
      timestamp:   new Date(),
    };

    if (session) {
      await Model.create([entry], { session });
    } else {
      await Model.create(entry);
    }
  } catch (err) {
    // Never surface audit errors to callers — log and continue.
    logger.error(`[auditTrail] Failed to write audit record (${action} on ${targetType}:${targetId}): ${err.message}`);
  }
};

module.exports = { recordAudit };
