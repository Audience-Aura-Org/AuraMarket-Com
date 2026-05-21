'use client';

import { useEffect } from 'react';

const isIOSStandalone = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  return isiOS && standalone;
};

const recoverViewport = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const active = document.activeElement;
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) && typeof active.blur === 'function') {
    active.blur();
  }

  const root = document.documentElement;
  root.classList.add('ios-keyboard-recovering');

  const settle = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.style.transform = 'translateZ(0)';
    requestAnimationFrame(() => {
      document.body.style.transform = '';
      root.classList.remove('ios-keyboard-recovering');
    });
  };

  requestAnimationFrame(settle);
  setTimeout(settle, 180);
  setTimeout(settle, 420);
};

export default function MobileKeyboardRecovery() {
  useEffect(() => {
    const setViewportVars = () => {
      if (typeof window === 'undefined' || typeof document === 'undefined') return;
      const height = Math.round(window.visualViewport?.height || window.innerHeight || 0);
      if (height > 0) {
        document.documentElement.style.setProperty('--app-visual-height', `${height}px`);
      }
    };

    setViewportVars();
    window.visualViewport?.addEventListener('resize', setViewportVars);
    window.visualViewport?.addEventListener('scroll', setViewportVars);
    window.addEventListener('resize', setViewportVars);

    return () => {
      window.visualViewport?.removeEventListener('resize', setViewportVars);
      window.visualViewport?.removeEventListener('scroll', setViewportVars);
      window.removeEventListener('resize', setViewportVars);
    };
  }, []);

  useEffect(() => {
    if (!isIOSStandalone()) return;

    const onKeyDown = (event) => {
      if (event.key === 'Enter') {
        setTimeout(recoverViewport, 40);
        setTimeout(recoverViewport, 300);
      }
    };

    const onFocusOut = () => {
      setTimeout(recoverViewport, 80);
      setTimeout(recoverViewport, 320);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') recoverViewport();
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('focusout', onFocusOut, true);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('focusout', onFocusOut, true);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return null;
}
