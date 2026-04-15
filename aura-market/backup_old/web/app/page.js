"use client";

export const dynamic = 'force-dynamic';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import StorefrontRenderer from '@/components/homepage/StorefrontRenderer';
import { useAuthStore } from '@/hooks/useAuth';
import HubContent from '@/components/hub/HubContent';

export default function LandingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchHomepage = async () => {
      try {
        const res = await api.get('/homepage');
        if (res.data?.success) {
          setSections(res.data.data.sections);
        }
      } catch (err) {
        console.error('Failed to fetch homepage:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHomepage();
  }, []);

  if (!mounted) return null;

  return (
    <div className="relative min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-x-hidden transition-colors duration-500">
      {/* BG Blur Blobs */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-blur-blob top-[-100px] left-[-100px] opacity-20" style={{background:'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter:'blur(60px)', zIndex:0}} />
      <div className="absolute w-[400px] h-[400px] rounded-full top-[60%] right-[-50px] opacity-20" style={{background:'radial-gradient(circle, var(--accent) 0%, transparent 70%)', filter:'blur(60px)', zIndex:0}} />

      {/* Dynamic Storefront */}
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="w-full relative z-10">
          {sections.length > 0 ? (
            <StorefrontRenderer sections={sections} />
          ) : (
            <main className="w-full pt-12 pb-24 px-6 md:px-20">
              <div className="grid lg:grid-cols-2 gap-16 items-center">
                <div className="flex flex-col gap-8">
                  <div className="inline-flex items-center gap-2 bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-4 py-2 rounded-full w-fit">
                    <span className="material-symbols-outlined text-[var(--accent)] text-sm">auto_awesome</span>
                    <span className="text-[var(--accent)] text-xs font-bold  tracking-widest">The Future of Commerce</span>
                  </div>
                  <h1 className="text-6xl md:text-7xl font-extrabold leading-[1.1] tracking-tight text-[var(--text-primary)]">
                    Experience <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-light)]">Liquid</span> Shopping.
                  </h1>
                  <p className="text-lg text-[var(--text-secondary)] max-w-lg leading-relaxed">
                    Aura Market introduces a premium multi-vendor ecosystem wrapped in a stunning liquid-glass interface.
                  </p>
                  <div className="flex flex-wrap gap-4 pt-4">
                    <button 
                      onClick={() => router.push('/discovery')} 
                      className="bg-[var(--accent)] text-white px-10 py-4 rounded-full font-bold text-lg shadow-2xl shadow-[var(--accent)]/40 flex items-center gap-3 hover:scale-105 transition-transform"
                    >
                      Enter Discovery Hub <span className="material-symbols-outlined">explore</span>
                    </button>
                    {user ? (
                      <button 
                        onClick={() => router.push(user.role === 'admin' ? '/admin/dashboard' : user.role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard')} 
                        className="glass-panel px-10 py-4 rounded-full font-bold text-lg flex items-center gap-3 hover:bg-[var(--accent)]/5 transition-all text-[var(--text-primary)]"
                      >
                        Dashboard <span className="material-symbols-outlined">dashboard</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => router.push('/register?vendor=true')} 
                        className="glass-panel px-10 py-4 rounded-full font-bold text-lg flex items-center gap-3 hover:bg-[var(--accent)]/5 transition-all text-[var(--text-primary)]"
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
      )}

      {/* Storefront Renderer follows */}
    </div>
  );
}


