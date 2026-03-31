'use client';

import Link from 'next/link';
import { 
  Sparkles, Smartphone, Laptop, 
  Settings, ShieldCheck, Mail, Info 
} from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] pt-20 pb-24 px-8 md:px-20 transition-colors duration-500">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-16">
        
        {/* Brand Section */}
        <div className="flex flex-col gap-6 md:col-span-2">
           <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-black flex items-center justify-center p-2 shadow-lg shadow-[var(--accent)]/20 ring-1 ring-white/10">
                 <img src="/logo-white.png" alt="Aura Logo" className="size-full object-contain" />
              </div>
              <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tighter uppercase">Aura Market</h2>
           </div>
           <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-sm opacity-60">
              The world's leading premium multi-vendor ecosystem. Experience liquid-glass commerce at a global scale.
           </p>
           <div className="flex items-center gap-2 mt-4">
              <span className="size-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_var(--emerald-500)]"></span>
              <span className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.2em]">Global Systems Online</span>
           </div>
        </div>

        {/* Links: Experience */}
        <div className="flex flex-col gap-6">
           <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
              <Sparkles className="size-3 text-[var(--accent)]" /> Experience
           </h3>
           <nav className="flex flex-col gap-4">
              <Link href="/discovery" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-2">Discovery Hub</Link>
              <Link href="/shop" className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors inline-flex items-center gap-2">Storefronts</Link>
              {/* PWA HUB LINK */}
              <Link href="/onboarding/pwa" className="group flex flex-col gap-1 p-3 -m-3 rounded-2xl hover:bg-[var(--accent)]/5 transition-all">
                 <span className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] flex items-center gap-2">
                    Get the Aura App <Smartphone className="size-3.5" />
                 </span>
                 <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-widest opacity-50">Desktop & iOS Native</span>
              </Link>
           </nav>
        </div>

        {/* Links: Support */}
        <div className="flex flex-col gap-6">
           <h3 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-widest flex items-center gap-2">
              <ShieldCheck className="size-3 text-[var(--accent)]" /> Trust
           </h3>
           <nav className="flex flex-col gap-4 text-sm text-[var(--text-secondary)]">
              <Link href="/help-center" className="hover:text-[var(--accent)] transition-colors">Help Center</Link>
              <Link href="/terms-of-service" className="hover:text-[var(--accent)] transition-colors">Privacy & Terms</Link>
              <div className="pt-4 flex flex-col gap-1 opacity-40">
                 <span className="text-[9px] font-black uppercase tracking-[0.3em]">Android Native</span>
                 <span className="text-[10px] font-bold italic">Launching Soon 🚀</span>
              </div>
           </nav>
        </div>

      </div>

      <div className="max-w-[1400px] mx-auto mt-20 pt-10 border-t border-[var(--glass-border)] flex flex-col md:flex-row items-center justify-between gap-8">
         <p className="text-[10px] font-black text-[var(--text-secondary)] uppercase tracking-[0.3em] opacity-40">
            © 2026 Aura Market. Pure Liquid-Glass.
         </p>
         <div className="flex items-center gap-6 opacity-30">
            <Laptop className="size-4" />
            <Smartphone className="size-4" />
            <Settings className="size-4" />
         </div>
      </div>
    </footer>
  );
}
