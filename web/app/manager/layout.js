'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useManagerMode } from '@/hooks/useManagerMode';

export default function ManagerLayout({ children }) {
  const pathname = usePathname();
  const loadAccounts = useManagerMode((s) => s.loadAccounts);
  const clearActAs = useManagerMode((s) => s.clearActAs);
  const actAsId = useManagerMode((s) => s.actAsId);
  const switching = useManagerMode((s) => s.switching);
  const startBadgePolling = useManagerMode((s) => s.startBadgePolling);
  const stopBadgePolling = useManagerMode((s) => s.stopBadgePolling);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Start badge polling while in manager routes
  useEffect(() => {
    startBadgePolling();
    return () => stopBadgePolling();
  }, [startBadgePolling, stopBadgePolling]);

  // Clear actAsId when navigating to a manager-space route
  // (e.g. /manager, /manager/accounts — but NOT /manager/as/...)
  // Don't clear when navigating to non-manager routes (e.g. /vendor/dashboard)
  // because the workspace redirect sends the manager there with actAsId active.
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

  // Refetch accounts on window focus (picks up newly assigned accounts)
  useEffect(() => {
    const handler = () => {
      useManagerMode.getState().loadAccounts({ force: true });
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  return (
    <DashboardLayout role="manager">
      {/* Switching progress bar */}
      {switching && (
        <div className="fixed top-0 left-0 right-0 z-[999] h-0.5">
          <div className="h-full bg-blue-500 animate-progress-bar rounded-r-full" />
        </div>
      )}
      {children}
      <style jsx global>{`
        @keyframes progress-bar {
          0% { width: 0%; }
          30% { width: 60%; }
          60% { width: 85%; }
          100% { width: 98%; }
        }
        .animate-progress-bar {
          animation: progress-bar 2s ease-out forwards;
        }
        /* Make star toggle visible on touch devices */
        @media (hover: none) {
          .touch-device\\:opacity-100 { opacity: 1 !important; }
          .group:hover .group-hover\\:opacity-100 { opacity: 1 !important; }
        }
      `}</style>
    </DashboardLayout>
  );
}
