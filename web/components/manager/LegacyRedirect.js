'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SkeletonRows } from '@/components/manager/ui';

/** Client-side redirect for retired manager URLs (static export has no server redirects). */
export default function LegacyRedirect({ to }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(to);
  }, [router, to]);
  return <SkeletonRows rows={4} />;
}
