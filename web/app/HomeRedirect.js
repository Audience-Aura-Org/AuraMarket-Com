"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function HomeRedirect() {
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

  return null;
}
