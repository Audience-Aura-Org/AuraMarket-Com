'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';
import { ArrowLeft, Shield } from 'lucide-react';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const ROLE_BANNER = {
  vendor:    { border: 'border-pink-500/20', bg: 'bg-pink-500/6',    text: 'text-pink-400',   accent: 'text-pink-300' },
  logistics: { border: 'border-purple-500/20', bg: 'bg-purple-500/6', text: 'text-purple-400', accent: 'text-purple-300' },
  customer:  { border: 'border-teal-500/20', bg: 'bg-teal-500/6',    text: 'text-teal-400',   accent: 'text-teal-300' },
};

export default function WorkspaceLayout({ children }) {
  const { userId } = useParams();
  const router = useRouter();
  const setActAs = useManagerMode((s) => s.setActAs);
  const setSwitching = useManagerMode((s) => s.setSwitching);
  const accounts = useManagerMode((s) => s.accounts);
  const account = accounts.find((a) => a.id === userId);

  useIsomorphicLayoutEffect(() => {
    if (userId) {
      setActAs(userId);
      setSwitching(false);
    }
  }, [userId, setActAs, setSwitching]);

  const colors = ROLE_BANNER[account?.role] || ROLE_BANNER.customer;

  return (
    <div>
      {/* Workspace identity banner */}
      <div className={`mx-3 md:mx-4 lg:mx-6 mt-3 md:mt-4 px-3 md:px-4 py-2 md:py-2.5 rounded-xl ${colors.bg} border ${colors.border} flex items-center gap-2 md:gap-3`}>
        <Shield className={`size-3.5 md:size-4 ${colors.text} shrink-0`} />
        <span className={`flex-1 min-w-0 ${colors.text} text-[11px] md:text-[12px] font-medium truncate`}>
          <span className="hidden sm:inline">Working as </span>
          <strong className={`${colors.accent} font-semibold`}>{account?.name || 'User'}</strong>
          {account?.role && (
            <span className="ml-1 opacity-60 capitalize">({account.role})</span>
          )}
          <span className="hidden md:inline ml-1.5 opacity-40">— changes recorded</span>
        </span>
        <button
          onClick={() => router.push('/manager')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] md:text-[11px] font-semibold ${colors.text} hover:bg-white/5 active:bg-white/10 transition-colors shrink-0`}
        >
          <ArrowLeft className="size-3" />
          <span className="hidden sm:inline">Back</span>
        </button>
      </div>
      {children}
    </div>
  );
}
