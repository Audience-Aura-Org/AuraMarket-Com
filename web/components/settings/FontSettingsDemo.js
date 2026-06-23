"use client";

import { useState, useEffect } from 'react';
import { getFontSize, getFontFamily, FONT_SIZES, FONT_FAMILIES } from '@/utils/fontSettings';

/**
 * Demo component to show current font settings
 * Useful for testing and demonstration
 */
export default function FontSettingsDemo() {
  const [currentFontSize, setCurrentFontSize] = useState('');
  const [currentFontFamily, setCurrentFontFamily] = useState('');

  useEffect(() => {
    // Get initial values
    setCurrentFontSize(getFontSize());
    setCurrentFontFamily(getFontFamily());

    // Listen for changes
    const handleFontSizeChange = () => {
      setCurrentFontSize(getFontSize());
    };

    const handleFontFamilyChange = () => {
      setCurrentFontFamily(getFontFamily());
    };

    window.addEventListener('fontsizechange', handleFontSizeChange);
    window.addEventListener('fontfamilychange', handleFontFamilyChange);

    return () => {
      window.removeEventListener('fontsizechange', handleFontSizeChange);
      window.removeEventListener('fontfamilychange', handleFontFamilyChange);
    };
  }, []);

  const fontSizeLabels = {
    [FONT_SIZES.sm]: 'Small (14px)',
    [FONT_SIZES.md]: 'Medium (16px)',
    [FONT_SIZES.lg]: 'Large (18px)',
    [FONT_SIZES.xl]: 'Extra Large (20px)',
  };

  const fontFamilyLabels = {
    [FONT_FAMILIES.default]: 'Default',
    [FONT_FAMILIES.serif]: 'Serif',
    [FONT_FAMILIES.mono]: 'Mono',
    [FONT_FAMILIES.dyslexic]: 'Dyslexic-friendly',
  };

  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--bg-secondary)]/20 p-4">
      <h3 className="text-sm font-semibold mb-3">Current Font Settings</h3>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-secondary)]">Font Size:</span>
          <span className="text-[12px] font-medium">
            {fontSizeLabels[currentFontSize] || 'Medium (16px)'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[var(--text-secondary)]">Font Family:</span>
          <span className="text-[12px] font-medium">
            {fontFamilyLabels[currentFontFamily] || 'Default'}
          </span>
        </div>
        <div className="mt-4 pt-3 border-t border-[var(--glass-border)]">
          <p className="text-[11px] text-[var(--text-secondary)] opacity-70">
            Click the settings button (bottom right) to customize fonts.
          </p>
        </div>
      </div>
    </div>
  );
}