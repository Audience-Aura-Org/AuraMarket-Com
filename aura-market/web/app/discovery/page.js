"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import HubContent from '@/components/hub/HubContent';
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

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[var(--bg-primary)]">
      <div className="flex-1 overflow-hidden relative">
         <HubContent />
      </div>
    </div>
  );
}
