"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function OnboardingWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hasHydrated } = useAuthStore();

  useEffect(() => {
    // Wait for persisted auth state to hydrate before redirecting.
    if (!hasHydrated) return;

    const role = user?.role?.toLowerCase();
    
    // 0. Skip for onboarding/auth pages to prevent redirect loops
    const SKIP_PREFIXES = ['/onboarding', '/login', '/register', '/auth'];
    if (SKIP_PREFIXES.some(p => pathname.startsWith(p))) return;

    const protectedPrefixes = [
      '/vendor',
      '/admin',
      '/logistics',
      '/messages',
      '/chat',
      '/cart',
      '/checkout',
      '/orders',
      '/profile',
      '/wallet',
      '/notifications',
      '/settings',
    ];

    const isProfessionalRole = ['admin', 'vendor', 'logistics'].includes(role);

    // 3. Protected route logic
    if (protectedPrefixes.some((p) => pathname.startsWith(p))) {
      // 3.1. Auth check
      if (!isAuthenticated || !user) {
        console.warn('[Watcher] No auth found on protected route, redirecting to login', pathname);
        router.replace('/login');
        return;
      }
      
      // 3.2. Onboarding check — ONLY for customers
      // Professional roles are exempt from customer calibration
      if (role === 'customer' && !user.onboarded && sessionStorage.getItem('onboarding_skipped') !== 'true') {
        console.warn('[Watcher] Customer not onboarded, redirecting to /onboarding');
        router.push('/onboarding');
        return;
      }
    }

    // 4. Role specific strictness (Security)
    // Ensure users are on the correct dashboard for their role
    if (pathname.startsWith('/vendor') && role !== 'vendor') {
      console.warn('[Watcher] Access Denied: Not a vendor', role);
      router.replace('/'); 
      return;
    }
    if (pathname.startsWith('/admin') && role !== 'admin') {
      console.warn('[Watcher] Access Denied: Not an admin', role);
      router.replace('/');
      return;
    }
    if (pathname.startsWith('/logistics') && role !== 'logistics') {
      console.warn('[Watcher] Access Denied: Not logistics', role);
      router.replace('/');
      return;
    }
  }, [user, isAuthenticated, hasHydrated, pathname, router]);

  return null;
}
