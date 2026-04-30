"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import DiscoveryHub from '@/components/hub/DiscoveryHub';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function DiscoveryPage() {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    // Redirect to login if not authenticated (after auth check completes)
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return <LoadingSpinner fullScreen />;
  }

  // Only render if authenticated
  if (!user) return null;

  return <DiscoveryHub />;
}
