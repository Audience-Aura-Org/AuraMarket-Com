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
  const { user, authChecked } = useAuthStore();

  useEffect(() => {
    if (authChecked && !user) {
      router.replace('/login');
    }
  }, [user, authChecked, router]);

  useEffect(() => {
    if (!authChecked || !user) return;
    if (!tab || tab === 'discover') {
      router.replace('/shop');
    }
  }, [tab, authChecked, user, router]);

  if (!authChecked || !tab || tab === 'discover') {
    return <LoadingSpinner />;
  }

  if (!user) return null;

  return <DiscoveryHub initialTab={tab} />;
}

export default function DiscoveryPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <DiscoveryPageContent />
    </Suspense>
  );
}
