'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// Direct imports for stability
import { Smartphone, Sparkles, MonitorSmartphone, ShieldCheck, Mail, FileText, Scale, Zap, Send, Globe, Command } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] py-12 md:py-24 px-6 md:px-8 transition-colors duration-500 relative z-10 overflow-hidden">
      <div className="max-w-[1400px] mx-auto">
        
        {/* 4-COLUMN DEFINITIVE BALANCED GRID */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16 mb-16 md:mb-24 items-start">
          
          {/* C-01: Identity & Vision */}
          <div className="flex flex-col gap-6 md:gap-8 md:col-span-1 md:min-h-[280px]">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-black border border-white/10 flex items-center justify-center p-2.5 shadow-2xl">
                 <img src="/logo-white.png" alt="Aura Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">Aura Market</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs opacity-60 italic">
               The premium multi-vendor ecosystem defining the future of commerce through liquid-glass aesthetics.
            </p>
            <div className="flex items-center gap-3 opacity-30">
               <Command className="size-4" />
               <span className="text-[10px] font-black uppercase tracking-widest pt-0.5">Core System v12.0</span>
            </div>
          </div>

          {/* C-02: Discovery Hub (Balanced) */}
          <div className="flex flex-col gap-6 md:gap-8 md:min-h-[280px]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Discovery</h3>
            <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--accent)] transition-all">Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--accent)] transition-all">Collections Hub</Link></li>
              <li><Link href="/brands" className="hover:text-[var(--accent)] transition-all">Verified Brands</Link></li>
              <li><Link href="/search" className="hover:text-[var(--accent)] transition-all">Signatures Drops</Link></li>
              <li><Link href="/vendors" className="hover:text-[var(--accent)] transition-all">Global Merchants</Link></li>
            </ul>
          </div>

          {/* C-03: Legal & Ecosystem (Balanced) */}
          <div className="flex flex-col gap-6 md:gap-8 md:min-h-[280px]">
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Protocols</h3>
             <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/privacy" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><ShieldCheck className="size-4 opacity-40" /> Privacy Node</Link></li>
                <li><Link href="/terms" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><Scale className="size-4 opacity-40" /> Market Rules</Link></li>
                <li><Link href="/logistics" className="hover:text-emerald-500 transition-all flex items-center gap-3"><Zap className="size-4 opacity-40" /> Global Logistics</Link></li>
                <li><Link href="/api-status" className="hover:text-indigo-500 transition-all flex items-center gap-3"><Globe className="size-4 opacity-40" /> Network Map</Link></li>
                <li><Link href="/help" className="hover:text-amber-500 transition-all flex items-center gap-3 font-medium">Support Hub</Link></li>
             </ul>
          </div>

          {/* C-04: Security & Engagement Portal (Balanced) */}
          <div className="flex flex-col gap-6 md:gap-8 md:min-h-[280px]">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Security Hub</h3>
            
            <div className="flex flex-col gap-6 md:gap-8">
               {/* Subscription Section */}
               <div className="flex flex-col gap-4">
                  <form className="relative group overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-3xl transition-all focus-within:border-[var(--accent)] shadow-sm" onSubmit={(e) => e.preventDefault()}>
                    <input 
                      type="email" 
                      placeholder="Subscribe to Drops"
                      className="w-full h-12 pl-4 pr-12 bg-transparent text-xs font-bold outline-none text-white placeholder:opacity-30"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button className="absolute right-0 top-0 h-full w-12 flex items-center justify-center bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all">
                       <Send className="size-4" />
                    </button>
                  </form>
               </div>

               {/* App Node Section */}
               <Link href="/onboarding/pwa" className="flex items-center gap-4 group p-4 rounded-2xl bg-gradient-to-br from-[var(--accent)]/5 to-transparent border border-[var(--glass-border)] hover:border-[var(--accent)]/50 transition-all shadow-xl shadow-[var(--accent)]/5">
                  <div className="size-9 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] ring-1 ring-[var(--accent)]/20 shadow-inner">
                     <Smartphone className="size-4" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-primary)]">Aura PWA Node</span>
                     <span className="text-[8px] font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-widest mt-0.5">Install App</span>
                  </div>
               </Link>

               {/* Network Badge */}
               <div className="flex items-center gap-3 text-emerald-500 opacity-80 pl-1 pt-1 border-t border-[var(--glass-border)]/50">
                  <ShieldCheck className="size-3.5" /> 
                  <span className="text-[9px] font-black uppercase tracking-widest">E2E Encrypted Protocol Active</span>
               </div>
            </div>
          </div>

        </div>

        {/* Status Line */}
        <div className="border-t border-[var(--glass-border)] pt-8 md:pt-12 flex flex-col md:flex-row items-center justify-between text-[var(--text-secondary)] gap-6 md:gap-10 opacity-50">
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
