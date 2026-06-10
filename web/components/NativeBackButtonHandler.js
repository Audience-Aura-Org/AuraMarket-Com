'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const ROOT_PATHS = new Set(['/', '/login', '/overtime', '/shop']);

export default function NativeBackButtonHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;

    let listener;
    let cancelled = false;

    const attach = async () => {
      listener = await App.addListener('backButton', ({ canGoBack }) => {
        const normalizedPath = pathname?.replace(/\/+$/, '') || '/';

        if (window.history.length > 1 || canGoBack) {
          router.back();
          return;
        }

        if (!ROOT_PATHS.has(normalizedPath)) {
          router.replace('/overtime');
          return;
        }

        App.exitApp();
      });

      if (cancelled && listener) {
        listener.remove();
      }
    };

    attach();

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [pathname, router]);

  return null;
}
