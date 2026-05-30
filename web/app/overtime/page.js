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

// Simple SplashScreen for initial mount
function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white transition-opacity duration-500">
      <div className="relative">
        <div className="size-20 rounded-full border border-black/5 flex items-center justify-center overflow-hidden shadow-sm">
           <img src="/icon-512.png?v=8" className="w-16 h-auto animate-pulse" alt="Aura Logo" />
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [sections, setSections] = useState(null); // null = not yet loaded
  const [loading, setLoading] = useState(true);

  // No mounted guard needed — we use null check instead
  useEffect(() => {
    const controller = new AbortController();
    const fetchHomepage = async () => {
      try {
        const res = await api.get('/homepage', { signal: controller.signal });
        if (res.data?.success) {
          setSections(res.data.data.sections || []);
        } else {
          setSections([]);
        }
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Failed to fetch homepage:', err);
          setSections([]);
        }
      } finally {
        // Immediate removal of splash once data is in
        setLoading(false);
      }
    };
    fetchHomepage();
    return () => controller.abort();
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-x-hidden transition-colors duration-500">
      {/* Splash Screen */}
      {loading && <SplashScreen />}

      {/* Ambient blobs — CSS-only, zero JS cost */}
      <div className="pointer-events-none fixed top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full opacity-20 z-0" style={{background:'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter:'blur(60px)'}} />
      <div className="pointer-events-none fixed top-[60%] right-[-50px] w-[400px] h-[400px] rounded-full opacity-20 z-0" style={{background:'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter:'blur(60px)'}} />

      {/* Storefront — shows skeleton immediately, replaces when data arrives */}
      <div className="w-full relative z-10">
        {!loading && sections && sections.length > 0 ? (
          <StorefrontRenderer sections={sections} />
        ) : !loading && (
          <main className="w-full pt-12 pb-24 px-6 md:px-20">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="flex flex-col gap-8">
                <div className="inline-flex items-center gap-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2 rounded-full w-fit">
                  <span className="material-symbols-outlined text-[var(--accent)] text-sm">auto_awesome</span>
                  <span className="text-[var(--accent)] text-xs  font-bold tracking-tight">The Future of Commerce</span>
                </div>
                <h1 className="text-6xl md:text-7xl  font-extrabold leading-[1.1] tracking-tight text-[var(--text-primary)]">
                  Shop premium products from trusted sellers.
                </h1>
                <p className="text-lg text-[var(--text-secondary)] max-w-lg leading-relaxed">
                  Auradime connects shoppers, vendors, and logistics partners for confident commerce across Cameroon and Africa.
                </p>
                <div className="flex flex-wrap gap-4 pt-4">
                  <button
                    onClick={() => router.push('/discovery')}
                    className="bg-[var(--accent)] text-white px-10 py-4 rounded-full  font-bold text-lg shadow-2xl shadow-[var(--accent)]/40 flex items-center gap-3 hover:scale-105 transition-transform"
                  >
                    Discovery Shop <span className="material-symbols-outlined">explore</span>
                  </button>
                  {user ? (
                    <button
                      onClick={() => router.push(user.role === 'admin' ? '/admin/dashboard' : user.role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard')}
                      className="glass-panel px-10 py-4 rounded-full  font-bold text-lg flex items-center gap-3 hover:bg-[var(--accent)]/5 transition-all text-[var(--text-primary)]"
                    >
                      Dashboard <span className="material-symbols-outlined">dashboard</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/register?vendor=true')}
                      className="glass-panel px-10 py-4 rounded-full  font-bold text-lg flex items-center gap-3 hover:bg-[var(--accent)]/5 transition-all text-[var(--text-primary)]"
                    >
                      Be a Vendor <span className="material-symbols-outlined">storefront</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* Aura Assistant — lazy, appears 1.2s after mount only for eligible users */}
      <AuraAssistant user={user} />
    </div>
  );
}
