import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
const patch = vi.fn();
const get = vi.fn();
vi.mock('@/services/api', () => ({ default: { post: (...a) => post(...a), patch: (...a) => patch(...a), get: (...a) => get(...a) } }));
const { authConfigFor, failInstantOrder, placeInstantOrder, sendDeliveryDetails } = await import('./instantBuy');
const { pollTransactionStatus, initiateSmartCameroonCollection } = await import('@/services/paymentProvider');

beforeEach(() => { post.mockReset(); patch.mockReset(); get.mockReset(); window.localStorage.clear(); });

const guestConfig = { headers: { Authorization: 'Bearer gtok' } };

describe('authConfigFor', () => {
  it('adds nothing for signed-in users', () => {
    window.localStorage.setItem('aura-guest-session', JSON.stringify({ token: 'gtok', user: {} }));
    expect(authConfigFor({ _id: 'u1' })).toEqual({});
  });
  it('sends the guest token for visitors', () => {
    window.localStorage.setItem('aura-guest-session', JSON.stringify({ token: 'gtok', user: {} }));
    expect(authConfigFor(null)).toEqual(guestConfig);
  });
});

describe('placeInstantOrder', () => {
  it('creates a pending-details order with only the area and the MoMo phone', async () => {
    post.mockResolvedValue({ data: { success: true, data: { orderIds: ['o1'] } } });
    const out = await placeInstantOrder({
      productId: 'p1', quantity: 2, variant: { color: 'red' }, selected_options: [],
      area: { quartier: 'Akwa', city: 'Douala', zone_id: 'z1' }, logisticsCompanyId: 'vendor_managed', phone: '677123456',
    }, guestConfig);
    expect(out).toEqual({ orderIds: ['o1'] });
    const [url, body, config] = post.mock.calls[0];
    expect(url).toBe('/orders/cart-split');
    expect(body).toMatchObject({
      delivery_details_pending: true,
      payment_method: 'pawapay',
      shipping_method: 'vendor_managed',
      logistics_company_id: null,
      delivery_quartier: 'Akwa',
      items: [{ product_id: 'p1', quantity: 2, variant: { color: 'red' }, selected_options: [] }],
      shipping_address: { quartier: 'Akwa', city: 'Douala', zone_id: 'z1', phone: '677123456' },
    });
    expect(body.shipping_address.street).toBeUndefined();
    expect(config.headers).toMatchObject({ Authorization: 'Bearer gtok' });
    expect(config.headers['Idempotency-Key']).toBeTruthy();
  });

  it('uses the delivery company when one is chosen', async () => {
    post.mockResolvedValue({ data: { success: true, data: { orderIds: ['o2'] } } });
    await placeInstantOrder({ productId: 'p1', quantity: 1, area: { quartier: 'Akwa' }, logisticsCompanyId: 'firm1', phone: '6' }, {});
    expect(post.mock.calls[0][1]).toMatchObject({ shipping_method: 'logistics_partner', logistics_company_id: 'firm1' });
  });
});

describe('after payment', () => {
  it('sends delivery details with the guest token', async () => {
    patch.mockResolvedValue({ data: { success: true } });
    await sendDeliveryDetails('o1', { full_name: 'Marie', phone: '699' }, guestConfig);
    expect(patch).toHaveBeenCalledWith('/orders/o1/delivery-details', { full_name: 'Marie', phone: '699' }, guestConfig);
  });
  it('marks an unpaid order failed', async () => {
    post.mockResolvedValue({ data: { success: true } });
    await failInstantOrder(['o1'], 'Declined', guestConfig);
    expect(post).toHaveBeenCalledWith('/payments/checkout/failed', { order_ids: ['o1'], reason: 'Declined' }, guestConfig);
  });
});

describe('payment helpers forward the guest token', () => {
  it('initiateSmartCameroonCollection passes the config to the initialize call', async () => {
    get.mockResolvedValue({ data: { data: { pawapay_orange_enabled: false } } });
    post.mockResolvedValue({ data: { success: true, data: { reference: 'r1' } } });
    await initiateSmartCameroonCollection({ amount: 1000, phone: '677123456', order_ids: ['o1'] }, guestConfig);
    expect(post.mock.calls[0][0]).toBe('/payments/pawapay/initialize');
    expect(post.mock.calls[0][2]).toEqual(guestConfig);
  });
  it('pollTransactionStatus sends the config on every check', async () => {
    vi.useFakeTimers();
    get.mockResolvedValue({ data: { status: 'SUCCESSFUL', data: {} } });
    const onSuccess = vi.fn();
    pollTransactionStatus('pawapay', 'r1', { onSuccess }, 5000, 300000, guestConfig);
    await vi.advanceTimersByTimeAsync(1100);
    expect(get.mock.calls[0][1]).toMatchObject({ headers: { Authorization: 'Bearer gtok' }, skipClientCache: true });
    expect(onSuccess).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
