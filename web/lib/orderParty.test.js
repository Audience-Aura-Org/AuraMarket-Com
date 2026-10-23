import { describe, expect, it } from 'vitest';
import { orderParty } from './orderParty';
describe('order party controls', () => {
  const order = { customer_id: { _id: 'buyer' }, vendor_id: { _id: 'store', user_id: { _id: 'seller' } } };
  it('uses ownership rather than the user role or vendor document ID', () => {
    expect(orderParty(order, 'buyer')).toEqual({isBuyer:true,isVendor:false});
    expect(orderParty(order, 'seller')).toEqual({isBuyer:false,isVendor:true});
    expect(orderParty(order, 'store')).toEqual({isBuyer:false,isVendor:false});
    expect(orderParty(order)).toEqual({isBuyer:false,isVendor:false});
  });
});
