/**
 * utils/revenue.js
 * The one definition of "earned revenue" used by every dashboard (vendor,
 * admin, manager, logistics). An order is earned when the money stayed:
 *
 *   - it is not cancelled, refund-pending or refunded, AND
 *   - it was paid, OR it is pay-on-delivery and was delivered/completed
 *     (the cash changed hands at the door, even though payment_status is
 *     only flipped to 'paid' on some delivery paths).
 *
 * Revenue is the sum of earned orders' total_amount.
 */
'use strict';

const NON_REVENUE_ORDER_STATUSES = ['cancelled', 'refund_pending', 'refunded'];
const PAID_STATUSES = ['paid'];
const DELIVERED_STATUSES = ['delivered', 'completed'];

/** $match stage filter: earned orders only. Merge into a scoped query. */
const EARNED_ORDER_MATCH = {
  order_status: { $nin: NON_REVENUE_ORDER_STATUSES },
  $or: [
    { payment_status: { $in: PAID_STATUSES } },
    { payment_method: 'pay_on_delivery', order_status: { $in: DELIVERED_STATUSES } },
  ],
};

/** Boolean aggregation expression: is this order earned? */
const isEarnedExpr = {
  $and: [
    { $not: [{ $in: ['$order_status', NON_REVENUE_ORDER_STATUSES] }] },
    {
      $or: [
        { $in: ['$payment_status', PAID_STATUSES] },
        {
          $and: [
            { $eq: ['$payment_method', 'pay_on_delivery'] },
            { $in: ['$order_status', DELIVERED_STATUSES] },
          ],
        },
      ],
    },
  ],
};

/** $sum operand: the order's total when earned, otherwise 0. */
const earnedRevenueExpr = { $cond: [isEarnedExpr, '$total_amount', 0] };

/** Plain-JS twin for already-loaded orders (keep in sync with the above). */
const isEarnedOrder = (order = {}) =>
  !NON_REVENUE_ORDER_STATUSES.includes(order.order_status) &&
  (PAID_STATUSES.includes(order.payment_status) ||
    (order.payment_method === 'pay_on_delivery' && DELIVERED_STATUSES.includes(order.order_status)));

module.exports = {
  NON_REVENUE_ORDER_STATUSES,
  EARNED_ORDER_MATCH,
  isEarnedExpr,
  earnedRevenueExpr,
  isEarnedOrder,
};
