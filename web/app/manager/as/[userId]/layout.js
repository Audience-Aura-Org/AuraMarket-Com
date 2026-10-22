'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useParams } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';
import WorkingAsStrip from '@/components/manager/shell/WorkingAsStrip';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function WorkspaceLayout({ children }) {
  const { userId } = useParams();
  const setActAs = useManagerMode((s) => s.setActAs);
  const setSwitching = useManagerMode((s) => s.setSwitching);
  const accounts = useManagerMode((s) => s.accounts);
  const account = accounts.find((a) => a.id === userId);

  // Set the act-as header before any embedded page effect fires its requests.
  useIsomorphicLayoutEffect(() => {
    if (userId) {
      setActAs(userId);
      setSwitching(false);
    }
  }, [userId, setActAs, setSwitching]);

  return (
    <div className="flex min-h-screen flex-col">
      <WorkingAsStrip account={account} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
