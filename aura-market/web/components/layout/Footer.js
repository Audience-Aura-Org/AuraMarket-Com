'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// Direct imports to bypass Turbopack Barrel-Cache conflicts
import { Smartphone } from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { MonitorSmartphone } from 'lucide-react';
import { ShieldCheck } from 'lucide-react';
import { Mail } from 'lucide-react';
import { FileText } from 'lucide-react';
import { Scale } from 'lucide-react';

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
              Definitive Premium Multi-Vendor Platform. Redefining the future of digital and physical commerce.
            </p>
            <div className="flex items-center gap-4">
              <div className="size-3 bg-[var(--accent)] rounded-full animate-pulse shadow-[0_0_10px_var(--accent)]"></div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)]">Global Distributed Node</span>
            </div>
          </div>

          {/* C-02: Discovery & App Portal */}
          <div className="flex flex-col gap-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Discovery Hub</h3>
            <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--accent)] transition-all">Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--accent)] transition-all">Collections</Link></li>
              <li>
                 <Link href="/onboarding/pwa" className="flex items-center gap-3 group text-[var(--accent)] hover:opacity-80 transition-all font-black">
                    <Smartphone className="size-4 group-hover:scale-110 transition-transform" />
                    Get Aura App
                 </Link>
              </li>
            </ul>
          </div>

          {/* C-03: Legal & Protocols */}
          <div className="flex flex-col gap-8">
             <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Protocols</h3>
             <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/privacy" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><ShieldCheck className="size-4 opacity-40" /> Privacy Protocol</Link></li>
                <li><Link href="/terms" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><Scale className="size-4 opacity-40" /> Market Protocol</Link></li>
                <li><Link href="/subscribe" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><Mail className="size-4 opacity-40" /> Join Exclusive</Link></li>
             </ul>
          </div>

          {/* C-04: Infrastructure & Security */}
          <div className="flex flex-col gap-8">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Security Hub</h3>
            <div className="flex flex-col gap-6">
               <div className="flex items-center gap-3 text-emerald-500 px-5 py-4 bg-emerald-500/5 rounded-3xl border border-emerald-500/10 backdrop-blur-3xl shadow-xl shadow-emerald-500/5">
                  <ShieldCheck className="size-5" />
                  <span className="text-[10px] font-black uppercase tracking-widest leading-none">End-to-End Encryption Node Active</span>
               </div>
               <div className="flex flex-col gap-2 pl-2">
                 <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-[0.4em] mb-1">Android Launching</p>
                 <div className="text-[11px] font-bold italic opacity-40 flex items-center gap-2">Soon 🚀 <Sparkles className="size-3 text-[var(--accent)]" /></div>
               </div>
            </div>
          </div>

        </div>

        {/* Global Stats Node */}
        <div className="border-t border-[var(--glass-border)] pt-12 flex flex-col md:flex-row items-center justify-between text-[var(--text-secondary)] gap-10 opacity-50">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em]">
              © {currentYear} Aura Market. Designed for Excellence.
            </p>
            <p className="text-[9px] font-bold opacity-30 italic">World-class commerce wrapped in liquid-glass.</p>
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

function Shield({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
