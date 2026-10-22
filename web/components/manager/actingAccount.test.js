import { describe, it, expect, vi } from 'vitest';
import { useEffect, useCallback } from 'react';
import { render, renderHook, act } from '@testing-library/react';
import { useActingAccount } from './actingAccount';
import { ActingAccountContext, useAuthStore } from '@/hooks/useAuth';

vi.mock('@/services/api', () => ({ default: { get: vi.fn() } }));

const loadSession = async () => ({});
const vendor = { _id: 'V1', name: 'Asah Devine', role: 'vendor', wallet_balance: 3500 };

describe('useActingAccount', () => {
  it('keeps helper identities stable when the balance or profile changes', () => {
    const { result } = renderHook(() => useActingAccount({ account: vendor, loadSession }));
    const first = result.current;

    act(() => first.setWalletBalance(9000));
    act(() => first.updateUser({ name: 'Asah D.' }));

    expect(result.current.walletBalance).toBe(9000);
    expect(result.current.user.name).toBe('Asah D.');
    expect(result.current.updateUser).toBe(first.updateUser);
    expect(result.current.setWalletBalance).toBe(first.setWalletBalance);
    expect(result.current.refreshWalletBalance).toBe(first.refreshWalletBalance);
  });

  it('a balance write leaves `user` untouched, so pages keyed on user do not re-fetch', () => {
    const { result } = renderHook(() => useActingAccount({ account: vendor, loadSession }));
    const userBefore = result.current.user;
    act(() => result.current.setWalletBalance(12000));
    expect(result.current.walletBalance).toBe(12000);
    expect(result.current.user).toBe(userBefore);
  });

  it('does not re-render when the balance written is unchanged', () => {
    const { result } = renderHook(() => useActingAccount({ account: vendor, loadSession }));
    const before = result.current;
    act(() => before.setWalletBalance(3500));
    expect(result.current).toBe(before);
  });

  it('an embedded page that loads on updateUser and writes the balance loads once', () => {
    let loads = 0;
    // Mirrors the vendor dashboard: load() depends on updateUser and stores the balance.
    function Dashboard() {
      const { updateUser, setWalletBalance } = useAuthStore();
      const load = useCallback(() => { loads += 1; setWalletBalance(3500 + loads); }, [updateUser, setWalletBalance]);
      useEffect(() => { if (loads < 50) load(); }, [load]);
      return null;
    }
    function Workspace() {
      const acting = useActingAccount({ account: vendor, loadSession });
      return (
        <ActingAccountContext.Provider value={acting}>
          <Dashboard />
        </ActingAccountContext.Provider>
      );
    }
    render(<Workspace />);
    expect(loads).toBe(1);
  });
});
