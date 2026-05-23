'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { ArrowUpRight, ShieldCheck, Zap } from 'lucide-react';

const LEGAL_LINKS = [
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms of Service', href: '/terms' },
  { name: 'Cookie Policy', href: '/cookies' },
  { name: 'Market Rules', href: '/rules' },
];

export default function Footer() {
  const currentYear = new Date().getFullYear();
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const isChatPage = pathname?.startsWith('/messages') ||
    pathname?.startsWith('/chat') ||
    pathname?.startsWith('/admin/messages');

  if (isChatPage) return null;

  return (
    <footer className="w-full border-t border-[var(--glass-border)] bg-[var(--bg-primary)] transition-colors duration-500">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(220px,360px)] md:items-start">
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex w-fit items-center gap-3 text-left"
            >
              <div className="size-9 rounded-xl bg-black p-2 ring-1 ring-white/10">
                <img src="/icon-512.png" alt="Auradime" className="h-full w-full object-contain" />
              </div>
              <div className="leading-none">
                <span className="block text-base font-bold tracking-tight text-[var(--text-primary)]">
                  Aura<span className="text-[var(--accent)]">dime</span>
                </span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-45">
                  Install and legal
                </span>
              </div>
            </button>

            <p className="max-w-xl text-[12px] leading-relaxed text-[var(--text-secondary)] md:text-[13px]">
              Install Auradime for faster access, then review the legal pages that govern the marketplace.
            </p>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-emerald-500">
                <Zap className="size-3" />
                <span className="text-[11px] font-semibold">Live</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-[var(--text-secondary)]">
                <ShieldCheck className="size-3 text-[var(--accent)]" />
                <span className="text-[11px] font-semibold">Secured</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-4">
              <h4 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)] opacity-50">
                Legal Pages
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {LEGAL_LINKS.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="text-[11px] font-semibold text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] md:text-[12px]"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/onboarding/pwa')}
              className="group rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/45 p-4 text-left transition-colors hover:border-[var(--accent)]/40"
            >
              <div className="mb-3 size-10 rounded-xl bg-black p-2 ring-1 ring-white/10">
                <img src="/icon-512.png" alt="Auradime" className="h-full w-full object-contain" />
              </div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                Install App
              </p>
              <h5 className="text-sm font-bold text-[var(--text-primary)]">Auradime on your homescreen</h5>
              <p className="mt-1 text-[11px] leading-snug text-[var(--text-secondary)] opacity-60">
                Fast access, native feel, ready when you are.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent)]">
                Get the app <ArrowUpRight className="size-3" />
              </span>
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-[var(--glass-border)] pt-5 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-[10px] font-semibold text-[var(--text-secondary)] opacity-45">
            &copy; {currentYear} Auradime Global. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-[10px] font-semibold text-[var(--text-secondary)] opacity-50 sm:justify-end">
            <Link href="/privacy" className="hover:opacity-100">Privacy</Link>
            <Link href="/terms" className="hover:opacity-100">Terms</Link>
            <Link href="/cookies" className="hover:opacity-100">Cookies</Link>
            <span className="rounded-full border border-[var(--glass-border)] px-2 py-0.5 text-[var(--accent)] opacity-100">
              v4.0
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
