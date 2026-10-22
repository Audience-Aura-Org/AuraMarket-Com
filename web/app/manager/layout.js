'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import ManagerShell from '@/components/manager/shell/ManagerShell';
import { useManagerMode } from '@/hooks/useManagerMode';
import '@/styles/manager.css';

export default function ManagerLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const loadAccounts = useManagerMode((s) => s.loadAccounts);
  const clearActAs = useManagerMode((s) => s.clearActAs);
  const actAsId = useManagerMode((s) => s.actAsId);
  const startBadgePolling = useManagerMode((s) => s.startBadgePolling);
  const stopBadgePolling = useManagerMode((s) => s.stopBadgePolling);

  // Force-load accounts on mount (not cached) so new assignments appear
  useEffect(() => {
    loadAccounts({ force: true });
  }, [loadAccounts]);

  // Start badge polling while in manager routes
  useEffect(() => {
    startBadgePolling();
    return () => stopBadgePolling();
  }, [startBadgePolling, stopBadgePolling]);

  // Clear actAsId when navigating to a manager-space route
  // (e.g. /manager, /manager/accounts — but NOT /manager/as/...).
  // Routes outside /manager are handled by OnboardingWatcher, which maps
  // /vendor/* and /logistics/* back into the workspace.
  useEffect(() => {
    if (actAsId && pathname?.startsWith('/manager') && !pathname.startsWith('/manager/as/')) {
      clearActAs();
    }
  }, [pathname, actAsId, clearActAs]);

  // Update browser tab title based on workspace
  useEffect(() => {
    const accounts = useManagerMode.getState().accounts;
    if (actAsId) {
      const account = accounts.find((a) => a.id === actAsId);
      if (account) {
        document.title = `${account.name} · Manager`;
      }
    } else if (pathname?.startsWith('/manager')) {
      document.title = 'Manager · AuraDime';
    }
  }, [actAsId, pathname]);

  // Access to the open account was revoked/expired mid-session: leave the
  // workspace instead of leaving the manager on a page full of errors.
  useEffect(() => {
    const handler = (e) => {
      const id = e.detail?.accountId;
      const mode = useManagerMode.getState();
      if (!id || mode.actAsId !== id) return;
      mode.removeAccount(id);
      mode.loadAccounts({ force: true });
      toast.error('Your access to this account has ended.');
      router.replace('/manager/accounts');
    };
    window.addEventListener('aura:workspace-access-lost', handler);
    return () => window.removeEventListener('aura:workspace-access-lost', handler);
  }, [router]);

  // Refetch accounts on window focus (picks up newly assigned accounts)
  useEffect(() => {
    const handler = () => {
      useManagerMode.getState().loadAccounts({ force: true });
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  return <ManagerShell>{children}</ManagerShell>;
}
