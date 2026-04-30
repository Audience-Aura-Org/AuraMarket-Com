import { Suspense } from 'react';
import AccountPageClient from '@/components/account/AccountPageClient';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function ProfilePage() {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <AccountPageClient />
    </Suspense>
  );
}
