import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn(), close: vi.fn(), active: vi.fn(),
  partner: { _id: 'partner', name: 'Sender' } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useSearchParams: () => new URLSearchParams('vendorId=partner&notificationTitle=Sender') }));
vi.mock('@/hooks/useAuth', () => ({ useAuthStore: () => ({ user: { _id: 'self', role: 'customer' }, loading: false }) }));
vi.mock('@/context/ChatContext', () => ({ toId: obj => obj?._id, useChat: () => ({
  initialPartnerData: { ...mocks.partner }, conversations: [], setActiveConversation: mocks.active,
  setSystemWide: vi.fn(), closeChat: mocks.close,
}) }));
vi.mock('@/lib/native-push', () => ({ peekPendingPushIntentForVendor: () => null }));
vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('@/components/hub/MessagingHub', () => ({ default: ({ onClose }) => <button onClick={onClose}>Close chat</button> }));
import ChatPage from './page';
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('seeds a notification chat once and closes even after message/context updates', () => {
  const { rerender } = render(<ChatPage />);
  rerender(<ChatPage />);
  expect(mocks.active).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Close chat'));
  rerender(<ChatPage />);
  fireEvent.click(screen.getByText('Close chat'));
  expect(mocks.replace).toHaveBeenCalledTimes(1);
  expect(mocks.replace).toHaveBeenCalledWith('/shop');
  expect(mocks.active).toHaveBeenCalledTimes(1);
});
