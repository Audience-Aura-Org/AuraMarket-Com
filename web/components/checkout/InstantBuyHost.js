'use client';
import dynamic from 'next/dynamic';
import { useInstantBuyStore } from '@/hooks/useInstantBuy';

// Loaded only when someone taps Buy Now, so product pages stay light.
const InstantBuySheet = dynamic(() => import('./InstantBuySheet'), { ssr: false });

export default function InstantBuyHost() {
  const request = useInstantBuyStore((s) => s.request);
  const close = useInstantBuyStore((s) => s.close);
  if (!request) return null;
  return <InstantBuySheet open {...request} onClose={close} />;
}
