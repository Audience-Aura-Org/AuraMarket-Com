import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({ user: null, get: vi.fn(), post: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuthStore: (sel) => sel({ user: m.user }) }));
vi.mock('@/services/api', () => ({ default: { get: (...a) => m.get(...a), post: (...a) => m.post(...a) } }));

import GuestClaimPrompt from './GuestClaimPrompt';

const guestStored = () => window.localStorage.setItem('aura-guest-session', JSON.stringify({ token: 'gtok', user: { _id: 'g1' } }));
beforeEach(() => { window.localStorage.clear(); m.user = null; m.get.mockReset(); m.post.mockReset(); });
afterEach(cleanup);

describe('GuestClaimPrompt', () => {
  it('asks before adding guest orders from this phone to the signed-in account', async () => {
    m.user = { _id: 'u1' };
    guestStored();
    m.get.mockResolvedValue({ data: { count: 2, data: { orders: [{}, {}] } } });
    m.post.mockResolvedValue({ data: { success: true, data: { orders: 2 } } });
    render(<GuestClaimPrompt />);
    await screen.findByText('Add the 2 orders bought on this phone without an account to your account?');
    expect(m.get).toHaveBeenCalledWith('/orders/my-orders', expect.objectContaining({ headers: { Authorization: 'Bearer gtok' } }));
    expect(m.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Add to my account' }));
    await waitFor(() => expect(m.post).toHaveBeenCalledWith('/auth/guest/claim', { guest_token: 'gtok' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(window.localStorage.getItem('aura-guest-session')).toBeNull();
  });

  it('"Not mine" forgets the guest session on this phone without moving anything', async () => {
    m.user = { _id: 'u1' };
    guestStored();
    m.get.mockResolvedValue({ data: { count: 1, data: { orders: [{}] } } });
    render(<GuestClaimPrompt />);
    fireEvent.click(await screen.findByRole('button', { name: 'Not mine' }));
    expect(m.post).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('aura-guest-session')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays hidden for visitors and quietly forgets a guest with no orders', async () => {
    guestStored();
    const { unmount } = render(<GuestClaimPrompt />);
    expect(m.get).not.toHaveBeenCalled();
    unmount();
    m.user = { _id: 'u1' };
    m.get.mockResolvedValue({ data: { count: 0, data: { orders: [] } } });
    render(<GuestClaimPrompt />);
    await waitFor(() => expect(window.localStorage.getItem('aura-guest-session')).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(m.post).not.toHaveBeenCalled();
  });
});
