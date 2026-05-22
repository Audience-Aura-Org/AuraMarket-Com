"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import MessagingHub from '@/components/hub/MessagingHub';

function chatExitHref(role) {
  if (role === 'vendor') return '/vendor/dashboard';
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'logistics') return '/logistics/dashboard';
  return '/discovery?tab=discover';
}

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
    <div className="fixed inset-0 z-[600] flex h-[100dvh] min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-secondary)]">
      <MessagingHub 
        vendorId={vendorId} 
        fullPage={true}
        onClose={() => router.push(chatExitHref(user?.role))}
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
