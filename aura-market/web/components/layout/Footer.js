'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Smartphone, Sparkles, MonitorSmartphone, ShieldCheck, Send, Globe, Zap, Scale, Cpu, Activity, Fingerprint } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isChatPage = pathname?.startsWith('/messages') || pathname?.startsWith('/chat') || pathname?.startsWith('/admin/messages');
  if (isChatPage) return null;

  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] pt-12 pb-8 px-4 sm:px-6 md:px-10 lg:px-16 transition-colors duration-500 relative z-10 overflow-hidden">
      
      {/* Background ambience */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[300px] bg-[var(--accent)]/[0.03] blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[200px] bg-indigo-500/[0.03] blur-[100px] rounded-full pointer-events-none" />

      <div className="max-w-[1400px] mx-auto relative z-10">

        {/* ── TOP: Branding + Newsletter ─────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8 mb-10">

          {/* Brand */}
          <div className="flex flex-col gap-4 max-w-sm">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => router.push('/')}>
              <div className="size-9 rounded-xl bg-black flex items-center justify-center p-2 shadow-xl ring-1 ring-white/10 group-hover:rotate-6 transition-all duration-500">
                <img src="/logo-white.png" alt="Aura" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_var(--accent)]" />
              </div>
              <div className="flex flex-col leading-none">
                <h2 className="text-base font-black uppercase tracking-tighter text-[var(--text-primary)]">
                  Aura<span className="text-[var(--accent)]">Market</span>
                </h2>
                <span className="text-[7px] font-black tracking-[0.35em] text-[var(--accent)] opacity-60 mt-0.5">DEFINITIVE REVISION</span>
              </div>
            </div>
            <p className="text-xs text-[var(--text-secondary)] opacity-60 font-medium leading-relaxed">
              The world's most precise multi-vendor ecosystem.<br className="hidden sm:block" /> Bringing liquid-glass aesthetics to global commerce.
            </p>
          </div>

          {/* Newsletter */}
          <div className="w-full lg:w-[360px]">
            <div className="p-4 rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/40 backdrop-blur-xl hover:border-[var(--accent)]/20 transition-all duration-500">
              <p className="text-[9px] font-black text-[var(--text-primary)] mb-3 tracking-widest uppercase flex items-center gap-2">
                <Sparkles className="size-3 text-[var(--accent)]" />
                Secure Access Hub
              </p>
              <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
                <input
                  type="email"
                  placeholder="secured-identity@aura.io"
                  className="flex-1 h-10 rounded-xl bg-[var(--bg-primary)] border border-[var(--glass-border)] px-3 text-xs font-bold outline-none text-[var(--text-primary)] placeholder:opacity-30 focus:border-[var(--accent)]/50 transition-all min-w-0"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button className="h-10 px-4 rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-all shadow-lg shadow-[var(--accent)]/20 flex items-center justify-center shrink-0">
                  <Send className="size-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-[var(--glass-border)] to-transparent opacity-40 mb-10" />

        {/* ── MAIN GRID: 4 equal columns ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 items-start">

          {/* Column 1: Core Nodes */}
          <div className="flex flex-col gap-5">
            <h3 className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.35em] text-[var(--text-primary)] opacity-40">
              <Cpu className="size-3 shrink-0" /> Core Nodes
            </h3>
            <ul className="flex flex-col gap-4 text-[12px] font-bold text-[var(--text-secondary)]">
              <li><Link href="/discovery" className="hover:text-[var(--accent)] transition-colors flex items-center gap-2 group"><div className="size-1 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all shrink-0" />Hub Experience</Link></li>
              <li><Link href="/shop" className="hover:text-[var(--accent)] transition-colors flex items-center gap-2 group"><div className="size-1 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all shrink-0" />Collections</Link></li>
              <li><Link href="/brands" className="hover:text-[var(--accent)] transition-colors flex items-center gap-2 group"><div className="size-1 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all shrink-0" />Verified Brands</Link></li>
              <li><Link href="/search" className="hover:text-[var(--accent)] transition-colors flex items-center gap-2 group"><div className="size-1 rounded-full bg-[var(--accent)] opacity-0 group-hover:opacity-100 transition-all shrink-0" />Signature Drops</Link></li>
            </ul>
          </div>

          {/* Column 2: Protocols */}
          <div className="flex flex-col gap-5">
            <h3 className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.35em] text-[var(--text-primary)] opacity-40">
              <Fingerprint className="size-3 shrink-0" /> Protocols
            </h3>
            <ul className="flex flex-col gap-4 text-[12px] font-bold text-[var(--text-secondary)]">
              <li>
                <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center opacity-50 shrink-0"><ShieldCheck className="size-3" /></div>
                  Privacy Node
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-[var(--bg-secondary)] border border-[var(--glass-border)] flex items-center justify-center opacity-50 shrink-0"><Scale className="size-3" /></div>
                  Market Rules
                </Link>
              </li>
              <li>
                <Link href="/logistics" className="hover:text-emerald-500 transition-colors flex items-center gap-2.5">
                  <div className="size-7 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0"><Zap className="size-3" /></div>
                  Global Logistics
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Global Grid */}
          <div className="flex flex-col gap-5">
            <h3 className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.35em] text-[var(--text-primary)] opacity-40">
              <Globe className="size-3 shrink-0" /> Global Grid
            </h3>
            <ul className="flex flex-col gap-4 text-[12px] font-bold text-[var(--text-secondary)]">
              <li><Link href="/vendors" className="hover:text-[var(--text-primary)] transition-colors">Global Merchants</Link></li>
              <li><Link href="/api-status" className="hover:text-[var(--text-primary)] transition-colors">Network Status</Link></li>
              <li><Link href="/help" className="hover:text-[var(--text-primary)] transition-colors">Support Hub</Link></li>
              <li className="flex items-center gap-2 pt-1">
                <span className="px-2.5 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] text-[8px] font-black uppercase tracking-widest border border-[var(--accent)]/20">Aura v4.0</span>
                <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </li>
            </ul>
          </div>

          {/* Column 4: PWA Card */}
          <div
            className="flex flex-col border border-[var(--glass-border)] bg-[var(--bg-secondary)]/30 backdrop-blur-xl rounded-3xl p-5 relative overflow-hidden group hover:border-[var(--accent)]/40 transition-all duration-500 cursor-pointer shadow-lg col-span-1"
            onClick={() => router.push('/onboarding/pwa')}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-[var(--accent)]/10 blur-[30px] rounded-full group-hover:bg-[var(--accent)]/20 transition-all duration-700 pointer-events-none" />
            <div className="relative z-10 flex flex-col justify-between gap-6 h-full">
              <div className="size-11 rounded-xl bg-black border border-white/5 flex items-center justify-center text-[var(--accent)] shadow-xl group-hover:scale-110 transition-transform duration-500 ring-1 ring-[var(--accent)]/20 shrink-0">
                <Smartphone className="size-5" />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[8px] font-black uppercase tracking-[0.35em] text-[var(--accent)]">Standalone</span>
                <h4 className="text-[13px] font-black text-[var(--text-primary)] leading-tight tracking-tight uppercase">
                  Install Aura<br />App
                </h4>
                <p className="text-[10px] text-[var(--text-secondary)] opacity-50 font-medium leading-snug mt-0.5">
                  Native performance.<br />Zero-latency access.
                </p>
              </div>
            </div>
            <div className="absolute bottom-3 right-4 text-[var(--accent)] opacity-10 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none">
              <MonitorSmartphone className="size-12" />
            </div>
          </div>

        </div>

        {/* ── BOTTOM BAR ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-[var(--glass-border)] gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-2 bg-[var(--bg-secondary)] px-3 py-1.5 rounded-xl border border-[var(--glass-border)] shadow-sm">
              <ShieldCheck className="size-3.5 text-[var(--accent)]" />
              <span className="text-[9px] font-black uppercase tracking-[0.25em] text-[var(--text-primary)]">Secured via Aura Shield™</span>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.35em] opacity-30 text-[var(--text-secondary)]">
              © {currentYear} Aura Global. All Rights Reserved.
            </p>
          </div>
          <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-[0.4em] opacity-40 text-[var(--text-secondary)]">
            <Link href="/privacy" className="hover:opacity-100 transition-opacity">Privacy</Link>
            <Link href="/terms" className="hover:opacity-100 transition-opacity">Terms</Link>
            <Link href="/logistics" className="hover:opacity-100 transition-opacity">Logistics</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
