'use client';

import { useEffect } from 'react';

const isIOSStandalone = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone === true;
  return isiOS && standalone;
};

const isChatActive = (target = null) => {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.classList.contains('chat-open')) return true;
  return Boolean(target?.closest?.('[data-chat-composer], [data-chat-messages]'));
};

const recoverViewport = (eventTarget = null) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (isChatActive(eventTarget)) return;

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
    if (!isIOSStandalone()) return;

    const onKeyDown = (event) => {
      if (isChatActive(event.target)) return;
      if (event.key === 'Enter') {
        setTimeout(() => recoverViewport(event.target), 40);
        setTimeout(() => recoverViewport(event.target), 300);
      }
    };

    const onFocusOut = (event) => {
      if (isChatActive(event.target)) return;
      setTimeout(() => recoverViewport(event.target), 80);
      setTimeout(() => recoverViewport(event.target), 320);
    };

    const onVisibility = () => {
      if (isChatActive()) return;
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
