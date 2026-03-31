'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// Direct imports for stability
import { Smartphone, Sparkles, MonitorSmartphone, ShieldCheck, Send, Globe, Command, Zap, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] pt-20 pb-10 px-6 md:px-12 transition-colors duration-500 relative z-10 overflow-hidden">
      
      {/* Background ambient glow for premium feel */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[var(--accent)]/5 blur-[120px] rounded-[100%] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto relative z-10">
        
        {/* Top Massive Branding & Engagement */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-16 md:mb-20 gap-10">
           <div className="flex flex-col gap-5">
              <div className="size-14 rounded-3xl bg-black flex items-center justify-center p-3 shadow-2xl ring-1 ring-white/10 group hover:scale-105 transition-all cursor-pointer">
                 <img src="/logo-white.png" alt="Aura Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-transform group-hover:rotate-6" />
              </div>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
                Aura Market
              </h2>
              <p className="text-sm text-[var(--text-secondary)] max-w-sm opacity-60 italic font-medium leading-relaxed">
                 The definitive multi-vendor ecosystem. Crafted with absolute precision and world-class liquid-glass aesthetics.
              </p>
           </div>

           {/* Newsletter Hub */}
           <div className="w-full md:w-[420px] flex flex-col gap-4">
              <p className="text-[10px] font-black text-[var(--text-primary)] uppercase tracking-[0.3em] opacity-80 flex items-center gap-2">
                 <Sparkles className="size-3.5 text-[var(--accent)]" /> 
                 Stay Locked In
              </p>
              <form className="relative group overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-3xl transition-all focus-within:border-[var(--accent)] hover:border-[var(--glass-border-hover)]" onSubmit={(e) => e.preventDefault()}>
                <input 
                  type="email" 
                  placeholder="Enter secured email..."
                  className="w-full h-14 pl-5 pr-14 bg-transparent text-sm font-bold outline-none text-[var(--text-primary)] placeholder:opacity-40"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="absolute right-1.5 top-1.5 bottom-1.5 w-12 rounded-xl flex items-center justify-center bg-[var(--accent)] text-white hover:scale-[0.96] transition-all shadow-lg shadow-[var(--accent)]/20 active:scale-95">
                   <Send className="size-4" />
                </button>
              </form>
           </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent opacity-50 mb-16" />

        {/* Links & Ecosystem Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-12 mb-20">
          
          {/* C-01: Discovery */}
          <div className="flex flex-col gap-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Discovery</h3>
            <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--text-primary)] transition-all">Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--text-primary)] transition-all">Collections</Link></li>
              <li><Link href="/brands" className="hover:text-[var(--text-primary)] transition-all">Verified Brands</Link></li>
              <li><Link href="/search" className="hover:text-[var(--accent)] transition-all">Signature Drops</Link></li>
            </ul>
          </div>

          {/* C-02: Protocols */}
          <div className="flex flex-col gap-6">
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">Protocols</h3>
             <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/privacy" className="hover:text-[var(--text-primary)] transition-all flex items-center gap-2"><ShieldCheck className="size-3.5 opacity-40" /> Privacy Node</Link></li>
                <li><Link href="/terms" className="hover:text-[var(--text-primary)] transition-all flex items-center gap-2"><Scale className="size-3.5 opacity-40" /> Market Rules</Link></li>
                <li><Link href="/logistics" className="hover:text-emerald-500 transition-all flex items-center gap-2"><Zap className="size-3.5 opacity-40" /> Global Logistics</Link></li>
                <li><Link href="/help" className="hover:text-amber-500 transition-all flex items-center gap-2">Support Center</Link></li>
             </ul>
          </div>

          {/* C-03: System Node */}
          <div className="flex flex-col gap-6">
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--text-primary)] opacity-40">System Node</h3>
             <ul className="flex flex-col gap-5 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/vendors" className="hover:text-[var(--text-primary)] transition-all">Global Merchants</Link></li>
                <li><Link href="/api-status" className="hover:text-[var(--text-primary)] transition-all flex items-center gap-2"><Globe className="size-3.5 opacity-40" /> Network Map</Link></li>
                <li className="flex items-center gap-2.5 mt-2 opacity-50 bg-[var(--bg-secondary)] w-fit px-3 py-1.5 rounded-lg border border-[var(--glass-border)]">
                  <Command className="size-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest leading-none pt-0.5">v12.0 Active</span>
                </li>
             </ul>
          </div>

          {/* C-04: High-Fidelity App Card */}
          <div 
             className="flex flex-col col-span-2 md:col-span-1 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 backdrop-blur-xl rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden group hover:border-[var(--accent)] transition-all duration-500 cursor-pointer shadow-xl shadow-black/5"
             onClick={() => router.push('/onboarding/pwa')}
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 blur-[40px] rounded-full group-hover:bg-[var(--accent)]/20 transition-all duration-700" />
             <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                <div className="size-14 rounded-2xl bg-[var(--accent)] flex items-center justify-center text-white shadow-lg shadow-[var(--accent)]/30 group-hover:scale-110 transition-transform duration-500">
                   <Smartphone className="size-6" />
                </div>
                <div className="flex flex-col gap-1.5">
                   <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)]">Standalone Platform</span>
                   <h4 className="text-2xl font-black text-[var(--text-primary)] leading-none tracking-tight uppercase">
                     Get App <Sparkles className="inline size-4 text-[var(--accent)] opacity-80 -mt-1" />
                   </h4>
                   <p className="text-xs text-[var(--text-secondary)] opacity-60 font-medium mt-1">
                     Experience Aura natively.
                   </p>
                </div>
             </div>
          </div>

        </div>

        {/* Global Footer Status Line */}
        <div className="flex flex-col lg:flex-row items-center justify-between text-[var(--text-secondary)] gap-6 opacity-60">
          <div className="flex flex-col md:flex-row items-center gap-4">
             <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-xl border border-emerald-500/20 shadow-sm shrink-0">
               <ShieldCheck className="size-4" /> 
               <span className="text-[10px] font-black uppercase tracking-widest leading-none pt-0.5">E2E Encrypted Protocol</span>
             </div>
             <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-center md:text-left mt-2 md:mt-0">
               © {currentYear} Aura Market.
             </p>
          </div>
          
          <div className="flex items-center gap-5 md:gap-8 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] shrink-0">
             <div className="flex items-center gap-2">
               <div className="size-2 bg-emerald-500 rounded-full animate-blink shadow-[0_0_8px_var(--emerald-500)]" />
               Optimal
             </div>
             <div className="w-1 h-1 rounded-full bg-[var(--text-secondary)]/30" />
             <div className="flex items-center gap-2">
                <MonitorSmartphone className="size-3.5" /> Standalone Ready
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
