"use client";

import { Suspense, useEffect } from 'react';
import ChatPage from '../chat/page';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function MessagesPage() {
  const router = useRouter();
  const { user, hasHydrated } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) router.replace('/login');
  }, [user, hasHydrated, router]);

  if (!hasHydrated || !user) return null;

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ChatPage />
    </Suspense>
  );
}
