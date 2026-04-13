"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DiscoveryHub from '@/components/hub/DiscoveryHub';
import { useAuthStore } from '@/hooks/useAuth';

export default function DiscoveryPage() {
  const { user, loading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="size-12 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <DiscoveryHub />;
}
