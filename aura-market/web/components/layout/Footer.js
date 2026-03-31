'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Smartphone, Sparkles, MonitorSmartphone, ShieldCheck, Zap } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] py-20 px-8 transition-colors duration-500 relative z-10">
      <div className="max-w-[1400px] mx-auto">
        
        {/* 4-COLUMN SIGNATURE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
          
          {/* C-01: Logo & Vision */}
          <div className="flex flex-col gap-6 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center p-2 shadow-2xl">
                 <img src="/logo-white.png" alt="Aura Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tighter text-[var(--text-primary)]">Aura Market</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs opacity-60 italic">
              Premium multi-vendor ecosystem. Definitive liquid-glass commerce.
            </p>
          </div>

          {/* C-02: Discovery Hub & PWA Portal */}
          <div className="flex flex-col gap-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--accent)] flex items-center gap-2">
               <Sparkles className="size-3" /> Discover
            </h3>
            <ul className="flex flex-col gap-4 text-sm font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--accent)] transition-all">Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--accent)] transition-all">Collections</Link></li>
              <li><Link href="/brands" className="hover:text-[var(--accent)] transition-all">Verified Brands</Link></li>
              {/* NATIVE PWA Hub LINK */}
              <li className="pt-2">
                 <Link href="/onboarding/pwa" className="flex items-center gap-2.5 text-[var(--accent)] group">
                    <div className="size-7 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center ring-1 ring-[var(--accent)]/20 group-hover:scale-110 transition-all">
                       <Smartphone className="size-3.5" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest">Get the App</span>
                 </Link>
              </li>
            </ul>
          </div>

          {/* C-03: Infrastructure & Systems */}
          <div className="flex flex-col gap-6">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] opacity-40">System Node</h3>
             <ul className="flex flex-col gap-4 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/logistics" className="hover:text-emerald-500 transition-all flex items-center gap-2">Logistics <Zap className="size-3 opacity-20" /></Link></li>
                <li><Link href="/api-status" className="hover:text-indigo-500 transition-all">Global Stats</Link></li>
                <li className="opacity-30 italic text-[9px] uppercase tracking-widest pt-2">Android Portal Coming Soon 🚀</li>
             </ul>
          </div>

          {/* C-04: Security & Support */}
          <div className="flex flex-col gap-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)] opacity-40">Trust Node</h3>
            <div className="flex flex-col gap-4">
               <div className="flex items-center gap-3 text-emerald-500 px-4 py-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 backdrop-blur-xl">
                  <Shield className="w-4 h-4" />
                  <span className="text-[9px] font-black uppercase tracking-widest">E2E Encrypted</span>
               </div>
               <Link href="/help" className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors pl-1">Help Center Hub</Link>
            </div>
          </div>

        </div>

        {/* Status Line */}
        <div className="border-t border-[var(--glass-border)] pt-10 flex flex-col md:flex-row items-center justify-between text-[var(--text-secondary)] gap-8 opacity-50">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">
            © {currentYear} Aura Market.
          </p>
          <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest">
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Optimal
             </div>
             <div className="flex items-center gap-2">
                <MonitorSmartphone className="size-3.5" /> PWA Hub Active
             </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Shield({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
