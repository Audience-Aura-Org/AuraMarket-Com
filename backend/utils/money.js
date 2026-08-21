/**
 * utils/money.js
 * Auradime — Authoritative money helpers.
 *
 * XAF is a ZERO-DECIMAL currency — there are no XAF cents.
 * All monetary amounts are stored and computed as whole integers.
 * Rule: round at every WRITE boundary. Never accumulate floating-point errors
 * by rounding each fee component independently; always derive one side by subtraction.
 */

/**
 * Round any monetary value to the nearest whole XAF integer.
 * Use this at every point a money value crosses a write boundary (DB write, response).
 * @param {*} n - Any value; non-finite or negative values become 0.
 * @returns {number} Whole integer >= 0.
 */
const toXAF = (n) => Math.round(Math.max(0, Number(n) || 0));

/**
 * Split an order's money into fee components without accumulating rounding errors.
 *
 * Algorithm:
 *   1. Round each independently computed fee (commission, escrow).
 *   2. Derive vendorNet by subtraction — never round it independently.
 *      This guarantees: commission + escrow + vendorNet + shipping + collection === total.
 *
 * @param {object} params
 * @param {number} params.subtotal       - Line-item total before fees/shipping.
 * @param {number} params.commissionPct  - Commission percentage (e.g. 5 for 5%).
 * @param {number} params.escrowPct      - Escrow fee percentage (e.g. 0 for none).
 * @param {number} params.shipping       - Shipping fee (whole XAF).
 * @param {number} params.collection     - Mobile money collection fee (whole XAF).
 * @param {number} [params.discount=0]   - Discount amount (whole XAF, subtracted from subtotal).
 * @returns {{ commission, escrow, total, vendorNet, shipping, collection }}
 */
const splitOrderMoney = ({ subtotal, commissionPct, escrowPct, shipping, collection, discount = 0 }) => {
  const sub        = toXAF(subtotal);
  const ship       = toXAF(shipping);
  const col        = toXAF(collection);
  const disc       = toXAF(discount);
  const commission = toXAF(sub * (commissionPct || 0) / 100);
  const escrow     = toXAF(sub * (escrowPct     || 0) / 100);
  const total      = toXAF(sub + ship + col - disc);
  // Vendor net is the REMAINDER — never rounded independently.
  const vendorNet  = total - commission - escrow - ship - col;

  return { commission, escrow, total, vendorNet, shipping: ship, collection: col };
};

module.exports = { toXAF, splitOrderMoney };
