"use client";

import { ArrowLeft, Power } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/hooks/useAuth';

export default function AccountHeader({ title = "Account Settings" }) {
  const router = useRouter();
  const { logout } = useAuthStore();

  return (
    <div className="sticky top-0 lg:top-0 max-lg:top-14 z-50 border-b border-[var(--glass-border)] backdrop-blur-2xl bg-[var(--bg-primary)]/80">
      <div className="max-w-[90%] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-[var(--bg-secondary)]/50 rounded-[1.5rem] transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg  font-bold tracking-tight">{title}</h1>
        </div>
        <button onClick={() => { logout(); router.push('/login'); }} className="p-2 hover:bg-rose-500/10 text-rose-500 rounded-[1.5rem] transition-colors">
          <Power className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
