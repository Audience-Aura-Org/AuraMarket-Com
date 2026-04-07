'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Send, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';

const NAV = [
  {
    label: 'Shop',
    links: [
      { name: 'Discovery Hub', href: '/discovery' },
      { name: 'Collections', href: '/collections' },
      { name: 'Verified Brands', href: '/brands' },
    ],
  },
  {
    label: 'Platform',
    links: [
      { name: 'Global Merchants', href: '/vendors' },
      { name: 'Global Logistics', href: '/logistics' },
      { name: 'Help Hub', href: '/help' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { name: 'Privacy Policy', href: '/privacy' },
      { name: 'Market Rules', href: '/rules' },
      { name: 'Cookie Policy', href: '/cookies' },
    ],
  },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const isDashboard = pathname?.startsWith('/admin') || pathname?.startsWith('/vendor') || pathname?.startsWith('/logistics');
  const isChatPage = pathname?.startsWith('/messages') || pathname?.startsWith('/chat') || pathname?.startsWith('/admin/messages');
  if (isChatPage || isDashboard) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
    setEmail('');
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <footer className="w-full bg-[var(--bg-primary)] border-t border-[var(--glass-border)] relative overflow-hidden transition-colors duration-500">

      {/* Subtle top accent bar */}
      <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[var(--accent)]/40 to-transparent" />

      {/* Main body */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 lg:px-20 py-16">

        {/* ── TOP ROW: Brand left, newsletter right ─────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-0 justify-between mb-16">

          {/* Brand block */}
          <div className="flex flex-col gap-6 max-w-xs">
            <button onClick={() => router.push('/')} className="flex items-center gap-3 group w-fit">
              <div className="size-9 rounded-xl bg-black p-2 ring-1 ring-white/10 group-hover:ring-[var(--accent)]/40 transition-all duration-300 shadow-xl">
                <img src="/logo-white.png" alt="Aura" className="w-full h-full object-contain" />
              </div>
              <div className="text-left leading-none">
                <span className="block text-base font-black uppercase tracking-tighter text-[var(--text-primary)]">
                  Aura<span className="text-[var(--accent)]">Market</span>
                </span>
                <span className="block text-[7px] font-bold tracking-[0.35em] text-[var(--text-secondary)] opacity-40 mt-0.5 uppercase">
                  Definitive Revision
                </span>
              </div>
            </button>
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
              The world's most precise multi-vendor ecosystem. Liquid-glass aesthetics for global commerce.
            </p>
            {/* Trust badges */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <Zap className="size-3" />
                <span className="text-[9px] font-black uppercase tracking-widest">Live</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                <ShieldCheck className="size-3 text-[var(--accent)]" />
                <span className="text-[9px] font-black uppercase tracking-widest">Secured</span>
              </div>
            </div>
          </div>

          {/* Newsletter block */}
          <div className="flex flex-col gap-4 lg:text-right max-w-sm lg:max-w-md w-full">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)] mb-1">Stay in the loop</p>
              <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight leading-tight">
                Early access.<br />Exclusive drops.
              </h3>
            </div>
            {submitted ? (
              <div className="flex items-center gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <ShieldCheck className="size-4 shrink-0" />
                <span className="text-sm font-bold">You're in. Welcome to Aura.</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="flex-1 h-11 rounded-xl bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-4 text-sm font-medium outline-none text-[var(--text-primary)] placeholder:opacity-30 focus:border-[var(--accent)]/50 transition-all min-w-0"
                />
                <button
                  type="submit"
                  className="h-11 px-5 rounded-xl bg-[var(--accent)] text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shrink-0 hover:opacity-90 transition-all shadow-lg shadow-[var(--accent)]/20 active:scale-95"
                >
                  <Send className="size-3.5" />
                  Join
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-[var(--glass-border)] opacity-60 mb-12" />

        {/* ── MAIN NAV LINKS + PWA CTA ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {NAV.map(section => (
            <div key={section.label} className="flex flex-col gap-4">
              <h4 className="text-[9px] font-black uppercase tracking-[0.35em] text-[var(--text-secondary)] opacity-40">
                {section.label}
              </h4>
              <ul className="flex flex-col gap-3">
                {section.links.map(link => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hover:translate-x-0.5 inline-block"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* PWA CTA column */}
          <div
            onClick={() => router.push('/onboarding/pwa')}
            className="flex flex-col justify-between p-5 rounded-2xl border border-[var(--glass-border)] hover:border-[var(--accent)]/40 bg-[var(--bg-secondary)]/50 backdrop-blur cursor-pointer group transition-all duration-300 relative overflow-hidden col-span-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="size-10 rounded-xl bg-black p-2 ring-1 ring-white/10 mb-4 group-hover:ring-[var(--accent)]/30 transition-all">
                <img src="/logo-white.png" alt="Aura" className="w-full h-full object-contain" />
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[var(--accent)] mb-1">Install App</p>
              <h5 className="text-sm font-black text-[var(--text-primary)] leading-tight">
                Aura on your homescreen
              </h5>
              <p className="text-[10px] text-[var(--text-secondary)] opacity-50 mt-1 leading-snug">
                Fast. Offline-ready. Native feel.
              </p>
            </div>
            <div className="relative z-10 mt-4 flex items-center gap-1 text-[var(--accent)] text-[10px] font-black uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
              Get the app <ArrowUpRight className="size-3" />
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-[var(--glass-border)]">
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
            © {currentYear} Aura Global. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest">
            <Link href="/privacy" className="hover:opacity-100 transition-opacity">Privacy</Link>
            <Link href="/terms" className="hover:opacity-100 transition-opacity">Terms</Link>
            <Link href="/logistics" className="hover:opacity-100 transition-opacity">Logistics</Link>
            <span className="px-2 py-0.5 rounded-full border border-[var(--glass-border)] text-[var(--accent)] opacity-100 not-italic">v4.0</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
