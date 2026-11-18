import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  user: null,
  apiGet: vi.fn(),
  ensureGuestSession: vi.fn(),
  placeInstantOrder: vi.fn(),
  sendDeliveryDetails: vi.fn(),
  failInstantOrder: vi.fn(),
  collect: vi.fn(),
  poll: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuthStore: (sel) => sel({ user: m.user }) }));
vi.mock('@/services/api', () => ({ default: { get: (...a) => m.apiGet(...a) } }));
vi.mock('@/lib/guestSession', () => ({ ensureGuestSession: (...a) => m.ensureGuestSession(...a) }));
vi.mock('@/lib/instantBuy', () => ({
  authConfigFor: (user) => (user ? {} : { headers: { Authorization: 'Bearer gtok' } }),
  placeInstantOrder: (...a) => m.placeInstantOrder(...a),
  sendDeliveryDetails: (...a) => m.sendDeliveryDetails(...a),
  failInstantOrder: (...a) => m.failInstantOrder(...a),
}));
vi.mock('@/services/paymentProvider', () => ({
  initiateSmartCameroonCollection: (...a) => m.collect(...a),
  pollTransactionStatus: (...a) => m.poll(...a),
  detectCameroonNetwork: () => 'mtn',
}));
vi.mock('@/components/location/AddressField', () => ({
  default: ({ value, onChange }) => (
    <input aria-label="Exact spot" value={value?.landmark || ''} onChange={(e) => onChange({ ...value, landmark: e.target.value, location: { lat: 4.05, lng: 9.7, source: 'pin' }, place_name: 'Akwa' })} />
  ),
  loadSavedAddresses: () => Promise.resolve(m.user ? [{ _id: 'a1', quartier: 'Akwa', city: 'Douala', landmark_description: 'Blue gate', recipient_name: 'Paul', contact_phone: '677000111', isDefault: true }] : []),
  spotFromSaved: (a) => ({ address_id: a._id, quartier: a.quartier, city: a.city, landmark: a.landmark_description, recipient_name: a.recipient_name, contact_phone: a.contact_phone, location: null }),
}));

import InstantBuySheet from './InstantBuySheet';

const item = { productId: 'p1', name: 'Red shoes', price: 10000, image: '/s.png', vendorId: 'v1' };
const firms = [
  { _id: 'f1', company_name: 'FastShip', pricing_mode: 'district', fee_estimate: 1000 },
  { _id: 'f2', company_name: 'FarAway', pricing_mode: 'distance', fee_estimate: 2500 },
];

beforeEach(() => {
  Object.values(m).forEach((fn) => typeof fn === 'function' && fn.mockReset?.());
  m.user = null;
  m.apiGet.mockImplementation((url) => {
    if (url.startsWith('/logistics/zones')) return Promise.resolve({ data: { success: true, data: { zones: [{ _id: 'z1', name: 'Akwa', type: 'quartier' }, { _id: 'z2', name: 'Bonapriso', type: 'quartier' }] } } });
    if (url.startsWith('/logistics/compatible-firms')) return Promise.resolve({ data: { success: true, data: { firms, is_intercity: false } } });
    if (url.startsWith('/payments/fees')) return Promise.resolve({ data: { success: true, data: { collection: { pawapay: { MTN_MOMO_CMR: 0.0175, default: 0.0177 }, payunit: 0.0177, eversend: 0.0142 }, payout: 0.013, fixed: 0 } } });
    return Promise.resolve({ data: {} });
  });
  m.ensureGuestSession.mockResolvedValue({ token: 'gtok', user: { _id: 'g1' } });
  m.placeInstantOrder.mockResolvedValue({ orderIds: ['abcdef123456'] });
  m.collect.mockResolvedValue({ success: true, gateway: 'pawapay', data: { reference: 'r1', gross_amount: 10326 } });
  m.sendDeliveryDetails.mockResolvedValue({ data: { success: true } });
  m.poll.mockImplementation((gw, ref, { onSuccess }) => { setTimeout(() => onSuccess({ data: {} }), 0); return () => {}; });
});
afterEach(cleanup);

