export function orderParty(order, userId) {
  const id = value => String(value?._id || value || '');
  const caller = id(userId);
  return {
    isBuyer: Boolean(caller && caller === id(order?.customer_id)),
    isVendor: Boolean(caller && caller === id(order?.vendor_id?.user_id)),
  };
}
