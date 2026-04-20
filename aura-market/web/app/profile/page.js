import { Suspense } from 'react';
import AccountPageClient from '@/components/account/AccountPageClient';

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin size-8 border-2 border-[var(--accent)] rounded-full border-t-transparent" /></div>}>
      <AccountPageClient />
    </Suspense>
  );
}
