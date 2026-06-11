"use client";

import { useLanguage } from '@/context/LanguageContext';

export default function AuthLanguageHeader() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="fixed inset-x-0 top-0 z-[5000] w-full border-b border-[var(--glass-border)] bg-[color-mix(in_srgb,var(--bg-primary)_96%,transparent)] px-4 pb-2.5 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] shadow-[0_12px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="size-10 shrink-0 overflow-hidden rounded-full bg-black p-1.5 shadow-lg ring-1 ring-white/10">
            <img src="/icon-512.png" alt="Aura Dime" className="size-full rounded-full object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-[var(--text-primary)]">
              Aura<span className="text-[var(--accent)]">Dime</span>
            </p>
            <p className="truncate text-[10px] font-semibold leading-tight text-[var(--text-secondary)] opacity-60">
              {t('login.tagline')}
            </p>
          </div>
        </div>

        <div className="inline-flex shrink-0 rounded-full border border-[var(--glass-border)] bg-[var(--bg-secondary)] p-1 text-[10px] font-bold shadow-lg ring-1 ring-black/5 sm:text-[11px]">
          {[
            { code: 'en', short: 'EN', full: 'English' },
            { code: 'fr', short: 'FR', full: 'French' },
          ].map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setLanguage(item.code, { reload: true })}
              aria-pressed={language === item.code}
              className={`min-w-10 rounded-full px-2.5 py-1.5 transition sm:min-w-[76px] sm:px-3 ${
                language === item.code
                  ? 'bg-[var(--accent)] text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              aria-label={item.code === 'en' ? 'Use English' : 'Utiliser le francais'}
            >
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.full}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
