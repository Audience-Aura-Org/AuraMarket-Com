/**
 * Client twin of backend/utils/revenue.js — the one definition of an
 * "earned" order. Keep both in sync (each has the same unit-test table).
 *
 * Earned = not cancelled/refund-pending/refunded AND (paid OR a
 * pay-on-delivery order that was delivered/completed: cash collected).
 */
const NON_REVENUE_ORDER_STATUSES = ['cancelled', 'refund_pending', 'refunded'];
const DELIVERED_STATUSES = ['delivered', 'completed'];

export const isEarnedOrder = (order = {}) =>
  !NON_REVENUE_ORDER_STATUSES.includes(order?.order_status) &&
  (order?.payment_status === 'paid' ||
    (order?.payment_method === 'pay_on_delivery' && DELIVERED_STATUSES.includes(order?.order_status)));

export const earnedRevenue = (orders = []) =>
  orders.reduce((sum, o) => sum + (isEarnedOrder(o) ? Number(o.total_amount) || 0 : 0), 0);
