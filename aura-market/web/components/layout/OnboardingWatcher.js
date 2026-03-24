"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function OnboardingWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // 1. If not authenticated, we don't care about onboarding
    if (!isAuthenticated || !user) return;

    // 1.5. Admin and Logistics roles bypass onboarding completely
    if (['admin', 'logistics'].includes(user.role)) return;

    // 2. If already on onboarding page, don't redirect again
    if (pathname.startsWith('/onboarding')) return;

    // 3. Global route protection for /vendor/* paths
    //    Anyone accessing a vendor dashboard MUST be a fully onboarded vendor.
    if (pathname.startsWith('/vendor')) {
      if (user.role !== 'vendor' || !user.onboarded) {
        router.push('/onboarding');
        return;
      }
    }

    // 4. If user skipped onboarding this session, don't redirect them globally
    if (sessionStorage.getItem('onboarding_skipped') === 'true') return;

    // 5. If onboarding is not complete (and they didn't skip), redirect to onboarding
    if (!user.onboarded) {
      router.push('/onboarding');
    }
  }, [user, isAuthenticated, pathname, router]);

  return null;
}
