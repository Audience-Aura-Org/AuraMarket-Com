'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { ArrowUpRight } from 'lucide-react';

const LEGAL_LINKS = [
  { name: 'Privacy', href: '/privacy' },
  { name: 'Terms', href: '/terms' },
  { name: 'Cookies', href: '/cookies' },
  { name: 'Rules', href: '/rules' },
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

  const isChatPage =
    pathname?.startsWith('/messages') ||
    pathname?.startsWith('/chat') ||
    pathname?.startsWith('/admin/messages');
  const isNativeApp = Capacitor.isNativePlatform();

  if (isChatPage) return null;

  return (
    <footer className="w-full border-t border-[var(--glass-border)] bg-[var(--bg-primary)] transition-colors duration-500">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-8 md:py-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Brand + Legal */}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-left"
              aria-label="Auradime home"
            >
              <div className="size-7 rounded-lg bg-black p-1.5 ring-1 ring-white/10">
                <img
                  src="/icon-512.png"
                  alt="Aura Dime"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-[13px] font-bold tracking-tight text-[var(--text-primary)]">
                Aura<span className="text-[var(--accent)]">Dime</span>
              </span>
            </button>

            <span className="hidden h-4 w-px bg-[var(--glass-border)] sm:block" />

            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="text-[11px] font-semibold tracking-wide text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
                >
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>

          {!isNativeApp && (
            <button
              type="button"
              onClick={() => router.push('/onboarding/pwa')}
              className="group inline-flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)]/60 px-3.5 py-1.5 text-[11px] font-semibold text-[var(--text-primary)] transition-all hover:border-[var(--accent)]/50 hover:bg-[var(--bg-secondary)]"
            >
              <span className="size-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
              Install App
              <ArrowUpRight className="size-3 text-[var(--accent)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        {/* Bottom row */}
        <div className="mt-4 flex items-center justify-center border-t border-[var(--glass-border)]/60 pt-3">
          <p className="text-[10px] font-medium tracking-wide text-[var(--text-secondary)] opacity-50">
            &copy; {currentYear} Auradime — auradime.com
          </p>
        </div>
      </div>
    </footer>
  );
}
