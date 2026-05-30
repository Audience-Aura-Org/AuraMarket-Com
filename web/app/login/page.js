"use client";

import UnifiedAuth from '@/components/auth/UnifiedAuth';

export default function LoginPage() {
  return (
    <div className="bg-[var(--bg-secondary)] text-[var(--text-primary)] min-h-screen relative overflow-x-hidden flex flex-col transition-colors duration-500">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 -z-10 bg-[var(--bg-secondary)] opacity-10 pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent-light)]/10" />
      </div>
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--accent)]/10 rounded-full blur-[120px] -z-10 animation-delay-2000 pointer-events-none"></div>

      {/* Unified Auth Hub */}
      <main className="flex-1 flex items-center justify-center p-6 relative z-10">
        <UnifiedAuth />
      </main>
    </div>
  );
}
