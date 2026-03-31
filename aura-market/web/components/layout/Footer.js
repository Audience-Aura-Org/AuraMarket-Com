'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Smartphone, Sparkles, MonitorSmartphone } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] py-20 px-8 transition-colors duration-500">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-16 mb-20">
          
          {/* Logo & Vision */}
          <div className="flex flex-col gap-6 md:col-span-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center p-2 shadow-2xl">
                 <img src="/logo-white.png" alt="Aura Logo" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tighter text-[var(--text-primary)]">Aura Market</h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-xs opacity-60">
              The premium multi-vendor ecosystem defining the future of commerce through liquid-glass aesthetics.
            </p>
          </div>

          {/* Discovery */}
          <div className="flex flex-col gap-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)] opacity-40">Discovery Hub</h3>
            <ul className="flex flex-col gap-4 text-sm font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--accent)] transition-all">Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--accent)] transition-all">Collections</Link></li>
              <li><Link href="/brands" className="hover:text-[var(--accent)] transition-all">Verified Brands</Link></li>
              {/* NEW AURA APP PORTAL INTEGRATED NATIVELY */}
              <li>
                 <Link href="/onboarding/pwa" className="flex items-center gap-2 group text-[var(--accent)]">
                    Get the Aura App <Smartphone className="size-3.5 group-hover:scale-110 transition-transform" />
                 </Link>
              </li>
            </ul>
          </div>

          {/* Infrastructure */}
          <div className="flex flex-col gap-6">
             <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)] opacity-40">Systems</h3>
             <ul className="flex flex-col gap-4 text-sm font-bold text-[var(--text-secondary)]">
                <li><Link href="/logistics" className="hover:text-emerald-500 transition-all">Logistics Control</Link></li>
                <li><Link href="/api-status" className="hover:text-indigo-500 transition-all">API Services</Link></li>
                <li><Link href="/compliance" className="hover:text-rose-500 transition-all">Compliance Node</Link></li>
                <li className="opacity-30 italic text-[10px] uppercase tracking-widest pt-2">Android App Launching Soon 🚀</li>
             </ul>
          </div>

          {/* Security */}
          <div className="flex flex-col gap-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-[var(--text-primary)] opacity-40">Secure Hub</h3>
            <div className="flex items-center gap-2 text-emerald-500 px-4 py-3 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 w-fit">
               <Shield className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">End-to-End Encryption Active</span>
            </div>
          </div>

        </div>

        {/* Global Stats Footer Line */}
        <div className="border-t border-[var(--glass-border)] pt-10 flex flex-col md:flex-row items-center justify-between text-[var(--text-secondary)] gap-8 opacity-40">
          <p className="text-[10px] font-black uppercase tracking-[0.3em]">
            © {currentYear} Aura Market. Designed for Excellence.
          </p>
          <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest">
             <div className="flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               Network Status: Optimal
             </div>
             <div className="flex items-center gap-2">
                Server: EU-West-Node
             </div>
             <div className="flex items-center gap-2">
                <MonitorSmartphone className="size-3.5" /> STANDALONE SUPPORT
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
