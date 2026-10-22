'use strict'
/**
 * tests/unit/revenue.test.js
 * isEarnedOrder (plain JS) must agree with the aggregation rule used by every dashboard.
 */
const { isEarnedOrder } = require('../../utils/revenue')

describe('isEarnedOrder', () => {
  it.each([
    ['paid and delivered', { payment_status: 'paid', order_status: 'delivered' }, true],
    ['paid, still processing', { payment_status: 'paid', order_status: 'processing' }, true],
    ['pay-on-delivery, delivered (cash collected)', { payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'delivered' }, true],
    ['pay-on-delivery, completed', { payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'completed' }, true],
    ['pay-on-delivery, still shipped', { payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'shipped' }, false],
    ['mobile money never paid', { payment_method: 'pawapay', payment_status: 'pending', order_status: 'placed' }, false],
    ['paid then cancelled', { payment_status: 'paid', order_status: 'cancelled' }, false],
    ['refund pending', { payment_status: 'paid', order_status: 'refund_pending' }, false],
    ['refunded', { payment_status: 'refunded', order_status: 'refunded' }, false],
    ['failed payment', { payment_status: 'failed', order_status: 'placed' }, false],
  ])('%s → %s', (_label, order, expected) => {
    expect(isEarnedOrder(order)).toBe(expected)
  })
})
