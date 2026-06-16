"use client";

export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import api from '@/services/api';
import { useAuthStore } from '@/hooks/useAuth';
import dynamic_import from 'next/dynamic';

// Lazy-load heavy components — not needed for initial paint
const StorefrontRenderer = dynamic_import(() => import('@/components/homepage/StorefrontRenderer'), { ssr: false });
const AuraAssistant = dynamic_import(() => import('@/components/onboarding/AuraAssistant'), { ssr: false });

export default function LandingPage() {
  const { user } = useAuthStore();
  const [sections, setSections] = useState(null); // null = not yet loaded

  // No mounted guard needed — we use null check instead
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

    fetchHomepage();
    const intervalId = window.setInterval(refreshWhenVisible, 15000);
    window.addEventListener('focus', fetchHomepage);
    window.addEventListener('online', fetchHomepage);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      isActive = false;
      controller.abort();
      window.clearInterval(intervalId);
      window.removeEventListener('focus', fetchHomepage);
      window.removeEventListener('online', fetchHomepage);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-x-hidden transition-colors duration-500 md:pt-0" style={{ paddingTop: 'calc\(61px\ \+\ env\(safe-area-inset-top,\ 0px\)\)' }}>
      {/* Ambient blobs — CSS-only, zero JS cost */}
      <div className="pointer-events-none fixed top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full opacity-20 z-0" style={{background:'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter:'blur(60px)'}} />
      <div className="pointer-events-none fixed top-[60%] right-[-50px] w-[400px] h-[400px] rounded-full opacity-20 z-0" style={{background:'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter:'blur(60px)'}} />

      {/* Storefront renders only CMS data; no preload/marketing fallback between pages. */}
      <div className="w-full relative z-10 pb-[calc(92px+env(safe-area-inset-bottom,0px))] sm:pb-10">
        {sections === null ? null : sections.length > 0 ? (
          <StorefrontRenderer sections={sections} />
        ) : (
          <main className="min-h-[60dvh] w-full" aria-label="Overtime CMS content" />
        )}
      </div>

      {/* Aura Assistant — lazy, appears 1.2s after mount only for eligible users */}
      <AuraAssistant user={user} />
    </div>
  );
}

