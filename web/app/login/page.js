"use client";

import UnifiedAuth from '@/components/auth/UnifiedAuth';
import { useLanguage } from '@/context/LanguageContext';

export default function LoginPage() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="bg-[var(--bg-secondary)] text-[var(--text-primary)] min-h-screen relative overflow-x-hidden flex flex-col transition-colors duration-500">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 -z-10 bg-[var(--bg-secondary)] opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent-light)]/10" />
      </div>
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] -z-10 animation-delay-2000 pointer-events-none"></div>

      <div className="fixed right-4 top-[calc(0.75rem+env(safe-area-inset-top,0px))] z-30 inline-flex rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] p-1 text-[10px] font-bold shadow-lg backdrop-blur-xl">
        {['en', 'fr'].map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className={`rounded-full px-2.5 py-1 transition ${
              language === code
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            aria-label={code === 'en' ? 'Use English' : 'Utiliser le français'}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Unified Auth Hub */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <div className="flex w-full flex-col items-center gap-6">
          <div className="flex w-full max-w-[420px] justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="size-16 shrink-0 rounded-full bg-black p-2 shadow-2xl ring-1 ring-white/10 overflow-hidden">
                <img src="/icon-512.png" alt="Aura Dime" className="h-full w-full rounded-full object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  Aura<span className="text-[var(--accent)]">Dime</span>
                </h1>
                <p className="text-[11px] font-semibold tracking-tight text-[var(--text-secondary)] opacity-60">
                  {t('login.tagline')}
                </p>
              </div>
            </div>
          </div>
          <UnifiedAuth />
        </div>
      </main>
    </div>
  );
}
