import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('./authStorage', () => ({ getStoredAuthToken: vi.fn(async () => 'token') }));
import { getSocketURL } from './socket';
afterEach(() => vi.unstubAllEnvs());
describe('socket server selection', () => {
  it('uses the configured API origin even during localhost development', () => {
    vi.stubEnv('NEXT_PUBLIC_SOCKET_URL','');vi.stubEnv('NEXT_PUBLIC_API_URL','https://payments-api.test/api/v1');
    expect(getSocketURL()).toBe('https://payments-api.test');
  });
  it('honors an explicit socket server override', () => {
    vi.stubEnv('NEXT_PUBLIC_SOCKET_URL','https://realtime.test');vi.stubEnv('NEXT_PUBLIC_API_URL','https://payments-api.test/api/v1');
    expect(getSocketURL()).toBe('https://realtime.test');
  });
});
