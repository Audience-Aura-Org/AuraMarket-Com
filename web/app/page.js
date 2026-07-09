"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/hooks/useAuth';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      router.replace('/shop');
      return;
    }

    if (user?.role === 'admin') {
      router.replace('/admin/dashboard');
      return;
    }

    if (user?.role === 'vendor') {
      router.replace('/vendor/dashboard');
      return;
    }

    if (user?.role === 'logistics') {
      router.replace('/logistics/dashboard');
      return;
    }

    router.replace('/shop');
  }, [authLoading, isAuthenticated, router, user]);

  // This page only redirects — always show a spinner
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
      <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
    </div>
  );
}
