'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Send, ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';

const NAV = [
  {
    label: 'Shop',
    links: [
      { name: 'Discovery Hub',    href: '/discovery' },
      { name: 'Collections',      href: '/shop' },
      { name: 'Verified Brands',  href: '/brands' },
      { name: 'Signature Drops',  href: '/signature-drops' },
    ],
  },
  {
    label: 'Platform',
    links: [
      { name: 'Global Merchants', href: '/vendors' },
      { name: 'Global Logistics', href: '/logistics' },
      { name: 'Support Hub',      href: '/help' },
      { name: 'Network Status',   href: '/api-status' },
    ],
  },
  {
    label: 'Legal',
    links: [
      { name: 'Privacy Policy',   href: '/privacy' },
      { name: 'Market Rules',     href: '/terms' },
      { name: 'Cookie Policy',    href: '/cookies' },
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

  const isChatPage = pathname?.startsWith('/messages') || pathname?.startsWith('/chat') || pathname?.startsWith('/admin/messages');
  if (isChatPage) return null;

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
      <div className="max-w-full mx-auto px-4 md:px-6 lg:px-8 xl:px-20 py-12 md:py-16 w-full">

        {/* ── TOP ROW: Brand left, newsletter right ─────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-8 md:gap-12 lg:gap-0 justify-between mb-16">

          {/* Brand block */}
          <div className="flex flex-col gap-4 md:gap-6 w-full md:max-w-xs">
            <button onClick={() => router.push('/')} className="flex items-center gap-3 group w-fit">
              <div className="size-8 md:size-9 rounded-xl bg-black p-2 ring-1 ring-white/10 group-hover:ring-[var(--accent)]/40 transition-all duration-300 shadow-xl">
                <img src="/logo-white.png" alt="Aura" className="w-full h-full object-contain" />
              </div>
              <div className="text-left leading-none">
                <span className="block text-sm md:text-base font-black uppercase tracking-tighter text-[var(--text-primary)]">
                  Aura<span className="text-[var(--accent)]">Market</span>
                </span>
                <span className="hidden md:block text-[6px] md:text-[7px] font-bold tracking-[0.35em] text-[var(--text-secondary)] opacity-40 mt-0.5 uppercase">
                  Definitive Revision
                </span>
              </div>
            </button>
            {/* Description — hidden on mobile */}
            <p className="hidden md:block text-[12px] md:text-[13px] text-[var(--text-secondary)] leading-relaxed">
              The world's most precise multi-vendor ecosystem. Liquid-glass aesthetics for global commerce.
            </p>
            {/* Trust badges — hidden on mobile */}
            <div className="hidden md:flex items-center gap-2 md:gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                <Zap className="size-3" />
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Live</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] text-[var(--text-secondary)]">
                <ShieldCheck className="size-3 text-[var(--accent)]" />
                <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">Secured</span>
              </div>
            </div>
          </div>

          {/* Newsletter block — hidden on mobile */}
          <div className="hidden md:flex flex-col gap-3 md:gap-4 w-full md:max-w-sm lg:max-w-md lg:text-right">
            <div>
              <p className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-[var(--accent)] mb-2 md:mb-1">Stay in the loop</p>
              <h3 className="text-xl md:text-2xl font-black text-[var(--text-primary)] tracking-tight leading-tight">
                Early access.<br />Exclusive drops.
              </h3>
            </div>
            {submitted ? (
              <div className="flex items-center gap-2 p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-center md:text-right justify-center md:justify-end">
                <ShieldCheck className="size-4 shrink-0" />
                <span className="text-xs md:text-sm font-bold uppercase tracking-widest">Aura Secured</span>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-2 relative">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="h-12 rounded-full bg-[var(--bg-secondary)] border border-[var(--glass-border)] px-6 text-xs md:text-sm font-medium outline-none text-[var(--text-primary)] placeholder:opacity-30 focus:border-[var(--accent)]/50 transition-all min-w-0 flex-1"
                />
                <button
                  type="submit"
                  className="h-10 md:h-12 px-6 md:px-8 rounded-full bg-[var(--accent)] text-white font-black text-[9px] md:text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shrink-0 hover:opacity-90 transition-all shadow-lg shadow-[var(--accent)]/20 active:scale-95 whitespace-nowrap"
                >
                  <Send className="size-3 md:size-3.5" />
                  <span>Join Ecosystem</span>
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-full h-px bg-[var(--glass-border)] opacity-60 mb-12" />

        {/* ── MAIN NAV LINKS + PWA CTA ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8 mb-12">
          {NAV.map(section => (
            <div key={section.label} className="flex flex-col gap-3">
              <h4 className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.35em] text-[var(--text-secondary)] opacity-40">
                {section.label}
              </h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                {section.links.map(link => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-[11px] md:text-[13px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hover:translate-x-0.5 inline-block"
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
            className="flex flex-col justify-between p-4 md:p-5 rounded-xl md:rounded-2xl border border-[var(--glass-border)] hover:border-[var(--accent)]/40 bg-[var(--bg-secondary)]/50 backdrop-blur cursor-pointer group transition-all duration-300 relative overflow-hidden col-span-1"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <div className="size-8 md:size-10 rounded-lg md:rounded-xl bg-black p-2 ring-1 ring-white/10 mb-3 md:mb-4 group-hover:ring-[var(--accent)]/30 transition-all">
                <img src="/logo-white.png" alt="Aura" className="w-full h-full object-contain" />
              </div>
              <p className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] text-[var(--accent)] mb-1">Install App</p>
              <h5 className="text-xs md:text-sm font-black text-[var(--text-primary)] leading-tight">
                Aura on your homescreen
              </h5>
              <p className="text-[9px] md:text-[10px] text-[var(--text-secondary)] opacity-50 mt-1 leading-snug">
                Fast. Offline-ready. Native feel.
              </p>
            </div>
            <div className="relative z-10 mt-3 md:mt-4 flex items-center gap-1 text-[var(--accent)] text-[8px] md:text-[10px] font-black uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
              Get the app <ArrowUpRight className="size-3" />
            </div>
          </div>
        </div>

        {/* ── BOTTOM BAR ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 md:gap-4 sm:flex-row items-center justify-between pt-6 md:pt-8 border-t border-[var(--glass-border)]">
          <p className="text-[8px] md:text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest text-center sm:text-left order-2 sm:order-1">
            © {currentYear} Aura Global. All rights reserved.
          </p>
          <div className="flex items-center gap-3 md:gap-6 text-[8px] md:text-[10px] font-semibold text-[var(--text-secondary)] opacity-40 uppercase tracking-widest order-1 sm:order-2 flex-wrap justify-center sm:justify-end">
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
