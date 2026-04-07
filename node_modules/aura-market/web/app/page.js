"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import StorefrontRenderer from '@/components/homepage/StorefrontRenderer';
import { useAuthStore } from '@/hooks/useAuth';
import HubContent from '@/components/hub/HubContent';
import { Sparkles, ArrowRight, Layout, ShoppingBag, Zap } from 'lucide-react';

export const dynamic = 'force-dynamic';

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

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[var(--bg-secondary)] flex items-center justify-center">
         <div className="w-12 h-12 border-2 border-[var(--accent)]/20 border-t-[var(--accent)] rounded-full animate-spin shadow-2xl" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[var(--bg-secondary)] text-[var(--text-primary)] overflow-x-hidden transition-colors duration-500">
      {/* Structural Background Layers */}
      <div className="absolute inset-0 pointer-events-none opacity-20" style={{background: 'radial-gradient(circle at 0% 0%, var(--accent) 0%, transparent 50%), radial-gradient(circle at 100% 100%, var(--accent) 0%, transparent 50%)', filter: 'blur(100px)'}} />

      {/* Dynamic Resolution Layer */}
      {loading ? (
        <div className="min-h-screen flex items-center justify-center relative z-20">
           <div className="flex flex-col items-center gap-6">
              <div className="w-16 h-16 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)] animate-pulse">Syncing Global Grid...</p>
           </div>
        </div>
      ) : (
        <div className="w-full relative z-10 transition-opacity duration-1000">
          {sections && sections.length > 0 ? (
            <StorefrontRenderer sections={sections} />
          ) : (
            <main className="w-full pt-12 pb-32 px-6 md:px-20 min-h-[70vh] flex items-center">
              <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
                <div className="flex flex-col gap-10">
                   <div className="inline-flex items-center gap-3 bg-[var(--accent)]/10 border border-[var(--accent)]/20 px-5 py-2.5 rounded-full w-fit group hover:bg-[var(--accent)]/20 transition-all cursor-default">
                      <Sparkles className="size-4 text-[var(--accent)] animate-pulse" />
                      <span className="text-[var(--accent)] text-[9px] font-black uppercase tracking-[0.4em]">Protocol Aura // Master Node</span>
                   </div>
                   
                   <div className="space-y-6">
                      <h1 className="text-5xl md:text-8xl font-black leading-[0.9] tracking-tighter text-[var(--text-primary)] italic">
                         LIQUID <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] via-[var(--accent-light)] to-[var(--accent)] bg-[length:200%_auto] animate-gradient-x">ECOSYSTEM.</span>
                      </h1>
                      <p className="text-lg md:text-xl text-[var(--text-secondary)] max-w-xl font-medium leading-relaxed opacity-60">
                         Welcome to the world's first premium multi-vendor architecture wrapped in a stunning liquid-glass operational interface.
                      </p>
                   </div>

                   <div className="flex flex-wrap gap-6 items-center">
                      <button 
                        onClick={() => router.push('/discovery')} 
                        className="bg-[var(--accent)] text-white px-12 py-5 rounded-3xl font-black text-sm shadow-[0_20px_50px_rgba(var(--accent-rgb),0.3)] flex items-center gap-4 hover:scale-105 active:scale-95 transition-all group"
                      >
                        Enter Terminal <ArrowRight className="size-4 group-hover:translate-x-2 transition-transform" />
                      </button>
                      
                      {user ? (
                        <button 
                          onClick={() => router.push(user.role === 'admin' ? '/admin/dashboard' : user.role === 'vendor' ? '/vendor/dashboard' : '/logistics/dashboard')} 
                          className="px-10 py-5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 font-black text-sm flex items-center gap-4 hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/20 transition-all text-[var(--text-primary)] active:scale-95"
                        >
                          <Layout className="size-4" /> Node Dashboard
                        </button>
                      ) : (
                        <button 
                          onClick={() => router.push('/register?vendor=true')} 
                          className="px-10 py-5 rounded-3xl border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 font-black text-sm flex items-center gap-4 hover:bg-[var(--accent)]/10 hover:border-[var(--accent)]/20 transition-all text-[var(--text-primary)] active:scale-95 text-transparent bg-clip-text bg-gradient-to-r from-[var(--text-primary)] to-[var(--text-secondary)]"
                        >
                          <ShoppingBag className="size-4" /> Establish Merchant Node
                        </button>
                      )}
                   </div>
                </div>

                {/* Optional: Add a high-fidelity visual node for the fallback */}
                <div className="hidden lg:flex justify-center relative">
                   <div className="size-[500px] rounded-full border border-[var(--glass-border)] flex items-center justify-center relative overflow-hidden bg-grid-white/[0.02]">
                      <div className="size-64 rounded-3xl bg-[var(--accent)]/10 animate-spin-slow blur-2xl" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="size-32 rounded-2xl bg-[var(--bg-primary)] border border-white/10 shadow-2xl flex items-center justify-center rotate-45">
                            <Zap className="size-12 text-[var(--accent)] -rotate-45" />
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            </main>
          )}
        </div>
      )}
    </div>
  );
}


