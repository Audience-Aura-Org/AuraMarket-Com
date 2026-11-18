/**
 * Instant Buy Now: order calls made by the Buy Now popup. They reuse the
 * normal checkout endpoints; the order is created with only the delivery area
 * (`delivery_details_pending`) and the buyer sends the rest after paying.
 */
import api from '@/services/api';
import { getGuestSession } from '@/lib/guestSession';

const VENDOR_MANAGED = 'vendor_managed';

/** Request config for the popup: nothing for signed-in users, the guest token otherwise. */
export const authConfigFor = (user) => {
  if (user) return {};
  const guest = getGuestSession();
  return guest ? { headers: { Authorization: `Bearer ${guest.token}` } } : {};
};

const newKey = () => (globalThis.crypto?.randomUUID?.() || `ib-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * @param {{ productId, quantity, variant?, selected_options?, area: { quartier, city?, zone_id? },
 *           logisticsCompanyId, phone, fulfilment_type?, scheduled_for? }} input
 * @returns {Promise<{ orderIds: string[] }>}
 */
export const placeInstantOrder = async ({
  productId, quantity = 1, variant, selected_options = [], area = {}, logisticsCompanyId = VENDOR_MANAGED,
  phone, fulfilment_type, scheduled_for,
}, config = {}) => {
  const vendorManaged = !logisticsCompanyId || logisticsCompanyId === VENDOR_MANAGED;
  const payload = {
    shipping_address: {
      quartier: area.quartier || undefined,
      city: area.city || undefined,
      zone_id: area.zone_id || undefined,
      phone,
    },
    escrow_enabled: false,
    payment_method: 'pawapay',
    shipping_method: vendorManaged ? VENDOR_MANAGED : 'logistics_partner',
    logistics_company_id: vendorManaged ? null : logisticsCompanyId,
    delivery_quartier: area.quartier || undefined,
    delivery_details_pending: true,
    items: [{ product_id: productId, quantity, variant, selected_options }],
    ...(fulfilment_type ? { fulfilment_type } : {}),
    ...(scheduled_for ? { scheduled_for } : {}),
  };
  const res = await api.post('/orders/cart-split', payload, {
    ...config,
    headers: { ...(config.headers || {}), 'Idempotency-Key': newKey() },
  });
  if (!res.data?.success) throw new Error(res.data?.message || 'Could not create the order.');
  return { orderIds: res.data.data.orderIds };
};

/** Name, phone and exact spot after payment. */
export const sendDeliveryDetails = (orderId, details, config = {}) =>
  api.patch(`/orders/${orderId}/delivery-details`, details, config);

/** The payment did not go through: release the unpaid order. */
export const failInstantOrder = (orderIds, reason, config = {}) =>
  api.post('/payments/checkout/failed', { order_ids: orderIds, reason }, config).catch(() => null);
