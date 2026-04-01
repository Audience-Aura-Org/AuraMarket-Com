'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Smartphone, Sparkles, MonitorSmartphone, ShieldCheck, Send, Globe, Command, Zap, Scale, Cpu, Activity, Fingerprint } from 'lucide-react';
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
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] pt-24 pb-12 px-6 md:px-12 lg:px-20 transition-colors duration-500 relative z-10 overflow-hidden">
      
      {/* Background layered effects for ultra-premium depth */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[400px] bg-[var(--accent)]/3 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[300px] bg-indigo-500/3 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-[0.02] pointer-events-none" />

      <div className="max-w-[1400px] mx-auto relative z-10">
        
        {/* Top Branding & Smart Newsletter Hub */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-20 gap-12 lg:gap-20">
           <div className="flex flex-col gap-5 max-w-lg">
              <div className="flex items-center gap-4 group cursor-pointer" onClick={() => router.push('/')}>
                <div className="size-12 rounded-2xl bg-black flex items-center justify-center p-2.5 shadow-2xl ring-1 ring-white/10 transform group-hover:rotate-6 transition-all duration-500">
                   <img src="/logo-white.png" alt="Aura" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_var(--accent)]" />
                </div>
                <div className="flex flex-col">
                  <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)] leading-none">
                    Aura<span className="text-[var(--accent)]">Market</span>
                  </h2>
                  <span className="text-[10px] font-black tracking-[0.4em] text-[var(--accent)] opacity-60 mt-1">DEFINITIVE VERSION</span>
                </div>
              </div>
              <p className="text-sm text-[var(--text-secondary)] opacity-70 italic font-medium leading-relaxed">
                 The world's most precise multi-vendor ecosystem. <br className="hidden md:block" /> Bringing liquid-glass aesthetics to global commerce.
              </p>
           </div>

           {/* Newsletter Hub - Signature Design */}
           <div className="w-full lg:w-[420px] relative">
              <div className="absolute -top-12 right-0 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] opacity-0 lg:opacity-100 transform translate-y-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                 <Activity className="size-3 text-emerald-500" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Nodes Online: 142ms Delay</span>
              </div>
              <div className="glass-panel p-6 rounded-[2rem] border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 hover:border-[var(--accent)]/30 transition-all duration-500">
                <p className="text-xs font-black text-[var(--text-primary)] mb-4 tracking-widest uppercase flex items-center gap-2">
                   <Sparkles className="size-3.5 text-[var(--accent)]" /> 
                   Secure Access Hub
                </p>
                <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                  <div className="relative flex-1 group">
                    <input 
                      type="email" 
                      placeholder="secured-identity@aura.io"
                      className="w-full h-12 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] pl-4 pr-4 text-xs font-bold outline-none text-[var(--text-primary)] placeholder:opacity-30 focus:border-[var(--accent)] transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <button className="h-12 px-6 rounded-xl bg-[var(--accent)] text-white hover:scale-[0.98] transition-all shadow-xl shadow-[var(--accent)]/30 active:scale-95 flex items-center justify-center">
                     <Send className="size-4" />
                  </button>
                </form>
              </div>
           </div>
        </div>

        <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent opacity-30 mb-20" />

        {/* Links & Ecosystem Grid - Liquid Glass Experience */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-16 mb-24">
          
          {/* Section 01: Core Nodes */}
          <div className="flex flex-col gap-8">
            <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-primary)] opacity-40">
               <Cpu className="size-3" /> Core Nodes
            </h3>
            <ul className="flex flex-col gap-6 text-sm font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--accent)] transition-all flex items-center gap-2 group"><div className="size-1 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all" /> Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--accent)] transition-all flex items-center gap-2 group"><div className="size-1 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all" /> Collections</Link></li>
              <li><Link href="/brands" className="hover:text-[var(--accent)] transition-all flex items-center gap-2 group"><div className="size-1 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all" /> Verified Brands</Link></li>
              <li><Link href="/search" className="hover:text-[var(--accent)] transition-all flex items-center gap-2 group"><div className="size-1 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all" /> Signature Drops</Link></li>
            </ul>
          </div>

          {/* Section 02: Operational Protocols */}
          <div className="flex flex-col gap-8">
             <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-primary)] opacity-40">
                <Fingerprint className="size-3" /> Protocols
             </h3>
             <ul className="flex flex-col gap-6 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/privacy" className="hover:text-[var(--text-primary)] transition-all flex items-center gap-3">
                   <div className="size-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center opacity-40"><ShieldCheck className="size-3.5" /></div>
                   Privacy Node
                </Link></li>
                <li><Link href="/terms" className="hover:text-[var(--text-primary)] transition-all flex items-center gap-3">
                   <div className="size-8 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center opacity-40"><Scale className="size-3.5" /></div>
                   Market Rules
                </Link></li>
                <li><Link href="/logistics" className="hover:text-emerald-500 transition-all flex items-center gap-3">
                   <div className="size-8 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-emerald-500"><Zap className="size-3.5" /></div>
                   Global Logistics
                </Link></li>
             </ul>
          </div>

          {/* Section 03: Global Grid */}
          <div className="flex flex-col gap-8">
             <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-[var(--text-primary)] opacity-40">
                <Globe className="size-3" /> Global Grid
             </h3>
             <ul className="flex flex-col gap-6 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/vendors" className="hover:text-[var(--text-primary)] transition-all">Global Merchants</Link></li>
                <li><Link href="/api-status" className="hover:text-[var(--text-primary)] transition-all">Network Status</Link></li>
                <li><Link href="/help" className="hover:text-[var(--text-primary)] transition-all">Support Hub</Link></li>
                <li className="flex items-center gap-3 mt-4">
                   <span className="px-3 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[9px] font-black uppercase tracking-widest border border-[var(--accent)]/20">Aura v4.0.0</span>
                   <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_var(--emerald-500)]" />
                </li>
             </ul>
          </div>

          {/* Section 04: PWA Native Card - Refined High-Fidelity */}
          <div 
             className="flex flex-col col-span-1 border border-[var(--glass-border)] bg-[var(--bg-primary)]/40 backdrop-blur-2xl rounded-[2.5rem] p-7 relative overflow-hidden group hover:border-[var(--accent)]/50 transition-all duration-700 cursor-pointer shadow-2xl shadow-black/10"
             onClick={() => router.push('/onboarding/pwa')}
          >
             <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--accent)]/10 blur-[40px] rounded-full group-hover:bg-[var(--accent)]/20 transition-all duration-1000" />
             <div className="relative z-10 flex flex-col h-full justify-between gap-10">
                <div className="size-14 rounded-2xl bg-black border border-white/5 flex items-center justify-center text-[var(--accent)] shadow-2xl group-hover:scale-110 transition-transform duration-700 ring-1 ring-[var(--accent)]/20">
                   <Smartphone className="size-6" />
                </div>
                <div className="flex flex-col gap-2">
                   <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[var(--accent)]">Standalone</span>
                   <h4 className="text-xl font-black text-[var(--text-primary)] leading-tight tracking-tighter uppercase">
                     Redeem Aura <br /> Experience
                   </h4>
                   <p className="text-[11px] text-[var(--text-secondary)] opacity-60 font-medium mt-1 leading-snug">
                     Native identity verification. <br /> Optimal performance.
                   </p>
                </div>
             </div>
             <div className="absolute bottom-4 right-6 text-[var(--accent)] opacity-20 transform translate-x-4 group-hover:translate-x-0 transition-transform duration-500">
                <MonitorSmartphone className="size-16" />
             </div>
          </div>

        </div>

        {/* Status Line - Definitive Conclusion */}
        <div className="flex flex-col lg:flex-row items-center justify-between pt-10 border-t border-[var(--glass-border)] text-[var(--text-secondary)] gap-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
             <div className="flex items-center gap-3 bg-[var(--bg-secondary)] px-4 py-2 rounded-2xl border border-[var(--glass-border)] shadow-sm">
               <ShieldCheck className="size-4 text-[var(--accent)]" /> 
               <span className="text-[10px] font-black uppercase tracking-[0.3em] leading-none pt-0.5 text-[var(--text-primary)]">Secured via Aura Shield™</span>
             </div>
             <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">
               © {currentYear} Aura Global. Definitive Copy.
             </p>
          </div>
          
          <div className="flex items-center gap-10 text-[9px] font-black uppercase tracking-[0.5em] opacity-50">
             <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Privacy</Link>
             <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">Terms</Link>
             <Link href="/logistics" className="hover:text-[var(--text-primary)] transition-colors">Logistics</Link>
          </div>
        </div>
        
      </div>

      <style jsx>{`
        @keyframes shine {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </footer>
  );
}
