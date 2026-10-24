import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ state: {}, get: vi.fn(), post: vi.fn(), replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: mocks.push, back: vi.fn() }), useSearchParams: () => new URLSearchParams('role=vendor') }));
vi.mock('@/hooks/useAuth', () => ({ useAuthStore: select => select(mocks.state) }));
vi.mock('@/services/api', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('@/context/LanguageContext', () => ({ useLanguage: () => ({ t: (key, fallback) => fallback, label: value => value }) }));
vi.mock('@/components/layout/DashboardLayout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
import SubscribePage from './page';
const plan = { _id: 'plan', name: 'Standard', slug: 'vendor-standard', price: 3000, currency: 'XAF', duration_days: 30, features: [] };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.state = { user: { _id: 'vendor', role: 'vendor', phone: '237670000001' }, hasHydrated: true, walletBalance: 10000, refreshWalletBalance: mocks.refresh };
  mocks.get.mockResolvedValue({ data: { data: { plans: [plan], required: true, subscribed: false, subscription: null } } });
});
afterEach(cleanup);
it('waits for hydration before redirecting a signed-out session', async () => {
  mocks.state = { hasHydrated: false, user: null };
  const { rerender } = render(<SubscribePage />);
  expect(mocks.replace).not.toHaveBeenCalled();
  mocks.state = { hasHydrated: true, user: null }; rerender(<SubscribePage />);
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login?from=subscribe'));
});
it('allows repurchase of a limited plan instead of treating it as already active', async () => {
  mocks.get.mockResolvedValue({ data: { data: { plans: [plan], required: true, subscribed: false, subscription: { status: 'limited', plan_id: plan } } } });
  render(<SubscribePage />);
  const button = await screen.findByRole('button', { name: 'Activate package' });
  expect(button.disabled).toBe(false);
});
it('prevents repeated submission and handles an already-active external checkout response', async () => {
  let resolve;
  mocks.post.mockImplementation(() => new Promise(done => { resolve = done; }));
  render(<SubscribePage />);
  const button = await screen.findByRole('button', { name: 'Activate package' });
  fireEvent.click(button); fireEvent.click(button);
  expect(mocks.post).toHaveBeenCalledTimes(1);
  resolve({ data: { message: 'This package is already active.', data: { active: true, subscribed: true } } });
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/vendor/dashboard'));
  expect(mocks.push).not.toHaveBeenCalled();
});
it('verifies with the original gateway when resuming a pending checkout', async () => {
  mocks.post.mockResolvedValue({ data: { data: { reference: 'EXISTING', gateway: 'payunit', pending_resume: true } } });
  render(<SubscribePage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Activate package' }));
  await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(expect.stringContaining('gateway=payunit&type=subscription&ref=EXISTING')));
});
