'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
// Direct imports for stability
import { Smartphone, Sparkles, MonitorSmartphone, ShieldCheck, Send, Globe, Command, Zap, Scale } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Unconditionally destruct Footer on messaging apps regardless of Providers wrapper state
  const isChatPage = pathname?.startsWith('/messages') || pathname?.startsWith('/chat') || pathname?.startsWith('/admin/messages');
  if (isChatPage) return null;

  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] pt-20 pb-10 px-6 md:px-12 transition-colors duration-500 relative z-10 overflow-hidden">
      
      {/* Background ambient glow for premium feel */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[var(--accent)]/5 blur-[120px] rounded-[100%] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto relative z-10">
        
        {/* Top Branding & Engagement */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-10 md:mb-12 gap-6 md:gap-8">
           <div className="flex flex-col gap-3">
              <div className="size-10 rounded-xl bg-black flex items-center justify-center p-2 shadow-xl ring-1 ring-white/10 group hover:scale-105 transition-all cursor-pointer">
                 <img src="/logo-white.png" alt="Aura Logo" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] transition-transform group-hover:rotate-6" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
                Aura Market
              </h2>
              <p className="text-xs text-[var(--text-secondary)] max-w-xs opacity-60 italic font-medium leading-snug">
                 The definitive multi-vendor ecosystem. Crafted with absolute precision.
              </p>
           </div>

           {/* Newsletter Hub */}
           <div className="w-full md:w-[340px] flex flex-col gap-2.5">
              <p className="text-sm font-semibold text-[var(--text-primary)] opacity-80 flex items-center gap-2 pl-1">
                 <Sparkles className="size-3 text-[var(--accent)]" /> 
                 Stay logged in
              </p>
              <form className="relative group overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-3xl transition-all focus-within:border-[var(--accent)] hover:border-[var(--glass-border-hover)]" onSubmit={(e) => e.preventDefault()}>
                <input 
                  type="email" 
                  placeholder="Enter secured email..."
                  className="w-full h-11 pl-4 pr-12 bg-transparent text-xs font-bold outline-none text-[var(--text-primary)] placeholder:opacity-40"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="absolute right-1 top-1 bottom-1 w-10 rounded-lg flex items-center justify-center bg-[var(--accent)] text-white hover:scale-[0.96] transition-all shadow-md shadow-[var(--accent)]/20 active:scale-95">
                   <Send className="size-3.5" />
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

          {/* C-04: High-Fidelity App Card (50% Mobile) */}
          <div 
             className="flex flex-col col-span-1 border border-[var(--glass-border)] bg-[var(--bg-primary)]/50 backdrop-blur-xl rounded-2xl md:rounded-[2rem] p-5 md:p-6 relative overflow-hidden group hover:border-[var(--accent)] transition-all duration-500 cursor-pointer shadow-xl shadow-black/5"
             onClick={() => router.push('/onboarding/pwa')}
          >
             <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-[var(--accent)]/10 blur-[30px] rounded-full group-hover:bg-[var(--accent)]/20 transition-all duration-700" />
             <div className="relative z-10 flex flex-col h-full justify-between gap-6 md:gap-8">
                <div className="size-10 md:size-12 rounded-xl md:rounded-2xl bg-black border border-white/5 flex items-center justify-center text-[var(--accent)] shadow-lg shadow-[var(--accent)]/20 group-hover:scale-110 transition-transform duration-500 ring-1 ring-[var(--accent)]/10">
                   <Smartphone className="size-4 md:size-5" />
                </div>
                <div className="flex flex-col gap-1 md:gap-1.5">
                   <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-primary)] opacity-40">Native Hub</span>
                   <h4 className="text-sm md:text-xl font-black text-[var(--text-primary)] leading-none tracking-tight uppercase flex items-center gap-1.5">
                     Get App <Sparkles className="size-3 text-[var(--accent)] animate-pulse" />
                   </h4>
                   <p className="text-[10px] md:text-xs text-[var(--text-secondary)] opacity-60 font-medium mt-1 leading-snug">
                     Install PWA instantly.
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
