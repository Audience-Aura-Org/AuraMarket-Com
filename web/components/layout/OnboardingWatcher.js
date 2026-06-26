"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function OnboardingWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hasHydrated, authChecked, loading, fetchMe, fetchFollowedVendors, followedVendorIds } = useAuthStore();

  useEffect(() => {
    const skipAuthProbePrefixes = ['/login', '/signup', '/register', '/auth', '/onboarding'];
    const shouldSkipAuthProbe = pathname === '/' || skipAuthProbePrefixes.some((prefix) => pathname?.startsWith(prefix));
    if (!hasHydrated || authChecked || loading || shouldSkipAuthProbe) return;
    fetchMe();
  }, [authChecked, fetchMe, hasHydrated, loading, pathname]);
 
  // Pre-fetch followed list as soon as authenticated to avoid flicker
  useEffect(() => {
    if (isAuthenticated && hasHydrated && followedVendorIds.length === 0) {
      fetchFollowedVendors();
    }
  }, [isAuthenticated, hasHydrated, followedVendorIds.length, fetchFollowedVendors]);

  useEffect(() => {
    // Wait for persisted auth state to hydrate before redirecting.
    if (!hasHydrated || loading) return;

    const role = user?.role?.toLowerCase();
    
    // 0. Skip for onboarding/auth pages to prevent redirect loops
    const SKIP_PREFIXES = ['/onboarding', '/login', '/signup', '/register', '/auth'];
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
      
      // 3.2. Onboarding check — for customers and vendors
      // Ensures they complete their profile before accessing protected features
      if ((role === 'customer' || role === 'vendor') && !user.onboarded && sessionStorage.getItem('onboarding_skipped') !== 'true') {
        console.warn('[Watcher] User not onboarded, redirecting to /onboarding');
        router.replace('/onboarding');
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
  }, [user, isAuthenticated, hasHydrated, loading, pathname, router]);

  return null;
}
