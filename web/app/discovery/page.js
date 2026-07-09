"use client";
import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import DiscoveryHub from '@/components/hub/DiscoveryHub';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function DiscoveryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab');
  const { authChecked } = useAuthStore();

  useEffect(() => {
    if (!authChecked) return;
    if (!tab || tab === 'discover') {
      router.replace('/shop');
    }
  }, [tab, authChecked, router]);

  if (!authChecked || !tab || tab === 'discover') {
    return <LoadingSpinner />;
  }

  return <DiscoveryHub initialTab={tab} />;
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DiscoveryPageContent />
    </Suspense>
  );
}
