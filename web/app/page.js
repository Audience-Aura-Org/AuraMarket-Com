"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import UnifiedAuth from '@/components/auth/UnifiedAuth';
import { useAuthStore } from '@/hooks/useAuth';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, user } = useAuthStore();

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

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

    router.replace('/discovery?tab=discover');
  }, [authLoading, isAuthenticated, router, user]);

  if (authLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
        <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[var(--bg-secondary)] opacity-10">
        <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent-light)]/10" />
      </div>
      <div className="pointer-events-none fixed left-[-10%] top-[-10%] -z-10 h-[40%] w-[40%] animate-pulse rounded-full bg-[var(--accent)]/10 blur-[120px]" />
      <div className="animation-delay-2000 pointer-events-none fixed bottom-[-10%] right-[-10%] -z-10 h-[40%] w-[40%] rounded-full bg-[var(--accent)]/10 blur-[120px]" />

      <main className="relative z-10 flex flex-1 items-center justify-center p-6">
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="size-16 overflow-hidden rounded-full bg-black p-2 shadow-2xl ring-1 ring-white/10">
              <img src="/icon-512.png" alt="Aura Dime" className="h-full w-full rounded-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Aura<span className="text-[var(--accent)]">Dime</span>
              </h1>
              <p className="text-[11px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-60">
                Shop with confidence
              </p>
            </div>
          </div>
          <UnifiedAuth />
        </div>
      </main>
    </div>
  );
}
