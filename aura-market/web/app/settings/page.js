"use client";

import { Suspense } from 'react';
import AccountPageClient from '@/components/account/AccountPageClient';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <AccountPageClient />
    </Suspense>
   );
}
