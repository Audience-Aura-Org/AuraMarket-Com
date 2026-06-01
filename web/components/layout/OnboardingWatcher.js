"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

export default function OnboardingWatcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, hasHydrated, fetchMe, fetchFollowedVendors, followedVendorIds } = useAuthStore();

  useEffect(() => {
    if (!hasHydrated || user) return;
    fetchMe();
  }, [hasHydrated, user, fetchMe]);
 
  // Pre-fetch followed list as soon as authenticated to avoid flicker
  useEffect(() => {
    if (isAuthenticated && hasHydrated && followedVendorIds.length === 0) {
      fetchFollowedVendors();
    }
  }, [isAuthenticated, hasHydrated, followedVendorIds.length, fetchFollowedVendors]);

  const verificationStatus = user?.verification_status;
  const showVerificationBanner = isAuthenticated &&
    user?.role !== 'admin' &&
    ['held', 'pending', 'rejected'].includes(verificationStatus) &&
    !pathname?.startsWith('/login') &&
    !pathname?.startsWith('/onboarding');

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
  }, [user, isAuthenticated, hasHydrated, pathname, router]);

  if (!showVerificationBanner) return null;

  const bannerCopy = verificationStatus === 'pending'
    ? 'Your verification is under review. You can browse Auradime, but account actions are paused until approval.'
    : verificationStatus === 'rejected'
      ? 'Your verification needs attention. Please resubmit your details so your account can be restored.'
      : 'Verification is required. You can view your account, but useful actions are paused until you complete KYC.';

  return (
    <div className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[900] md:left-auto md:right-5 md:top-20 md:w-[420px]">
      <div className="rounded-3xl border border-amber-500/25 bg-[var(--bg-primary)]/95 p-4 shadow-2xl shadow-amber-500/10 backdrop-blur-2xl">
        <div className="flex gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/25 bg-amber-500/10 text-amber-500">
            {verificationStatus === 'pending' ? <ShieldCheck className="size-5" /> : <AlertTriangle className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-tight text-[var(--text-primary)]">Verification required</p>
            <p className="mt-1 text-[11px] font-semibold leading-relaxed text-[var(--text-secondary)] opacity-70">{bannerCopy}</p>
            <button
              type="button"
              onClick={() => router.push('/profile?tab=kyc')}
              className="mt-3 rounded-2xl bg-[var(--accent)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white transition-all active:scale-95"
            >
              Open verification
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
