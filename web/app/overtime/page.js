"use client";

export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import dynamic_import from 'next/dynamic';

// Lazy-load heavy components — not needed for initial paint
const StorefrontRenderer = dynamic_import(() => import('@/components/homepage/StorefrontRenderer'), { ssr: false });
const AuraAssistant = dynamic_import(() => import('@/components/onboarding/AuraAssistant'), { ssr: false });

function OvertimeSkeleton() {
  return (
    <div className="w-full animate-pulse">
      {/* Hero skeleton */}
      <div className="w-full h-[72dvh] min-h-[440px] md:h-[88dvh] md:min-h-[600px] bg-[var(--bg-primary)] rounded-none relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-secondary)] via-[var(--bg-primary)] to-[var(--bg-secondary)] animate-[shimmer_1.8s_infinite]" style={{backgroundSize:'200% 100%'}} />
        <div className="absolute bottom-16 md:bottom-20 left-5 sm:left-10 md:left-16 lg:left-28 space-y-4 w-80 md:w-[480px]">
          <div className="h-3 w-24 bg-white/10 rounded-full" />
          <div className="h-10 md:h-14 w-full bg-white/10 rounded-2xl" />
          <div className="h-10 md:h-14 w-4/5 bg-white/10 rounded-2xl" />
          <div className="h-4 w-3/4 bg-white/8 rounded-full" />
          <div className="h-12 w-36 bg-white/10 rounded-2xl mt-4" />
        </div>
      </div>
      {/* Section skeletons */}
      {[0, 1].map(i => (
        <div key={i} className="px-5 sm:px-8 md:px-12 py-8">
          <div className="flex items-end justify-between mb-5">
            <div className="space-y-2">
              <div className="h-5 w-36 bg-[var(--bg-primary)] rounded-full" />
              <div className="h-3 w-52 bg-[var(--bg-primary)] rounded-full opacity-60" />
            </div>
            <div className="h-8 w-20 bg-[var(--bg-primary)] rounded-full" />
          </div>
          <div className="flex gap-3 overflow-hidden">
            {[0,1,2,3,4,5].map(j => (
              <div key={j} className="w-[calc(50%-0.375rem)] sm:w-[calc(33.33%-0.5rem)] lg:w-[calc(16.66%-0.625rem)] shrink-0 aspect-[3/4] rounded-3xl bg-[var(--bg-primary)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const { user, authChecked } = useAuthStore();
  const [sections, setSections] = useState(null); // null = not yet loaded

  const router = useRouter();

  useEffect(() => {
    if (authChecked && !user) router.replace('/login');
  }, [authChecked, user, router]);

  useEffect(() => {
    let isActive = true;
    let controller = new AbortController();

    const fetchHomepage = async () => {
      try {
        controller.abort();
        controller = new AbortController();
        const res = await api.get('/homepage', {
          signal: controller.signal,
          params: { nocache: '1', t: Date.now() },
        });
        if (!isActive) return;
        if (res.data?.success) {
          setSections(res.data.data.sections || []);
        } else {
          setSections([]);
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Failed to fetch homepage:', err);
          if (!isActive) return;
          setSections([]);
        }
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') fetchHomepage();
    };

    const handleAdminUpdate = (e) => {
      if (e.key === 'aura_homepage_updated') fetchHomepage();
    };

    fetchHomepage();
    const intervalId = window.setInterval(refreshWhenVisible, 15000);
    window.addEventListener('focus', fetchHomepage);
    window.addEventListener('online', fetchHomepage);
    window.addEventListener('storage', handleAdminUpdate);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      isActive = false;
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', fetchHomepage);
      window.removeEventListener('online', fetchHomepage);
      window.removeEventListener('storage', handleAdminUpdate);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-x-hidden transition-colors duration-500">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none fixed top-[-120px] left-[-120px] w-[500px] h-[500px] rounded-full opacity-15 z-0"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div className="pointer-events-none fixed top-[55%] right-[-80px] w-[450px] h-[450px] rounded-full opacity-12 z-0"
        style={{ background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div className="pointer-events-none fixed bottom-[-100px] left-[30%] w-[400px] h-[400px] rounded-full opacity-8 z-0"
        style={{ background: 'radial-gradient(circle, var(--accent-light, var(--accent)) 0%, transparent 70%)', filter: 'blur(100px)' }} />

      <div className="w-full relative z-10 pb-[calc(92px+env(safe-area-inset-bottom,0px))] sm:pb-10">
        {sections === null ? (
          <OvertimeSkeleton />
        ) : sections.length > 0 ? (
          <StorefrontRenderer sections={sections} />
        ) : (
          <main className="min-h-[60dvh] w-full" aria-label="Overtime CMS content" />
        )}
      </div>

      <AuraAssistant user={user} />
    </div>
  );
}
