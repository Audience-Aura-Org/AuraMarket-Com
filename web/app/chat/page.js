"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import ChatSlideOverlay from '@/components/hub/ChatSlideOverlay';

export default function ChatPage() {
  const { user, loading: authLoading } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const vendorId = searchParams.get('vendorId');
  const productId = searchParams.get('productId');

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
