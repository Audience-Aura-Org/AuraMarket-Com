import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/preferences', () => ({ Preferences: {} }));
import { getStoredAuthToken, normalizeAuthToken } from './authStorage';
beforeEach(() => localStorage.clear());
describe('credential storage', () => {
  it.each([null, undefined, '', '  ', 'null', ' undefined ', 'NULL'])('rejects missing or serialized empty values: %s', value => expect(normalizeAuthToken(value)).toBeNull());
  it('normalizes surrounding whitespace', () => expect(normalizeAuthToken('  signed-token  ')).toBe('signed-token'));
  it('does not restore a credential from cached account data', async () => {
    localStorage.setItem('aura-auth-storage', JSON.stringify({state:{token:'stale-token',isAuthenticated:true}}));
    expect(await getStoredAuthToken()).toBeNull();
  });
  it('reads only the dedicated credential slot', async () => {
    localStorage.setItem('aura_token','signed-token');
    expect(await getStoredAuthToken()).toBe('signed-token');
  });
});
