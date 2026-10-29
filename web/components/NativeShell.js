'use client';
/**
 * Android app chrome: status bar colour, hiding the launch splash once the first
 * screen has painted, and an offline bar. Renders nothing in browsers.
 * (Browser behaviours such as text selection and overscroll are switched off in
 * CSS under html.native-app, set before first paint in app/layout.js.)
 */
import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { WifiOff } from 'lucide-react';

export default function NativeShell() {
  const [native, setNative] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    setNative(true);
    document.documentElement.classList.add('native-app');

    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#0a050a' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    }).catch(() => {});

    // Hide the splash after the first screen has painted (two frames), with a
    // safety net so a slow page never keeps the logo up.
    let hidden = false;
    const hide = () => {
      if (hidden) return;
      hidden = true;
      import('@capacitor/splash-screen').then(({ SplashScreen }) => SplashScreen.hide({ fadeOutDuration: 200 })).catch(() => {});
    };
    requestAnimationFrame(() => requestAnimationFrame(hide));
    const safety = setTimeout(hide, 4000);

    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      clearTimeout(safety);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!native || !offline) return null;
  return (
    <div role="status" className="fixed inset-x-0 top-0 z-[200] flex items-center justify-center gap-2 bg-[#0a050a] px-4 py-2 text-[12px] font-semibold text-white" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
      <WifiOff className="size-4" /> No internet connection. Some content may be out of date.
    </div>
  );
}
