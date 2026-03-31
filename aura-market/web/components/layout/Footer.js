'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// Direct imports for stability
import { Smartphone } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { MonitorSmartphone } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';
import { Mail } from 'lucide-react';
import { FileText } from 'lucide-react';
import { Scale } from 'lucide-react';
import { Zap } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] py-24 px-8 transition-colors duration-500 relative z-10 overflow-hidden">
      <div className="max-w-[1400px] mx-auto">
        
        {/* 4-COLUMN DEFINITIVE GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-24">
          
          {/* C-01: Identity & Vision */}
          <div className="flex flex-col gap-8 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-black border border-white/10 flex items-center justify-center p-2.5 shadow-2xl">
                 <img src="/logo-white.png" alt="Aura Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">Aura Market</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs opacity-60 italic">
               Premium Multi-Vendor Ecosystem. The future of commerce wrapped in liquid-glass.
            </p>
          </div>

          {/* C-02: Discovery & App Portal */}
          <div className="flex flex-col gap-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Discovery Hub</h3>
            <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--accent)] transition-all">Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--accent)] transition-all">Collections</Link></li>
              <li>
                 <Link href="/onboarding/pwa" className="flex items-center gap-3 group text-[var(--accent)] hover:opacity-80 transition-all font-black uppercase text-[11px] tracking-widest">
                    <Smartphone className="size-4 group-hover:scale-110 transition-transform" />
                    Get Aura App
                 </Link>
              </li>
            </ul>
          </div>

          {/* C-03: Legal & Protocols */}
          <div className="flex flex-col gap-8">
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Protocols</h3>
             <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/privacy" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><ShieldCheck className="size-4 opacity-40 px-0.5" /> Privacy Node</Link></li>
                <li><Link href="/terms" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><Scale className="size-4 opacity-40 px-0.5" /> Market Protocol</Link></li>
                <li><Link href="/subscribe" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><Mail className="size-4 opacity-40 px-0.5" /> Join Exclusive</Link></li>
             </ul>
          </div>

          {/* C-04: Security & Systems Hub */}
          <div className="flex flex-col gap-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Security Hub</h3>
            <div className="flex flex-col gap-6">
               <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
                  <li className="flex items-center gap-3 text-emerald-500">
                    <ShieldCheck className="size-4" /> 
                    <span className="text-[11px] font-black uppercase tracking-widest leading-none pt-0.5">E2E Encrypted</span>
                  </li>
                  <li><Link href="/logistics" className="hover:text-emerald-500 transition-all flex items-center gap-3"><Zap className="size-4 opacity-40 px-0.5" /> Systems Node</Link></li>
                  <li>
                    <div className="flex flex-col gap-1.5 pt-2 opacity-30">
                       <p className="text-[8px] font-black uppercase tracking-[0.4em]">Mobile Launching</p>
                       <p className="text-[10px] font-bold italic flex items-center gap-2">Android Soon 🚀</p>
                    </div>
                  </li>
               </ul>
            </div>
          </div>

        </div>

        {/* Global Footer Line */}
        <div className="border-t border-[var(--glass-border)] pt-12 flex flex-col md:flex-row items-center justify-between text-[var(--text-secondary)] gap-10 opacity-50">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">
              © {currentYear} Aura Market. Designed for Excellence.
            </p>
          </div>
          <div className="flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.4em]">
             <div className="flex items-center gap-2">
               <div className="size-2 bg-emerald-500 rounded-full animate-blink shadow-[0_0_8px_var(--emerald-500)]" />
               Network Optimal
             </div>
             <div className="flex items-center gap-3">
                <MonitorSmartphone className="size-4" /> Standalone Active
             </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .animate-blink {
          animation: blink 2s infinite;
        }
      `}</style>
    </footer>
  );
}
