"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import DiscoveryHub from '@/components/hub/DiscoveryHub';

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
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--glass-border)] border-t-[var(--accent)] animate-spin" />
      </div>
    );
  }

  // Only render if authenticated
  if (!user) return null;

  return <DiscoveryHub />;
}
