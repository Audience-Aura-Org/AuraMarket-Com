'use client';

import { useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useManagerMode } from '@/hooks/useManagerMode';

export default function ManagerLayout({ children }) {
  const loadAccounts = useManagerMode((s) => s.loadAccounts);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  return <DashboardLayout role="manager">{children}</DashboardLayout>;
}
