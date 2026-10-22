import { describe, it, expect } from 'vitest';
import { isEarnedOrder, earnedRevenue } from './revenue';

describe('isEarnedOrder (mirrors backend/utils/revenue)', () => {
  it.each([
    ['paid and delivered', { payment_status: 'paid', order_status: 'delivered' }, true],
    ['paid, still processing', { payment_status: 'paid', order_status: 'processing' }, true],
    ['pay-on-delivery, delivered', { payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'delivered' }, true],
    ['pay-on-delivery, completed', { payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'completed' }, true],
    ['pay-on-delivery, still shipped', { payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'shipped' }, false],
    ['mobile money never paid', { payment_method: 'pawapay', payment_status: 'pending', order_status: 'placed' }, false],
    ['paid then cancelled', { payment_status: 'paid', order_status: 'cancelled' }, false],
    ['refund pending', { payment_status: 'paid', order_status: 'refund_pending' }, false],
    ['refunded', { payment_status: 'refunded', order_status: 'refunded' }, false],
    ['failed payment', { payment_status: 'failed', order_status: 'placed' }, false],
  ])('%s', (_label, order, expected) => {
    expect(isEarnedOrder(order)).toBe(expected);
  });

  it('earnedRevenue sums only earned orders', () => {
    expect(earnedRevenue([
      { payment_status: 'paid', order_status: 'delivered', total_amount: 10000 },
      { payment_status: 'paid', order_status: 'cancelled', total_amount: 9000 },
      { payment_method: 'pay_on_delivery', payment_status: 'pending', order_status: 'delivered', total_amount: 4000 },
    ])).toBe(14000);
  });
});
