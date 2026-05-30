"use client";

import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AccountHeader({ title = "Account Settings" }) {
  const router = useRouter();

  return (
    <div className="sticky top-0 lg:top-0 max-lg:top-14 z-50 border-b border-[var(--glass-border)] backdrop-blur-2xl bg-[var(--bg-primary)]/80">
      <div className="max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-[var(--bg-secondary)]/50 rounded-[1.5rem] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg  font-bold tracking-tight">{title}</h1>
        </div>
        <div className="w-9" />
      </div>
    </div>
  );
}
