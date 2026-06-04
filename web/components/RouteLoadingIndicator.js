'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

const NAVIGATION_START_EVENT = 'aura:navigation-start';

const isModifiedClick = (event) => (
  event.metaKey ||
  event.ctrlKey ||
  event.shiftKey ||
  event.altKey ||
  event.button !== 0
);

const shouldHandleHref = (href) => {
  if (!href) return false;
  return !href.startsWith('#') &&
    !href.startsWith('mailto:') &&
    !href.startsWith('tel:') &&
    !href.startsWith('sms:') &&
    !href.startsWith('blob:') &&
    !href.startsWith('data:');
};

export const startRouteLoading = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NAVIGATION_START_EVENT));
};

export default function RouteLoadingIndicator() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const startedAtRef = useRef(0);
  const hideTimerRef = useRef(null);
  const hardStopTimerRef = useRef(null);

  const start = useCallback(() => {
    window.clearTimeout(hideTimerRef.current);
    window.clearTimeout(hardStopTimerRef.current);
    startedAtRef.current = Date.now();
    setLoading(true);
    hardStopTimerRef.current = window.setTimeout(() => setLoading(false), 7000);
  }, []);

  const stop = useCallback(() => {
    const minimumVisibleMs = 240;
    const elapsed = Date.now() - startedAtRef.current;
    const delay = Math.max(0, minimumVisibleMs - elapsed);

    window.clearTimeout(hardStopTimerRef.current);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setLoading(false), delay);
  }, []);

  useEffect(() => {
    const routeStart = () => start();

    const handleDocumentClick = (event) => {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const anchor = event.target?.closest?.('a[href]');
      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!shouldHandleHref(href)) return;

      let url;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (next !== current) start();
    };

    const startFromHistoryUrl = (url) => {
      if (!url) return false;
      let nextUrl;
      try {
        nextUrl = new URL(String(url), window.location.href);
      } catch {
        return false;
      }

      if (nextUrl.origin !== window.location.origin) return false;

      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const next = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      if (next === current) return false;

      start();
      return true;
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function patchedPushState(...args) {
      const started = startFromHistoryUrl(args[2]);
      const result = originalPushState.apply(this, args);
      if (started) window.setTimeout(stop, 350);
      return result;
    };

    window.history.replaceState = function patchedReplaceState(...args) {
      const started = startFromHistoryUrl(args[2]);
      const result = originalReplaceState.apply(this, args);
      if (started) window.setTimeout(stop, 350);
      return result;
    };

    window.addEventListener(NAVIGATION_START_EVENT, routeStart);
    window.addEventListener('popstate', routeStart);
    document.addEventListener('click', handleDocumentClick, true);

    return () => {
      window.removeEventListener(NAVIGATION_START_EVENT, routeStart);
      window.removeEventListener('popstate', routeStart);
      document.removeEventListener('click', handleDocumentClick, true);
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(hardStopTimerRef.current);
    };
  }, [start, stop]);

  useEffect(() => {
    if (!loading) return;
    stop();
  }, [pathname, loading, stop]);

  if (!loading) return null;

  const isAndroidApp = (() => {
    try {
      return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
    } catch {
      return false;
    }
  })();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[10000] flex justify-center"
      aria-live="polite"
      aria-label="Loading page"
    >
      <div className="absolute inset-x-0 top-0 h-[3px] overflow-hidden bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]">
        <div className="h-full w-1/2 animate-[aura-route-progress_0.85s_ease-in-out_infinite] rounded-r-full bg-[var(--accent)] shadow-[0_0_18px_rgba(var(--accent-rgb),0.45)]" />
      </div>
      <div
        className={[
          'mt-[calc(env(safe-area-inset-top,0px)+10px)] flex items-center gap-2 rounded-full border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-[11px] font-semibold text-[var(--text-primary)] shadow-lg backdrop-blur-xl',
          isAndroidApp ? 'md:hidden' : 'max-md:flex md:hidden',
        ].join(' ')}
      >
        <span className="size-2 rounded-full bg-[var(--accent)] shadow-[0_0_12px_rgba(var(--accent-rgb),0.5)]" />
        Opening
      </div>
    </div>
  );
}
