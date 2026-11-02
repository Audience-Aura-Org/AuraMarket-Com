'use client';
import { detectCameroonNetwork } from '@/services/paymentProvider';

const LOGOS = {
  mtn: { src: '/payments/mtn-momo.svg', alt: 'MTN Mobile Money' },
  orange: { src: '/payments/orange-money.svg', alt: 'Orange Money' },
};

/**
 * MTN or Orange logo that pops in at the right edge of a phone field once the number's
 * first digits name the network. Place it inside a `relative` wrapper and give the input
 * right padding (pr-14).
 */
export default function NetworkLogo({ phone }) {
  const network = detectCameroonNetwork(phone);
  if (!network) return null;
  const { src, alt } = LOGOS[network];
  return (
    // key remounts the image so the pop plays again when the network changes
    <img key={network} src={src} alt={alt} title={alt} width={32} height={32}
      className="network-logo pointer-events-none absolute right-2.5 top-1/2 size-8 -translate-y-1/2 rounded-lg shadow-sm" />
  );
}
