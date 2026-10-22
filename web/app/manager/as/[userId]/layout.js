'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useParams } from 'next/navigation';
import { useManagerMode } from '@/hooks/useManagerMode';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export default function WorkspaceLayout({ children }) {
  const { userId } = useParams();
  const setActAs = useManagerMode((s) => s.setActAs);
  const setSwitching = useManagerMode((s) => s.setSwitching);

  // Set the act-as header before any embedded page effect fires its requests.
  useIsomorphicLayoutEffect(() => {
    if (userId) {
      setActAs(userId);
      setSwitching(false);
    }
  }, [userId, setActAs, setSwitching]);

  return <>{children}</>;
}
