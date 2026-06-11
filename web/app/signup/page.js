"use client";

import UnifiedAuth from '@/components/auth/UnifiedAuth';
import AuthLanguageHeader from '@/components/auth/AuthLanguageHeader';

export default function SignupPage() {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-x-hidden bg-[var(--bg-secondary)] text-[var(--text-primary)] transition-colors duration-500">
      <div className="fixed inset-0 -z-10 bg-[var(--bg-secondary)] opacity-10 pointer-events-none">
        <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent-light)]/10" />
      </div>
      <div className="fixed left-[-10%] top-[-10%] -z-10 size-[40%] animate-pulse rounded-full bg-[var(--accent)]/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] -z-10 size-[40%] rounded-full bg-[var(--accent)]/10 blur-[120px] animation-delay-2000 pointer-events-none" />

      <AuthLanguageHeader />

      <div className="h-[calc(4.5rem+env(safe-area-inset-top,0px))] shrink-0" aria-hidden="true" />

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-6 pt-2">
        <div className="flex w-full flex-col items-center gap-6">
          <UnifiedAuth signupOnly />
        </div>
      </main>
    </div>
  );
}
