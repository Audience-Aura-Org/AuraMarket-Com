'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Page state kept in the query string so tabs and filters survive reloads
 * and can be linked to (legacy redirects rely on it).
 * Pages using this must render inside <Suspense> (static export).
 */
export function useUrlState(defaults) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const state = Object.fromEntries(
    Object.entries(defaults).map(([k, d]) => [k, params.get(k) ?? d])
  );

  const setState = useCallback((patch) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === '' || v === defaults[k]) next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, pathname, router]);

  return [state, setState];
}