const open = () => render(<InstantBuySheet open item={item} quantity={1} onClose={() => {}} />);
const chooseAreaAndPay = async (phone = '677123456') => {
  await screen.findByRole('option', { name: 'Akwa' });
  fireEvent.change(screen.getByLabelText('Delivery area'), { target: { value: 'z1' } });
  fireEvent.change(screen.getByLabelText('Mobile Money number'), { target: { value: phone } });
  const pay = await screen.findByRole('button', { name: /^Pay / });
  fireEvent.click(pay);
};

describe('InstantBuySheet', () => {
  it('guest: pays with a guest session, then sends name, phone and spot', async () => {
    open();
    await chooseAreaAndPay();
    await screen.findByText(/Payment confirmed · 10[\s,. ]?326 XAF/);
    expect(m.ensureGuestSession).toHaveBeenCalled();
    expect(m.placeInstantOrder.mock.calls[0][0]).toMatchObject({ productId: 'p1', quantity: 1, area: { quartier: 'Akwa', zone_id: 'z1' }, logisticsCompanyId: 'vendor_managed', phone: '677123456' });
    expect(m.placeInstantOrder.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer gtok' } });
    expect(m.collect.mock.calls[0][0]).toMatchObject({ phone: '677123456', order_ids: ['abcdef123456'] });
    expect(m.collect.mock.calls[0][1]).toEqual({ headers: { Authorization: 'Bearer gtok' } });

    expect(screen.getByLabelText('Phone').value).toBe('677123456');
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Marie Ngo' } });
    fireEvent.change(screen.getByLabelText('Exact spot'), { target: { value: 'Blue gate' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send delivery details' }));
    await screen.findByText('Order placed');
    expect(m.sendDeliveryDetails).toHaveBeenCalledWith('abcdef123456', expect.objectContaining({ full_name: 'Marie Ngo', phone: '677123456', landmark: 'Blue gate', location: { lat: 4.05, lng: 9.7, source: 'pin' } }), { headers: { Authorization: 'Bearer gtok' } });
    expect(screen.getByRole('link', { name: 'Create an account to keep your orders' })).toBeTruthy();
  });

  it('signed-in: area and address come from the saved address; Confirm sends it', async () => {
    m.user = { _id: 'u1', name: 'Paul', phone: '677000111' };
    open();
    await waitFor(() => expect(screen.getByLabelText('Delivery area').value).toBe('z1'));
    fireEvent.change(screen.getByLabelText('Mobile Money number'), { target: { value: '677000111' } });
    fireEvent.click(await screen.findByRole('button', { name: /^Pay / }));
    await screen.findByText(/Payment confirmed/);
    expect(m.ensureGuestSession).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Exact spot').value).toBe('Blue gate');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm address' }));
    await screen.findByText('Order placed');
    expect(m.sendDeliveryDetails).toHaveBeenCalledWith('abcdef123456', expect.objectContaining({ full_name: 'Paul', phone: '677000111', landmark: 'Blue gate' }), {});
  });

  it('payment failure: shows the reason, releases the order and offers Try again', async () => {
    m.poll.mockImplementation((gw, ref, { onFailed }) => { setTimeout(() => onFailed({ reason: 'Not enough balance' }), 0); return () => {}; });
    open();
    await chooseAreaAndPay();
    await screen.findByText('Not enough balance');
    expect(m.failInstantOrder).toHaveBeenCalledWith(['abcdef123456'], expect.any(String), { headers: { Authorization: 'Bearer gtok' } });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('only zone-priced delivery companies can be chosen, and they change the total', async () => {
    open();
    await screen.findByRole('option', { name: 'Akwa' });
    fireEvent.change(screen.getByLabelText('Delivery area'), { target: { value: 'z1' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    expect(await screen.findByRole('radio', { name: /FastShip/ })).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /FarAway/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /FastShip/ }));
    // No number typed yet → highest collection rate (1.77%) + payout 1.3%: 11,000 → 11,344
    expect((await screen.findByRole('button', { name: /^Pay / })).textContent).toMatch(/11[\s,. ]?344/);
  });
});
