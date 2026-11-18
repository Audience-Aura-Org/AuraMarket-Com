'use client';
/**
 * Instant Buy Now switch. Buy Now buttons call `open({ item, quantity, ... })`
 * when `enabled` (admin flag `instant_buy`); with the flag off they keep their
 * old behaviour. One <InstantBuyHost/> in Providers renders the popup.
 */
import { create } from 'zustand';
import { useFeatureFlag } from '@/lib/featureFlags';

export const useInstantBuyStore = create((set) => ({
  request: null, // { item, quantity, variant, selectedOptions, fulfilmentType }
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

export const useInstantBuy = () => {
  const enabled = useFeatureFlag('instant_buy');
  const open = useInstantBuyStore((s) => s.open);
  return { enabled, open };
};
