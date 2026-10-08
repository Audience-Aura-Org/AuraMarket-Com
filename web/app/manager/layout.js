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

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // Clear actAsId when navigating to a manager-space route
  // (e.g. /manager, /manager/accounts — but NOT /manager/as/...)
  // Don't clear when navigating to non-manager routes (e.g. /vendor/dashboard)
  // because the workspace redirect sends the manager there with actAsId active.
  useEffect(() => {
    if (actAsId && pathname?.startsWith('/manager') && !pathname.startsWith('/manager/as/')) {
      clearActAs();
    }
  }, [pathname, actAsId, clearActAs]);

  return <DashboardLayout role="manager">{children}</DashboardLayout>;
}
