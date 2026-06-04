'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
      return undefined;
    }

    let mounted = true;
    let showListener;
    let hideListener;

    const bind = async () => {
      showListener = await Keyboard.addListener('keyboardWillShow', (info) => {
        if (!mounted) return;
        setKeyboardHeight(Number(info.keyboardHeight || 0));
      });

      hideListener = await Keyboard.addListener('keyboardWillHide', () => {
        if (!mounted) return;
        setKeyboardHeight(0);
      });
    };

    bind();

    return () => {
      mounted = false;
      showListener?.remove?.();
      hideListener?.remove?.();
    };
  }, []);

  return keyboardHeight;
}
