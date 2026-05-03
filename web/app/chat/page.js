"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import ChatSlideOverlay from '@/components/hub/ChatSlideOverlay';

function ChatContent() {
  const { user, loading: authLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const vendorId = searchParams.get('vendorId');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?from=chat');
    }
  }, [user, authLoading, router]);

  if (authLoading) return null;
  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[600] bg-[var(--bg-secondary)] flex flex-col h-screen w-full">
      <ChatSlideOverlay 
        vendorId={vendorId} 
        fullPage={true}
        onClose={() => router.push('/')}
      />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[var(--bg-secondary)] animate-pulse" />}>
      <ChatContent />
    </Suspense>
  );
}
