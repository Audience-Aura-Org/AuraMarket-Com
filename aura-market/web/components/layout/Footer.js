'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// Direct imports for stability
import { Smartphone, Sparkles, MonitorSmartphone, ShieldCheck, Mail, FileText, Scale, Zap, Send } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');

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
               The premium multi-vendor ecosystem defining the future of liquid-glass commerce.
            </p>
          </div>

          {/* C-02: Discovery Hub */}
          <div className="flex flex-col gap-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Discovery</h3>
            <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--accent)] transition-all">Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--accent)] transition-all">Collections</Link></li>
              <li><Link href="/brands" className="hover:text-[var(--accent)] transition-all">Verified Brands</Link></li>
            </ul>
          </div>

          {/* C-03: Legal & Protocols */}
          <div className="flex flex-col gap-8">
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Protocols</h3>
             <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/privacy" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><ShieldCheck className="size-4 opacity-40" /> Privacy Node</Link></li>
                <li><Link href="/terms" className="hover:text-[var(--accent)] transition-all flex items-center gap-3"><Scale className="size-4 opacity-40" /> Market Protocol</Link></li>
                <li><Link href="/logistics" className="hover:text-emerald-500 transition-all flex items-center gap-3"><Zap className="size-4 opacity-40" /> Systems Node</Link></li>
             </ul>
          </div>

          {/* C-04: Security & Subscribers Hub (REFACTORED) */}
          <div className="flex flex-col gap-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Security Hub</h3>
            
            <div className="flex flex-col gap-8">
               {/* Subscription Sub-node */}
               <div className="flex flex-col gap-4">
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-80">Stay Locked In</p>
                  <form className="relative group overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-3xl transition-all focus-within:border-[var(--accent)]" onSubmit={(e) => e.preventDefault()}>
                    <input 
                      type="email" 
                      placeholder="secured-email"
                      className="w-full h-12 pl-4 pr-12 bg-transparent text-xs font-bold outline-none text-white placeholder:opacity-30"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <button className="absolute right-0 top-0 h-full w-12 flex items-center justify-center bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-white transition-all">
                       <Send className="size-4" />
                    </button>
                  </form>
               </div>

               {/* App Installation Sub-node */}
               <div className="flex flex-col gap-4">
                  <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-widest opacity-80">Get the App</p>
                  <Link href="/onboarding/pwa" className="flex items-center gap-4 group p-4 rounded-2xl bg-gradient-to-br from-[var(--accent)]/5 to-transparent border border-[var(--glass-border)] hover:border-[var(--accent)]/50 transition-all shadow-xl shadow-[var(--accent)]/5">
                     <div className="size-10 rounded-xl bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] shadow-inner ring-1 ring-[var(--accent)]/20 shadow-[var(--accent)]/30">
                        <Smartphone className="size-5" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)]">Aura PWA Hub</span>
                        <span className="text-[9px] font-bold text-[var(--text-secondary)] opacity-50 uppercase tracking-widest">Install Desktop/iOS</span>
                     </div>
                  </Link>
               </div>

               {/* Network Status Minimal */}
               <div className="flex items-center gap-3 text-emerald-500 opacity-80 pl-1">
                  <ShieldCheck className="size-4" /> 
                  <span className="text-[10px] font-black uppercase tracking-widest">E2E Encrypted Node</span>
               </div>
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
               Optimal
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
