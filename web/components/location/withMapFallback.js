'use client';
/**
 * A map that uses Google Maps when a key is set, and the free MapLibre map when
 * there is no key or Google refuses it (API not enabled, billing off, wrong domain).
 * The switch happens on the spot, without Google's grey error box, and holds for the
 * rest of the session. Both versions take the same props and load only when shown.
 *
 *   const LiveMap = withMapFallback(() => import('./google/GoogleLiveMap'), () => import('./LiveMap'), Loading)
 */
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { googleMapsFailed, onGoogleMapsFailure, useGoogleMaps } from '@/lib/googleMaps';

export default function withMapFallback(loadGoogle, loadFree, Loading = () => null) {
  const Google = dynamic(loadGoogle, { ssr: false, loading: Loading });
  const Free = dynamic(loadFree, { ssr: false, loading: Loading });
  return function MapWithFallback(props) {
    const [broken, setBroken] = useState(() => googleMapsFailed());
    useEffect(() => onGoogleMapsFailure(() => setBroken(true)), []);
    return useGoogleMaps && !broken ? <Google {...props} /> : <Free {...props} />;
  };
}
